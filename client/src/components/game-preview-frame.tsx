/**
 * Super-engine preview container — best practice priority:
 * 1. Live iframe embed when safe (internal /games/*.html or allowlisted hosts)
 * 2. Cinematic cover art + Play CTA for external fleet (apex CSP)
 * 3. Lightweight Three.js vignette only when no cover art exists
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Box, MonitorPlay, ImageIcon } from "lucide-react";
import type { FleetGameCard } from "@/data/fleetGames";
import { openGameTab, resolveGameLaunch } from "@/lib/game-launch";
import { ForgePreviewCanvas } from "@/components/forge-preview-canvas";
import { GameCoverPreview } from "@/components/game-cover-preview";
import { DEFAULT_FORGE_SETTINGS, type ForgeRenderSettings } from "@/lib/engine3d";

type PreviewMode = "embed" | "cover" | "canvas";

interface GamePreviewFrameProps {
  game: FleetGameCard;
  className?: string;
  title?: string;
  forgeSettings?: ForgeRenderSettings;
  /** Force Three.js vignette when cover/embed available (dev showcase only) */
  preferCanvas?: boolean;
}

/** True if URL is a dedicated static game shell (good for iframe). */
function isStaticGameShell(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes("/games/") &&
    (url.endsWith(".html") || url.includes(".html?"))
  );
}

/** Same-origin /embed/* proxy (voxgrudge etc.) — best iframe target. */
function isProxiedPath(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("/embed/");
}

/** True if internal SPA route with embed query (minimal chrome). */
function isEmbeddableSpa(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!url.startsWith("/")) return false;
  return url.includes("embed=1") || url.includes("/embed/");
}

export function GamePreviewFrame({
  game,
  className = "",
  title,
  forgeSettings,
  preferCanvas = false,
}: GamePreviewFrameProps) {
  const settings = forgeSettings ?? DEFAULT_FORGE_SETTINGS;
  const launch = resolveGameLaunch(game);

  const hasCover = !!game.cardImage;
  const embedUrl = launch.embedUrl;
  const canIframe =
    !!embedUrl &&
    (launch.mode === "embed" ||
      launch.mode === "internal" ||
      isStaticGameShell(embedUrl) ||
      isEmbeddableSpa(embedUrl));

  // Best default: live embed when safe → cinematic cover → 3D vignette last (never junk shapes)
  const pickDefault = (): PreviewMode => {
    if (preferCanvas) return "canvas";
    // Prefer real HTML5 shells / same-origin proxies over heavy SPA iframes
    if (canIframe && (isStaticGameShell(embedUrl) || isProxiedPath(embedUrl))) return "embed";
    if (hasCover || launch.mode === "tab") return "cover";
    if (canIframe) return "embed";
    return "canvas";
  };

  const [mode, setMode] = useState<PreviewMode>(pickDefault);
  const [embedFailed, setEmbedFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    readyRef.current = false;
    setEmbedFailed(false);
    setMode(pickDefault());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on game switch
  }, [game.id, embedUrl, launch.mode, canIframe, hasCover, preferCanvas]);

  // Iframe readiness watchdog — fall back to cover (not shapes) on empty/fail
  useEffect(() => {
    if (mode !== "embed" || !embedUrl) return;

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
        if (!doc) {
          // No document after timeout — treat as failed embed
          setEmbedFailed(true);
          setMode(hasCover ? "cover" : "canvas");
          return;
        }
        const text = (doc.body?.innerText ?? doc.title ?? "").slice(0, 400);
        const title = (doc.title ?? "").toLowerCase();
        // SPA shell, 404, or empty placeholder mistaken for the game
        const isBroken =
          text.includes("Rec0deD") ||
          text.includes("Grudge Studio Gaming Portal") ||
          text.includes("404") ||
          title.includes("404") ||
          text.includes("NOT_FOUND") ||
          text.includes("Full game HTML to be deployed") ||
          (doc.body?.childElementCount ?? 0) === 0;
        if (isBroken) {
          setEmbedFailed(true);
          setMode(hasCover ? "cover" : "canvas");
        }
      } catch {
        /* cross-origin live embeds — keep iframe */
      }
    }, 6_000);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(watchdog);
    };
  }, [mode, embedUrl, hasCover]);

  const showModeToggle = canIframe || hasCover;

  return (
    <div className={`relative w-full h-full min-h-[220px] overflow-hidden flex flex-col bg-black ${className}`}>
      {/* Mode switcher */}
      {showModeToggle && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-1 rounded-lg bg-black/80 p-1 backdrop-blur-sm border border-gray-700/60">
          {canIframe && (
            <Button
              size="sm"
              variant={mode === "embed" ? "default" : "ghost"}
              className={`h-7 px-2 text-xs ${mode === "embed" ? "bg-orange-500 hover:bg-orange-600" : "text-gray-300"}`}
              onClick={() => {
                setEmbedFailed(false);
                setMode("embed");
              }}
            >
              <MonitorPlay className="w-3 h-3 mr-1" />
              Live
            </Button>
          )}
          <Button
            size="sm"
            variant={mode === "cover" ? "default" : "ghost"}
            className={`h-7 px-2 text-xs ${mode === "cover" ? "bg-orange-500 hover:bg-orange-600" : "text-gray-300"}`}
            onClick={() => setMode("cover")}
          >
            <ImageIcon className="w-3 h-3 mr-1" />
            Cover
          </Button>
          <Button
            size="sm"
            variant={mode === "canvas" ? "default" : "ghost"}
            className={`h-7 px-2 text-xs ${mode === "canvas" ? "bg-orange-500 hover:bg-orange-600" : "text-gray-300"}`}
            onClick={() => setMode("canvas")}
          >
            <Box className="w-3 h-3 mr-1" />
            3D
          </Button>
        </div>
      )}

      {/* Primary surface */}
      {mode === "embed" && embedUrl && !embedFailed ? (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="absolute inset-0 block h-full w-full border-0"
          title={title ?? game.name}
          allow="autoplay; fullscreen; gamepad; xr-spatial-tracking; accelerometer; gyroscope; clipboard-write; pointer-lock"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
          onError={() => {
            setEmbedFailed(true);
            setMode(hasCover ? "cover" : "canvas");
          }}
        />
      ) : mode === "canvas" ? (
        <ForgePreviewCanvas game={game} settings={settings} className="absolute inset-0" />
      ) : (
        <GameCoverPreview
          game={game}
          className="absolute inset-0"
          onPlay={() => {
            if (canIframe && embedUrl) {
              setEmbedFailed(false);
              setMode("embed");
              return;
            }
            openGameTab(launch.playUrl);
          }}
        />
      )}

      {/* Tab-only external games always show a floating open button on canvas mode */}
      {mode === "canvas" && launch.mode === "tab" && (
        <div className="absolute bottom-4 right-4 z-20">
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
            onClick={() => openGameTab(launch.playUrl)}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Open game
          </Button>
        </div>
      )}

      {mode === "canvas" && (
        <div className="absolute bottom-3 left-3 z-10">
          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-[10px]">
            3D vignette · not the live game
          </Badge>
        </div>
      )}
      {mode === "embed" && (
        <div className="absolute bottom-3 left-3 z-10">
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
            Live embed
          </Badge>
        </div>
      )}
    </div>
  );
}
