import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Award,
  Gamepad2,
  Loader2,
  LogOut,
  Medal,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useAuthModal } from "@/components/auth-modal";

interface PlayerStats {
  gamesPlayed: number;
  totalScores: number;
  personalBests: number;
  globalRecords: number;
  challengesWon: number;
  challengesLost: number;
  gbuxBalance: string;
  grudgeId: string;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  role: string;
}

interface RecentScore {
  id: number;
  gameId: number;
  score: number;
  isPersonalBest: boolean;
  isGlobalRecord: boolean;
  createdAt: string;
  gameTitle: string;
  platform: string;
  thumbnailUrl: string | null;
}

interface PlayerGame {
  game: {
    id: number;
    title: string;
    platform: string;
    thumbnailUrl: string | null;
    isFeatured: boolean | null;
  };
  bestScore: number;
  personalBestAt: string | null;
}

interface ChallengeRow {
  id: number;
  challengerId: number;
  opponentId: number;
  gameId: number;
  gbuxWager: string;
  status: string;
  challengerScore: number | null;
  opponentScore: number | null;
  winnerId: number | null;
  createdAt: string;
}

interface TransactionRow {
  id: number;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function AccountPage() {
  const { player, loading, logout } = useAuth();
  const { open: openAuthModal } = useAuthModal();

  useEffect(() => {
    if (!loading && !player) {
      openAuthModal({ redirectTo: "/account", initialTab: "signin", reason: "Sign in to see your stats, scores, and PvP history." });
    }
  }, [loading, player, openAuthModal]);

  const enabled = !!player;

  const statsQuery = useQuery<PlayerStats>({
    queryKey: ["/api/me/stats"],
    queryFn: () => fetchJSON<PlayerStats>("/api/me/stats"),
    enabled,
  });

  const scoresQuery = useQuery<RecentScore[]>({
    queryKey: ["/api/me/scores"],
    queryFn: () => fetchJSON<RecentScore[]>("/api/me/scores?limit=15"),
    enabled,
  });

  const gamesQuery = useQuery<PlayerGame[]>({
    queryKey: ["/api/me/games"],
    queryFn: () => fetchJSON<PlayerGame[]>("/api/me/games"),
    enabled,
  });

  const activeQuery = useQuery<ChallengeRow[]>({
    queryKey: ["/api/challenges/active"],
    queryFn: () => fetchJSON<ChallengeRow[]>("/api/challenges/active"),
    enabled,
  });

  const pendingQuery = useQuery<ChallengeRow[]>({
    queryKey: ["/api/challenges/pending"],
    queryFn: () => fetchJSON<ChallengeRow[]>("/api/challenges/pending"),
    enabled,
  });

  const txQuery = useQuery<TransactionRow[]>({
    queryKey: ["/api/transactions"],
    queryFn: () => fetchJSON<TransactionRow[]>("/api/transactions?limit=10"),
    enabled,
  });

  if (loading || !player) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
        {!loading && !player && (
          <Button className="gilded-button" onClick={() => openAuthModal({ redirectTo: "/account", initialTab: "signin" })}>
            Sign in to continue
          </Button>
        )}
      </div>
    );
  }

  const stats = statsQuery.data;
  const gbux = stats?.gbuxBalance ?? player.gbuxBalance ?? "0";

  return (
    <div className="min-h-screen bg-[hsl(225,30%,6%)] text-[hsl(45,30%,90%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Profile header */}
        <section className="fantasy-panel p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-[hsl(225,25%,14%)] border border-[hsl(43,60%,30%)]/40 flex items-center justify-center overflow-hidden">
              {player.avatarUrl ? (
                <img src={player.avatarUrl} alt={player.username} className="w-full h-full object-cover" />
              ) : (
                <Sparkles className="w-8 h-8 text-[hsl(43,85%,55%)]" />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-heading gold-text" style={{ WebkitTextFillColor: "unset" }}>
                {stats?.displayName || player.displayName || player.username}
              </h1>
              <div className="text-sm text-[hsl(45,15%,60%)] font-body mt-1 flex flex-wrap gap-3">
                <span>@{player.username}</span>
                <span>Grudge ID: <span className="text-[hsl(43,85%,55%)]">{player.grudgeId}</span></span>
                <Badge variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)] uppercase text-[10px]">
                  {player.role || "player"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="stone-panel px-4 py-2 rounded-lg flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[hsl(43,85%,55%)]" />
              <div>
                <div className="text-xs text-[hsl(45,15%,60%)] font-body">GBUX</div>
                <div className="text-lg font-heading gold-text">{Number(gbux).toFixed(2)}</div>
              </div>
            </div>
            <Button variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(45,30%,90%)]" onClick={() => logout()}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </div>
        </section>

        {/* Stat grid */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Games Played", value: stats?.gamesPlayed ?? 0, icon: Gamepad2 },
            { label: "Total Plays", value: stats?.totalScores ?? 0, icon: Medal },
            { label: "Personal Bests", value: stats?.personalBests ?? 0, icon: Trophy },
            { label: "Global Records", value: stats?.globalRecords ?? 0, icon: Award },
            { label: "Wins", value: stats?.challengesWon ?? 0, icon: Swords },
            { label: "Losses", value: stats?.challengesLost ?? 0, icon: Shield },
          ].map((stat) => (
            <div key={stat.label} className="fantasy-panel p-4 text-center">
              <stat.icon className="w-5 h-5 mx-auto text-[hsl(43,85%,55%)]" />
              <div className="text-2xl font-heading gold-text mt-2">{stat.value}</div>
              <div className="text-xs text-[hsl(45,15%,60%)] font-body mt-1">{stat.label}</div>
            </div>
          ))}
        </section>

        {/* Recent scores + Challenges */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
          <div className="fantasy-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
                Recent Scores
              </h2>
              <Link href="/leaderboards">
                <Button variant="ghost" size="sm" className="text-[hsl(43,85%,55%)]">
                  View leaderboards
                </Button>
              </Link>
            </div>
            {scoresQuery.isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" /></div>
            ) : !scoresQuery.data?.length ? (
              <p className="text-sm text-[hsl(45,15%,60%)] font-body">No scores submitted yet. Play a game to get on the board.</p>
            ) : (
              <ul className="divide-y divide-[hsl(43,60%,30%)]/20">
                {scoresQuery.data.map((row) => (
                  <li key={row.id} className="py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-[hsl(225,25%,14%)] overflow-hidden flex-shrink-0">
                      {row.thumbnailUrl && (
                        <img
                          src={row.thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{row.gameTitle}</span>
                        <Badge variant="outline" className="text-[10px] border-[hsl(43,60%,30%)]/50 text-[hsl(43,85%,55%)] uppercase">
                          {row.platform}
                        </Badge>
                      </div>
                      <div className="text-xs text-[hsl(45,15%,60%)] font-body mt-0.5">
                        {new Date(row.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-heading text-lg gold-text">{row.score.toLocaleString()}</div>
                      <div className="flex gap-1 justify-end">
                        {row.isGlobalRecord && <Badge className="text-[10px] bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)]">WR</Badge>}
                        {row.isPersonalBest && <Badge className="text-[10px] bg-[hsl(120,60%,50%)]/20 text-[hsl(120,60%,60%)]">PB</Badge>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-6">
            <div className="fantasy-panel p-5">
              <h2 className="font-heading text-lg text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>
                Active & Pending PvP
              </h2>
              {activeQuery.isLoading || pendingQuery.isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
              ) : !(activeQuery.data?.length || pendingQuery.data?.length) ? (
                <p className="text-sm text-[hsl(45,15%,60%)] font-body">
                  No open challenges.{" "}
                  <Link href="/pvp" className="text-[hsl(43,85%,55%)] hover:underline">Start one</Link>.
                </p>
              ) : (
                <ul className="space-y-2">
                  {[...(pendingQuery.data || []), ...(activeQuery.data || [])].map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 p-2 rounded border border-[hsl(43,60%,30%)]/20">
                      <div className="text-sm">
                        <div className="font-medium">Challenge #{c.id}</div>
                        <div className="text-xs text-[hsl(45,15%,60%)] font-body">
                          Wager: {Number(c.gbuxWager).toFixed(2)} GBUX
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase border-[hsl(43,60%,30%)]/50 text-[hsl(43,85%,55%)]">
                        {c.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/pvp">
                <Button className="w-full mt-4 gilded-button">
                  <Swords className="w-4 h-4 mr-2" /> Open PvP Hub
                </Button>
              </Link>
            </div>

            <div className="fantasy-panel p-5">
              <h2 className="font-heading text-lg text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>
                GBUX Activity
              </h2>
              {txQuery.isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
              ) : !txQuery.data?.length ? (
                <p className="text-sm text-[hsl(45,15%,60%)] font-body">No transactions yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {txQuery.data.map((tx) => {
                    const amt = Number(tx.amount);
                    return (
                      <li key={tx.id} className="flex items-center justify-between gap-2 py-1">
                        <div className="min-w-0">
                          <div className="text-[hsl(45,30%,90%)] truncate">{tx.description || tx.type}</div>
                          <div className="text-xs text-[hsl(45,15%,60%)] font-body">{new Date(tx.createdAt).toLocaleString()}</div>
                        </div>
                        <div className={`font-heading text-sm ${amt >= 0 ? "text-[hsl(120,60%,60%)]" : "text-[hsl(0,70%,65%)]"}`}>
                          {amt >= 0 ? "+" : ""}{amt.toFixed(2)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Games played */}
        <section>
          <h2 className="font-heading text-xl text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>
            Games Played
          </h2>
          {gamesQuery.isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" /></div>
          ) : !gamesQuery.data?.length ? (
            <p className="text-sm text-[hsl(45,15%,60%)] font-body">
              Play anything in the <Link href="/games" className="text-[hsl(43,85%,55%)] hover:underline">retro library</Link> to get this list started.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {gamesQuery.data.map((row) => (
                <Link key={row.game.id} href={`/play/${row.game.id}`}>
                  <div className="fantasy-panel overflow-hidden hover:rune-glow transition cursor-pointer">
                    <div className="aspect-[3/4] bg-[hsl(225,25%,12%)] relative">
                      {row.game.thumbnailUrl && (
                        <img
                          src={row.game.thumbnailUrl}
                          alt={row.game.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-heading truncate">{row.game.title}</div>
                      <div className="flex items-center justify-between mt-1">
                        <Badge variant="outline" className="text-[10px] border-[hsl(43,60%,30%)]/50 text-[hsl(43,85%,55%)] uppercase">
                          {row.game.platform}
                        </Badge>
                        <span className="text-[10px] text-[hsl(43,85%,55%)] font-heading">{row.bestScore.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
