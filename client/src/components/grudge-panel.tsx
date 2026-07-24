/**
 * GrudgePanel — Right-side sliding account panel
 *
 * A persistent edge tab that opens into a full widget board:
 *   - Profile: Avatar, Grudge ID, GBUX, wallet, stats
 *   - Games: Recent plays, personal bests, quick launch
 *   - Social: Treaty chat, friends, messages
 *   - Activity: GBUX history, score events, updates
 *   - Settings: Edit profile, wallet management, connections
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Award,
  Bell,
  Check,
  ChevronRight,
  ClipboardCopy,
  Coins,
  Edit3,
  Gamepad,
  Globe,
  Loader2,
  LogOut,
  Medal,
  MessageCircle,
  Send,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Unlink,
  User,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useAuthModal } from "@/components/auth-modal";
import { GameCover } from "@/components/game-cover";
import { completeProfile } from "@/lib/player-auth";
import {
  buildJoinPayload,
  buildSwitchRoomPayload,
  getTreatyWsUrl,
  identityFromPlayer,
  TREATY_CHANNELS,
  fetchTreatyFriends,
  type TreatyFriend,
} from "@/lib/treaty-chat";
import TreatyChannelPicker, { treatyChannelById } from "@/components/treaty/TreatyChannelPicker";

// ── Context ──────────────────────────────────────────────────────

interface GrudgePanelContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const GrudgePanelContext = createContext<GrudgePanelContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  activeTab: "profile",
  setActiveTab: () => {},
});

export function useGrudgePanel() {
  return useContext(GrudgePanelContext);
}

// ── Provider ─────────────────────────────────────────────────────

export function GrudgePanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle, activeTab, setActiveTab }),
    [isOpen, open, close, toggle, activeTab, setActiveTab],
  );

  return (
    <GrudgePanelContext.Provider value={value}>
      {children}
      <GrudgePanelSheet />
    </GrudgePanelContext.Provider>
  );
}

// ── Tabs config ──────────────────────────────────────────────────

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "games", label: "Games", icon: Gamepad },
  { id: "social", label: "Social", icon: Users },
  { id: "activity", label: "Activity", icon: Zap },
  { id: "studio", label: "Studio", icon: Globe },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

const DASH = "https://dash.grudge-studio.com";

// ── Sheet ────────────────────────────────────────────────────────

function GrudgePanelSheet() {
  const { isOpen, close, activeTab, setActiveTab } = useGrudgePanel();
  const { player } = useAuth();
  const { open: openAuth } = useAuthModal();

  return (
    <Sheet open={isOpen} onOpenChange={(next) => (!next ? close() : null)}>
      <SheetContent
        side="right"
        className="w-[420px] sm:max-w-[420px] p-0 flex flex-col border-l"
        style={{
          background: "linear-gradient(180deg, hsl(225,32%,9%), hsl(225,30%,6%))",
          borderColor: "rgba(200,153,26,0.25)",
        }}
      >
        <SheetTitle className="sr-only">Grudge Panel</SheetTitle>

        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: "rgba(200,153,26,0.2)", background: "hsl(225,30%,8%)" }}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: "#c8991a" }} />
            <span className="font-heading text-sm tracking-wider" style={{ color: "#c8991a" }}>
              GRUDGE PANEL
            </span>
          </div>
          {player && (
            <span className="text-[10px] font-heading text-[hsl(43,85%,55%)]">
              {Number(player.gbuxBalance || 0).toFixed(0)} ¤
            </span>
          )}
        </div>

        {/* ── Tab bar ── */}
        <div
          className="flex shrink-0 border-b"
          style={{ borderColor: "rgba(200,153,26,0.15)", background: "hsl(225,28%,8%)" }}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors relative"
                style={{
                  color: active ? "#c8991a" : "hsl(45,15%,50%)",
                }}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="text-[9px] uppercase tracking-wider font-heading">{tab.label}</span>
                {active && (
                  <div
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                    style={{ background: "linear-gradient(90deg, transparent, #c8991a, transparent)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {!player ? (
              <div className="text-center py-12">
                <Shield className="w-10 h-10 text-[hsl(43,85%,55%)] mx-auto mb-4 opacity-50" />
                <p className="text-sm text-[hsl(45,15%,60%)] font-body mb-4">
                  Sign in to access your Grudge Panel
                </p>
                <Button
                  className="gilded-button"
                  onClick={() => {
                    close();
                    openAuth({ initialTab: "signin" });
                  }}
                >
                  Sign In
                </Button>
              </div>
            ) : activeTab === "profile" ? (
              <ProfileTab />
            ) : activeTab === "games" ? (
              <GamesTab />
            ) : activeTab === "social" ? (
              <SocialTab />
            ) : activeTab === "activity" ? (
              <ActivityTab />
            ) : activeTab === "studio" ? (
              <StudioTab />
            ) : activeTab === "settings" ? (
              <SettingsTab />
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-[hsl(45,15%,50%)] hover:text-[hsl(43,85%,55%)] transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3" /> : <ClipboardCopy className="w-3 h-3" />}
    </button>
  );
}

function StatBlock({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="text-center">
      <Icon className="w-4 h-4 mx-auto text-[hsl(43,85%,55%)] mb-1" />
      <div className="text-lg font-heading gold-text">{value}</div>
      <div className="text-[10px] text-[hsl(45,15%,60%)] font-body">{label}</div>
    </div>
  );
}

// ── Profile Tab ──────────────────────────────────────────────────

function ProfileTab() {
  const { player } = useAuth();
  if (!player) return null;

  const statsQ = useQuery({
    queryKey: ["/api/me/stats"],
    queryFn: () => fetchJSON<any>("/api/me/stats"),
  });
  const stats = statsQ.data;

  return (
    <div className="space-y-5">
      {/* Identity card */}
      <div
        className="rounded-lg p-4 border"
        style={{
          background: "linear-gradient(145deg, hsl(225,28%,14%), hsl(225,30%,10%))",
          borderColor: "rgba(200,153,26,0.2)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[hsl(225,25%,14%)] border border-[hsl(43,60%,30%)]/40 flex items-center justify-center overflow-hidden shrink-0">
            {player.avatarUrl ? (
              <img src={player.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Sparkles className="w-6 h-6 text-[hsl(43,85%,55%)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-heading text-base text-[hsl(43,85%,65%)]" style={{ WebkitTextFillColor: "unset" }}>
              {player.displayName || player.username}
            </div>
            <div className="text-xs text-[hsl(45,15%,60%)] font-body">@{player.username}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className="text-[9px] border-[hsl(43,60%,30%)]/50 text-[hsl(43,85%,55%)] uppercase px-1.5 py-0"
              >
                {player.role}
              </Badge>
            </div>
          </div>
        </div>

        {/* Grudge ID */}
        <div className="mt-3 flex items-center gap-2 p-2 rounded bg-[hsl(225,30%,6%)] border border-[hsl(225,20%,15%)]">
          <Shield className="w-3 h-3 text-[hsl(43,85%,55%)] shrink-0" />
          <span className="text-xs font-mono text-[hsl(43,85%,65%)] truncate flex-1">{player.grudgeId}</span>
          <CopyButton text={player.grudgeId} />
        </div>
      </div>

      {/* GBUX Balance */}
      <div
        className="rounded-lg p-3 border flex items-center justify-between"
        style={{
          background: "linear-gradient(135deg, hsl(43,30%,12%), hsl(225,28%,10%))",
          borderColor: "rgba(200,153,26,0.25)",
        }}
      >
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-[hsl(43,85%,55%)]" />
          <div>
            <div className="text-xs text-[hsl(45,15%,60%)] font-body">GBUX Balance</div>
            <div className="text-xl font-heading gold-text">{Number(player.gbuxBalance || 0).toFixed(2)}</div>
          </div>
        </div>
        <Link href="/pvp" onClick={() => useGrudgePanelClose()}>
          <Button size="sm" className="dark-button text-xs">
            <Swords className="w-3 h-3 mr-1" /> Wager
          </Button>
        </Link>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <StatBlock icon={Gamepad} label="Played" value={stats.gamesPlayed ?? 0} />
          <StatBlock icon={Trophy} label="P. Bests" value={stats.personalBests ?? 0} />
          <StatBlock icon={Award} label="Records" value={stats.globalRecords ?? 0} />
          <StatBlock icon={Medal} label="Scores" value={stats.totalScores ?? 0} />
          <StatBlock icon={Swords} label="Wins" value={stats.challengesWon ?? 0} />
          <StatBlock icon={Shield} label="Losses" value={stats.challengesLost ?? 0} />
        </div>
      )}

      {/* Wallet status */}
      <div className="rounded-lg p-3 border border-[hsl(225,20%,15%)] bg-[hsl(225,30%,8%)]">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-3.5 h-3.5 text-[hsl(43,85%,55%)]" />
          <span className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider">Wallet</span>
        </div>
        {player.puterId && (
          <div className="text-[11px] text-[hsl(45,15%,60%)] font-body flex items-center gap-1">
            <Globe className="w-3 h-3" /> Puter Cloud connected
          </div>
        )}
        <div className="text-[11px] text-[hsl(45,15%,60%)] font-body mt-1">
          Phantom Connect: {(player as any).solanaAddress ? "Linked" : "Not linked"}
        </div>
      </div>

      <Link href="/account">
        <Button className="w-full dark-button text-xs" onClick={() => useGrudgePanelClose()}>
          Full Account Page <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </Link>
    </div>
  );
}

// Need a helper to close panel from link clicks
function useGrudgePanelClose() {
  const { close } = useGrudgePanel();
  close();
}

// ── Games Tab ────────────────────────────────────────────────────

function GamesTab() {
  const gamesQ = useQuery({
    queryKey: ["/api/me/games"],
    queryFn: () => fetchJSON<{
      retro: Array<{ game: { id: number; title: string; platform: string; thumbnailUrl: string | null }; bestScore: number }>;
      fleet: Array<{ gameKey: string; title: string; url?: string; playCount: number }>;
      all: unknown[];
    }>("/api/me/games"),
  });
  const { close } = useGrudgePanel();

  const retro = gamesQ.data?.retro ?? [];
  const fleet = gamesQ.data?.fleet ?? [];
  const hasPlays = retro.length > 0 || fleet.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider">My Games</span>
        <Link href="/account" onClick={close}>
          <span className="text-[10px] text-[hsl(43,85%,55%)] hover:underline font-body flex items-center gap-0.5">
            Hub <ChevronRight className="w-3 h-3" />
          </span>
        </Link>
      </div>

      {gamesQ.isLoading ? (
        <div className="py-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)] mx-auto" />
        </div>
      ) : !hasPlays ? (
        <div className="text-center py-8">
          <Gamepad className="w-8 h-8 text-[hsl(45,15%,40%)] mx-auto mb-2" />
          <p className="text-sm text-[hsl(45,15%,55%)] font-body">No games played yet.</p>
          <Link href="/account" onClick={close}>
            <Button size="sm" className="gilded-button mt-3 text-xs">
              Open Games Hub
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {fleet.slice(0, 6).map((row) => (
            <a
              key={row.gameKey}
              href={row.url || "/super-engine"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              <div className="flex items-center gap-3 p-2 rounded border border-[hsl(43,60%,30%)]/15 hover:border-[hsl(43,60%,30%)]/40 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded bg-[hsl(225,25%,12%)] flex items-center justify-center shrink-0">
                  <Gamepad className="w-4 h-4 text-[hsl(43,85%,55%)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{row.title}</div>
                  <div className="text-[10px] text-[hsl(45,15%,55%)] font-body">
                    Fleet · {row.playCount} play{row.playCount === 1 ? "" : "s"}
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] border-[hsl(43,60%,30%)]/30 text-[hsl(43,85%,55%)] uppercase shrink-0">
                  new
                </Badge>
              </div>
            </a>
          ))}
          {retro.slice(0, 6).map((row) => (
            <Link key={row.game.id} href={`/play/${row.game.id}`} onClick={close}>
              <div className="flex items-center gap-3 p-2 rounded border border-[hsl(43,60%,30%)]/15 hover:border-[hsl(43,60%,30%)]/40 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded bg-[hsl(225,25%,12%)] overflow-hidden shrink-0">
                  <GameCover
                    src={row.game.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{row.game.title}</div>
                  <div className="text-[10px] text-[hsl(45,15%,55%)] font-body">
                    Best: {row.bestScore?.toLocaleString() ?? "—"}
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] border-[hsl(43,60%,30%)]/30 text-[hsl(43,85%,55%)] uppercase shrink-0">
                  {row.game.platform}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Saves placeholder */}
      <div className="pt-3 border-t border-[hsl(43,60%,30%)]/15">
        <span className="text-xs font-heading text-[hsl(45,15%,50%)] uppercase tracking-wider">Save States</span>
        <p className="text-[11px] text-[hsl(45,15%,45%)] font-body mt-1">
          Cloud saves coming soon — your progress will sync across devices via Grudge ID.
        </p>
      </div>
    </div>
  );
}

// ── Social Tab ───────────────────────────────────────────────────

function SocialTab() {
  const { player } = useAuth();
  const { close } = useGrudgePanel();
  const [chatRoom, setChatRoom] = useState("general");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatConnected, setChatConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const roomRef = useRef(chatRoom);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalClose = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChannel = treatyChannelById(chatRoom) ?? TREATY_CHANNELS[0];
  roomRef.current = chatRoom;

  // Connect once per player — do NOT tear down on room change (that zeroed presence)
  useEffect(() => {
    if (!player) return;

    const identity = identityFromPlayer(player);
    intentionalClose.current = false;
    let closed = false;

    const connect = () => {
      if (closed) return;
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }
      let ws: WebSocket;
      try {
        ws = new WebSocket(getTreatyWsUrl());
      } catch {
        setChatConnected(false);
        reconnectTimer.current = setTimeout(connect, 3000);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (closed) return;
        setChatConnected(true);
        try {
          ws.send(JSON.stringify(buildJoinPayload(identity, roomRef.current)));
        } catch {
          /* */
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "message" || data.type === "system") {
            setChatMessages((prev) => [...prev.slice(-50), data]);
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        setChatConnected(false);
        if (wsRef.current === ws) wsRef.current = null;
        if (!intentionalClose.current && !closed) {
          reconnectTimer.current = setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      intentionalClose.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      try {
        wsRef.current?.close();
      } catch {
        /* */
      }
      wsRef.current = null;
    };
  }, [player]);

  // switch_room on open socket — was reconnecting and dropping the roster
  useEffect(() => {
    if (!player) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(buildSwitchRoomPayload(chatRoom)));
      } catch {
        /* */
      }
    }
  }, [chatRoom, player]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: "message", message: text }));
      setChatInput("");
    } catch {
      /* keep input so user can retry */
    }
  };

  return (
    <div className="space-y-4">
      {/* Treaty Chat */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider">
            <MessageCircle className="w-3 h-3 inline mr-1" />
            Treaty Chat
            <span className="ml-1.5 text-[9px] font-normal normal-case text-[hsl(45,15%,45%)]">
              {activeChannel.icon} #{activeChannel.name}
            </span>
          </span>
          <Link href={`/chat?room=${chatRoom}`} onClick={close}>
            <span className="text-[10px] text-[hsl(43,85%,55%)] hover:underline font-body">Open full chat</span>
          </Link>
        </div>
        <div className="mb-2 overflow-x-auto">
          <TreatyChannelPicker
            currentRoom={chatRoom}
            onSelect={(id) => {
              setChatMessages([]);
              setChatRoom(id);
            }}
            layout="bar"
          />
        </div>
        <div
          className="rounded border border-[hsl(225,20%,15%)] bg-[hsl(225,30%,6%)] h-48 flex flex-col"
        >
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-xs">
            {chatMessages.length === 0 && (
              <p className="text-[hsl(45,15%,40%)] font-body text-center pt-6">
                {chatConnected ? `No messages in #${activeChannel.name} yet.` : "Connecting…"}
              </p>
            )}
            {chatMessages.map((msg, i) =>
              msg.type === "system" ? (
                <div key={i} className="text-[10px] text-[hsl(45,15%,45%)] font-body italic">{msg.message}</div>
              ) : (
                <div key={i}>
                  <span className="text-[hsl(43,85%,55%)] font-medium">{msg.username}</span>{" "}
                  <span className="text-[hsl(45,30%,85%)]">{msg.message}</span>
                </div>
              ),
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t border-[hsl(225,20%,15%)] p-2 flex gap-1">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder={`Message #${activeChannel.name}…`}
              className="h-7 text-xs bg-[hsl(225,25%,10%)] border-[hsl(43,60%,30%)]/20"
            />
            <Button size="sm" className="h-7 w-7 p-0 dark-button" onClick={sendChat}>
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Friends — live Treaty presence */}
      <SocialFriendsBlock
        enabled={!!player}
        onMessage={(room) => {
          close();
          window.location.href = `/chat?room=${encodeURIComponent(room)}`;
        }}
      />

      {/* DMs shortcut */}
      <div>
        <span className="text-xs font-heading text-[hsl(45,15%,50%)] uppercase tracking-wider">
          <MessageCircle className="w-3 h-3 inline mr-1" /> Messages
        </span>
        <div className="mt-2 rounded border border-[hsl(225,20%,15%)] bg-[hsl(225,30%,8%)] p-3 text-center">
          <p className="text-[11px] text-[hsl(45,15%,45%)] font-body mb-2">
            Friends, DMs, and in-game chat live in Treaty.
          </p>
          <Link href="/chat?tab=dms" onClick={close}>
            <span className="text-[11px] text-[hsl(43,85%,55%)] hover:underline font-body">Open Treaty DMs →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function SocialFriendsBlock({
  enabled,
  onMessage,
}: {
  enabled: boolean;
  onMessage: (dmRoom: string) => void;
}) {
  const friendsQ = useQuery({
    queryKey: ["/api/treaty/friends"],
    queryFn: fetchTreatyFriends,
    enabled,
    refetchInterval: 20_000,
  });

  return (
    <div>
      <span className="text-xs font-heading text-[hsl(45,15%,50%)] uppercase tracking-wider">
        <Users className="w-3 h-3 inline mr-1" /> Friends
      </span>
      <div className="mt-2 rounded border border-[hsl(225,20%,15%)] bg-[hsl(225,30%,8%)] p-3">
        {!enabled ? (
          <p className="text-[11px] text-[hsl(45,15%,45%)] font-body text-center">Sign in to see friends.</p>
        ) : friendsQ.isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mx-auto text-[hsl(43,85%,55%)]" />
        ) : !(friendsQ.data?.length) ? (
          <p className="text-[11px] text-[hsl(45,15%,45%)] font-body text-center">
            No friends yet.{" "}
            <Link href="/chat">
              <span className="text-[hsl(43,85%,55%)] hover:underline">Open Treaty</span>
            </Link>
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-40 overflow-y-auto">
            {(friendsQ.data as TreatyFriend[]).map((f) => (
              <li key={f.friendshipId || f.id} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.isOnline ? "bg-emerald-400" : "bg-[hsl(45,15%,30%)]"}`} />
                <span className="truncate flex-1 text-[hsl(45,30%,85%)]">{f.displayName || f.username}</span>
                {f.dmRoom && (
                  <button
                    type="button"
                    className="text-[10px] text-[hsl(43,85%,55%)] hover:underline shrink-0"
                    onClick={() => onMessage(f.dmRoom!)}
                  >
                    DM
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Activity Tab ─────────────────────────────────────────────────

function ActivityTab() {
  const txQ = useQuery({
    queryKey: ["/api/transactions"],
    queryFn: () => fetchJSON<any[]>("/api/transactions?limit=20"),
  });

  const scoresQ = useQuery({
    queryKey: ["/api/me/scores"],
    queryFn: () => fetchJSON<any[]>("/api/me/scores?limit=10"),
  });

  return (
    <div className="space-y-5">
      {/* GBUX History */}
      <div>
        <span className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider">
          <Coins className="w-3 h-3 inline mr-1" /> GBUX History
        </span>
        {txQ.isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[hsl(43,85%,55%)] mt-3" />
        ) : !txQ.data?.length ? (
          <p className="text-[11px] text-[hsl(45,15%,50%)] font-body mt-2">No transactions yet.</p>
        ) : (
          <div className="mt-2 space-y-1">
            {txQ.data.map((tx: any) => {
              const amt = Number(tx.amount);
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-2 py-1.5 px-2 rounded border border-[hsl(225,20%,15%)]"
                  style={{ background: "hsl(225,30%,8%)" }}
                >
                  <div className="min-w-0">
                    <div className="text-[11px] text-[hsl(45,30%,85%)] truncate">{tx.description || tx.type}</div>
                    <div className="text-[10px] text-[hsl(45,15%,45%)] font-body">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-heading shrink-0 ${amt >= 0 ? "text-[hsl(120,60%,55%)]" : "text-[hsl(0,65%,60%)]"}`}
                  >
                    {amt >= 0 ? "+" : ""}
                    {amt.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Score Events */}
      <div>
        <span className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider">
          <Trophy className="w-3 h-3 inline mr-1" /> Score Events
        </span>
        {scoresQ.isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[hsl(43,85%,55%)] mt-3" />
        ) : !scoresQ.data?.length ? (
          <p className="text-[11px] text-[hsl(45,15%,50%)] font-body mt-2">No scores yet.</p>
        ) : (
          <div className="mt-2 space-y-1">
            {scoresQ.data.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 py-1.5 px-2 rounded border border-[hsl(225,20%,15%)]"
                style={{ background: "hsl(225,30%,8%)" }}
              >
                <div className="min-w-0">
                  <div className="text-[11px] text-[hsl(45,30%,85%)] truncate">{s.gameTitle}</div>
                  <div className="flex gap-1 mt-0.5">
                    {s.isGlobalRecord && (
                      <Badge className="text-[8px] bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] px-1 py-0">WR</Badge>
                    )}
                    {s.isPersonalBest && (
                      <Badge className="text-[8px] bg-[hsl(120,60%,50%)]/15 text-[hsl(120,60%,60%)] px-1 py-0">PB</Badge>
                    )}
                  </div>
                </div>
                <span className="text-sm font-heading gold-text shrink-0">{s.score?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Updates */}
      <div>
        <span className="text-xs font-heading text-[hsl(45,15%,50%)] uppercase tracking-wider">
          <Bell className="w-3 h-3 inline mr-1" /> Updates
        </span>
        <div className="mt-2 space-y-1">
          <div className="py-1.5 px-2 rounded border border-[hsl(225,20%,15%)] bg-[hsl(225,30%,8%)]">
            <div className="text-[11px] text-[hsl(43,85%,65%)]">Phantom Connect SDK integrated</div>
            <div className="text-[10px] text-[hsl(45,15%,45%)] font-body">Google & Apple sign-in now creates embedded wallets</div>
          </div>
          <div className="py-1.5 px-2 rounded border border-[hsl(225,20%,15%)] bg-[hsl(225,30%,8%)]">
            <div className="text-[11px] text-[hsl(43,85%,65%)]">GBUX Economy Active</div>
            <div className="text-[10px] text-[hsl(45,15%,45%)] font-body">Earn GBUX on every score: 1¤ per play, 10¤ for PB, 100¤ for world record</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Studio Tab (merged with dash.grudge-studio.com) ──────────────

function StudioTab() {
  const { player } = useAuth();
  const { close } = useGrudgePanel();
  const isAdmin =
    player?.role === "admin" ||
    player?.role === "master" ||
    player?.role === "master_admin" ||
    player?.role === "owner";

  const links: { href: string; label: string; hint: string }[] = [
    { href: `${DASH}/`, label: "Dashboard home", hint: "Overview & health" },
    { href: `${DASH}/accounts`, label: "Accounts admin", hint: "Users · characters · lookup" },
    { href: `${DASH}/assets`, label: "Assets & SSOT", hint: "R2 · ObjectStore · D1" },
    { href: `${DASH}/railway`, label: "Railway fleet", hint: "Services · deploys" },
    { href: `${DASH}/services`, label: "Services health", hint: "Live probes" },
    { href: `${DASH}/economy`, label: "Economy", hint: "GBUX · wallets" },
    { href: `${DASH}/?panel=studio`, label: "Open right panel on dash", hint: "Same Grudge Panel UX" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[hsl(45,15%,55%)] font-body leading-relaxed">
        Studio admin lives on{" "}
        <a href={DASH} className="text-[hsl(43,85%,55%)] hover:underline" target="_blank" rel="noreferrer">
          dash.grudge-studio.com
        </a>
        . Same Grudge ID session; dash uses the right-side panel for account + studio nav.
      </p>
      {!isAdmin && (
        <p className="text-[11px] text-[hsl(43,70%,50%)] font-body">
          Admin role required for full dash. You can still open public dash pages if allowed.
        </p>
      )}
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              target="_blank"
              rel="noreferrer"
              onClick={close}
              className="flex items-center gap-2 p-2.5 rounded border border-[hsl(43,60%,30%)]/20 hover:border-[hsl(43,60%,30%)]/50 transition-colors"
              style={{ background: "hsl(225,30%,8%)" }}
            >
              <Globe className="w-3.5 h-3.5 text-[hsl(43,85%,55%)] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-[hsl(45,30%,90%)]">{l.label}</div>
                <div className="text-[10px] text-[hsl(45,15%,50%)] font-body">{l.hint}</div>
              </div>
              <ChevronRight className="w-3 h-3 text-[hsl(45,15%,40%)]" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Settings Tab ─────────────────────────────────────────────────

function SettingsTab() {
  const { player, refresh, logout } = useAuth();
  const { close } = useGrudgePanel();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(player?.displayName || "");
  const [email, setEmail] = useState(player?.email || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!player) return null;

  const handleSave = async () => {
    setBusy(true);
    setMsg("");
    const r = await completeProfile({
      displayName: displayName || undefined,
      email: email || undefined,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    await refresh();
    setMsg("Saved!");
    setEditing(false);
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Profile edit */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider">Profile</span>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-[hsl(43,85%,55%)] hover:text-[hsl(43,90%,70%)]">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-[hsl(45,15%,55%)] font-body uppercase tracking-wider">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-8 text-xs bg-[hsl(225,25%,10%)] border-[hsl(43,60%,30%)]/20 mt-1"
                maxLength={60}
              />
            </div>
            <div>
              <label className="text-[10px] text-[hsl(45,15%,55%)] font-body uppercase tracking-wider">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-xs bg-[hsl(225,25%,10%)] border-[hsl(43,60%,30%)]/20 mt-1"
              />
            </div>
            {msg && <p className={`text-xs ${msg === "Saved!" ? "text-[hsl(120,60%,55%)]" : "text-[hsl(0,65%,60%)]"}`}>{msg}</p>}
            <div className="flex gap-2">
              <Button size="sm" className="gilded-button text-xs flex-1" onClick={handleSave} disabled={busy}>
                {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="outline" className="text-xs border-[hsl(43,60%,30%)]/30" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[hsl(45,15%,55%)] font-body">Username</span>
              <span className="text-[hsl(45,30%,85%)]">@{player.username}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[hsl(45,15%,55%)] font-body">Display Name</span>
              <span className="text-[hsl(45,30%,85%)]">{player.displayName || "—"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[hsl(45,15%,55%)] font-body">Email</span>
              <span className="text-[hsl(45,30%,85%)]">{player.email || "Not set"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[hsl(45,15%,55%)] font-body">Grudge ID</span>
              <span className="text-[hsl(43,85%,55%)] font-mono text-[10px]">{player.grudgeId}</span>
            </div>
            {msg && <p className="text-xs text-[hsl(120,60%,55%)]">{msg}</p>}
          </div>
        )}
      </div>

      {/* Wallet Connections */}
      <div>
        <span className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider">
          <Wallet className="w-3 h-3 inline mr-1" /> Wallet Connections
        </span>
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between p-2 rounded border border-[hsl(225,20%,15%)] bg-[hsl(225,30%,8%)]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#ab9ff2]/20 flex items-center justify-center">
                <Wallet className="w-3 h-3 text-[#ab9ff2]" />
              </div>
              <div>
                <div className="text-[11px] text-[hsl(45,30%,85%)]">Phantom / Solana</div>
                <div className="text-[10px] text-[hsl(45,15%,50%)] font-body">
                  {(player as any).solanaAddress
                    ? `${(player as any).solanaAddress.slice(0, 4)}...${(player as any).solanaAddress.slice(-4)}`
                    : "Not connected"}
                </div>
              </div>
            </div>
            {(player as any).solanaAddress ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-[10px] text-[hsl(0,65%,60%)] hover:text-[hsl(0,70%,70%)] h-6 px-2"
                onClick={async () => {
                  await fetch("/api/web3/disconnect", { method: "POST", credentials: "include" });
                  await refresh();
                }}
              >
                <Unlink className="w-3 h-3 mr-1" /> Unlink
              </Button>
            ) : (
              <Badge variant="outline" className="text-[9px] border-[hsl(45,15%,30%)] text-[hsl(45,15%,50%)]">
                Available
              </Badge>
            )}
          </div>

          {player.puterId && (
            <div className="flex items-center justify-between p-2 rounded border border-[hsl(225,20%,15%)] bg-[hsl(225,30%,8%)]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#2b6cb0]/20 flex items-center justify-center">
                  <Globe className="w-3 h-3 text-[#5a9fd4]" />
                </div>
                <div>
                  <div className="text-[11px] text-[hsl(45,30%,85%)]">Puter Cloud</div>
                  <div className="text-[10px] text-[hsl(45,15%,50%)] font-body">Connected</div>
                </div>
              </div>
              <Badge className="text-[9px] bg-[hsl(120,60%,50%)]/15 text-[hsl(120,60%,60%)] border-0">Active</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Sign Out */}
      <Button
        variant="outline"
        className="w-full border-[hsl(0,40%,30%)] text-[hsl(0,65%,65%)] hover:bg-[hsl(0,40%,15%)] text-xs"
        onClick={() => {
          logout();
          close();
        }}
      >
        <LogOut className="w-3 h-3 mr-2" /> Sign Out
      </Button>
    </div>
  );
}

// ── Edge Tab Trigger (fixed to right side of viewport) ───────────

export function GrudgePanelTab() {
  const { toggle, isOpen } = useGrudgePanel();
  const { player } = useAuth();

  return (
    <button
      onClick={toggle}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1 py-3 px-1.5 rounded-l-lg border border-r-0 transition-all hover:px-2.5 group"
      style={{
        background: isOpen
          ? "linear-gradient(135deg, hsl(43,60%,20%), hsl(43,50%,15%))"
          : "linear-gradient(135deg, hsl(225,28%,12%), hsl(225,30%,8%))",
        borderColor: isOpen ? "rgba(200,153,26,0.5)" : "rgba(200,153,26,0.2)",
        boxShadow: isOpen ? "0 0 12px rgba(200,153,26,0.15)" : "none",
      }}
      title="Grudge Panel"
    >
      <div className="flex flex-col items-center gap-1">
        {player?.avatarUrl ? (
          <img src={player.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
        ) : (
          <Shield className="w-4 h-4 text-[hsl(43,85%,55%)]" />
        )}
        <span
          className="text-[8px] font-heading uppercase tracking-wider"
          style={{ color: isOpen ? "#c8991a" : "hsl(45,15%,50%)", writingMode: "vertical-lr", textOrientation: "mixed" }}
        >
          {player ? "PANEL" : "LOGIN"}
        </span>
      </div>
    </button>
  );
}
