import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Users, Hash, MessageSquare, Circle } from "lucide-react";
import type { ChatMessage } from "@shared/schema";

interface ChatRoom {
  id: string;
  name: string;
  description: string;
}

interface WsMessage {
  type: "message" | "system" | "users";
  id?: number;
  username?: string;
  message?: string;
  room?: string;
  createdAt?: string;
  users?: string[];
}

const USERNAME_KEY = "rec0ded88_chat_username";

function getRandomName(): string {
  const adjectives = ["Shadow", "Crimson", "Phantom", "Golden", "Arcane", "Dark", "Iron", "Storm", "Frost", "Ember"];
  const nouns = ["Knight", "Mage", "Rogue", "Warrior", "Hunter", "Paladin", "Ranger", "Wizard", "Berserker", "Assassin"];
  const num = Math.floor(Math.random() * 999);
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${num}`;
}

export default function Chat() {
  const [username, setUsername] = useState(() => {
    return localStorage.getItem(USERNAME_KEY) || "";
  });
  const [usernameInput, setUsernameInput] = useState(username);
  const [hasJoined, setHasJoined] = useState(!!username);
  const [currentRoom, setCurrentRoom] = useState("general");
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [input, setInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: rooms = [] } = useQuery<ChatRoom[]>({
    queryKey: ["/api/chat/rooms"],
  });

  const { data: history = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", currentRoom],
    queryFn: async () => {
      const resp = await fetch(`/api/chat/messages?room=${currentRoom}`);
      return resp.json();
    },
    enabled: hasJoined,
  });

  useEffect(() => {
    if (history.length > 0 && hasJoined) {
      const historyMsgs: WsMessage[] = history.map((m) => ({
        type: "message" as const,
        id: m.id,
        username: m.username,
        message: m.message,
        room: m.room,
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
      }));
      setMessages(historyMsgs);
    }
  }, [history, hasJoined]);

  const connectWs = useCallback(() => {
    if (!username || wsRef.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "join", username, room: currentRoom }));
    };

    ws.onmessage = (event) => {
      const data: WsMessage = JSON.parse(event.data);
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
  }, [username, currentRoom, hasJoined]);

  useEffect(() => {
    if (hasJoined) connectWs();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [hasJoined, connectWs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleJoin = () => {
    const name = usernameInput.trim() || getRandomName();
    setUsername(name);
    setUsernameInput(name);
    localStorage.setItem(USERNAME_KEY, name);
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
    setMessages([]);
    setCurrentRoom(roomId);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "switch_room", room: roomId }));
    }
  };

  const formatTime = (ts?: string) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(225,30%,6%)" }}>
        <div className="w-full max-w-md mx-4">
          <div className="fantasy-panel p-8 text-center">
            <MessageSquare className="w-12 h-12 text-[hsl(43,85%,55%)] mx-auto mb-4" />
            <h1 className="text-2xl font-heading gold-text mb-2">Tavern Chat</h1>
            <p className="text-[hsl(45,15%,55%)] font-body mb-6 text-sm">
              Enter a name to join the conversation. Leave blank for a random name.
            </p>
            <div className="space-y-4">
              <Input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Your display name..."
                className="bg-[hsl(225,25%,15%)] border-[hsl(43,60%,30%)]/30 text-[hsl(45,30%,90%)] placeholder:text-[hsl(45,15%,35%)] text-center"
                maxLength={30}
              />
              <Button onClick={handleJoin} className="w-full gilded-button">
                Enter the Tavern
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(225,30%,6%)" }}>
      <div className="flex-1 flex max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 gap-3 min-h-0">

        <div className="hidden md:flex flex-col w-56 shrink-0 gap-3">
          <div className="fantasy-panel p-3">
            <h3 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider mb-3" style={{ WebkitTextFillColor: "unset" }}>
              <Hash className="w-3 h-3 inline mr-1" /> Rooms
            </h3>
            <div className="space-y-1">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleSwitchRoom(room.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    currentRoom === room.id
                      ? "bg-[hsl(43,85%,55%)]/10 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]/30"
                      : "text-[hsl(45,15%,60%)] hover:bg-[hsl(225,25%,15%)] hover:text-[hsl(45,30%,80%)]"
                  }`}
                >
                  <span className="font-body"># {room.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="fantasy-panel p-3 flex-1">
            <h3 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider mb-3" style={{ WebkitTextFillColor: "unset" }}>
              <Users className="w-3 h-3 inline mr-1" /> Online ({onlineUsers.length})
            </h3>
            <div className="space-y-1">
              {onlineUsers.map((user) => (
                <div key={user} className="flex items-center gap-2 text-sm text-[hsl(45,30%,80%)] font-body px-1">
                  <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" />
                  <span className={user === username ? "text-[hsl(43,85%,55%)]" : ""}>{user}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="fantasy-panel px-4 py-2 mb-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-heading text-[hsl(43,85%,65%)]" style={{ WebkitTextFillColor: "unset" }}>
                # {rooms.find((r) => r.id === currentRoom)?.name || currentRoom}
              </h2>
              <span className="text-xs text-[hsl(45,15%,45%)] font-body hidden sm:inline">
                {rooms.find((r) => r.id === currentRoom)?.description}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  connected
                    ? "border-emerald-500/30 text-emerald-400"
                    : "border-red-500/30 text-red-400"
                }`}
              >
                {connected ? "Connected" : "Reconnecting..."}
              </Badge>
              <span className="text-xs text-[hsl(45,15%,45%)] font-body">{username}</span>
            </div>
          </div>

          <div className="md:hidden fantasy-panel px-3 py-2 mb-3 shrink-0">
            <div className="flex gap-2 overflow-x-auto">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleSwitchRoom(room.id)}
                  className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                    currentRoom === room.id
                      ? "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]/30"
                      : "text-[hsl(45,15%,60%)] hover:text-[hsl(45,30%,80%)]"
                  }`}
                >
                  # {room.name}
                </button>
              ))}
            </div>
          </div>

          <div className="fantasy-panel flex-1 flex flex-col min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-1">
                {messages.map((msg, i) => {
                  if (msg.type === "system") {
                    return (
                      <div key={`sys-${i}`} className="text-center py-1">
                        <span className="text-[10px] text-[hsl(45,15%,35%)] font-body italic">{msg.message}</span>
                      </div>
                    );
                  }

                  const isOwn = msg.username === username;

                  return (
                    <div key={msg.id || `msg-${i}`} className="flex gap-3 py-1.5 hover:bg-[hsl(225,25%,12%)]/50 px-2 rounded group">
                      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                        style={{
                          background: `hsl(${(msg.username || "").charCodeAt(0) * 37 % 360}, 50%, 25%)`,
                          color: `hsl(${(msg.username || "").charCodeAt(0) * 37 % 360}, 60%, 70%)`,
                        }}
                      >
                        {(msg.username || "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-sm font-semibold ${isOwn ? "text-[hsl(43,85%,55%)]" : "text-[hsl(45,30%,85%)]"}`}>
                            {msg.username}
                          </span>
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
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={`Message #${rooms.find((r) => r.id === currentRoom)?.name || currentRoom}...`}
                  className="bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/20 text-[hsl(45,30%,90%)] placeholder:text-[hsl(45,15%,30%)] focus:border-[hsl(43,85%,55%)]/40"
                  maxLength={500}
                  disabled={!connected}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
