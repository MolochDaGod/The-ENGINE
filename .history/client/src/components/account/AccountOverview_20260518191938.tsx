import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Award, Copy, Gamepad2, Loader2, Medal, Shield, Sparkles, Swords, Trophy, Wallet,
} from "lucide-react";
import type { PlayerProfile } from "@/lib/player-auth";
import { GameCover } from "@/components/game-cover";

interface PlayerStats {
  gamesPlayed: number;
  totalScores: number;
  personalBests: number;
  globalRecords: number;
  challengesWon: number;
  challengesLost: number;
  gbuxBalance: string;
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

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
}

export default function AccountOverview({ player }: { player: PlayerProfile }) {
  const statsQuery = useQuery<PlayerStats>({
    queryKey: ["/api/me/stats"],
    queryFn: () => fetchJSON<PlayerStats>("/api/me/stats"),
  });

  const scoresQuery = useQuery<RecentScore[]>({
    queryKey: ["/api/me/scores"],
    queryFn: () => fetchJSON<RecentScore[]>("/api/me/scores?limit=8"),
  });

  const stats = statsQuery.data;
  const gbux = stats?.gbuxBalance ?? player.gbuxBalance ?? "0";

  return (
    <div className="space-y-6">
      {/* Profile Card — based on GrudgeBuilder AccountPage pattern */}
      <section className="fantasy-panel p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Avatar + Identity */}
          <div className="flex items-center gap-4 flex-1">
            {player.avatarUrl ? (
              <img
                src={player.avatarUrl}
                alt={player.username}
                className="w-16 h-16 rounded-xl ring-2 ring-[hsl(43,60%,30%)]/50 object-cover shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[hsl(43,85%,55%)] via-[hsl(25,80%,45%)] to-[hsl(0,60%,35%)] flex items-center justify-center ring-2 ring-[hsl(43,60%,30%)]/50 shadow-lg">
                <span className="text-2xl font-bold text-white font-heading">
                  {(player.displayName || player.username || "W")[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold font-heading gold-text" style={{ WebkitTextFillColor: "unset" }}>
                {player.displayName || player.username}
              </h2>
              <div className="text-sm text-[hsl(45,15%,60%)] font-body mt-0.5 flex flex-wrap gap-2 items-center">
                <span>@{player.username}</span>
                <Badge variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)] uppercase text-[10px]">
                  {player.role || "player"}
                </Badge>
              </div>
              {player.bio && (
                <p className="text-xs text-[hsl(45,15%,55%)] font-body mt-1 max-w-md">{player.bio}</p>
              )}
            </div>
          </div>

          {/* GBUX Balance */}
          <div className="stone-panel px-5 py-3 rounded-lg flex items-center gap-3">
            <Wallet className="w-5 h-5 text-[hsl(43,85%,55%)]" />
            <div>
              <div className="text-xs text-[hsl(45,15%,60%)] font-body">GBUX</div>
              <div className="text-xl font-heading gold-text">{Number(gbux).toFixed(2)}</div>
            </div>
          </div>
        </div>

        <Separator className="my-5 border-[hsl(43,60%,30%)]/20" />

        {/* Grudge ID + Puter ID — copyable */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-[hsl(43,60%,30%)]/15 border-l-2 border-l-[hsl(0,50%,30%)]">
            <div>
              <div className="text-[10px] text-[hsl(45,15%,50%)] uppercase tracking-wider font-body">Grudge ID</div>
              <div className="text-sm font-mono text-[hsl(43,85%,55%)]">{player.grudgeId}</div>
            </div>
            <button onClick={() => copyText(player.grudgeId)} className="text-[hsl(45,15%,45%)] hover:text-[hsl(43,85%,55%)] transition">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          {player.puterId && (
            <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-[hsl(43,60%,30%)]/15 border-l-2 border-l-[hsl(190,80%,40%)]">
              <div>
                <div className="text-[10px] text-[hsl(45,15%,50%)] uppercase tracking-wider font-body">Puter ID</div>
                <div className="text-sm font-mono text-[hsl(190,70%,60%)]">{player.puterId}</div>
              </div>
              <button onClick={() => copyText(player.puterId!)} className="text-[hsl(45,15%,45%)] hover:text-[hsl(190,70%,60%)] transition">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Stat Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Games Played", value: stats?.gamesPlayed ?? 0, icon: Gamepad2 },
          { label: "Total Plays", value: stats?.totalScores ?? 0, icon: Medal },
          { label: "Personal Bests", value: stats?.personalBests ?? 0, icon: Trophy },
          { label: "Global Records", value: stats?.globalRecords ?? 0, icon: Award },
          { label: "Wins", value: stats?.challengesWon ?? 0, icon: Swords },
          { label: "Losses", value: stats?.challengesLost ?? 0, icon: Shield },
        ].map((stat) => (
          <div key={stat.label} className="fantasy-panel p-3 text-center">
            <stat.icon className="w-4 h-4 mx-auto text-[hsl(43,85%,55%)]" />
            <div className="text-xl font-heading gold-text mt-1">{stat.value}</div>
            <div className="text-[10px] text-[hsl(45,15%,60%)] font-body mt-0.5">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Recent Scores */}
      <section className="fantasy-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-base text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
            Recent Scores
          </h3>
          <Link href="/leaderboards">
            <Button variant="ghost" size="sm" className="text-[hsl(43,85%,55%)] text-xs">
              View leaderboards
            </Button>
          </Link>
        </div>
        {scoresQuery.isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" /></div>
        ) : !scoresQuery.data?.length ? (
          <p className="text-sm text-[hsl(45,15%,60%)] font-body">
            No scores yet. Play a game in the <Link href="/games" className="text-[hsl(43,85%,55%)] hover:underline">retro library</Link> to get started.
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(43,60%,30%)]/15">
            {scoresQuery.data.map((row) => (
              <li key={row.id} className="py-2.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-[hsl(225,25%,14%)] overflow-hidden flex-shrink-0">
                  <GameCover src={row.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium truncate block">{row.gameTitle}</span>
                  <span className="text-[10px] text-[hsl(45,15%,60%)] font-body">{new Date(row.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="text-right">
                  <div className="font-heading text-base gold-text">{row.score.toLocaleString()}</div>
                  <div className="flex gap-1 justify-end">
                    {row.isGlobalRecord && <Badge className="text-[9px] bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)]">WR</Badge>}
                    {row.isPersonalBest && <Badge className="text-[9px] bg-[hsl(120,60%,50%)]/20 text-[hsl(120,60%,60%)]">PB</Badge>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
