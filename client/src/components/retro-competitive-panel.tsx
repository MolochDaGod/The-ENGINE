/**
 * Rec0deD competitive Top 10 — shared cards for /pvp and /leaderboards.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GameCover } from "@/components/game-cover";
import { Loader2, Play, Swords, Trophy } from "lucide-react";
import {
  RETRO_COMPETITIVE_TOP10,
  type CompetitiveMode,
} from "@/data/retroCompetitive";
import type { Game } from "@shared/schema";

export type CompetitiveGameRow = Game & {
  competitive?: {
    modes: CompetitiveMode[];
    blurb: string;
    scoreHint: string;
    rank: number;
  };
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const modeBadge: Record<CompetitiveMode, string> = {
  pvp: "bg-[hsl(0,60%,55%)]/15 text-[hsl(0,70%,70%)] border-[hsl(0,60%,55%)]/30",
  pve: "bg-[hsl(200,60%,50%)]/15 text-[hsl(200,70%,70%)] border-[hsl(200,60%,50%)]/30",
  coop: "bg-[hsl(120,60%,50%)]/15 text-[hsl(120,60%,60%)] border-[hsl(120,60%,50%)]/30",
};

export function useCompetitiveGames(mode: CompetitiveMode | "all" = "all") {
  return useQuery<CompetitiveGameRow[]>({
    queryKey: ["/api/games/competitive", mode],
    queryFn: () =>
      fetchJSON<CompetitiveGameRow[]>(
        mode === "all" ? "/api/games/competitive" : `/api/games/competitive?mode=${mode}`,
      ),
    staleTime: 60_000,
    placeholderData: () =>
      RETRO_COMPETITIVE_TOP10.filter((g) => mode === "all" || g.modes.includes(mode as CompetitiveMode)).map(
        (meta, i) =>
          ({
            id: meta.gameId,
            title: meta.title,
            slug: meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            platform: meta.platform,
            isFeatured: true,
            category: "retro",
            isPlayable: true,
            description: meta.blurb,
            thumbnailUrl: null,
            embedUrl: null,
            competitive: {
              modes: [...meta.modes],
              blurb: meta.blurb,
              scoreHint: meta.scoreHint,
              rank: i + 1,
            },
          }) as CompetitiveGameRow,
      ),
  });
}

export function RetroCompetitiveGrid({
  mode = "all",
  onPickForChallenge,
  compact = false,
}: {
  mode?: CompetitiveMode | "all";
  /** When set, shows "Challenge with this" for signed-in PvP flow */
  onPickForChallenge?: (gameId: number) => void;
  compact?: boolean;
}) {
  const q = useCompetitiveGames(mode);

  if (q.isLoading && !q.data?.length) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
      </div>
    );
  }

  const list = q.data || [];

  return (
    <div
      className={
        compact
          ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3"
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
      }
    >
      {list.map((game) => {
        const rank = game.competitive?.rank ?? 0;
        const modes = game.competitive?.modes ?? [];
        return (
          <div
            key={game.id}
            className="fantasy-panel overflow-hidden flex flex-col hover:rune-glow transition-all"
          >
            <div className="aspect-[3/4] bg-[hsl(225,25%,12%)] relative">
              <GameCover
                src={game.thumbnailUrl}
                alt={game.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-[hsl(43,85%,55%)] text-[hsl(225,30%,8%)] font-heading text-xs flex items-center justify-center">
                {rank || "•"}
              </div>
              <div className="absolute top-2 right-2">
                <Badge className="text-[9px] uppercase border border-[hsl(43,60%,30%)]/50 bg-black/50">
                  {game.platform?.toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="p-3 flex flex-col flex-1 gap-2">
              <h3
                className="font-heading text-sm text-[hsl(45,30%,92%)] line-clamp-2"
                style={{ WebkitTextFillColor: "unset" }}
              >
                {game.title}
              </h3>
              {!compact && (
                <p className="text-[11px] text-[hsl(45,15%,65%)] font-body line-clamp-2">
                  {game.competitive?.blurb || game.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {modes.map((m) => (
                  <Badge key={m} variant="outline" className={`text-[9px] uppercase ${modeBadge[m]}`}>
                    {m}
                  </Badge>
                ))}
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                <Link href={`/play/${game.id}`}>
                  <Button size="sm" className="gilded-button h-8 text-xs">
                    <Play className="w-3 h-3 mr-1" /> Play
                  </Button>
                </Link>
                <Link href={`/leaderboards?game=${game.id}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-[hsl(43,60%,30%)]"
                  >
                    <Trophy className="w-3 h-3 mr-1" /> Board
                  </Button>
                </Link>
                {onPickForChallenge && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-[hsl(0,50%,40%)] text-[hsl(0,70%,70%)]"
                    onClick={() => onPickForChallenge(game.id)}
                  >
                    <Swords className="w-3 h-3 mr-1" /> Challenge
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
