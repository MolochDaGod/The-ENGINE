import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Users, MessageSquare, Circle, Shield, Share2, Wifi, WifiOff, Check,
  Gamepad2, Mail, UserPlus, Loader2,
} from "lucide-react";
import type { ChatMessage } from "@shared/schema";
import { useAuth } from "@/components/auth-provider";
import { redirectToCanonicalLogin } from "@/lib/canonicalAuth";
import TreatyChannelPicker, { treatyChannelById } from "@/components/treaty/TreatyChannelPicker";
import {
  TREATY_CHANNELS,
  type TreatyIdentity,
  type TreatyWsMessage,
  type TreatyFriend,
  type TreatyDmThread,
  type TreatyGameRoom,
  identityFromPlayer,
  persistGuestName,
  getTreatyWsUrl,
  buildJoinPayload,
  buildSwitchRoomPayload,
  shareTreatyUrl,
  isValidChannelId,
  isValidRoomId,
  roomKind,
  roomLabel,
  gameRoomId,
  sendTreatyHttp,
  fetchTreatyMessages,
  normalizeTreatyMessage,
  fetchTreatyFriends,
  fetchTreatyDms,
  openTreatyDm,
  fetchActiveGameRooms,
  requestFriend,
  acceptFriend,
  fetchPendingFriends,
} from "@/lib/treaty-chat";
import { apiUrl } from "@/lib/api-config";

type HubTab = "channels" | "friends" | "dms" | "games";

