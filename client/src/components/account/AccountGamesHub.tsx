import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Gamepad, Loader2, Play, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { GameCover } from "@/components/game-cover";
import {
  getAccountGamesByCategory,
  mergeAccountPlayHistory,
  type AccountGameCard,
  type AccountGameCategory,
  type AccountGamePlay,
} from "@/lib/accountGames";
import { launchAccountGame } from "@/lib/accountGameLaunch";

interface GamesApiResponse {
  retro: Array<{
    kind: "retro";
    game: { id: number; title: string; platform: string; thumbnailUrl: string | null };
    bestScore: number;
    personalBestAt: string | null;
  }>;
  fleet: Array<{
    kind: "fleet";
    gameKey: string;
    title: string;
    url?: string;
    lastPlayedAt: string;
    playCount: number;
  }>;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function statusBadge(status?: string) {
  if (!status || status === "live") return null;
  return (
    <Badge variant="outline" className="text-[9px] uppercase border-[hsl(43,60%,30%)]/40 text-[hsl(45,15%,55%)]">
      {status}
    </Badge>
  );
}

function GameLaunchCard({
  game,
  onLaunch,
  launching,
}: {
  game: AccountGameCard;
  onLaunch: (game: AccountGameCard) => void;
  launching: string | null;
}) {
  const external = !game.url.startsWith("/");
  return (
    <div className="fantasy-panel p-4 flex flex-col gap-3 h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-heading text-sm text-[hsl(45,30%,92%)] truncate" style={{ WebkitTextFillColor: "unset" }}>
            {game.title}
          </h4>
          <p className="text-[11px] text-[hsl(45,15%,55%)] font-body mt-1 line-clamp-2">{game.description}</p>
        </div>
        {statusBadge(game.status)}
      </div>
      <div className="flex flex-wrap gap-1 mt-auto">
        {game.tags?.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="outline" className="text-[8px] border-[hsl(43,60%,30%)]/25 text-[hsl(43,85%,55%)]">
            {tag}
          </Badge>
        ))}
      </div>
      <Button
        size="sm"
        className="gilded-button w-full text-xs"
        disabled={launching === game.id}
        onClick={() => onLaunch(game)}
      >
        {launching === game.id ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : external ? (
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
        ) : (
          <Play className="w-3.5 h-3.5 mr-1.5" />
        )}
        Play
      </Button>
    </div>
  );
}

export default function AccountGamesHub({ compact = false }: { compact?: boolean }) {
  const { player } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<AccountGameCategory>("fleet");
  const [launching, setLaunching] = useState<string | null>(null);

  const gamesQ = useQuery<GamesApiResponse>({
    queryKey: ["/api/me/games"],
    queryFn: () => fetchJSON<GamesApiResponse>("/api/me/games"),
  });

  const recentPlays = useMemo<AccountGamePlay[]>(() => {
    if (!gamesQ.data) return [];
    const fleetPlays: AccountGamePlay[] = gamesQ.data.fleet.map((row) => ({
      gameKey: row.gameKey,
      category: "fleet",
      title: row.title,
      url: row.url,
      lastPlayedAt: row.lastPlayedAt,
      playCount: row.playCount,
    }));
    return mergeAccountPlayHistory(fleetPlays, gamesQ.data.retro);
  }, [gamesQ.data]);

  async function handleLaunch(game: AccountGameCard) {
    setLaunching(game.id);
    try {
      await launchAccountGame(game, navigate, player?.grudgeId);
      gamesQ.refetch();
    } finally {
      setLaunching(null);
    }
  }

  return (
    <div className="space-y-6">
      {!compact && (
        <section className="fantasy-panel p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-heading text-base text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
                Recent Plays
              </h3>
              <p className="text-xs text-[hsl(45,15%,55%)] font-body mt-0.5">
                Fleet launches and retro scores on one timeline.
              </p>
            </div>
            <Link href="/super-engine">
              <Button variant="ghost" size="sm" className="text-[hsl(43,85%,55%)] text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Forge
              </Button>
            </Link>
          </div>
          {gamesQ.isLoading ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" /></div>
          ) : !recentPlays.length ? (
            <p className="text-sm text-[hsl(45,15%,60%)] font-body">
              No plays yet. Launch a fleet game below or browse the{" "}
              <Link href="/games" className="text-[hsl(43,85%,55%)] hover:underline">retro library</Link>.
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(43,60%,30%)]/15">
              {recentPlays.slice(0, compact ? 6 : 10).map((row) => (
                <li key={row.gameKey} className="py-2.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-[hsl(225,25%,14%)] flex items-center justify-center shrink-0">
                    <Gamepad className="w-4 h-4 text-[hsl(43,85%,55%)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">{row.title}</span>
                    <span className="text-[10px] text-[hsl(45,15%,60%)] font-body">
                      {row.category === "fleet" ? "Fleet" : "Retro"} · {new Date(row.lastPlayedAt).toLocaleDateString()}
                      {row.playCount > 1 ? ` · ${row.playCount} plays` : ""}
                    </span>
                  </div>
                  {row.url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] border-[hsl(43,60%,30%)]/30"
                      onClick={() => {
                        const card = getAccountGamesByCategory("all").find((g) => g.id === row.gameKey.replace(/^retro:/, ""))
                          ?? {
                            id: row.gameKey,
                            title: row.title,
                            description: "",
                            url: row.url!,
                            category: row.category,
                          };
                        void handleLaunch(card);
                      }}
                    >
                      Play
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="fantasy-panel p-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as AccountGameCategory)}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="font-heading text-base text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
                Game Library
              </h3>
              <p className="text-xs text-[hsl(45,15%,55%)] font-body mt-0.5">
                New fleet games, retro catalog, or everything at once.
              </p>
            </div>
            <TabsList className="bg-[hsl(225,25%,10%)] border border-[hsl(43,60%,30%)]/15 rounded-lg p-1 h-auto">
              <TabsTrigger value="fleet" className="text-xs data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)]">
                New Games
              </TabsTrigger>
              <TabsTrigger value="retro" className="text-xs data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)]">
                Retro
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)]">
                All Games
              </TabsTrigger>
            </TabsList>
          </div>

          {(["fleet", "retro", "all"] as const).map((category) => (
            <TabsContent key={category} value={category} className="mt-0">
              <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
                {getAccountGamesByCategory(category).map((game) => (
                  <GameLaunchCard
                    key={game.id}
                    game={game}
                    onLaunch={handleLaunch}
                    launching={launching}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  );
}