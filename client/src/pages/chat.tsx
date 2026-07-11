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
  shareTreatyUrl,
  isValidChannelId,
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

export default function Chat() {
  const { player } = useAuth();

  const identity = useMemo(() => identityFromPlayer(player), [player]);
  const [guestName, setGuestName] = useState(identity.displayName === "Guest" ? "" : identity.displayName);
  const [hasJoined, setHasJoined] = useState(identity.isVerified);
  const [currentRoom, setCurrentRoom] = useState(roomFromSearch);
  const [messages, setMessages] = useState<TreatyWsMessage[]>([]);
  const [input, setInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeIdentity: TreatyIdentity = identity.isVerified
    ? identity
    : identityFromPlayer(null, guestName);

  const activeChannel = treatyChannelById(currentRoom) ?? TREATY_CHANNELS[0];

  const { data: history = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", currentRoom],
    queryFn: async () => {
      const resp = await fetch(`/api/chat/messages?room=${currentRoom}`, { credentials: "include" });
      return resp.json();
    },
    enabled: hasJoined,
  });

  useEffect(() => {
    if (history.length > 0 && hasJoined) {
      const historyMsgs: TreatyWsMessage[] = history.map((m) => ({
        type: "message" as const,
        id: m.id,
        username: m.username,
        displayName: m.username,
        message: m.message,
        room: m.room,
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
      }));
      setMessages(historyMsgs);
    } else if (hasJoined) {
      setMessages([]);
    }
  }, [history, hasJoined, currentRoom]);

  const connectWs = useCallback(() => {
    if (!hasJoined || wsRef.current) return;

    const ws = new WebSocket(getTreatyWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify(buildJoinPayload(activeIdentity, currentRoom)));
    };

    ws.onmessage = (event) => {
      const data: TreatyWsMessage = JSON.parse(event.data);
      if (data.type === "users") {
        setOnlineUsers(data.users || []);
      } else if (data.type === "message" || data.type === "system") {
        setMessages((prev) => [...prev, data]);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      setTimeout(() => {
        if (hasJoined) connectWs();
      }, 3000);
    };
  }, [activeIdentity, currentRoom, hasJoined]);

  useEffect(() => {
    if (hasJoined) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      connectWs();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [hasJoined, currentRoom, connectWs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (player && !hasJoined) setHasJoined(true);
  }, [player, hasJoined]);

  const handleJoin = (roomId?: string) => {
    const name = guestName.trim() || getRandomName();
    persistGuestName(name);
    setGuestName(name);
    if (roomId && isValidChannelId(roomId)) setCurrentRoom(roomId);
    setHasJoined(true);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", message: text }));
    setInput("");
    inputRef.current?.focus();
  };

  const handleSwitchRoom = (roomId: string) => {
    if (roomId === currentRoom) return;
    setCurrentRoom(roomId);
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    window.history.replaceState({}, "", url.toString());
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(shareTreatyUrl(currentRoom));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (ts?: string) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const displayName = activeIdentity.displayName || activeIdentity.username;

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
      {/* Sticky channel bar — always visible */}
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
            <div className="flex-1" />
            <button type="button" onClick={handleShare} className="text-[hsl(45,15%,50%)] hover:text-[hsl(43,85%,55%)] p-1" title="Copy invite link">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
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
              {onlineUsers.length === 0 ? (
                <p className="text-[10px] text-[hsl(45,15%,45%)] font-body">Nobody else here yet — say hi!</p>
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
                      <div key={`sys-${i}`} className="text-center py-1">
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
                            {formatTime(msg.createdAt)}
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
                Enter to send · Grudge ID holders show a verified shield
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}