import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, X, Maximize2, Minimize2, Cpu, Gamepad2, Swords, Car, Castle, Shield, Puzzle, Users, Zap, Globe, Box, Brain, Monitor, Check, Minus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import superEngineBg from "@assets/IqGYJJe_1773841545953.png";
import imgGrudgeStudio from "@assets/19aec67671d8b_1773869463362.png";
import imgCloudPilot from "@assets/a17ae3c8-1237-463c-89d7-ad1708b48929_1773869467486.png";
import imgGbuxCoin from "@assets/image_1773869512711.png";
import gameImgWargus from "@assets/game_wargus_rts.png";
import gameImgTowerDef from "@assets/game_tower_defense.png";
import gameImgAvernus3d from "@assets/game_avernus_3d.png";
import gameImgAvernusArena from "@assets/game_avernus_arena.png";
import gameImgDecay from "@assets/game_decay_survival.png";
import gameImgOverdrive from "@assets/game_overdrive_3d.png";
import gameImgRpgMaker from "@assets/game_rpg_maker.png";
import gameImgPuzzle from "@assets/game_puzzle_platformer.png";

type Capability = '3D' | 'Physics' | 'Multiplayer' | 'AI' | '2D' | 'Particles';

interface GameCard {
  id: string;
  name: string;
  description: string;
  type: string;
  engine: string;
  route: string;
  emoji: string;
  color: string;
  gradientBorder: string;
  icon: typeof Gamepad2;
  capabilities: Capability[];
  previewType: 'threejs' | 'canvas2d' | 'static';
  cardImage?: string;
}