function getRandomName(): string {
  const adjectives = ["Shadow", "Crimson", "Phantom", "Golden", "Arcane", "Dark", "Iron", "Storm", "Frost", "Ember"];
  const nouns = ["Knight", "Mage", "Rogue", "Warrior", "Hunter", "Paladin", "Ranger", "Wizard", "Berserker", "Assassin"];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 999)}`;
}

function roomFromSearch(): string {
  if (typeof window === "undefined") return "general";
  const room = new URLSearchParams(window.location.search).get("room");
  if (room && isValidRoomId(room)) return room;
  if (isValidChannelId(room)) return room!;
  return "general";
}

function tabFromRoom(room: string): HubTab {
  const k = roomKind(room);
  if (k === "dm") return "dms";
  if (k === "game") return "games";
  return "channels";
}

function applyUsersPayload(
  data: TreatyWsMessage,
  selfName: string,
  setOnlineUsers: (u: string[]) => void,
) {
  const list = Array.isArray(data.users) ? data.users.filter(Boolean) : [];
  if (list.length === 0 && selfName) {
    setOnlineUsers([selfName]);
    return;
  }
  if (selfName && !list.includes(selfName)) {
    setOnlineUsers([selfName, ...list]);
    return;
  }
  setOnlineUsers(list);
}

export default function Chat() {
  const { player } = useAuth();
  const queryClient = useQueryClient();

  const identity = useMemo(() => identityFromPlayer(player), [player]);
  const [guestName, setGuestName] = useState(() =>
    identity.displayName === "Guest" ? "" : identity.displayName,
  );
  const [hasJoined, setHasJoined] = useState(identity.isVerified);
  const [currentRoom, setCurrentRoom] = useState(roomFromSearch);
  const [hubTab, setHubTab] = useState<HubTab>(() => tabFromRoom(roomFromSearch()));
  const [messages, setMessages] = useState<TreatyWsMessage[]>([]);
  const [input, setInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [friendBusy, setFriendBusy] = useState(false);
  const [dmPeerLabel, setDmPeerLabel] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const intentionalClose = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasJoinedRef = useRef(hasJoined);
  const roomRef = useRef(currentRoom);
  const identityRef = useRef(identity);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  hasJoinedRef.current = hasJoined;
  roomRef.current = currentRoom;

  const activeIdentity: TreatyIdentity = useMemo(() => {
    if (identity.isVerified) return identity;
    return identityFromPlayer(null, guestName);
  }, [identity, guestName]);

  identityRef.current = activeIdentity;

  const label = roomLabel(currentRoom);
  const channelMeta = treatyChannelById(currentRoom);
  const displayName = activeIdentity.displayName || activeIdentity.username || "Guest";
  const kind = roomKind(currentRoom);

  const friendsQ = useQuery({
    queryKey: ["/api/treaty/friends"],
    queryFn: fetchTreatyFriends,
    enabled: hasJoined && !!player,
    refetchInterval: 15_000,
  });
  const dmsQ = useQuery({
    queryKey: ["/api/treaty/dms"],
    queryFn: fetchTreatyDms,
    enabled: hasJoined && !!player,
    refetchInterval: 20_000,
  });
  const gamesQ = useQuery({
    queryKey: ["/api/treaty/games"],
    queryFn: fetchActiveGameRooms,
    enabled: hasJoined,
    refetchInterval: 10_000,
  });
  const pendingQ = useQuery({
    queryKey: ["/api/friends/pending"],
    queryFn: fetchPendingFriends,
    enabled: hasJoined && !!player,
    refetchInterval: 20_000,
  });

  const { data: history = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", currentRoom],
    queryFn: async () => {
      const resp = await fetch(
        apiUrl(`/api/chat/messages?room=${encodeURIComponent(currentRoom)}`),
        { credentials: "include" },
      );
      if (!resp.ok) return [];
      const data = await resp.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    enabled: hasJoined && kind !== "dm",
  });

  useEffect(() => {
    if (!hasJoined) return;
    if (kind === "dm") {
      // DMs use treaty endpoint (auth-gated)
      fetchTreatyMessages(currentRoom).then((rows) => {
        if (rows.length) setMessages(rows);
      });
      return;
    }
    if (!history.length) return;
    const historyMsgs: TreatyWsMessage[] = history.map((m) => ({
      type: "message" as const,
      id: m.id,
      username: m.username,
      displayName: m.username,
      message: m.message,
      room: m.room,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
    }));
    setMessages((prev) => {
      const live = prev.filter((p) => p.type === "message" || p.type === "system");
      const histIds = new Set(historyMsgs.map((h) => h.id).filter(Boolean));
      const extra = live.filter((p) => !p.id || !histIds.has(p.id));
      return [...historyMsgs, ...extra];
    });
  }, [history, hasJoined, currentRoom, kind]);

  // Resolve DM peer label from friends/inbox
  useEffect(() => {
    if (kind !== "dm") {
      setDmPeerLabel(null);
      return;
    }
    const fromDm = (dmsQ.data as TreatyDmThread[] | undefined)?.find((d) => d.room === currentRoom);
    if (fromDm?.peer) {
      setDmPeerLabel(fromDm.peer.displayName || fromDm.peer.username);
      return;
    }
    const fromFriend = (friendsQ.data as TreatyFriend[] | undefined)?.find((f) => f.dmRoom === currentRoom);
    if (fromFriend) {
      setDmPeerLabel(fromFriend.displayName || fromFriend.username || "Friend");
    }
  }, [kind, currentRoom, dmsQ.data, friendsQ.data]);

  const clearReconnect = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };

  const connectWs = useCallback(() => {
    if (!hasJoinedRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    clearReconnect();
    intentionalClose.current = false;
    setWsError(null);

    let url: string;
    try {
      url = getTreatyWsUrl();
    } catch {
      setWsError("Could not resolve chat WebSocket URL");
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      setWsError(`WebSocket create failed: ${e instanceof Error ? e.message : String(e)}`);
      reconnectTimer.current = setTimeout(() => {
        if (hasJoinedRef.current) connectWs();
      }, 3000);
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setWsError(null);
      const id = identityRef.current;
      const room = roomRef.current;
      const self = id.displayName || id.username || "Guest";
      setOnlineUsers((prev) => (prev.includes(self) ? prev : [self, ...prev]));
      try {
        ws.send(JSON.stringify(buildJoinPayload(id, room)));
      } catch {
        setWsError("Failed to send join");
      }
    };

    ws.onmessage = (event) => {
      let data: TreatyWsMessage;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.type === "users" || data.type === "joined") {
        const self =
          identityRef.current.displayName || identityRef.current.username || "Guest";
        applyUsersPayload(data, self, setOnlineUsers);
      } else if (data.type === "message" || data.type === "system") {
        // Only append if for current room (or system without room)
        if (data.room && data.room !== roomRef.current && data.type === "message") return;
        setMessages((prev) => {
          if (data.id && prev.some((p) => p.id === data.id)) return prev;
          return [...prev, data];
        });
      } else if (data.type === "dm_notify") {
        queryClient.invalidateQueries({ queryKey: ["/api/treaty/dms"] });
      } else if (data.type === "error") {
        setWsError(data.message || "Chat error");
      }
    };

    ws.onerror = () => {
      setWsError(`Chat socket error (${url})`);
    };

    ws.onclose = () => {
      setConnected(false);
      const self =
        identityRef.current.displayName || identityRef.current.username || "Guest";
      setOnlineUsers((prev) => (prev.length ? prev : self ? [self] : []));
      wsRef.current = null;
      if (!intentionalClose.current && hasJoinedRef.current) {
        reconnectTimer.current = setTimeout(() => {
          if (hasJoinedRef.current) connectWs();
        }, 2500);
      }
    };
  }, [queryClient]);

  useEffect(() => {
    if (!hasJoined) return;
    connectWs();
    return () => {
      intentionalClose.current = true;
      clearReconnect();
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* */ }
        wsRef.current = null;
      }
    };
  }, [hasJoined, connectWs]);

  useEffect(() => {
    if (!hasJoined) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      setOnlineUsers([displayName]);
      ws.send(JSON.stringify(buildSwitchRoomPayload(currentRoom)));
    }
  }, [currentRoom, hasJoined, displayName]);

  useEffect(() => {
    if (!hasJoined || !connected) return;
    const t = window.setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: "heartbeat" })); } catch { /* */ }
      }
    }, 20_000);
    return () => window.clearInterval(t);
  }, [hasJoined, connected]);

  useEffect(() => {
    if (!hasJoined) return;
    let cancelled = false;
    const poll = async () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      try {
        const rows = await fetchTreatyMessages(currentRoom);
        if (cancelled || !rows.length) return;
        setMessages((prev) => {
          const keys = new Set(prev.map((p) => `${p.id ?? ""}|${p.createdAt ?? ""}|${p.message ?? ""}`));
          const next = [...prev];
          for (const m of rows) {
            const k = `${m.id ?? ""}|${m.createdAt ?? ""}|${m.message ?? ""}`;
            if (!keys.has(k)) {
              keys.add(k);
              next.push(m);
            }
          }
          return next;
        });
      } catch { /* */ }
    };
    poll();
    const t = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [hasJoined, currentRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (player && !hasJoined) setHasJoined(true);
  }, [player, hasJoined]);

  useEffect(() => {
    if (!hasJoined || !identity.isVerified) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(buildJoinPayload(identity, roomRef.current)));
    }
  }, [hasJoined, identity.isVerified, identity.grudgeId, identity.displayName]);

  const selectRoom = (roomId: string, tab?: HubTab) => {
    if (!isValidRoomId(roomId) && !isValidChannelId(roomId)) return;
    setCurrentRoom(roomId);
    setMessages([]);
    setHubTab(tab ?? tabFromRoom(roomId));
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    window.history.replaceState({}, "", url.toString());
  };

  const handleJoin = (roomId?: string) => {
    const name = guestName.trim() || getRandomName();
    persistGuestName(name);
    setGuestName(name);
    if (roomId && (isValidChannelId(roomId) || isValidRoomId(roomId))) setCurrentRoom(roomId);
    setHasJoined(true);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    inputRef.current?.focus();

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "message", message: text }));
        return;
      } catch {
        setWsError("Send failed on live socket — trying HTTP…");
      }
    }

    try {
      const result = await sendTreatyHttp(currentRoom, text, activeIdentity);
      const m = result?.message as Parameters<typeof normalizeTreatyMessage>[0] | undefined;
      const normalized = m
        ? normalizeTreatyMessage({ ...m, room: currentRoom })
        : {
            type: "message" as const,
            grudgeId: activeIdentity.grudgeId,
            username: activeIdentity.username,
            displayName: activeIdentity.displayName,
            message: text,
            room: currentRoom,
            createdAt: new Date().toISOString(),
          };
      if (!normalized.message) normalized.message = text;
      if (!normalized.displayName) normalized.displayName = activeIdentity.displayName;
      setMessages((prev) => {
        if (normalized.id && prev.some((p) => p.id === normalized.id)) return prev;
        return [...prev, normalized];
      });
      setWsError(null);
      if (kind === "dm") queryClient.invalidateQueries({ queryKey: ["/api/treaty/dms"] });
    } catch {
      setWsError("Send failed — chat backend unreachable");
      setMessages((prev) => [
        ...prev,
        { type: "system", message: "Message not delivered. Retry in a moment.", room: currentRoom },
      ]);
    }
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(shareTreatyUrl(currentRoom));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMessageFriend = async (f: TreatyFriend) => {
    if (!player) {
      redirectToCanonicalLogin(`/chat?room=${currentRoom}`);
      return;
    }
    if (f.dmRoom) {
      selectRoom(f.dmRoom, "dms");
      return;
    }
    const opened = await openTreatyDm({ userId: f.id, username: f.username, grudgeId: f.grudgeId });
    if (opened?.room) selectRoom(opened.room, "dms");
  };

  const handleAddFriend = async () => {
    const q = friendQuery.trim();
    if (!q || !player) return;
    setFriendBusy(true);
    try {
      if (/^\d+$/.test(q)) {
        await requestFriend({ userId: Number(q) });
      } else {
        await requestFriend({ username: q });
      }
      setFriendQuery("");
      friendsQ.refetch();
      pendingQ.refetch();
    } catch (e) {
      setWsError(e instanceof Error ? e.message : "Friend request failed");
    } finally {
      setFriendBusy(false);
    }
  };

  const titleName =
    kind === "dm"
      ? dmPeerLabel || "Direct message"
      : kind === "game"
        ? label.name
        : channelMeta?.name || label.name;

  if (!hasJoined) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "hsl(225,30%,6%)" }}>
        <div className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
          <div className="fantasy-panel p-6 sm:p-8 mb-6 text-center">
            <MessageSquare className="w-12 h-12 text-[hsl(43,85%,55%)] mx-auto mb-3" />
            <h1 className="text-3xl font-heading gold-text mb-2">Treaty</h1>
            <p className="text-[hsl(45,15%,55%)] font-body text-sm max-w-md mx-auto">
              Social layer for Grudge Studio — public channels, friends, DMs, and live chat inside every game.
            </p>
          </div>

          <div className="fantasy-panel p-5 mb-6">
            <h2 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider mb-3">
              Pick a channel to enter
            </h2>
            <TreatyChannelPicker
              currentRoom={isValidChannelId(currentRoom) ? currentRoom : "general"}
              onSelect={(id) => {
                setCurrentRoom(id);
                const url = new URL(window.location.href);
                url.searchParams.set("room", id);
                window.history.replaceState({}, "", url.toString());
              }}
              layout="grid"
            />
          </div>

          <div className="fantasy-panel p-6 space-y-4">
            <Button
              className="w-full gilded-button h-11"
              onClick={() => redirectToCanonicalLogin(`/chat?room=${currentRoom}`)}
            >
              <Shield className="w-4 h-4 mr-2" /> Sign in with Grudge ID
            </Button>
            <p className="text-[10px] text-center text-[hsl(45,15%,45%)] font-body">
              Sign in to use friends, DMs, and cross-game presence. Guests can still use public channels.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[hsl(43,60%,30%)]/30" />
              <span className="text-[10px] text-[hsl(45,15%,40%)] font-body uppercase">or guest</span>
              <div className="flex-1 h-px bg-[hsl(43,60%,30%)]/30" />
            </div>
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Guest display name (optional)…"
              className="bg-[hsl(225,25%,15%)] border-[hsl(43,60%,30%)]/30 text-[hsl(45,30%,90%)] text-center"
              maxLength={30}
            />
            <Button onClick={() => handleJoin(currentRoom)} variant="outline" className="w-full h-11">
              Enter #{titleName} as Guest
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const tabBtn = (id: HubTab, icon: ReactNode, text: string, badge?: number) => (
    <button
      type="button"
      key={id}
      onClick={() => setHubTab(id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body border transition-all ${
        hubTab === id
          ? "border-[hsl(43,70%,45%)] bg-[hsl(43,50%,20%)]/30 text-[hsl(43,85%,65%)]"
          : "border-transparent text-[hsl(45,15%,50%)] hover:text-[hsl(45,30%,80%)]"
      }`}
    >
      {icon}
      {text}
      {badge != null && badge > 0 && (
        <span className="ml-0.5 text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-400">{badge}</span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(225,30%,6%)" }}>
      <div className="sticky top-16 z-40 border-b border-[hsl(43,60%,30%)]/25 bg-[hsl(225,30%,7%)]/95 backdrop-blur-md px-3 sm:px-4 py-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-lg">{label.icon}</span>
            <span className="text-sm font-heading text-[hsl(43,85%,65%)]">Treaty</span>
            <Badge
              variant="outline"
              className={`text-[10px] ml-1 ${connected ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-400"}`}
            >
              {connected ? <><Wifi className="w-2.5 h-2.5 mr-1 inline" />Live</> : <><WifiOff className="w-2.5 h-2.5 mr-1 inline" />Reconnecting</>}
            </Badge>
            <span className="text-[10px] text-[hsl(45,15%,45%)] hidden sm:inline">
              Online {onlineUsers.length}
            </span>
            <div className="flex-1" />
            <button type="button" onClick={handleShare} className="text-[hsl(45,15%,50%)] hover:text-[hsl(43,85%,55%)] p-1" title="Copy invite link">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-1">
            {tabBtn("channels", <MessageSquare className="w-3 h-3" />, "Channels")}
            {tabBtn("friends", <Users className="w-3 h-3" />, "Friends", friendsQ.data?.filter((f) => f.isOnline).length)}
            {tabBtn("dms", <Mail className="w-3 h-3" />, "DMs", dmsQ.data?.length)}
            {tabBtn("games", <Gamepad2 className="w-3 h-3" />, "In-game", gamesQ.data?.length)}
          </div>
          {wsError && (
            <p className="text-[10px] text-amber-400/90 font-body mb-1 truncate" title={wsError}>
              {wsError}
            </p>
          )}
          {hubTab === "channels" && (
            <TreatyChannelPicker
              currentRoom={isValidChannelId(currentRoom) ? currentRoom : "general"}
              onSelect={(id) => selectRoom(id, "channels")}
              layout="bar"
            />
          )}
        </div>
      </div>

      <div className="flex-1 flex max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 gap-3 min-h-0">
        {/* Left rail */}
        <div className="hidden lg:flex flex-col w-72 shrink-0 gap-3">
          {hubTab === "channels" && (
            <div className="fantasy-panel p-4 flex-1 overflow-y-auto">
              <h3 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider mb-3">Channels</h3>
              <TreatyChannelPicker
                currentRoom={isValidChannelId(currentRoom) ? currentRoom : "general"}
                onSelect={(id) => selectRoom(id, "channels")}
                layout="sidebar"
              />
            </div>
          )}

          {hubTab === "friends" && (
            <div className="fantasy-panel p-4 flex-1 overflow-y-auto space-y-3">
              <h3 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider">Friends</h3>
              {!player ? (
                <p className="text-xs text-[hsl(45,15%,50%)] font-body">
                  <button type="button" className="text-[hsl(43,85%,55%)] underline" onClick={() => redirectToCanonicalLogin("/chat")}>
                    Sign in
                  </button>{" "}
                  to manage friends.
                </p>
              ) : (
                <>
                  <div className="flex gap-1">
                    <Input
                      value={friendQuery}
                      onChange={(e) => setFriendQuery(e.target.value)}
                      placeholder="Username…"
                      className="h-8 text-xs bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/20"
                      onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
                    />
                    <Button size="sm" className="h-8 gilded-button px-2" disabled={friendBusy || !friendQuery.trim()} onClick={handleAddFriend}>
                      {friendBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                    </Button>
                  </div>
                  {(pendingQ.data?.length ?? 0) > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-[hsl(45,15%,45%)] uppercase">Pending</p>
                      {pendingQ.data!.map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-xs gap-2">
                          <span>{r.from?.displayName || r.from?.username || "Player"}</span>
                          <Button size="sm" className="h-6 text-[10px] gilded-button" onClick={async () => {
                            await acceptFriend(r.id);
                            pendingQ.refetch();
                            friendsQ.refetch();
                          }}>Accept</Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {friendsQ.isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[hsl(43,85%,55%)]" />
                  ) : !(friendsQ.data?.length) ? (
                    <p className="text-[11px] text-[hsl(45,15%,45%)] font-body">No friends yet. Add by username or message someone from chat.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {(friendsQ.data as TreatyFriend[]).map((f) => (
                        <li key={f.friendshipId || f.id} className="flex items-center gap-2 text-sm">
                          <Circle className={`w-2 h-2 ${f.isOnline ? "fill-emerald-400 text-emerald-400" : "fill-[hsl(45,15%,30%)] text-[hsl(45,15%,30%)]"}`} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[hsl(45,30%,88%)]">{f.displayName || f.username}</div>
                            {f.gameKey && (
                              <div className="text-[9px] text-[hsl(45,15%,45%)] truncate">in {f.gameKey}</div>
                            )}
                          </div>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleMessageFriend(f)}>
                            DM
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {hubTab === "dms" && (
            <div className="fantasy-panel p-4 flex-1 overflow-y-auto space-y-2">
              <h3 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider mb-2">Direct messages</h3>
              {!player ? (
                <p className="text-xs text-[hsl(45,15%,50%)]">Sign in to use DMs.</p>
              ) : dmsQ.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : !(dmsQ.data?.length) ? (
                <p className="text-[11px] text-[hsl(45,15%,45%)] font-body">No conversations yet. Open a DM from Friends.</p>
              ) : (
                (dmsQ.data as TreatyDmThread[]).map((d) => (
                  <button
                    key={d.room}
                    type="button"
                    onClick={() => selectRoom(d.room, "dms")}
                    className={`w-full text-left p-2 rounded-lg border transition-all ${
                      currentRoom === d.room
                        ? "border-[hsl(43,70%,45%)] bg-[hsl(43,40%,15%)]/40"
                        : "border-[hsl(43,60%,30%)]/15 hover:bg-[hsl(225,25%,12%)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Circle className={`w-2 h-2 ${d.peer?.isOnline ? "fill-emerald-400 text-emerald-400" : "fill-[hsl(45,15%,30%)] text-[hsl(45,15%,30%)]"}`} />
                      <span className="text-sm text-[hsl(45,30%,90%)] truncate">
                        {d.peer?.displayName || d.peer?.username || "Player"}
                      </span>
                    </div>
                    <p className="text-[10px] text-[hsl(45,15%,45%)] truncate mt-0.5 pl-4">{d.lastMessage}</p>
                  </button>
                ))
              )}
            </div>
          )}

          {hubTab === "games" && (
            <div className="fantasy-panel p-4 flex-1 overflow-y-auto space-y-2">
              <h3 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider mb-2">Live game chats</h3>
              <p className="text-[10px] text-[hsl(45,15%,45%)] font-body mb-2">
                Every fleet game can join <code className="text-[hsl(43,70%,55%)]">game:slug</code> via bootstrap.
              </p>
              {gamesQ.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : !(gamesQ.data?.length) ? (
                <p className="text-[11px] text-[hsl(45,15%,45%)]">No active game rooms right now.</p>
              ) : (
                (gamesQ.data as TreatyGameRoom[]).map((g) => (
                  <button
                    key={g.room}
                    type="button"
                    onClick={() => selectRoom(g.room, "games")}
                    className={`w-full text-left p-2 rounded-lg border ${
                      currentRoom === g.room
                        ? "border-[hsl(43,70%,45%)] bg-[hsl(43,40%,15%)]/40"
                        : "border-[hsl(43,60%,30%)]/15 hover:bg-[hsl(225,25%,12%)]"
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-sm text-[hsl(45,30%,90%)] truncate">{g.gameTitle || g.gameKey}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0">{g.online} online</Badge>
                    </div>
                  </button>
                ))
              )}
              <div className="pt-2 border-t border-[hsl(43,60%,30%)]/15 space-y-1">
                <p className="text-[10px] text-[hsl(45,15%,45%)]">Jump to game room</p>
                {["avernus-3d", "mage-arena", "wargus", "terraforge", "grudge-brawl"].map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    className="block w-full text-left text-[11px] text-[hsl(43,85%,55%)] hover:underline font-body"
                    onClick={() => selectRoom(gameRoomId(slug), "games")}
                  >
                    #{slug}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="fantasy-panel p-3">
            <h3 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider mb-2">
              <Users className="w-3 h-3 inline mr-1" /> Online ({onlineUsers.length})
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {!connected ? (
                <p className="text-[10px] text-amber-400/80 font-body">Connecting…</p>
              ) : onlineUsers.length === 0 ? (
                <p className="text-[10px] text-[hsl(45,15%,45%)] font-body">Waiting for roster…</p>
              ) : (
                onlineUsers.map((user) => (
                  <div key={user} className="flex items-center gap-2 text-sm text-[hsl(45,30%,80%)] font-body px-1">
                    <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" />
                    <span className={user === displayName ? "text-[hsl(43,85%,55%)] font-medium" : ""}>{user}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main thread */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="fantasy-panel px-4 py-3 mb-3 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-base font-heading text-[hsl(45,30%,92%)] flex items-center gap-2">
                <span>{label.icon}</span>
                {kind === "dm" ? dmPeerLabel || "DM" : kind === "game" ? `#${titleName}` : `#${titleName}`}
                {kind !== "community" && (
                  <Badge variant="outline" className="text-[9px] uppercase">{kind}</Badge>
                )}
              </h2>
              <p className="text-xs text-[hsl(45,15%,50%)] font-body mt-0.5">
                {kind === "dm"
                  ? "Private conversation — only you two"
                  : kind === "game"
                    ? "Live channel for this game (all clients share it)"
                    : label.description}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {activeIdentity.isVerified ? (
                <Badge variant="outline" className="text-[10px] border-[hsl(270,50%,40%)]/30 text-[hsl(270,60%,70%)]">
                  <Shield className="w-2.5 h-2.5 mr-1" />
                  {activeIdentity.grudgeId?.slice(0, 8)}…
                </Badge>
              ) : (
                <button
                  type="button"
                  onClick={() => redirectToCanonicalLogin(`/chat?room=${currentRoom}`)}
                  className="text-[10px] text-[hsl(43,85%,55%)] hover:underline font-body"
                >
                  Verify with Grudge ID
                </button>
              )}
              <span className="text-xs text-[hsl(45,15%,45%)] font-body hidden sm:inline">{displayName}</span>
            </div>
          </div>

          <div className="fantasy-panel flex-1 flex flex-col min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-1">
                {messages.length === 0 && (
                  <div className="text-center py-12 px-4">
                    <span className="text-4xl block mb-3">{label.icon}</span>
                    <p className="text-sm text-[hsl(45,30%,80%)] font-body">
                      {kind === "dm" ? "Say hello — this is private." : `#${titleName} is quiet.`}
                    </p>
                    <p className="text-xs text-[hsl(45,15%,50%)] font-body mt-1">Be the first to break the ice.</p>
                  </div>
                )}
                {messages.map((msg, i) => {
                  if (msg.type === "system") {
                    return (
                      <div key={`sys-${i}-${msg.message?.slice(0, 12)}`} className="text-center py-1">
                        <span className="text-[10px] text-[hsl(45,15%,35%)] font-body italic">{msg.message}</span>
                      </div>
                    );
                  }

                  const name = msg.displayName || msg.username || "?";
                  const isOwn = name === displayName;

                  return (
                    <div key={msg.id || `msg-${i}`} className="flex gap-3 py-1.5 hover:bg-[hsl(225,25%,12%)]/50 px-2 rounded group">
                      <div
                        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                        style={{
                          background: `hsl(${(name.charCodeAt(0) * 37) % 360}, 50%, 25%)`,
                          color: `hsl(${(name.charCodeAt(0) * 37) % 360}, 60%, 70%)`,
                        }}
                      >
                        {name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${isOwn ? "text-[hsl(43,85%,55%)]" : "text-[hsl(45,30%,85%)]"}`}>
                            {name}
                          </span>
                          {msg.grudgeId && (
                            <span title="Grudge ID verified" className="inline-flex">
                              <Shield className="w-3 h-3 text-[hsl(270,60%,60%)]" aria-hidden />
                            </span>
                          )}
                          {!isOwn && player && msg.username && kind === "community" && (
                            <button
                              type="button"
                              className="text-[9px] text-[hsl(45,15%,45%)] opacity-0 group-hover:opacity-100 hover:text-[hsl(43,85%,55%)]"
                              onClick={async () => {
                                try {
                                  await requestFriend({ username: msg.username });
                                  setWsError(null);
                                  friendsQ.refetch();
                                } catch (e) {
                                  setWsError(e instanceof Error ? e.message : "Friend request failed");
                                }
                              }}
                            >
                              + friend
                            </button>
                          )}
                          <span className="text-[10px] text-[hsl(45,15%,35%)] opacity-0 group-hover:opacity-100 transition-opacity">
                            {msg.createdAt
                              ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : ""}
                          </span>
                        </div>
                        <p className="text-sm text-[hsl(45,30%,80%)] font-body break-words">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-3 border-t border-[hsl(43,60%,30%)]/15 shrink-0">
              {kind === "dm" && !player ? (
                <Button className="w-full gilded-button" onClick={() => redirectToCanonicalLogin(`/chat?room=${currentRoom}`)}>
                  Sign in to send DMs
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder={
                      connected
                        ? kind === "dm"
                          ? `Message ${dmPeerLabel || "friend"}…`
                          : `Message #${titleName}…`
                        : `Message #${titleName} (offline queue)…`
                    }
                    className="bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/20 text-[hsl(45,30%,90%)] placeholder:text-[hsl(45,15%,30%)] focus:border-[hsl(43,85%,55%)]/40"
                    maxLength={500}
                    autoFocus
                  />
                  <Button onClick={handleSend} disabled={!input.trim()} className="gilded-button px-4" size="icon">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-[hsl(45,15%,38%)] font-body mt-1.5 hidden sm:block">
                Treaty = channels · friends · DMs · in-game rooms · live WS presence
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
