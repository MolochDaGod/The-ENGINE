import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Users, MessageSquare, Circle, Shield, Share2, Wifi, WifiOff, Check } from "lucide-react";
import type { ChatMessage } from "@shared/schema";
import { useAuth } from "@/components/auth-provider";
import { redirectToCanonicalLogin } from "@/lib/canonicalAuth";
import TreatyChannelPicker, { treatyChannelById } from "@/components/treaty/TreatyChannelPicker";
import {
  TREATY_CHANNELS,
  type TreatyIdentity,
  type TreatyWsMessage,
  identityFromPlayer,
  persistGuestName,
  getTreatyWsUrl,
  buildJoinPayload,
  buildSwitchRoomPayload,
  shareTreatyUrl,
  isValidChannelId,
  sendTreatyHttp,
  fetchTreatyMessages,
} from "@/lib/treaty-chat";

function getRandomName(): string {
  const adjectives = ["Shadow", "Crimson", "Phantom", "Golden", "Arcane", "Dark", "Iron", "Storm", "Frost", "Ember"];
  const nouns = ["Knight", "Mage", "Rogue", "Warrior", "Hunter", "Paladin", "Ranger", "Wizard", "Berserker", "Assassin"];
  const num = Math.floor(Math.random() * 999);
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${num}`;
}

function roomFromSearch(): string {
  if (typeof window === "undefined") return "general";
  const room = new URLSearchParams(window.location.search).get("room");
  return isValidChannelId(room) ? room : "general";
}

function applyUsersPayload(
  data: TreatyWsMessage,
  selfName: string,
  setOnlineUsers: (u: string[]) => void,
) {
  const list = Array.isArray(data.users) ? data.users.filter(Boolean) : [];
  // Always show self if server list is empty but we're joined
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

  const identity = useMemo(() => identityFromPlayer(player), [player]);
  const [guestName, setGuestName] = useState(() =>
    identity.displayName === "Guest" ? "" : identity.displayName,
  );
  const [hasJoined, setHasJoined] = useState(identity.isVerified);
  const [currentRoom, setCurrentRoom] = useState(roomFromSearch);
  const [messages, setMessages] = useState<TreatyWsMessage[]>([]);
  const [input, setInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const activeChannel = treatyChannelById(currentRoom) ?? TREATY_CHANNELS[0];
  const displayName = activeIdentity.displayName || activeIdentity.username || "Guest";

  const { data: history = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", currentRoom],
    queryFn: async () => {
      const resp = await fetch(`/api/chat/messages?room=${encodeURIComponent(currentRoom)}`, {
        credentials: "include",
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: hasJoined,
  });

  // Seed history without wiping live WS messages that arrived first
  useEffect(() => {
    if (!hasJoined) return;
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
  }, [history, hasJoined, currentRoom]);

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
    } catch (e) {
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
      // Optimistic self so Online is never stuck at 0 after a successful open
      const self = id.displayName || id.username || "Guest";
      setOnlineUsers((prev) => (prev.includes(self) ? prev : [self, ...prev]));
      try {
        ws.send(JSON.stringify(buildJoinPayload(id, room)));
      } catch (err) {
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
        applyUsersPayload(data, identityRef.current.displayName || identityRef.current.username, setOnlineUsers);
        if (data.type === "joined" && data.room) {
          // keep room in sync if server normalized it
        }
      } else if (data.type === "message" || data.type === "system") {
        setMessages((prev) => [...prev, data]);
      } else if (data.type === "error") {
        setWsError(data.message || "Chat error");
      }
    };

    ws.onerror = () => {
      setWsError(`Chat socket error (${url})`);
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (!intentionalClose.current && hasJoinedRef.current) {
        reconnectTimer.current = setTimeout(() => {
          if (hasJoinedRef.current) connectWs();
        }, 2500);
      }
    };
  }, []);

  // Connect once on join; reconnect handled inside onclose
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

  // Room change: switch_room on open socket; do not tear down WS (was zeroing presence)
  useEffect(() => {
    if (!hasJoined) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      setOnlineUsers([displayName]);
      ws.send(JSON.stringify(buildSwitchRoomPayload(currentRoom)));
    }
  }, [currentRoom, hasJoined, displayName]);

  // Poll HTTP history while socket is offline so guests still see traffic
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
      } catch {
        /* ignore */
      }
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

  // If verified identity arrives after guest join, re-announce join with real name
  useEffect(() => {
    if (!hasJoined || !identity.isVerified) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(buildJoinPayload(identity, roomRef.current)));
    }
  }, [hasJoined, identity.isVerified, identity.grudgeId, identity.displayName]);

  const handleJoin = (roomId?: string) => {
    const name = guestName.trim() || getRandomName();
    persistGuestName(name);
    setGuestName(name);
    if (roomId && isValidChannelId(roomId)) setCurrentRoom(roomId);
    setHasJoined(true);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    inputRef.current?.focus();

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "message", message: text }));
      return;
    }

    // HTTP fallback when WebSocket is down (still persists + shows locally)
    try {
      const result = await sendTreatyHttp(currentRoom, text, activeIdentity);
      const m = (result as { message?: TreatyWsMessage & { text?: string; ts?: string } })?.message;
      setMessages((prev) => [
        ...prev,
        {
          type: "message",
          id: typeof m?.id === "number" ? m.id : undefined,
          grudgeId: m?.grudgeId ?? activeIdentity.grudgeId,
          username: m?.username || activeIdentity.username,
          displayName: m?.displayName || activeIdentity.displayName,
          message: m?.message || m?.text || text,
          room: currentRoom,
          createdAt: m?.createdAt || m?.ts || new Date().toISOString(),
        },
      ]);
      setWsError(null);
    } catch {
      setWsError("Send failed — chat backend unreachable");
      setMessages((prev) => [
        ...prev,
        { type: "system", message: "Message not delivered. Retry in a moment.", room: currentRoom },
      ]);
    }
  };

  const handleSwitchRoom = (roomId: string) => {
    if (roomId === currentRoom) return;
    setCurrentRoom(roomId);
    setMessages([]);
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    window.history.replaceState({}, "", url.toString());
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(shareTreatyUrl(currentRoom));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!hasJoined) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "hsl(225,30%,6%)" }}>
        <div className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
          <div className="fantasy-panel p-6 sm:p-8 mb-6 text-center">
            <MessageSquare className="w-12 h-12 text-[hsl(43,85%,55%)] mx-auto mb-3" />
            <h1 className="text-3xl font-heading gold-text mb-2">Treaty Chat</h1>
            <p className="text-[hsl(45,15%,55%)] font-body text-sm max-w-md mx-auto">
              Six live channels for builders, players, and traders. Sign in with Grudge ID for a verified badge.
            </p>
          </div>

          <div className="fantasy-panel p-5 mb-6">
            <h2 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider mb-3">
              Pick a channel to enter
            </h2>
            <TreatyChannelPicker
              currentRoom={currentRoom}
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
              Enter #{activeChannel.name} as Guest
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(225,30%,6%)" }}>
      <div className="sticky top-16 z-40 border-b border-[hsl(43,60%,30%)]/25 bg-[hsl(225,30%,7%)]/95 backdrop-blur-md px-3 sm:px-4 py-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{activeChannel.icon}</span>
            <span className="text-sm font-heading text-[hsl(43,85%,65%)]">Treaty Chat</span>
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
          {wsError && (
            <p className="text-[10px] text-amber-400/90 font-body mb-1 truncate" title={wsError}>
              {wsError}
            </p>
          )}
          <TreatyChannelPicker currentRoom={currentRoom} onSelect={handleSwitchRoom} layout="bar" />
        </div>
      </div>

      <div className="flex-1 flex max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 gap-3 min-h-0">
        <div className="hidden lg:flex flex-col w-64 shrink-0">
          <div className="fantasy-panel p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider mb-3">
              Channels
            </h3>
            <TreatyChannelPicker currentRoom={currentRoom} onSelect={handleSwitchRoom} layout="sidebar" />
          </div>

          <div className="fantasy-panel p-3 mt-3">
            <h3 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider mb-2">
              <Users className="w-3 h-3 inline mr-1" /> Online ({onlineUsers.length})
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {!connected ? (
                <p className="text-[10px] text-amber-400/80 font-body">Connecting to presence…</p>
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

        <div className="flex-1 flex flex-col min-h-0">
          <div className="fantasy-panel px-4 py-3 mb-3 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-base font-heading text-[hsl(45,30%,92%)] flex items-center gap-2">
                <span>{activeChannel.icon}</span>
                #{activeChannel.name}
              </h2>
              <p className="text-xs text-[hsl(45,15%,50%)] font-body mt-0.5">{activeChannel.description}</p>
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
                    <span className="text-4xl block mb-3">{activeChannel.icon}</span>
                    <p className="text-sm text-[hsl(45,30%,80%)] font-body">#{activeChannel.name} is quiet.</p>
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
                          background: `hsl(${name.charCodeAt(0) * 37 % 360}, 50%, 25%)`,
                          color: `hsl(${name.charCodeAt(0) * 37 % 360}, 60%, 70%)`,
                        }}
                      >
                        {name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${isOwn ? "text-[hsl(43,85%,55%)]" : "text-[hsl(45,30%,85%)]"}`}>
                            {name}
                          </span>
                          {msg.grudgeId && (
                            <Shield className="w-3 h-3 text-[hsl(270,60%,60%)]" title="Grudge ID verified" />
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
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={connected ? `Message #${activeChannel.name}…` : "Connecting…"}
                  className="bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/20 text-[hsl(45,30%,90%)] placeholder:text-[hsl(45,15%,30%)] focus:border-[hsl(43,85%,55%)]/40"
                  maxLength={500}
                  disabled={!connected}
                  autoFocus
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || !connected}
                  className="gilded-button px-4"
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-[hsl(45,15%,38%)] font-body mt-1.5 hidden sm:block">
                Enter to send · Presence is live WebSocket roster (not DB last_seen)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
