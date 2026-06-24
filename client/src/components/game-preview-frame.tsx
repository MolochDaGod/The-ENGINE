import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { FleetGameCard } from "@/data/fleetGames";
import { openGameTab, resolveGameLaunch } from "@/lib/game-launch";

interface GamePreviewFrameProps {
  game: FleetGameCard;
  className?: string;
  title?: string;
}

export function GamePreviewFrame({ game, className = "", title }: GamePreviewFrameProps) {
  const launch = resolveGameLaunch(game);
  const [blocked, setBlocked] = useState(launch.mode === "tab");

  if (blocked || !launch.embedUrl) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-black/85 p-8 text-center ${className}`}>
        <p className="text-gray-300 mb-2 max-w-md">
          {game.name} opens in a dedicated window — embedded preview is not available from this portal host.
        </p>
        {game.disambiguation && (
          <p className="text-xs text-gray-500 mb-4">{game.disambiguation}</p>
        )}
        <Button
          className="bg-orange-500 hover:bg-orange-600 text-white"
          onClick={() => openGameTab(launch.playUrl)}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open {game.name}
        </Button>
      </div>
    );
  }

  return (
    <iframe
      src={launch.embedUrl}
      className={className}
      title={title ?? game.name}
      allow="autoplay; fullscreen; gamepad"
      onError={() => setBlocked(true)}
    />
  );
}