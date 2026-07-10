import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Maximize2, Minimize2, Gamepad, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import type { Game } from "@shared/schema";
import grudgeLogo from "@assets/uXpJmRe_1773828784729.png";
import NotFound from "@/pages/not-found";
import { GameCover } from "@/components/game-cover";
import { loadRetroGameById, loadRetroCatalog } from "@/lib/retro-catalog";
import { getFleetEntry, resolveFleetId } from "@/data/fleetRegistry";
import { navigateGame, resolveGameLaunch } from "@/lib/game-launch";
import { CANONICAL } from "@/lib/canonicalDomains";
import { useAuth } from "@/components/auth-provider";
import { useAuthModal } from "@/components/auth-modal";

const PLATFORM_CORE_MAP: Record<string, string> = {
  nes: "nes",
  snes: "snes",
  genesis: "segaMD",
  n64: "n64",
  neogeo: "fbneo",
  playstation: "psx",
  gameboy: "gb",
  gba: "gba",
  nds: "nds",
};

/** Normalize smart/curly punctuation to ASCII so ROM filenames resolve on the server. */
function normalizeRomName(name: string): string {
  return name
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2026]/g, "...")
    .replace(/[\u00A0]/g, " ");
}

function normalizeEmbedUrl(url: string): string {
  try {
    const decoded = decodeURIComponent(url);
    const normalized = normalizeRomName(decoded);
    const qIdx = normalized.indexOf("?");
    if (qIdx === -1) return normalized;
    const base = normalized.slice(0, qIdx);
    const qs = new URLSearchParams(normalized.slice(qIdx + 1));
    return `${base}?${qs.toString()}`;
  } catch {
    return url;
  }
}

function buildEmulatorUrl(game: Game): string | null {
  const core = PLATFORM_CORE_MAP[game.platform];
  if (!core) return null;
  const title = normalizeRomName(game.title);
  return `/emulator.html?core=${core}&platform=${encodeURIComponent(game.platform)}&game=${encodeURIComponent(title)}`;
}

function buildLegacyEmbedUrl(game: Game): string | null {
  if (game.embedUrl) {
    // Prefer same-origin emulator proxy path when embed points at rec0ded templates
    if (game.embedUrl.includes("play-") && game.platform) {
      const emu = buildEmulatorUrl(game);
      if (emu) return emu;
    }
    if (game.embedUrl.startsWith("http")) return normalizeEmbedUrl(game.embedUrl);
    return `https://rec0ded88.com${normalizeEmbedUrl(game.embedUrl)}`;
  }
  const platformMap: Record<string, string> = {
    nes: "play-nes.html",
    snes: "play-snes.html",
    genesis: "play-sega-genesis.html",
    n64: "play-n64.html",
    neogeo: "play-neo-geo.html",
    playstation: "play-ps1.html",
    gameboy: "play-gb.html",
    gba: "play-gba.html",
    nds: "play-nds.html",
  };
  const embedFile = platformMap[game.platform];
  if (!embedFile) return null;
  const title = normalizeRomName(game.title);
  return `https://rec0ded88.com/wp-content/emu/html/${embedFile}?gameName=${encodeURIComponent(title)}.zip&gameID=${game.id}`;
}

