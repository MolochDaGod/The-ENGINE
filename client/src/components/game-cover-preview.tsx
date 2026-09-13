/**
 * High-quality cover / poster preview for super-engine containers.
 * Used when live iframe is blocked (apex CSP) or unavailable — never raw geometric trash.
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Play } from "lucide-react";
import type { FleetGameCard } from "@/data/fleetGames";
import { openGameTab, resolveGameLaunch } from "@/lib/game-launch";

interface GameCoverPreviewProps {
  game: FleetGameCard;
  className?: string;
  onPlay?: () => void;
}

export function GameCoverPreview({ game, className = "", onPlay }: GameCoverPreviewProps) {
  const launch = resolveGameLaunch(game);

  const handlePlay = () => {
    if (onPlay) {
      onPlay();
      return;
    }
    openGameTab(launch.playUrl);
  };

  return (
    <div className={`relative w-full h-full min-h-[200px] overflow-hidden bg-black ${className}`}>
      {/* Cover art or rich gradient fallback */}
      {game.cardImage ? (
        <img
          src={game.cardImage}
          alt={game.name}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${game.color}`} />
      )}

      {/* Cinematic overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 30% 20%, rgba(251,146,60,0.25), transparent 55%)",
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-end p-6 md:p-10 text-center">
        <span className="text-5xl md:text-6xl drop-shadow-lg mb-3" aria-hidden>
          {game.emoji}
        </span>
        <h3 className="text-xl md:text-2xl font-bold text-white drop-shadow-md mb-1">
          {game.name}
        </h3>
        {game.disambiguation && (
          <p className="text-xs text-orange-200/80 mb-2">{game.disambiguation}</p>
        )}
        <p className="text-sm text-gray-300 max-w-md mb-4 line-clamp-2">{game.description}</p>
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40">{game.type}</Badge>
          <Badge className="bg-white/10 text-gray-200 border-white/20">{game.engine}</Badge>
          {game.capabilities.slice(0, 3).map((c) => (
            <Badge key={c} variant="outline" className="text-[10px] border-white/20 text-gray-300">
              {c}
            </Badge>
          ))}
        </div>
        <Button
          size="lg"
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg shadow-orange-500/30"
          onClick={handlePlay}
        >
          <Play className="w-5 h-5 mr-2 fill-current" />
          Play {game.name}
          {!launch.playUrl.startsWith("/") && <ExternalLink className="w-4 h-4 ml-2" />}
        </Button>
        <p className="text-[10px] text-gray-500 mt-3">
          {launch.mode === "tab"
            ? "Opens in a new tab (embed blocked on apex portal host)"
            : "Live preview available — switch to Live Embed when ready"}
        </p>
      </div>
    </div>
  );
}
