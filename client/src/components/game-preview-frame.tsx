import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Box, MonitorPlay } from "lucide-react";
import type { FleetGameCard } from "@/data/fleetGames";
import { openGameTab, resolveGameLaunch } from "@/lib/game-launch";
import { ForgePreviewCanvas } from "@/components/forge-preview-canvas";
import type { ForgeRenderSettings } from "@/lib/engine3d";

type PreviewMode = "embed" | "canvas" | "tab";

interface GamePreviewFrameProps {
  game: FleetGameCard;
  className?: string;
  title?: string;
  forgeSettings?: ForgeRenderSettings;
  /** Prefer live Three.js canvas over iframe when both are available */
  preferCanvas?: boolean;
}

export function GamePreviewFrame({
  game,
  className = "",
  title,
  forgeSettings,
  preferCanvas = false,
}: GamePreviewFrameProps) {
  const launch = resolveGameLaunch(game);
  const canEmbed = launch.mode === "embed" || launch.mode === "internal";
  const canCanvas = game.previewType === "threejs" || game.previewType === "canvas2d" || preferCanvas;

  const defaultMode: PreviewMode = preferCanvas && canCanvas
    ? "canvas"
    : canEmbed
      ? "embed"
      : canCanvas
        ? "canvas"
        : "tab";

  const [mode, setMode] = useState<PreviewMode>(defaultMode);
  const [embedFailed, setEmbedFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    readyRef.current = false;
    setEmbedFailed(false);
    setMode(
      preferCanvas && canCanvas
        ? "canvas"
        : canEmbed
          ? "embed"
          : canCanvas
            ? "canvas"
            : "tab",
    );
  }, [game.id, launch.embedUrl, launch.mode, canEmbed, canCanvas, preferCanvas]);

  useEffect(() => {
    if (mode !== "embed" || !launch.embedUrl) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "grudge:game:ready") {
        readyRef.current = true;
      }
    };
    window.addEventListener("message", onMessage);

    const watchdog = window.setTimeout(() => {
      if (readyRef.current) return;
      try {
        const doc = iframeRef.current?.contentDocument;
        if (doc && doc.body && doc.body.childElementCount === 0) {
          setEmbedFailed(true);
          if (canCanvas) setMode("canvas");
        }
      } catch {
        /* cross-origin — cannot inspect; keep iframe visible */
      }
    }, 12_000);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(watchdog);
    };
  }, [mode, launch.embedUrl, canCanvas]);

  if (mode === "tab" || (!canEmbed && !canCanvas)) {
    return (
      <div className={`flex flex-col items-center justify-center h-full min-h-[200px] bg-black/85 p-8 text-center ${className}`}>
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
    <div className={`relative w-full h-full min-h-[200px] overflow-hidden flex flex-col ${className}`}>
      {canEmbed && canCanvas && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-1 rounded-lg bg-black/75 p-1 backdrop-blur-sm border border-gray-700/50">
          <Button
            size="sm"
            variant={mode === "canvas" ? "default" : "ghost"}
            className={`h-7 px-2 text-xs ${mode === "canvas" ? "bg-orange-500 hover:bg-orange-600" : "text-gray-300"}`}
            onClick={() => setMode("canvas")}
          >
            <Box className="w-3 h-3 mr-1" />
            Forge Canvas
          </Button>
          <Button
            size="sm"
            variant={mode === "embed" ? "default" : "ghost"}
            className={`h-7 px-2 text-xs ${mode === "embed" ? "bg-orange-500 hover:bg-orange-600" : "text-gray-300"}`}
            onClick={() => setMode("embed")}
          >
            <MonitorPlay className="w-3 h-3 mr-1" />
            Live Embed
          </Button>
        </div>
      )}

      {mode === "canvas" && forgeSettings ? (
        <ForgePreviewCanvas game={game} settings={forgeSettings} className="absolute inset-0" />
      ) : mode === "canvas" && !forgeSettings ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-gray-400 text-sm">
          Forge canvas requires system settings
        </div>
      ) : embedFailed && forgeSettings ? (
        <ForgePreviewCanvas game={game} settings={forgeSettings} className="absolute inset-0" />
      ) : (
        <iframe
          ref={iframeRef}
          src={launch.embedUrl!}
          className="absolute inset-0 block h-full w-full border-0"
          title={title ?? game.name}
          allow="autoplay; fullscreen; gamepad; xr-spatial-tracking; accelerometer; gyroscope; clipboard-write; pointer-lock"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
          onError={() => {
            setEmbedFailed(true);
            if (canCanvas) setMode("canvas");
          }}
        />
      )}

      {mode === "canvas" && (
        <div className="absolute bottom-3 left-3 z-10">
          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-[10px]">
            Grudge Forge · Three.js Preview
          </Badge>
        </div>
      )}
    </div>
  );
}