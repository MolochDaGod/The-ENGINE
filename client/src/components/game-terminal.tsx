import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Gamepad2,
  Library,
  Maximize2,
  Minimize2,
  Search,
  Settings2,
  Terminal,
  X,
} from "lucide-react";
import { FORGE_GAMES, resolveFleetGameId, type Capability, type FleetGameCard } from "@/data/fleetGames";
import { GamePreviewFrame } from "@/components/game-preview-frame";
import { ForgeSystemPanel } from "@/components/forge-system-panel";
import { navigateGame, openGameTab, resolveGameLaunch } from "@/lib/game-launch";
import { DEFAULT_FORGE_SETTINGS, type ForgeRenderSettings } from "@/lib/engine3d";
import { SuperEngineStack } from "@/components/super-engine-stack";

const FILTER_TAGS: { id: "all" | Capability; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "3D", label: "3D" },
  { id: "2D", label: "2D" },
  { id: "Multiplayer", label: "MP" },
  { id: "Physics", label: "PHYS" },
  { id: "AI", label: "AI" },
];

function ForgeListThumb({ game }: { game: FleetGameCard }) {
  if (game.cardImage) {
    return (
      <img
        src={game.cardImage}
        alt=""
        className="h-10 w-10 shrink-0 rounded object-cover"
        loading="lazy"
        draggable={false}
      />
    );
  }
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gradient-to-br ${game.color} text-lg`}>
      {game.emoji}
    </div>
  );
}

function TerminalLog({ lines }: { lines: string[] }) {
  return (
    <div className="hidden shrink-0 border-t border-[hsl(43,60%,30%)]/25 bg-black/50 px-3 py-2 font-mono text-[10px] leading-relaxed text-[hsl(45,15%,55%)] sm:block">
      {lines.map((line) => (
        <div key={line} className="truncate">
          <span className="text-[hsl(43,85%,55%)]">❯</span> {line}
        </div>
      ))}
    </div>
  );
}

export interface GameTerminalProps {
  games?: FleetGameCard[];
  defaultGameId?: string;
}

export function GameTerminal({ games = FORGE_GAMES, defaultGameId }: GameTerminalProps) {
  const [, navigate] = useLocation();
  const [, legacyMatch] = useRoute("/super-engine/:legacyId");
  const legacyId = legacyMatch?.legacyId;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<"all" | Capability>("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [forgeSettings, setForgeSettings] = useState<ForgeRenderSettings>(DEFAULT_FORGE_SETTINGS);
  const searchRef = useRef<HTMLInputElement>(null);

  const forgeHydrated = useRef(false);
  const forgeSaveTimer = useRef<number | null>(null);

  // Hydrate super-engine forge presets from account play settings when signed in
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/play-settings", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const forge = data?.settings?.forge;
        if (!forge || cancelled) return;
        setForgeSettings((prev) => ({
          ...prev,
          ...(forge.lighting ? { lighting: forge.lighting } : {}),
          ...(forge.camera ? { camera: forge.camera } : {}),
          ...(forge.toneMapping ? { toneMapping: forge.toneMapping } : {}),
          ...(typeof forge.exposure === "number" ? { exposure: forge.exposure } : {}),
          ...(typeof forge.pixelRatio === "number" ? { pixelRatio: forge.pixelRatio } : {}),
          ...(typeof forge.showGrid === "boolean" ? { showGrid: forge.showGrid } : {}),
          ...(typeof forge.fogEnabled === "boolean" ? { fogEnabled: forge.fogEnabled } : {}),
          ...(typeof forge.autoRotate === "boolean" ? { autoRotate: forge.autoRotate } : {}),
          ...(typeof forge.shadows === "boolean" ? { shadows: forge.shadows } : {}),
        }));
        forgeHydrated.current = true;
      } catch {
        /* guest / offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateForgeSettings = useCallback((next: ForgeRenderSettings) => {
    setForgeSettings(next);
    if (forgeSaveTimer.current) window.clearTimeout(forgeSaveTimer.current);
    forgeSaveTimer.current = window.setTimeout(() => {
      fetch("/api/me/play-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { forge: next } }),
      }).catch(() => {});
    }, 800);
  }, []);

  const resolvedLegacy = legacyId ? resolveFleetGameId(legacyId) : null;

  useEffect(() => {
    if (resolvedLegacy) {
      setSelectedId(resolvedLegacy);
      // Deep links like /super-engine/grudge-drive open the play canvas immediately
      setFullscreen(true);
      return;
    }
    if (defaultGameId) {
      setSelectedId(resolveFleetGameId(defaultGameId));
    }
  }, [resolvedLegacy, defaultGameId]);

  const filteredGames = useMemo(() => {
    const q = search.trim().toLowerCase();
    return games.filter((game) => {
      const matchesTag = tag === "all" || game.capabilities.includes(tag);
      const matchesSearch =
        !q ||
        game.name.toLowerCase().includes(q) ||
        game.type.toLowerCase().includes(q) ||
        game.description.toLowerCase().includes(q) ||
        game.id.includes(q);
      return matchesTag && matchesSearch;
    });
  }, [games, search, tag]);

  const selectedGame = useMemo(
    () => (selectedId ? games.find((g) => g.id === selectedId) ?? null : null),
    [games, selectedId],
  );

  const launch = selectedGame ? resolveGameLaunch(selectedGame) : null;

  const selectGame = useCallback(
    (gameId: string) => {
      const resolved = resolveFleetGameId(gameId);
      setSelectedId(resolved);
      navigate(`/super-engine/${resolved}`, { replace: false });
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    },
    [navigate],
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    navigate("/super-engine");
  }, [navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const logLines = [
    `SUPER ENGINE — live stack · ThreeFlow · Rapier · Node · D1 · ${games.length} titles`,
    selectedGame
      ? `SESSION: ${selectedGame.name} (${launch?.mode ?? "idle"})`
      : "AWAITING SELECTION — pick a title from the catalog",
    `HOST: ${typeof window !== "undefined" ? window.location.hostname : "portal"}`,
  ];

  const shell = (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[hsl(225,30%,6%)] text-[hsl(45,30%,90%)]">
      {/* Terminal chrome */}
      <header className="flex shrink-0 items-center gap-3 border-b border-[hsl(43,60%,30%)]/30 bg-[hsl(225,30%,8%)]/95 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Terminal className="h-4 w-4 shrink-0 text-[hsl(43,85%,55%)]" />
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(45,15%,60%)]">
            GRUDGE STUDIO // GAME TERMINAL
          </span>
          <Badge variant="outline" className="hidden border-[hsl(43,60%,30%)]/40 text-[10px] text-[hsl(43,85%,55%)] sm:inline-flex">
            {games.length} GAMES
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[hsl(45,15%,60%)] hover:text-white md:hidden"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle catalog"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <Link href="/gs">
            <Button variant="ghost" size="sm" className="h-8 text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)]">
              Portal
            </Button>
          </Link>
        </div>
      </header>
      <SuperEngineStack />

      <div className="relative flex min-h-0 flex-1">
        {/* Catalog sidebar */}
        <aside
          className={`absolute inset-y-0 left-0 z-20 flex w-[min(100%,320px)] flex-col border-r border-[hsl(43,60%,30%)]/25 bg-[hsl(225,28%,9%)]/98 backdrop-blur-md transition-transform md:static md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="shrink-0 space-y-2 border-b border-[hsl(43,60%,30%)]/20 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(45,15%,45%)]" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fleet… (/)"
                className="h-9 border-[hsl(43,60%,30%)]/30 bg-black/30 pl-8 font-mono text-xs text-[hsl(45,30%,90%)] placeholder:text-[hsl(45,15%,40%)]"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTER_TAGS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTag(f.id)}
                  className={`rounded border px-2 py-0.5 font-mono text-[9px] tracking-wide transition-colors ${
                    tag === f.id
                      ? "border-[hsl(43,85%,55%)]/50 bg-[hsl(43,85%,55%)]/10 text-[hsl(43,85%,55%)]"
                      : "border-[hsl(43,60%,30%)]/25 text-[hsl(45,15%,50%)] hover:border-[hsl(43,60%,30%)]/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filteredGames.length === 0 ? (
              <p className="px-2 py-6 text-center font-mono text-xs text-[hsl(45,15%,45%)]">No matches</p>
            ) : (
              <ul className="space-y-1">
                {filteredGames.map((game) => {
                  const active = selectedId === game.id;
                  return (
                    <li key={game.id}>
                      <button
                        type="button"
                        onClick={() => selectGame(game.id)}
                        className={`flex w-full items-center gap-2.5 rounded-md border px-2 py-2 text-left transition-all ${
                          active
                            ? "border-[hsl(43,85%,55%)]/50 bg-[hsl(43,85%,55%)]/10 shadow-[0_0_12px_rgba(212,175,55,0.12)]"
                            : "border-transparent hover:border-[hsl(43,60%,30%)]/30 hover:bg-black/25"
                        }`}
                        data-testid={`terminal-game-${game.id}`}
                      >
                        <ForgeListThumb game={game} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-[hsl(45,30%,92%)]">{game.name}</div>
                          <div className="truncate font-mono text-[9px] uppercase tracking-wide text-[hsl(45,15%,45%)]">
                            {game.type}
                          </div>
                        </div>
                        {active && (
                          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[hsl(120,60%,50%)]" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="shrink-0 space-y-1 border-t border-[hsl(43,60%,30%)]/20 p-2">
            <Link href="/games">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start border-[hsl(43,60%,30%)]/35 text-[hsl(45,15%,65%)] hover:border-[hsl(43,85%,55%)]/50 hover:text-[hsl(43,85%,55%)]"
              >
                <Library className="mr-2 h-3.5 w-3.5" />
                Retro Library (1,360+)
              </Button>
            </Link>
          </div>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="absolute inset-0 z-10 bg-black/50 md:hidden"
            aria-label="Close catalog"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Player viewport */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[hsl(43,60%,30%)]/20 bg-black/40 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              {selectedGame ? (
                <>
                  <span className="text-xl">{selectedGame.emoji}</span>
                  <div className="min-w-0">
                    <h1 className="truncate text-sm font-semibold text-[hsl(43,85%,65%)]">{selectedGame.name}</h1>
                    <p className="truncate font-mono text-[9px] text-[hsl(45,15%,45%)]">{selectedGame.engine}</p>
                  </div>
                  <Badge variant="outline" className="hidden border-[hsl(43,60%,30%)]/40 text-[10px] sm:inline-flex">
                    {selectedGame.type}
                  </Badge>
                </>
              ) : (
                <div className="flex items-center gap-2 text-[hsl(45,15%,55%)]">
                  <Gamepad2 className="h-4 w-4" />
                  <span className="font-mono text-xs">SELECT A TITLE TO BOOT</span>
                </div>
              )}
            </div>
            {selectedGame && (
              <div className="flex shrink-0 items-center gap-1">
                {launch?.mode === "tab" && (
                  <Button
                    size="sm"
                    className="gilded-button h-8 px-3 text-xs"
                    onClick={() => openGameTab(launch.playUrl)}
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Launch
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-[hsl(45,15%,55%)]"
                  onClick={() => setFullscreen(true)}
                  aria-label="Fullscreen"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-[hsl(45,15%,55%)]"
                  onClick={() => navigateGame(selectedGame.route, navigate)}
                  aria-label="Open full page"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-[hsl(45,15%,55%)]"
                  onClick={clearSelection}
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="relative min-h-0 flex-1 bg-black">
            {selectedGame ? (
              <>
                <GamePreviewFrame
                  game={selectedGame}
                  forgeSettings={forgeSettings}
                  className="absolute inset-0"
                />
                <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-[hsl(43,60%,30%)]/50 bg-black/70 text-[hsl(43,85%,55%)] backdrop-blur-sm hover:bg-black/90"
                    onClick={() => setSettingsOpen((v) => !v)}
                  >
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    Systems
                  </Button>
                  {settingsOpen && (
                    <div className="w-[min(100vw-2rem,320px)] max-h-[min(60vh,420px)] overflow-y-auto shadow-xl">
                      <ForgeSystemPanel
                        settings={forgeSettings}
                        onChange={updateForgeSettings}
                        compact
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="rounded-full border border-[hsl(43,60%,30%)]/40 bg-[hsl(225,28%,10%)] p-6">
                  <Terminal className="h-12 w-12 text-[hsl(43,85%,55%)]" />
                </div>
                <div>
                  <h2 className="gold-text text-2xl">Grudge Studio Forge</h2>
                  <p className="mt-2 max-w-md font-mono text-xs leading-relaxed text-[hsl(45,15%,55%)]">
                    Unified game terminal — one container, every Grudge title. Pick from the catalog or deep-link
                    /super-engine/&lt;game-id&gt;.
                  </p>
                </div>
                <Button
                  className="gilded-button"
                  onClick={() => {
                    const first = filteredGames[0] ?? games[0];
                    if (first) selectGame(first.id);
                  }}
                >
                  Boot first title
                </Button>
              </div>
            )}
          </div>

          <TerminalLog lines={logLines} />
        </main>
      </div>
    </div>
  );

  if (fullscreen && selectedGame) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <div className="flex shrink-0 items-center justify-between border-b border-[hsl(43,60%,30%)]/30 bg-[hsl(225,30%,8%)] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{selectedGame.emoji}</span>
            <span className="font-semibold text-[hsl(43,85%,65%)]">{selectedGame.name}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFullscreen(false)}
            className="text-[hsl(45,15%,60%)] hover:text-white"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative min-h-0 flex-1">
          <GamePreviewFrame
            game={selectedGame}
            forgeSettings={forgeSettings}
            className="absolute inset-0"
          />
          <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-[hsl(43,60%,30%)]/50 bg-black/70 text-[hsl(43,85%,55%)] backdrop-blur-sm"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Systems
            </Button>
            {settingsOpen && (
              <div className="w-[min(100vw-2rem,320px)] max-h-[min(50vh,380px)] overflow-y-auto shadow-xl">
                <ForgeSystemPanel
                  settings={forgeSettings}
                  onChange={updateForgeSettings}
                  compact
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return shell;
}