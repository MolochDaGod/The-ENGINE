import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Maximize2, Minimize2, Gamepad2, Loader2, Play, Trophy, Swords, Users, Flame } from "lucide-react";
import type { Game } from "@shared/schema";
import grudgeLogo from "@assets/uXpJmRe_1773828784729.png";
import NotFound from "@/pages/not-found";
import {
  startScoreListener,
  fetchLeaderboard,
  fetchPersonalBest,
  connectEngine,
  joinGame,
  leaveGame,
  fetchOpenChallenges,
  createChallenge,
  acceptChallenge,
} from "@/lib/engine-sdk";

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

function buildEmulatorUrl(game: Game): string | null {
  const core = PLATFORM_CORE_MAP[game.platform];
  if (!core) return null;

  return `/emulator.html?core=${core}&platform=${encodeURIComponent(game.platform)}&game=${encodeURIComponent(game.title)}`;
}

function buildLegacyEmbedUrl(game: Game): string | null {
  if (game.embedUrl) {
    return `https://rec0ded88.com${game.embedUrl}`;
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
  return `https://rec0ded88.com/wp-content/emu/html/${embedFile}?gameName=${encodeURIComponent(game.title)}.zip&gameID=${game.id}`;
}

export default function GamePlayer() {
  const [, params] = useRoute("/play/:id");
  const [, setLocation] = useLocation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useEmulatorJS, setUseEmulatorJS] = useState(true);
  const [emulatorError, setEmulatorError] = useState(false);
  const [scoreToast, setScoreToast] = useState<{ score: number; isPersonalBest: boolean; isGlobalRecord: boolean } | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [personalBest, setPersonalBest] = useState<any>(null);
  const [challenges, setChallenges] = useState<any[]>([]);
  const gameId = params?.id ? parseInt(params.id) : null;

  const { data: game, isLoading } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
    queryFn: async () => {
      const resp = await fetch(`/api/games/${gameId}`);
      if (!resp.ok) throw new Error("Game not found");
      return resp.json();
    },
    enabled: !!gameId,
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
  }, [gameId]);

  // Score listener + presence + leaderboard
  useEffect(() => {
    if (!gameId || !game) return;

    // Start score listener from emulator iframe
    const cleanupScores = startScoreListener(gameId, (data) => {
      setScoreToast(data);
      setTimeout(() => setScoreToast(null), 4000);
      // Refresh leaderboard
      fetchLeaderboard(gameId, 10).then(d => setLeaderboard(d.leaderboard || []));
      fetchPersonalBest(gameId).then(pb => setPersonalBest(pb));
    });

    // Load initial leaderboard + personal best
    fetchLeaderboard(gameId, 10).then(d => setLeaderboard(d.leaderboard || []));
    fetchPersonalBest(gameId).then(pb => setPersonalBest(pb));

    // Load challenges for this game
    fetchOpenChallenges().then(all => {
      setChallenges((all || []).filter((c: any) => c.gameId === gameId));
    });

    // Connect to Socket.IO and join game room
    connectEngine().then(() => {
      joinGame(gameId, game.title);
    });

    return () => {
      cleanupScores?.();
      leaveGame(gameId);
    };
  }, [gameId, game?.title]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(225,30%,6%)' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)] mx-auto mb-3" />
          <p className="text-[hsl(45,15%,60%)] font-body text-sm">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return <NotFound />;
  }

  const emulatorSrc = buildEmulatorUrl(game);
  const legacySrc = buildLegacyEmbedUrl(game);
  const embedSrc = useEmulatorJS && emulatorSrc && !emulatorError ? emulatorSrc : legacySrc;

  if (isFullscreen && embedSrc) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col">
        <div className="h-10 flex items-center justify-between px-4 shrink-0 border-b border-[hsl(43,60%,30%)]/30" style={{ background: 'hsl(225,30%,8%)' }}>
          <div className="flex items-center gap-3">
            <img src={grudgeLogo} alt="" className="w-5 h-5 rounded" />
            <span className="text-[hsl(45,30%,90%)] font-heading text-sm">{game.title}</span>
            <Badge variant="outline" className="text-[10px] border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)]">
              {game.platform.toUpperCase()}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(false)} className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] h-7">
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
    <div className="min-h-screen" style={{ background: 'hsl(225,30%,6%)' }}>
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/games")} className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Library
            </Button>
            <div className="flex items-center gap-3">
              <img src={grudgeLogo} alt="" className="w-7 h-7 rounded hidden sm:block" />
              <div>
                <h1 className="text-lg font-heading text-[hsl(43,85%,65%)]" style={{ WebkitTextFillColor: 'unset' }}>{game.title}</h1>
                <Badge variant="outline" className="text-[10px] border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)]">
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
                onClick={() => { setUseEmulatorJS(!useEmulatorJS); setEmulatorError(false); }}
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
            <div className="aspect-video w-full">
              <iframe
                src={embedSrc}
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; gamepad"
                sandbox={useEmulatorJS ? undefined : "allow-scripts allow-same-origin allow-popups"}
                title={game.title}
                onError={() => {
                  if (useEmulatorJS) {
                    setEmulatorError(true);
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="fantasy-panel p-12 text-center">
            <Gamepad2 className="w-16 h-16 text-[hsl(43,60%,30%)] mx-auto mb-4" />
            <h3 className="text-xl font-heading text-[hsl(43,85%,65%)] mb-2" style={{ WebkitTextFillColor: 'unset' }}>Emulator Coming Soon</h3>
            <p className="text-[hsl(45,15%,60%)] mb-4 font-body">This game is being set up for web play. Check back soon!</p>
            <Button onClick={() => setLocation("/games")} className="dark-button">
              Browse Other Games
            </Button>
          </div>
        )}

        {/* Score toast notification */}
        {scoreToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
            <div className={`px-6 py-3 rounded-lg border-2 shadow-lg ${
              scoreToast.isGlobalRecord
                ? 'bg-gradient-to-r from-[hsl(43,70%,25%)] to-[hsl(35,60%,20%)] border-[hsl(43,85%,55%)] text-[hsl(43,90%,70%)]'
                : scoreToast.isPersonalBest
                  ? 'bg-gradient-to-r from-[hsl(225,25%,14%)] to-[hsl(225,28%,10%)] border-[hsl(43,60%,30%)] text-[hsl(43,85%,65%)]'
                  : 'bg-[hsl(225,25%,14%)] border-[hsl(220,15%,25%)] text-[hsl(45,30%,90%)]'
            }`}>
              <div className="flex items-center gap-3 font-heading text-sm">
                {scoreToast.isGlobalRecord ? (
                  <><Flame className="w-5 h-5 text-[hsl(43,85%,55%)]" /> NEW WORLD RECORD! {scoreToast.score.toLocaleString()} pts</>
                ) : scoreToast.isPersonalBest ? (
                  <><Trophy className="w-5 h-5 text-[hsl(43,85%,55%)]" /> New Personal Best! {scoreToast.score.toLocaleString()} pts</>
                ) : (
                  <>Score: {scoreToast.score.toLocaleString()} pts</>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Leaderboard */}
          <div className="fantasy-panel p-4 md:col-span-1">
            <h3 className="text-sm font-heading text-[hsl(43,85%,55%)] uppercase mb-3 tracking-wider flex items-center gap-2" style={{ WebkitTextFillColor: 'unset' }}>
              <Trophy className="w-4 h-4" /> Leaderboard
            </h3>
            {personalBest && (
              <div className="mb-3 p-2 rounded border border-[hsl(43,60%,30%)]/30 bg-[hsl(43,40%,18%)]/20">
                <div className="text-[10px] text-[hsl(45,15%,60%)] font-heading uppercase">Your Best</div>
                <div className="text-sm text-[hsl(43,85%,65%)] font-heading">{personalBest.score?.toLocaleString()} pts</div>
              </div>
            )}
            {leaderboard.length > 0 ? (
              <div className="space-y-1">
                {leaderboard.map((entry: any, i: number) => (
                  <div key={entry.id || i} className="flex items-center gap-2 text-xs font-body">
                    <span className={`w-5 text-center font-heading ${
                      i === 0 ? 'text-[hsl(43,85%,55%)]' : i === 1 ? 'text-[hsl(45,30%,70%)]' : i === 2 ? 'text-[hsl(30,60%,50%)]' : 'text-[hsl(45,15%,50%)]'
                    }`}>{i + 1}</span>
                    <span className="flex-1 text-[hsl(45,30%,90%)] truncate">{entry.username}</span>
                    <span className="text-[hsl(43,85%,55%)] font-heading">{entry.score?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[hsl(45,15%,50%)] font-body text-center py-3">No scores yet — be the first!</div>
            )}
          </div>

          {/* Game info panels */}
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="fantasy-panel p-4">
              <h3 className="text-sm font-heading text-[hsl(43,85%,55%)] uppercase mb-2 tracking-wider" style={{ WebkitTextFillColor: 'unset' }}>Controls</h3>
              <div className="space-y-1 text-sm text-[hsl(45,30%,90%)] font-body">
                <div>Arrow Keys - D-Pad</div>
                <div>Z / X - A / B Buttons</div>
                <div>Enter - Start</div>
                <div>Shift - Select</div>
                <div>A / S - L / R Buttons</div>
              </div>
            </div>
            <div className="fantasy-panel p-4">
              <h3 className="text-sm font-heading text-[hsl(43,85%,55%)] uppercase mb-2 tracking-wider" style={{ WebkitTextFillColor: 'unset' }}>Game Info</h3>
              <div className="space-y-1 text-sm text-[hsl(45,30%,90%)] font-body">
                <div>Platform: <span className="text-[hsl(43,85%,55%)]">{game.platform.toUpperCase()}</span></div>
                {game.category && <div>Category: <span className="text-[hsl(43,85%,55%)]">{game.category}</span></div>}
                {(game as any).multiplayerType && (game as any).multiplayerType !== "solo" && (
                  <div className="flex items-center gap-1">
                    {(game as any).multiplayerType === "pvp_local" && <><Swords className="w-3 h-3" /> PvP</>}
                    {(game as any).multiplayerType === "coop" && <><Users className="w-3 h-3" /> Co-op</>}
                    {(game as any).multiplayerType === "pve" && <><Gamepad2 className="w-3 h-3" /> PvE</>}
                  </div>
                )}
                {(game as any).scoreTrackable && (
                  <div className="text-[hsl(43,85%,55%)] flex items-center gap-1"><Trophy className="w-3 h-3" /> Score Tracked</div>
                )}
                {game.isFeatured && <div className="text-[hsl(35,100%,55%)]">Featured Classic</div>}
              </div>
            </div>
            <div className="fantasy-panel p-4">
              <h3 className="text-sm font-heading text-[hsl(43,85%,55%)] uppercase mb-2 tracking-wider flex items-center gap-2" style={{ WebkitTextFillColor: 'unset' }}>
                <Swords className="w-4 h-4" /> GBUX Challenges
              </h3>
              {challenges.length > 0 ? (
                <div className="space-y-2">
                  {challenges.slice(0, 3).map((c: any) => (
                    <div key={c.id} className="p-2 rounded border border-[hsl(220,15%,25%)] bg-[hsl(225,25%,12%)]">
                      <div className="text-xs text-[hsl(45,30%,90%)] font-body">{c.challengerName} — {c.gbuxWager} GBUX</div>
                      <Button
                        size="sm"
                        className="mt-1 h-6 text-[10px] bg-[hsl(0,50%,35%)] hover:bg-[hsl(0,50%,40%)] text-white border-0"
                        onClick={() => acceptChallenge(c.id)}
                      >
                        Accept Challenge
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-[hsl(45,15%,50%)] font-body">No open challenges</div>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-[hsl(0,50%,35%)] hover:bg-[hsl(0,50%,40%)] text-white border-0"
                    onClick={() => {
                      if (gameId) createChallenge(gameId, "high_score_single", 10);
                    }}
                  >
                    <Swords className="w-3 h-3 mr-1" /> Create 10 GBUX Challenge
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