const CAPABILITY_CONFIG: Record<Capability, { icon: typeof Zap; color: string; label: string }> = {
  '3D': { icon: Box, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: '3D' },
  'Physics': { icon: Zap, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Physics' },
  'Multiplayer': { icon: Users, color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Multiplayer' },
  'AI': { icon: Brain, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'AI' },
  '2D': { icon: Monitor, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', label: '2D' },
  'Particles': { icon: Zap, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'Particles' },
};

const GAMES: GameCard[] = [
  {
    id: 'wargus',
    name: 'Wargus RTS',
    description: 'Classic real-time strategy game powered by the Stratagus engine. Build bases, train armies, and conquer your enemies.',
    type: 'Strategy',
    engine: 'Stratagus Engine',
    route: '/wargus',
    emoji: '⚔️',
    color: 'from-red-900/60 to-red-800/30',
    gradientBorder: 'from-red-500 via-orange-500 to-yellow-500',
    icon: Swords,
    capabilities: ['3D', 'AI', 'Physics', 'Particles'],
    previewType: 'threejs',
    cardImage: gameImgWargus,
  },
  {
    id: 'tower-defense',
    name: 'Tower Defense',
    description: 'Defend your base by strategically placing towers along enemy paths. Upgrade and adapt to survive waves of attackers.',
    type: 'Strategy',
    engine: 'Three.js TD',
    route: '/tower-defense',
    emoji: '🏰',
    color: 'from-amber-900/60 to-amber-800/30',
    gradientBorder: 'from-amber-500 via-yellow-500 to-orange-500',
    icon: Castle,
    capabilities: ['3D', 'AI', 'Particles'],
    previewType: 'threejs',
    cardImage: gameImgTowerDef,
  },
  {
    id: 'avernus-3d',
    name: 'Avernus 3D',
    description: 'Full 3D combat arena with weapons, abilities, and enemy AI. Battle through the depths of Avernus.',
    type: '3D Action',
    engine: 'Three.js Combat',
    route: '/avernus-3d',
    emoji: '🔥',
    color: 'from-orange-900/60 to-orange-800/30',
    gradientBorder: 'from-orange-500 via-red-500 to-pink-500',
    icon: Shield,
    capabilities: ['3D', 'Physics', 'AI', 'Particles'],
    previewType: 'threejs',
    cardImage: gameImgAvernus3d,
  },
  {
    id: 'avernus-arena',
    name: 'Avernus Arena',
    description: '2D top-down arena combat. Fight waves of demons in this fast-paced action game.',
    type: '2D Action',
    engine: 'Canvas 2D',
    route: '/avernus-arena',
    emoji: '⚔️',
    color: 'from-purple-900/60 to-purple-800/30',
    gradientBorder: 'from-purple-500 via-pink-500 to-red-500',
    icon: Swords,
    capabilities: ['2D', 'AI', 'Particles'],
    previewType: 'canvas2d',
    cardImage: gameImgAvernusArena,
  },
  {
    id: 'decay-survival',
    name: 'Decay Survival',
    description: 'Survive a zombie apocalypse in this top-down shooter. Scavenge resources, find weapons, and stay alive.',
    type: 'Survival Shooter',
    engine: 'Three.js Shooter',
    route: '/decay-survival',
    emoji: '🧟',
    color: 'from-green-900/60 to-green-800/30',
    gradientBorder: 'from-green-500 via-emerald-500 to-teal-500',
    icon: Shield,
    capabilities: ['3D', 'Physics', 'AI'],
    previewType: 'threejs',
    cardImage: gameImgDecay,
  },
  {
    id: 'overdrive-3d',
    name: 'Overdrive 3D Racing',
    description: 'High-speed 3D racing through obstacle-filled courses. Dodge barriers, collect boosts, and set records.',
    type: '3D Racing',
    engine: 'Three.js Racing',
    route: '/overdrive-3d',
    emoji: '🏎️',
    color: 'from-blue-900/60 to-blue-800/30',
    gradientBorder: 'from-blue-500 via-cyan-500 to-teal-500',
    icon: Car,
    capabilities: ['3D', 'Physics', 'Particles'],
    previewType: 'threejs',
    cardImage: gameImgOverdrive,
  },
  {
    id: 'rpg-maker',
    name: 'RPG Maker Studio',
    description: 'Create your own RPG adventures with a drag-and-drop editor. Design maps, characters, and quests.',
    type: 'RPG / Editor',
    engine: 'Custom RPG Engine',
    route: '/rpg-maker-studio',
    emoji: '🗡️',
    color: 'from-indigo-900/60 to-indigo-800/30',
    gradientBorder: 'from-indigo-500 via-violet-500 to-purple-500',
    icon: Gamepad2,
    capabilities: ['2D', 'AI'],
    previewType: 'canvas2d',
    cardImage: gameImgRpgMaker,
  },
  {
    id: 'puzzle-platformer',
    name: 'Puzzle Platformer',
    description: 'A physics-based puzzle platformer with challenging levels. Jump, push, and think your way to victory.',
    type: '2D Platformer',
    engine: 'Stencyl + Custom',
    route: '/puzzle-platformer',
    emoji: '🧩',
    color: 'from-teal-900/60 to-teal-800/30',
    gradientBorder: 'from-teal-500 via-cyan-500 to-blue-500',
    icon: Puzzle,
    capabilities: ['2D', 'Physics'],
    previewType: 'canvas2d',
    cardImage: gameImgPuzzle,
  },
];

interface EngineRow {
  name: string;
  rendering: string;
  physics: boolean;
  multiplayer: boolean;
  ai: boolean;
  particles: boolean;
  scriptLanguage: string;
  platforms: string;
}

const ENGINE_TABLE: EngineRow[] = [
  { name: 'Three.js', rendering: '3D WebGL', physics: true, multiplayer: true, ai: true, particles: true, scriptLanguage: 'TypeScript', platforms: 'Web, Mobile' },
  { name: 'Stratagus', rendering: '3D Isometric', physics: false, multiplayer: true, ai: true, particles: true, scriptLanguage: 'Lua/TS', platforms: 'Web' },
  { name: 'Canvas 2D', rendering: '2D Canvas', physics: false, multiplayer: false, ai: true, particles: true, scriptLanguage: 'TypeScript', platforms: 'Web, Mobile' },
  { name: 'Stencyl', rendering: '2D Tile', physics: true, multiplayer: false, ai: true, particles: false, scriptLanguage: 'Visual/Haxe', platforms: 'Web, Desktop' },
  { name: 'Custom RPG', rendering: '2D Tile', physics: false, multiplayer: false, ai: true, particles: false, scriptLanguage: 'TypeScript', platforms: 'Web' },
];

function MiniThreeJSPreview({ color, seed }: { color: string; seed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    let t = 0;

    const hueBase = (seed * 60) % 360;

    const draw = () => {
      t += 0.02;
      ctx.fillStyle = `hsl(${hueBase}, 30%, 8%)`;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 20; i++) {
        const x = ((Math.sin(t * 0.5 + i * 1.3) + 1) / 2) * w;
        const y = ((Math.cos(t * 0.7 + i * 0.9) + 1) / 2) * h;
        const r = 2 + Math.sin(t + i) * 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${(hueBase + i * 15) % 360}, 70%, 60%, 0.6)`;
        ctx.fill();
      }

      const cx = w / 2;
      const cy = h / 2;
      const size = 20 + Math.sin(t) * 5;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.5);

      ctx.strokeStyle = `hsla(${hueBase + 30}, 80%, 60%, 0.8)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(-size / 2, -size / 2, size, size);

      ctx.strokeStyle = `hsla(${hueBase + 60}, 80%, 60%, 0.5)`;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      ctx.fillStyle = `hsla(${hueBase}, 60%, 50%, 0.1)`;
      for (let i = 0; i < 5; i++) {
        const gx = (Math.sin(t * 0.3 + i * 2) + 1) / 2 * w;
        const gy = (Math.cos(t * 0.4 + i * 1.5) + 1) / 2 * h;
        ctx.beginPath();
        ctx.arc(gx, gy, 30, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [color, seed]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={120}
      className="w-full h-full rounded-lg"
    />
  );
}

function FPSCounter() {
  const [fps, setFps] = useState(60);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const countRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      countRef.current++;
      const now = performance.now();
      if (now - lastTimeRef.current >= 1000) {
        setFps(countRef.current);
        countRef.current = 0;
        lastTimeRef.current = now;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      <div className={`w-2 h-2 rounded-full ${fps > 50 ? 'bg-green-400' : fps > 30 ? 'bg-yellow-400' : 'bg-red-400'}`} />
      <span className="text-gray-400">{fps} FPS</span>
    </div>
  );
}

export default function SuperEngine() {
  const [, navigate] = useLocation();
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [fullscreenGame, setFullscreenGame] = useState<string | null>(null);
  const [hoveredGame, setHoveredGame] = useState<string | null>(null);

  const { data: featuredGames } = useQuery<any[]>({
    queryKey: ['/api/games', 'featured'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/games?featured=true');
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
  });

  const handlePlay = useCallback((gameId: string) => {
    setExpandedGame(prev => prev === gameId ? null : gameId);
  }, []);

  const handleFullscreen = useCallback((gameId: string) => {
    setFullscreenGame(gameId);
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenGame(null);
  }, []);

  const handleNavigate = useCallback((route: string) => {
    navigate(route);
  }, [navigate]);

  const fullscreenGameData = GAMES.find(g => g.id === fullscreenGame);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white relative">
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url(${superEngineBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-gray-950/80 via-transparent to-black/90 pointer-events-none" />
      {fullscreenGame && fullscreenGameData && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{fullscreenGameData.emoji}</span>
              <span className="font-bold text-lg">{fullscreenGameData.name}</span>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">{fullscreenGameData.type}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCloseFullscreen} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1">
            <iframe
              src={fullscreenGameData.route}
              className="w-full h-full border-0"
              title={fullscreenGameData.name}
              allow="autoplay; fullscreen"
            />
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="outline" className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-black">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <FPSCounter />
            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1">Super Engine</Badge>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{GAMES.length} Games</Badge>
          </div>
        </div>

        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Cpu className="w-10 h-10 text-orange-400" />
            <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-400 to-purple-400">
              Super Engine Arcade
            </h1>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Play games built with the Grudge Studio Super Engine — combining Construct3, Three.js, Stratagus, and more into one unified platform.
          </p>
          <div className="flex justify-center items-center gap-6 mt-8">
            <div className="w-24 h-24 rounded-xl border border-orange-500/30 overflow-hidden bg-black/40 backdrop-blur-sm hover:scale-105 transition-transform">
              <img src={imgGrudgeStudio} alt="Grudge Studio" className="w-full h-full object-cover" />
            </div>
            <div className="w-24 h-24 rounded-xl border border-orange-500/30 overflow-hidden bg-black/40 backdrop-blur-sm hover:scale-105 transition-transform">
              <img src={imgCloudPilot} alt="CloudPilot" className="w-full h-full object-cover" />
            </div>
            <div className="w-24 h-24 rounded-xl border border-orange-500/30 overflow-hidden bg-black/40 backdrop-blur-sm hover:scale-105 transition-transform">
              <img src={imgGbuxCoin} alt="GBUX" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {GAMES.map((game, index) => {
            const isExpanded = expandedGame === game.id;
            const isHovered = hoveredGame === game.id;
            const Icon = game.icon;

            return (
              <div
                key={game.id}
                className={`relative group ${isExpanded ? 'md:col-span-2 xl:col-span-3' : ''}`}
                onMouseEnter={() => setHoveredGame(game.id)}
                onMouseLeave={() => setHoveredGame(null)}
              >
                <div
                  className={`absolute -inset-[2px] rounded-xl bg-gradient-to-r ${game.gradientBorder} opacity-0 transition-opacity duration-500 blur-sm ${isHovered ? 'opacity-70' : ''}`}
                />
                <div
                  className={`absolute -inset-[1px] rounded-xl bg-gradient-to-r ${game.gradientBorder} opacity-0 transition-opacity duration-500 ${isHovered ? 'opacity-100' : ''}`}
                />

                <Card
                  className={`relative bg-gradient-to-br ${game.color} border-gray-700/50 transition-all duration-300 overflow-hidden`}
                >
                  <CardContent className="p-0">
                    {isExpanded ? (
                      <div className="flex flex-col">
                        <div className="relative w-full" style={{ height: '500px' }}>
                          <iframe
                            src={game.route}
                            className="w-full h-full border-0 rounded-t-lg"
                            title={game.name}
                            allow="autoplay; fullscreen"
                          />
                          <div className="absolute top-3 right-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="bg-black/70 hover:bg-black/90 text-white border-0"
                              onClick={() => handleFullscreen(game.id)}
                            >
                              <Maximize2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="bg-black/70 hover:bg-black/90 text-white border-0"
                              onClick={() => handlePlay(game.id)}
                            >
                              <Minimize2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="absolute top-3 left-3 bg-black/70 rounded-lg px-3 py-1.5">
                            <FPSCounter />
                          </div>
                        </div>
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{game.emoji}</span>
                            <div>
                              <h3 className="text-white font-bold text-lg">{game.name}</h3>
                              <p className="text-gray-400 text-sm">{game.engine}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-orange-500 hover:bg-orange-600 text-white"
                              onClick={() => handleNavigate(game.route)}
                            >
                              Open Full Page
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-600 text-gray-300 hover:bg-gray-700"
                              onClick={() => handlePlay(game.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5">
                        <div
                          className="aspect-video bg-black/40 rounded-lg mb-4 relative overflow-hidden cursor-pointer"
                          onClick={() => handlePlay(game.id)}
                        >
                          {game.cardImage ? (
                            <img src={game.cardImage} alt={game.name} className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <MiniThreeJSPreview color={game.color} seed={index} />
                          )}

                          <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30 transform group-hover:scale-110 transition-transform duration-300">
                              <Play className="w-8 h-8 text-white ml-1" />
                            </div>
                          </div>

                          <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                            {game.capabilities.map((cap) => {
                              const config = CAPABILITY_CONFIG[cap];
                              const CapIcon = config.icon;
                              return (
                                <span
                                  key={cap}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${config.color} backdrop-blur-sm`}
                                >
                                  <CapIcon className="w-3 h-3" />
                                  {config.label}
                                </span>
                              );
                            })}
                          </div>

                          <div className="absolute bottom-2 right-2 bg-black/70 rounded px-2 py-1 backdrop-blur-sm">
                            <FPSCounter />
                          </div>
                        </div>

                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-white font-bold text-lg">{game.name}</h3>
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 shrink-0 ml-2">
                            {game.type}
                          </Badge>
                        </div>
                        <p className="text-gray-400 text-sm mb-3 line-clamp-2">{game.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            {game.engine}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/20"
                              onClick={() => handlePlay(game.id)}
                              data-testid={`button-play-${game.id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Play
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-600 text-gray-300 hover:bg-gray-700"
                              onClick={() => handleNavigate(game.route)}
                            >
                              <Maximize2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {featuredGames && featuredGames.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center gap-3 mb-6">
              <Gamepad2 className="w-8 h-8 text-purple-400" />
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                Classic Retro Games
              </h2>
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                {featuredGames.length} Featured
              </Badge>
            </div>
            <p className="text-gray-400 mb-6">
              Play classic console games right in your browser — NES, SNES, Genesis, and more via embedded emulators.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {featuredGames.slice(0, 12).map((game: any) => (
                <Link key={game.id} href={`/play/${game.id}`}>
                  <div className="group relative cursor-pointer">
                    <div className="absolute -inset-[1px] rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative bg-gray-800 rounded-lg p-3 flex flex-col items-center gap-2 transition-transform duration-200 group-hover:scale-[1.02]">
                      {game.coverUrl ? (
                        <img src={game.coverUrl} alt={game.title} className="w-full aspect-square object-cover rounded" />
                      ) : (
                        <div className="w-full aspect-square bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded flex items-center justify-center">
                          <Gamepad2 className="w-8 h-8 text-purple-400" />
                        </div>
                      )}
                      <span className="text-white text-xs font-medium text-center line-clamp-2">{game.title}</span>
                      <Badge className="text-[10px] bg-gray-700 text-gray-300 border-gray-600">
                        {game.platform || 'Retro'}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link href="/games">
                <Button variant="outline" className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white">
                  <Globe className="w-4 h-4 mr-2" />
                  Browse Full Game Library
                </Button>
              </Link>
            </div>
          </div>
        )}

        {(!featuredGames || featuredGames.length === 0) && (
          <div className="mt-16">
            <div className="flex items-center gap-3 mb-6">
              <Gamepad2 className="w-8 h-8 text-purple-400" />
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                Classic Retro Games
              </h2>
            </div>
            <p className="text-gray-400 mb-6">
              Play classic console games right in your browser — NES, SNES, Genesis, and more via embedded emulators.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {['Super Mario Bros', 'Legend of Zelda', 'Contra', 'Mega Man 2', 'Castlevania', 'Metroid'].map((title) => (
                <Link key={title} href="/games">
                  <div className="group relative cursor-pointer">
                    <div className="absolute -inset-[1px] rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative bg-gray-800 rounded-lg p-3 flex flex-col items-center gap-2 transition-transform duration-200 group-hover:scale-[1.02]">
                      <div className="w-full aspect-square bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded flex items-center justify-center">
                        <Gamepad2 className="w-8 h-8 text-purple-400" />
                      </div>
                      <span className="text-white text-xs font-medium text-center line-clamp-2">{title}</span>
                      <Badge className="text-[10px] bg-gray-700 text-gray-300 border-gray-600">NES</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link href="/games">
                <Button variant="outline" className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white">
                  <Globe className="w-4 h-4 mr-2" />
                  Browse Full Game Library
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="mt-16">
          <div className="flex items-center gap-3 mb-6">
            <Cpu className="w-8 h-8 text-cyan-400" />
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              Engine Comparison
            </h2>
          </div>
          <p className="text-gray-400 mb-6">
            Compare the capabilities of each game engine powering the Super Engine platform.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-700/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/80 border-b border-gray-700/50">
                  <th className="text-left px-4 py-3 text-gray-300 font-semibold">Engine</th>
                  <th className="text-left px-4 py-3 text-gray-300 font-semibold">Rendering</th>
                  <th className="text-center px-4 py-3 text-gray-300 font-semibold">Physics</th>
                  <th className="text-center px-4 py-3 text-gray-300 font-semibold">Multiplayer</th>
                  <th className="text-center px-4 py-3 text-gray-300 font-semibold">AI</th>
                  <th className="text-center px-4 py-3 text-gray-300 font-semibold">Particles</th>
                  <th className="text-left px-4 py-3 text-gray-300 font-semibold">Language</th>
                  <th className="text-left px-4 py-3 text-gray-300 font-semibold">Platforms</th>
                </tr>
              </thead>
              <tbody>
                {ENGINE_TABLE.map((engine, i) => (
                  <tr
                    key={engine.name}
                    className={`border-b border-gray-700/30 ${i % 2 === 0 ? 'bg-gray-900/40' : 'bg-gray-800/20'} hover:bg-gray-700/30 transition-colors`}
                  >
                    <td className="px-4 py-3 font-medium text-white">{engine.name}</td>
                    <td className="px-4 py-3 text-gray-400">{engine.rendering}</td>
                    <td className="px-4 py-3 text-center">
                      {engine.physics ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <Minus className="w-4 h-4 text-gray-600 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {engine.multiplayer ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <Minus className="w-4 h-4 text-gray-600 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {engine.ai ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <Minus className="w-4 h-4 text-gray-600 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {engine.particles ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <Minus className="w-4 h-4 text-gray-600 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{engine.scriptLanguage}</td>
                    <td className="px-4 py-3 text-gray-400">{engine.platforms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-800/50 border border-gray-700">
            <Cpu className="w-5 h-5 text-orange-400" />
            <span className="text-gray-300">Powered by</span>
            <span className="text-orange-400 font-bold">Grudge Studio Super Engine</span>
            <span className="text-gray-500">—</span>
            <span className="text-gray-400 text-sm">Construct3 · Three.js · Stratagus · Stencyl · GDevelop</span>
          </div>
        </div>
      </div>
    </div>
  );
}