/** Fleet / forge game player shell (external or internal). */
function FleetGamePlayer({ fleetId }: { fleetId: string }) {
  const [, setLocation] = useLocation();
  const { player } = useAuth();
  const { open: openAuth } = useAuthModal();
  const entry = getFleetEntry(fleetId);

  // Paid IDE — route through portal gate (not /forge — CF may redirect that host)
  useEffect(() => {
    if (entry?.id === "grudge-forge") {
      setLocation("/studio-forge");
    }
  }, [entry?.id, setLocation]);

  if (!entry) {
    return <NotFound />;
  }

  if (entry.id === "grudge-forge") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(225,30%,6%)" }}>
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
      </div>
    );
  }

  const launch = resolveGameLaunch({
    id: entry.id,
    route: entry.canonicalUrl,
    embedRoute: entry.embedUrl,
    allowEmbed: entry.allowEmbed,
  });

  const needsAuth = entry.authRequired && !player;

  return (
    <div className="min-h-screen" style={{ background: "hsl(225,30%,6%)" }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/super-engine")}
            className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)]"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Forge games
          </Button>
          <Badge variant="outline" className="border-amber-700/50 text-amber-400">
            {entry.status}
          </Badge>
        </div>

        <div className="fantasy-panel p-8">
          <h1 className="text-2xl font-heading text-[hsl(43,85%,65%)] mb-2">{entry.name}</h1>
          <p className="text-sm text-[hsl(45,15%,60%)] mb-6 max-w-2xl">{entry.description}</p>

          {needsAuth ? (
            <div className="rounded-xl border border-amber-800/40 bg-black/30 p-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Sign in with Grudge ID to play this title.
              </div>
              <Button className="dark-button" onClick={() => openAuth()}>
                Sign in
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button
                className="dark-button"
                onClick={() => navigateGame(launch.playUrl, setLocation)}
              >
                Play <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
              {launch.embedUrl && launch.mode !== "tab" && (
                <div className="w-full mt-4 aspect-video rounded-lg overflow-hidden border border-[hsl(43,60%,30%)]/40">
                  <iframe
                    src={launch.embedUrl}
                    className="w-full h-full border-0"
                    allowFullScreen
                    title={entry.name}
                  />
                </div>
              )}
              <p className="w-full text-[11px] text-[hsl(45,15%,50%)] mt-2">
                Launch URL:{" "}
                <code className="text-amber-500/80 break-all">
                  {launch.playUrl.startsWith("/")
                    ? `${CANONICAL.engine}${launch.playUrl}`
                    : launch.playUrl}
                </code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GamePlayer() {
  const [, fleetParams] = useRoute("/play/fleet/:id");
  const [, params] = useRoute("/play/:id");
  const [, setLocation] = useLocation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useEmulatorJS, setUseEmulatorJS] = useState(true);
  const [emulatorError, setEmulatorError] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);

  const rawId = fleetParams?.id ?? params?.id ?? null;
  const isFleetRoute = !!fleetParams?.id || (!!rawId && Number.isNaN(Number(rawId)));

  // Fleet / forge games (string id)
  if (isFleetRoute && rawId) {
    return <FleetGamePlayer fleetId={resolveFleetId(rawId)} />;
  }

  const gameId = rawId ? parseInt(rawId, 10) : null;

  const { data: game, isLoading, error } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
    queryFn: async () => {
      const fromCatalog = await loadRetroGameById(gameId!);
      if (fromCatalog) return fromCatalog;
      // Slug fallback
      const all = await loadRetroCatalog();
      const bySlug = all.find((g) => g.slug === rawId || String(g.id) === rawId);
      if (bySlug) return bySlug;
      const resp = await fetch(`/api/games/${gameId}`);
      if (!resp.ok) throw new Error("Game not found");
      return resp.json();
    },
    enabled: !!gameId && !Number.isNaN(gameId),
    retry: 1,
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen]);

  useEffect(() => {
    setEmulatorError(false);
    setUseEmulatorJS(true);
    setIframeFailed(false);
  }, [gameId]);

  // Probe emulator.html availability once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/emulator.html", { method: "HEAD", credentials: "same-origin" });
        // Soft 404: SPA shell without EmulatorJS markers
        if (!res.ok) {
          if (!cancelled) setEmulatorError(true);
          return;
        }
        const full = await fetch("/emulator.html?core=nes&platform=nes&game=test", {
          credentials: "same-origin",
        });
        const text = await full.text();
        if (!text.includes("EJS_player") && !text.includes("emulatorjs")) {
          if (!cancelled) setEmulatorError(true);
        }
      } catch {
        if (!cancelled) setEmulatorError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(225,30%,6%)" }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)] mx-auto mb-3" />
          <p className="text-[hsl(45,15%,60%)] font-body text-sm">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!game || error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "hsl(225,30%,6%)" }}>
        <NotFound />
        <Button onClick={() => setLocation("/games")} className="dark-button">
          Browse game library
        </Button>
      </div>
    );
  }

  const emulatorSrc = buildEmulatorUrl(game);
  const legacySrc = buildLegacyEmbedUrl(game);
  const embedSrc =
    useEmulatorJS && emulatorSrc && !emulatorError && !iframeFailed ? emulatorSrc : legacySrc;

  if (isFullscreen && embedSrc) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col">
        <div
          className="h-10 flex items-center justify-between px-4 shrink-0 border-b border-[hsl(43,60%,30%)]/30"
          style={{ background: "hsl(225,30%,8%)" }}
        >
          <div className="flex items-center gap-3">
            <img src={grudgeLogo} alt="" className="w-5 h-5 rounded" />
            <span className="text-[hsl(45,30%,90%)] font-heading text-sm">{game.title}</span>
            <Badge variant="outline" className="text-[10px] border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)]">
              {game.platform.toUpperCase()}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(false)}
            className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] h-7"
          >
            <Minimize2 className="w-4 h-4 mr-1" /> Exit
          </Button>
        </div>
        <div className="flex-1">
          <iframe
            src={embedSrc}
            className="w-full h-full border-0"
            allowFullScreen
            allow="autoplay; gamepad"
            sandbox={useEmulatorJS ? undefined : "allow-scripts allow-same-origin allow-popups"}
            title={game.title}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "hsl(225,30%,6%)" }}>
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/games")}
              className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)]"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Library
            </Button>
            <div className="flex items-center gap-3">
              <img src={grudgeLogo} alt="" className="w-7 h-7 rounded hidden sm:block" />
              <div>
                <h1
                  className="text-lg font-heading text-[hsl(43,85%,65%)]"
                  style={{ WebkitTextFillColor: "unset" }}
                >
                  {game.title}
                </h1>
                <Badge
                  variant="outline"
                  className="text-[10px] border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)]"
                >
                  {game.platform.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {emulatorSrc && legacySrc && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUseEmulatorJS(!useEmulatorJS);
                  setEmulatorError(false);
                  setIframeFailed(false);
                }}
                className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] text-xs"
              >
                {useEmulatorJS ? "Legacy Player" : "EmulatorJS"}
              </Button>
            )}
            {embedSrc && (
              <Button size="sm" onClick={() => setIsFullscreen(true)} className="dark-button">
                <Maximize2 className="w-4 h-4 mr-1" /> Fullscreen
              </Button>
            )}
          </div>
        </div>

        {embedSrc ? (
          <div className="fantasy-panel overflow-hidden">
            <div className="aspect-video w-full relative">
              <iframe
                src={embedSrc}
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; gamepad"
                sandbox={useEmulatorJS ? undefined : "allow-scripts allow-same-origin allow-popups"}
                title={game.title}
                onLoad={(e) => {
                  // Detect SPA fallback shell mistakenly serving emulator.html
                  try {
                    const doc = (e.target as HTMLIFrameElement).contentDocument;
                    if (doc?.body && doc.body.innerText.includes("404")) {
                      setIframeFailed(true);
                    }
                  } catch {
                    /* cross-origin legacy player — ignore */
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="fantasy-panel p-12 text-center">
            <Gamepad className="w-16 h-16 text-[hsl(43,60%,30%)] mx-auto mb-4" />
            <h3
              className="text-xl font-heading text-[hsl(43,85%,65%)] mb-2"
              style={{ WebkitTextFillColor: "unset" }}
            >
              Emulator unavailable
            </h3>
            <p className="text-[hsl(45,15%,60%)] mb-4 font-body">
              Could not build a play URL for this title. The ROM proxy or platform core may be missing.
            </p>
            <Button onClick={() => setLocation("/games")} className="dark-button">
              Browse Other Games
            </Button>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {(game as { thumbnailUrl?: string }).thumbnailUrl && (
            <div className="fantasy-panel p-3 flex items-center justify-center">
              <GameCover
                src={(game as { thumbnailUrl?: string }).thumbnailUrl}
                alt={game.title}
                className="max-h-48 object-contain rounded"
              />
            </div>
          )}
          <div className="fantasy-panel p-4">
            <h3
              className="text-sm font-heading text-[hsl(43,85%,55%)] uppercase mb-2 tracking-wider"
              style={{ WebkitTextFillColor: "unset" }}
            >
              Controls
            </h3>
            <div className="space-y-1 text-sm text-[hsl(45,30%,90%)] font-body">
              <div>Arrow Keys - D-Pad</div>
              <div>Z / X - A / B Buttons</div>
              <div>Enter - Start</div>
              <div>Shift - Select</div>
              <div>A / S - L / R Buttons</div>
            </div>
          </div>
          <div className="fantasy-panel p-4">
            <h3
              className="text-sm font-heading text-[hsl(43,85%,55%)] uppercase mb-2 tracking-wider"
              style={{ WebkitTextFillColor: "unset" }}
            >
              Game Info
            </h3>
            <div className="space-y-1 text-sm text-[hsl(45,30%,90%)] font-body">
              <div>
                Platform: <span className="text-[hsl(43,85%,55%)]">{game.platform.toUpperCase()}</span>
              </div>
              {game.category && (
                <div>
                  Category: <span className="text-[hsl(43,85%,55%)]">{game.category}</span>
                </div>
              )}
              {game.isFeatured && <div className="text-[hsl(35,100%,55%)]">Featured Classic</div>}
            </div>
          </div>
          <div className="fantasy-panel p-4">
            <h3
              className="text-sm font-heading text-[hsl(43,85%,55%)] uppercase mb-2 tracking-wider"
              style={{ WebkitTextFillColor: "unset" }}
            >
              Tips
            </h3>
            <div className="space-y-1 text-sm text-[hsl(45,30%,90%)] font-body">
              <div>Use Fullscreen for best experience</div>
              <div>Save states may not persist</div>
              <div>Keyboard recommended</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
