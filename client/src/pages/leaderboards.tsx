import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Flame, Loader2, Medal, Play, Trophy } from "lucide-react";
import type { Game } from "@shared/schema";
import { GameCover } from "@/components/game-cover";
import { RetroCompetitiveGrid } from "@/components/retro-competitive-panel";
import {
  RETRO_COMPETITIVE_TOP10,
  type CompetitiveMode,
} from "@/data/retroCompetitive";

interface TopGame extends Game {
  playerCount: number;
  scoreCount: number;
}

interface TopPlayer {
  userId: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalScore: number;
  personalBests: number;
  globalRecords: number;
}

interface LeaderboardRow {
  id: number;
  userId: number;
  gameId: number;
  score: number;
  isPersonalBest: boolean;
  isGlobalRecord: boolean;
  createdAt: string;
  username: string;
  displayName: string | null;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function LeaderboardsPage() {
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"competitive" | "global">("competitive");
  const [retroMode, setRetroMode] = useState<CompetitiveMode | "all">("all");

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const g = q.get("game");
      if (g && Number.isFinite(Number(g))) {
        setSelectedGameId(Number(g));
        setTab("competitive");
      }
      const t = q.get("tab");
      if (t === "global" || t === "competitive") setTab(t);
      const m = q.get("mode");
      if (m === "pvp" || m === "pve" || m === "coop" || m === "all") setRetroMode(m);
    } catch {
      /* ignore */
    }
  }, []);

  const topGamesQuery = useQuery<TopGame[]>({
    queryKey: ["/api/games/top"],
    queryFn: () => fetchJSON<TopGame[]>("/api/games/top?limit=24&windowDays=30"),
  });

  const topPlayersQuery = useQuery<TopPlayer[]>({
    queryKey: ["/api/leaderboards/global"],
    queryFn: () => fetchJSON<TopPlayer[]>("/api/leaderboards/global?limit=25"),
  });

  const gamesListQuery = useQuery<Game[]>({
    queryKey: ["/api/games"],
    queryFn: () => fetchJSON<Game[]>("/api/games"),
  });

  const defaultCompetitiveId = RETRO_COMPETITIVE_TOP10[0]?.gameId ?? null;
  const activeGameId =
    selectedGameId ??
    (tab === "competitive" ? defaultCompetitiveId : topGamesQuery.data?.[0]?.id ?? null);

  const selectedBoardQuery = useQuery<LeaderboardRow[]>({
    queryKey: ["/api/leaderboards", activeGameId],
    queryFn: () => fetchJSON<LeaderboardRow[]>(`/api/leaderboards/${activeGameId}?limit=50`),
    enabled: activeGameId != null,
  });

  const filteredGames = useMemo(() => {
    const list = gamesListQuery.data || [];
    if (!search) {
      // Prefer competitive roster at top of picker
      const ids = new Set(RETRO_COMPETITIVE_TOP10.map((g) => g.gameId));
      return [...list]
        .sort((a, b) => Number(ids.has(b.id)) - Number(ids.has(a.id)) || a.title.localeCompare(b.title))
        .slice(0, 40);
    }
    const q = search.toLowerCase();
    return list.filter((g) => g.title.toLowerCase().includes(q)).slice(0, 30);
  }, [gamesListQuery.data, search]);

  const activeGame = useMemo(() => {
    if (activeGameId == null) return null;
    const fromComp = RETRO_COMPETITIVE_TOP10.find((g) => g.gameId === activeGameId);
    const found =
      gamesListQuery.data?.find((g) => g.id === activeGameId) ||
      topGamesQuery.data?.find((g) => g.id === activeGameId) ||
      null;
    if (found) return found;
    if (fromComp) {
      return {
        id: fromComp.gameId,
        title: fromComp.title,
        platform: fromComp.platform,
      } as Game;
    }
    return null;
  }, [activeGameId, gamesListQuery.data, topGamesQuery.data]);

  return (
    <div className="min-h-screen bg-[hsl(225,30%,6%)] text-[hsl(45,30%,90%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Badge className="mb-3 bg-[hsl(43,85%,55%)]/10 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]/40">
              Leaderboards · Rec0deD:88
            </Badge>
            <h1 className="text-3xl md:text-4xl font-heading gold-text" style={{ WebkitTextFillColor: "unset" }}>
              Global boards for PvP &amp; PvE
            </h1>
            <p className="text-[hsl(45,15%,60%)] font-body mt-2 max-w-3xl">
              Competitive Top 10 first, then the full retro library. Scores come from The ENGINE (
              <code className="text-[hsl(43,85%,55%)]">POST /api/scores</code>
              ). Challenge winners on <Link href="/pvp" className="text-[hsl(43,85%,55%)] hover:underline">/pvp</Link> can earn GBUX.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pvp">
              <Button className="gilded-button">
                <Flame className="w-4 h-4 mr-2" /> Open PvP Hub
              </Button>
            </Link>
            <Link href="/account">
              <Button variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(45,30%,90%)]">
                <Medal className="w-4 h-4 mr-2" /> My Stats
              </Button>
            </Link>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("competitive")}
            className={`px-4 py-2 rounded-full text-sm font-heading border ${
              tab === "competitive"
                ? "bg-[hsl(43,85%,55%)]/20 border-[hsl(43,85%,55%)] text-[hsl(43,85%,55%)]"
                : "border-[hsl(43,60%,30%)]/40 text-[hsl(45,15%,70%)]"
            }`}
          >
            Competitive Top 10
          </button>
          <button
            type="button"
            onClick={() => setTab("global")}
            className={`px-4 py-2 rounded-full text-sm font-heading border ${
              tab === "global"
                ? "bg-[hsl(43,85%,55%)]/20 border-[hsl(43,85%,55%)] text-[hsl(43,85%,55%)]"
                : "border-[hsl(43,60%,30%)]/40 text-[hsl(45,15%,70%)]"
            }`}
          >
            Global / All games
          </button>
        </div>

        {tab === "competitive" && (
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All modes"],
                  ["pvp", "PvP"],
                  ["pve", "PvE"],
                  ["coop", "Co-op"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRetroMode(id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-heading border ${
                    retroMode === id
                      ? "bg-[hsl(43,85%,55%)]/15 border-[hsl(43,85%,55%)] text-[hsl(43,85%,55%)]"
                      : "border-[hsl(43,60%,30%)]/40 text-[hsl(45,15%,70%)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <RetroCompetitiveGrid
              mode={retroMode}
              compact
            />
            <p className="text-xs text-[hsl(45,15%,55%)] font-body">
              Click <strong>Board</strong> on a card or pick a game below to load its live leaderboard.
            </p>
          </section>
        )}

        {/* Top games + Top players */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          <div className="fantasy-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
                Top Games (30 days)
              </h2>
              <span className="text-xs text-[hsl(45,15%,60%)] font-body">by unique players</span>
            </div>
            {topGamesQuery.isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" /></div>
            ) : !topGamesQuery.data?.length ? (
              <p className="text-sm text-[hsl(45,15%,60%)] font-body">No top games data yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {topGamesQuery.data.map((game, idx) => (
                  <button
                    key={game.id}
                    onClick={() => setSelectedGameId(game.id)}
                    className={`fantasy-panel overflow-hidden text-left transition hover:rune-glow ${activeGameId === game.id ? "ring-2 ring-[hsl(43,85%,55%)]" : ""}`}
                  >
                    <div className="aspect-[3/4] bg-[hsl(225,25%,12%)] relative">
  <GameCover src={ game.thumbnailUrl } alt = { game.title } className = "absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-[hsl(43,85%,55%)] text-[hsl(225,30%,8%)] font-heading text-xs flex items-center justify-center">
                        {idx + 1}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-heading truncate">{game.title}</div>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-[hsl(45,15%,60%)] font-body">
                        <span>{game.playerCount} players</span>
                        <span>{game.scoreCount} plays</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="fantasy-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
                Top Players
              </h2>
              <Crown className="w-5 h-5 text-[hsl(43,85%,55%)]" />
            </div>
            {topPlayersQuery.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
            ) : !topPlayersQuery.data?.length ? (
              <p className="text-sm text-[hsl(45,15%,60%)] font-body">No players on the global board yet.</p>
            ) : (
              <ol className="space-y-2">
                {topPlayersQuery.data.map((p, idx) => (
                  <li key={p.userId} className="flex items-center gap-3 p-2 rounded border border-[hsl(43,60%,30%)]/20">
                    <div className="w-7 h-7 rounded-full bg-[hsl(225,25%,14%)] text-[hsl(43,85%,55%)] font-heading text-xs flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{p.displayName || p.username}</div>
                      <div className="text-xs text-[hsl(45,15%,60%)] font-body">
                        {p.personalBests} PBs · {p.globalRecords} WRs
                      </div>
                    </div>
                    <div className="font-heading text-sm gold-text">{p.totalScore.toLocaleString()}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* Per-game leaderboard */}
        <section className="fantasy-panel p-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="font-heading text-lg text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
                <Trophy className="w-5 h-5 inline-block mr-2 text-[hsl(43,85%,55%)]" />
                {activeGame ? `${activeGame.title} · Leaderboard` : "Leaderboard"}
              </h2>
              <p className="text-xs text-[hsl(45,15%,60%)] font-body mt-1">Pick any game to see its top personal bests.</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search games"
                className="w-56 border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
              />
              {activeGame && (
                <Link href={`/play/${activeGame.id}`}>
                  <Button size="sm" className="gilded-button">
                    <Play className="w-4 h-4 mr-1" /> Play
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
            <div className="max-h-96 overflow-y-auto space-y-1 pr-2">
              {gamesListQuery.isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
              ) : filteredGames.length === 0 ? (
                <p className="text-sm text-[hsl(45,15%,60%)]">No games match.</p>
              ) : (
                filteredGames.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGameId(g.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition flex items-center justify-between ${activeGameId === g.id ? "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]" : "text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)]"}`}
                  >
                    <span className="truncate">{g.title}</span>
                    <Badge variant="outline" className="text-[10px] border-[hsl(43,60%,30%)]/50 text-[hsl(43,85%,55%)] uppercase ml-2">
                      {g.platform}
                    </Badge>
                  </button>
                ))
              )}
            </div>

            <div>
              {selectedGameId == null ? (
                <p className="text-sm text-[hsl(45,15%,60%)] font-body">Pick a top game or search for one.</p>
              ) : selectedBoardQuery.isLoading ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" /></div>
              ) : !selectedBoardQuery.data?.length ? (
                <p className="text-sm text-[hsl(45,15%,60%)] font-body">No scores submitted for this game yet. Be the first.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[hsl(45,15%,60%)] font-body text-xs uppercase">
                      <th className="py-2">#</th>
                      <th>Player</th>
                      <th className="text-right">Score</th>
                      <th className="text-right hidden md:table-cell">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(43,60%,30%)]/20">
                    {selectedBoardQuery.data.map((row, idx) => (
                      <tr key={row.id}>
                        <td className="py-2 font-heading text-[hsl(43,85%,55%)] w-8">{idx + 1}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{row.displayName || row.username}</span>
                            {row.isGlobalRecord && <Badge className="text-[10px] bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)]">WR</Badge>}
                          </div>
                        </td>
                        <td className="text-right font-heading gold-text">{row.score.toLocaleString()}</td>
                        <td className="text-right text-xs text-[hsl(45,15%,60%)] font-body hidden md:table-cell">
                          {new Date(row.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
