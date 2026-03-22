import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Star,
  Key,
  Heart,
  Clock,
  Target,
  Zap,
  Gem
} from "lucide-react";
import { Link } from "wouter";

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  onGround: boolean;
  keys: number;
  health: number;
  maxHealth: number;
  invincible: number;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'solid' | 'moving' | 'breakable' | 'spring';
  color: string;
  moving?: {
    direction: number;
    speed: number;
    range: number;
    startX: number;
  };
  breakTimer?: number;
  broken?: boolean;
}

interface Collectible {
  x: number;
  y: number;
  type: 'key' | 'gem' | 'coin' | 'heart' | 'powerup';
  collected: boolean;
  value: number;
  color: string;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  width: number;
  height: number;
  type: 'walker' | 'jumper' | 'shooter';
  health: number;
  direction: number;
  color: string;
  alive: boolean;
}

interface ExitPortal {
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
}

const LEVELS = [
  {
    name: "Crystal Caverns",
    platforms: [
      { x: 0, y: 550, width: 200, height: 50, type: 'solid' as const, color: '#4a5568' },
      { x: 250, y: 500, width: 150, height: 20, type: 'solid' as const, color: '#4a5568' },
      { x: 450, y: 450, width: 100, height: 20, type: 'solid' as const, color: '#4a5568' },
      { x: 600, y: 400, width: 100, height: 20, type: 'moving' as const, color: '#3182ce',
        moving: { direction: 1, speed: 2, range: 150, startX: 600 } },
      { x: 200, y: 350, width: 80, height: 20, type: 'moving' as const, color: '#3182ce',
        moving: { direction: -1, speed: 1.5, range: 100, startX: 200 } },
      { x: 400, y: 300, width: 60, height: 20, type: 'spring' as const, color: '#38a169' },
      { x: 650, y: 250, width: 80, height: 20, type: 'breakable' as const, color: '#d69e2e' },
      { x: 100, y: 200, width: 100, height: 20, type: 'solid' as const, color: '#4a5568' },
      { x: 300, y: 150, width: 120, height: 20, type: 'solid' as const, color: '#4a5568' },
      { x: 500, y: 100, width: 150, height: 20, type: 'solid' as const, color: '#4a5568' },
      { x: 700, y: 50, width: 100, height: 20, type: 'solid' as const, color: '#4a5568' },
    ],
    collectibles: [
      { x: 300, y: 460, type: 'key' as const, collected: false, value: 1, color: '#ffd700' },
      { x: 480, y: 410, type: 'gem' as const, collected: false, value: 50, color: '#9f7aea' },
      { x: 650, y: 360, type: 'coin' as const, collected: false, value: 10, color: '#f6e05e' },
      { x: 230, y: 310, type: 'coin' as const, collected: false, value: 10, color: '#f6e05e' },
      { x: 430, y: 260, type: 'heart' as const, collected: false, value: 25, color: '#f56565' },
      { x: 350, y: 110, type: 'gem' as const, collected: false, value: 50, color: '#9f7aea' },
      { x: 550, y: 60, type: 'powerup' as const, collected: false, value: 100, color: '#4fd1c7' },
      { x: 750, y: 10, type: 'key' as const, collected: false, value: 1, color: '#ffd700' },
    ],
    enemies: [
      { x: 300, y: 480, vx: 1, width: 15, height: 20, type: 'walker' as const, health: 1, direction: 1, color: '#e53e3e', alive: true },
      { x: 500, y: 430, vx: 0, width: 18, height: 22, type: 'jumper' as const, health: 2, direction: 1, color: '#d69e2e', alive: true },
      { x: 150, y: 180, vx: 1.5, width: 16, height: 20, type: 'walker' as const, health: 1, direction: -1, color: '#e53e3e', alive: true },
    ],
    exit: { x: 720, y: 10, width: 40, height: 40 },
    playerStart: { x: 50, y: 400 },
  },
  {
    name: "Shadow Depths",
    platforms: [
      { x: 0, y: 550, width: 150, height: 50, type: 'solid' as const, color: '#4a5568' },
      { x: 200, y: 520, width: 80, height: 20, type: 'breakable' as const, color: '#d69e2e' },
      { x: 350, y: 480, width: 100, height: 20, type: 'solid' as const, color: '#4a5568' },
      { x: 500, y: 430, width: 80, height: 20, type: 'spring' as const, color: '#38a169' },
      { x: 650, y: 500, width: 100, height: 20, type: 'solid' as const, color: '#4a5568' },
      { x: 100, y: 380, width: 100, height: 20, type: 'moving' as const, color: '#3182ce',
        moving: { direction: 1, speed: 2.5, range: 180, startX: 100 } },
      { x: 400, y: 320, width: 60, height: 20, type: 'breakable' as const, color: '#d69e2e' },
      { x: 550, y: 280, width: 80, height: 20, type: 'solid' as const, color: '#4a5568' },
      { x: 700, y: 350, width: 100, height: 20, type: 'solid' as const, color: '#4a5568' },
      { x: 250, y: 230, width: 100, height: 20, type: 'solid' as const, color: '#4a5568' },
      { x: 50, y: 160, width: 80, height: 20, type: 'spring' as const, color: '#38a169' },
      { x: 300, y: 100, width: 120, height: 20, type: 'moving' as const, color: '#3182ce',
        moving: { direction: -1, speed: 1.8, range: 120, startX: 300 } },
      { x: 600, y: 130, width: 100, height: 20, type: 'solid' as const, color: '#4a5568' },
      { x: 700, y: 60, width: 100, height: 20, type: 'solid' as const, color: '#4a5568' },
    ],
    collectibles: [
      { x: 370, y: 440, type: 'key' as const, collected: false, value: 1, color: '#ffd700' },
      { x: 680, y: 460, type: 'coin' as const, collected: false, value: 10, color: '#f6e05e' },
      { x: 250, y: 340, type: 'gem' as const, collected: false, value: 50, color: '#9f7aea' },
      { x: 580, y: 240, type: 'heart' as const, collected: false, value: 25, color: '#f56565' },
      { x: 730, y: 310, type: 'coin' as const, collected: false, value: 10, color: '#f6e05e' },
      { x: 280, y: 190, type: 'gem' as const, collected: false, value: 50, color: '#9f7aea' },
      { x: 80, y: 120, type: 'powerup' as const, collected: false, value: 100, color: '#4fd1c7' },
      { x: 630, y: 90, type: 'key' as const, collected: false, value: 1, color: '#ffd700' },
    ],
    enemies: [
      { x: 370, y: 460, vx: 1.2, width: 15, height: 20, type: 'walker' as const, health: 1, direction: 1, color: '#e53e3e', alive: true },
      { x: 660, y: 480, vx: 0, width: 18, height: 22, type: 'jumper' as const, health: 2, direction: 1, color: '#d69e2e', alive: true },
      { x: 560, y: 260, vx: 1, width: 15, height: 20, type: 'walker' as const, health: 1, direction: -1, color: '#e53e3e', alive: true },
      { x: 280, y: 80, vx: 1.5, width: 16, height: 20, type: 'walker' as const, health: 1, direction: 1, color: '#e53e3e', alive: true },
    ],
    exit: { x: 720, y: 20, width: 40, height: 40 },
    playerStart: { x: 50, y: 400 },
  },
];

const makePlayer = (startX: number, startY: number): Player => ({
  x: startX, y: startY, vx: 0, vy: 0,
  width: 20, height: 30, onGround: false,
  keys: 0, health: 100, maxHealth: 100, invincible: 0,
});

export default function PuzzlePlatformer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'completed' | 'gameOver'>('menu');
  const [level, setLevel] = useState(0);
  const [score, setScore] = useState(0);
  const [gameTime, setGameTime] = useState(0);
  const [levelTime, setLevelTime] = useState(0);

  const levelData = LEVELS[level] || LEVELS[0];
  const [player, setPlayer] = useState<Player>(makePlayer(levelData.playerStart.x, levelData.playerStart.y));
  const [platforms, setPlatforms] = useState<Platform[]>(levelData.platforms.map(p => ({ ...p })));
  const [collectibles, setCollectibles] = useState<Collectible[]>(levelData.collectibles.map(c => ({ ...c })));
  const [enemies, setEnemies] = useState<Enemy[]>(levelData.enemies.map(e => ({ ...e })));
  const [exitPortal, setExitPortal] = useState<ExitPortal>({ ...levelData.exit, active: false });

  const keysRef = useRef<{ [key: string]: boolean }>({});
  const [particles, setParticles] = useState<Array<{
    x: number; y: number; vx: number; vy: number; life: number; color: string; size?: number;
  }>>([]);
  const [screenShake, setScreenShake] = useState({ x: 0, y: 0, duration: 0 });
  const animTimeRef = useRef(0);
  const prevHealthRef = useRef(100);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const createParticles = useCallback((x: number, y: number, color: string, count = 8) => {
    const newP: typeof particles = [];
    for (let i = 0; i < count; i++) {
      newP.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        life: 30,
        color,
      });
    }
    setParticles(prev => [...prev, ...newP]);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const loadLevel = useCallback((idx: number) => {
    const ld = LEVELS[idx] || LEVELS[0];
    setPlatforms(ld.platforms.map(p => ({ ...p, broken: false, breakTimer: undefined, moving: p.moving ? { ...p.moving } : undefined })));
    setCollectibles(ld.collectibles.map(c => ({ ...c, collected: false })));
    setEnemies(ld.enemies.map(e => ({ ...e, alive: true })));
    setExitPortal({ ...ld.exit, active: false });
    setPlayer(makePlayer(ld.playerStart.x, ld.playerStart.y));
    setLevelTime(0);
    prevHealthRef.current = 100;
  }, []);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      if (gameStateRef.current !== 'playing') return;

      setGameTime(prev => prev + 1 / 60);
      setLevelTime(prev => prev + 1 / 60);

      const keys = keysRef.current;

      setPlayer(prevPlayer => {
        let p = { ...prevPlayer };

        if (p.invincible > 0) p.invincible--;

        if (keys['ArrowLeft'] || keys['a']) {
          p.vx = Math.max(-6, p.vx - 0.5);
        } else if (keys['ArrowRight'] || keys['d']) {
          p.vx = Math.min(6, p.vx + 0.5);
        } else {
          p.vx *= 0.8;
        }

        if ((keys['ArrowUp'] || keys['w'] || keys[' ']) && p.onGround) {
          p.vy = -12;
          p.onGround = false;
        }

        p.vy += 0.6;
        if (p.vy > 15) p.vy = 15;

        p.x += p.vx;
        p.y += p.vy;

        p.onGround = false;

        setPlatforms(prevPlats => {
          const updated = prevPlats.map(plat => {
            let pl = { ...plat, moving: plat.moving ? { ...plat.moving } : undefined };

            if (pl.type === 'moving' && pl.moving) {
              pl.x += pl.moving.direction * pl.moving.speed;
              if (pl.x <= pl.moving.startX - pl.moving.range || pl.x >= pl.moving.startX + pl.moving.range) {
                pl.moving.direction *= -1;
              }
            }

            if (pl.broken) return pl;

            if (pl.breakTimer !== undefined) {
              pl.breakTimer--;
              if (pl.breakTimer <= 0) {
                pl.broken = true;
                createParticles(pl.x + pl.width / 2, pl.y + pl.height / 2, '#d69e2e', 12);
                return pl;
              }
            }

            if (p.x < pl.x + pl.width && p.x + p.width > pl.x &&
                p.y < pl.y + pl.height && p.y + p.height > pl.y) {
              if (prevPlayer.y + prevPlayer.height <= pl.y + 4 && p.vy > 0) {
                p.y = pl.y - p.height;
                p.vy = 0;
                p.onGround = true;

                if (pl.type === 'spring') {
                  p.vy = -18;
                  p.onGround = false;
                  createParticles(p.x + p.width / 2, pl.y, '#38a169');
                }

                if (pl.type === 'breakable' && pl.breakTimer === undefined) {
                  pl.breakTimer = 30;
                }
              } else if (prevPlayer.y >= pl.y + pl.height && p.vy < 0) {
                p.y = pl.y + pl.height;
                p.vy = 0;
              } else if (p.vy >= 0) {
                if (prevPlayer.x + prevPlayer.width <= pl.x) {
                  p.x = pl.x - p.width;
                } else if (prevPlayer.x >= pl.x + pl.width) {
                  p.x = pl.x + pl.width;
                }
                p.vx = 0;
              }
            }

            return pl;
          });
          return updated;
        });

        if (p.x < 0) p.x = 0;
        if (p.x + p.width > 800) p.x = 800 - p.width;
        if (p.y > 650) {
          p.health -= 25;
          p.x = levelData.playerStart.x;
          p.y = levelData.playerStart.y;
          p.vx = 0;
          p.vy = 0;
          p.invincible = 60;
          setScreenShake({ x: 0, y: 0, duration: 15 });
        }

        setEnemies(prevEn => {
          return prevEn.map(enemy => {
            if (!enemy.alive) return enemy;
            let e = { ...enemy };

            switch (e.type) {
              case 'walker':
                e.x += e.vx * e.direction;
                if (e.x <= 50 || e.x >= 750) e.direction *= -1;
                break;
              case 'jumper':
                if (Math.random() < 0.02) e.vx = (Math.random() - 0.5) * 4;
                e.x += e.vx;
                e.vx *= 0.95;
                if (e.x < 50) { e.x = 50; e.vx *= -1; }
                if (e.x > 750) { e.x = 750; e.vx *= -1; }
                break;
            }

            if (p.invincible <= 0 &&
                p.x < e.x + e.width && p.x + p.width > e.x &&
                p.y < e.y + e.height && p.y + p.height > e.y) {
              if (p.vy > 0 && p.y + p.height < e.y + e.height * 0.6) {
                e.health--;
                if (e.health <= 0) {
                  e.alive = false;
                  createParticles(e.x + e.width / 2, e.y + e.height / 2, e.color, 12);
                  setScore(prev => prev + 25);
                }
                p.vy = -10;
              } else {
                p.health -= 20;
                p.invincible = 60;
                const knockDir = p.x < e.x ? -1 : 1;
                p.vx = knockDir * 6;
                p.vy = -6;
                setScreenShake({ x: 0, y: 0, duration: 12 });
                createParticles(p.x + p.width / 2, p.y + p.height / 2, '#ff4444', 6);
              }
            }

            return e;
          });
        });

        setCollectibles(prevC => {
          return prevC.map(c => {
            if (c.collected) return c;
            if (p.x < c.x + 20 && p.x + p.width > c.x &&
                p.y < c.y + 20 && p.y + p.height > c.y) {
              createParticles(c.x + 10, c.y + 10, c.color);
              setScore(prev => prev + c.value);
              if (c.type === 'key') p.keys++;
              if (c.type === 'heart') p.health = Math.min(p.maxHealth, p.health + c.value);
              return { ...c, collected: true };
            }
            return c;
          });
        });

        setExitPortal(prev => {
          const active = p.keys >= 2;
          if (active && !prev.active) createParticles(prev.x + prev.width / 2, prev.y + prev.height / 2, '#38ff38', 12);
          const portal = { ...prev, active };

          if (active &&
              p.x < portal.x + portal.width && p.x + p.width > portal.x &&
              p.y < portal.y + portal.height && p.y + p.height > portal.y) {
            const nextLevel = level + 1;
            if (nextLevel < LEVELS.length) {
              setLevel(nextLevel);
              setTimeout(() => {
                loadLevel(nextLevel);
              }, 0);
            } else {
              setGameState('completed');
            }
          }

          return portal;
        });

        if (p.health <= 0) {
          p.health = 0;
          setTimeout(() => setGameState('gameOver'), 100);
        }

        return p;
      });

      setParticles(prev =>
        prev.map(pt => ({
          ...pt,
          x: pt.x + pt.vx,
          y: pt.y + pt.vy,
          vy: pt.vy + 0.2,
          life: pt.life - 1,
        })).filter(pt => pt.life > 0)
      );

      setScreenShake(prev => {
        if (prev.duration <= 0) return { x: 0, y: 0, duration: 0 };
        return {
          x: (Math.random() - 0.5) * prev.duration,
          y: (Math.random() - 0.5) * prev.duration,
          duration: prev.duration - 1,
        };
      });

      animTimeRef.current += 1 / 60;
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [gameState, level, levelData, createParticles, loadLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const t = animTimeRef.current * 60;

    ctx.save();
    ctx.translate(screenShake.x, screenShake.y);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#2d3748');
    gradient.addColorStop(0.5, '#1a202c');
    gradient.addColorStop(1, '#0d1117');
    ctx.fillStyle = gradient;
    ctx.fillRect(-5, -5, canvas.width + 10, canvas.height + 10);

    for (let i = 0; i < 30; i++) {
      const sx = ((i * 97 + t * 0.02) % 850) - 25;
      const sy = ((i * 53) % 300);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(t * 0.01 + i) * 0.2})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    const parallaxFar = player.x * 0.1;

    ctx.fillStyle = '#1e293b';
    for (let i = 0; i < 5; i++) {
      const mx = i * 250 - parallaxFar % 250 - 50;
      const mh = 80 + Math.sin(i * 1.7) * 40;
      ctx.beginPath();
      ctx.moveTo(mx, canvas.height - 50);
      ctx.lineTo(mx + 60, canvas.height - 50 - mh);
      ctx.lineTo(mx + 120, canvas.height - 50 - mh * 0.7);
      ctx.lineTo(mx + 180, canvas.height - 50 - mh * 0.9);
      ctx.lineTo(mx + 250, canvas.height - 50);
      ctx.closePath();
      ctx.fill();
    }

    const parallaxMid = player.x * 0.3;
    ctx.fillStyle = 'rgba(100,130,160,0.15)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 280 + t * 0.15 - parallaxMid) % 900) - 50;
      const cy = 60 + i * 40;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 50 + i * 10, 15 + i * 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    platforms.forEach(platform => {
      if (platform.broken) return;

      ctx.fillStyle = platform.color;
      if (platform.breakTimer !== undefined) {
        ctx.globalAlpha = 0.4 + Math.sin(t * 0.3) * 0.3;
      }
      ctx.fillRect(platform.x, platform.y, platform.width, platform.height);

      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(platform.x, platform.y, platform.width, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(platform.x, platform.y + platform.height - 3, platform.width, 3);

      if (platform.type === 'moving') {
        ctx.fillStyle = '#63b3ed';
        ctx.fillRect(platform.x + 2, platform.y + 2, platform.width - 4, 4);
        for (let i = 0; i < platform.width; i += 10) {
          ctx.fillStyle = 'rgba(99,179,237,0.3)';
          ctx.fillRect(platform.x + i, platform.y + 8, 4, platform.height - 10);
        }
      } else if (platform.type === 'spring') {
        const springH = 5 + Math.sin(t * 0.1) * 2;
        ctx.fillStyle = '#68d391';
        ctx.fillRect(platform.x + 10, platform.y - springH, platform.width - 20, springH);
        ctx.fillStyle = '#48bb78';
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(platform.x + 15 + i * 12, platform.y - springH, 3, springH);
        }
      } else if (platform.type === 'breakable') {
        ctx.strokeStyle = '#a0aec0';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
        ctx.setLineDash([]);
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(platform.x + 10 + i * 20, platform.y);
          ctx.lineTo(platform.x + 5 + i * 20, platform.y + platform.height);
          ctx.strokeStyle = 'rgba(160,174,192,0.3)';
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    });

    const ep = exitPortal;
    const portalPulse = Math.sin(t * 0.08) * 0.3 + 0.7;
    if (ep.active) {
      ctx.fillStyle = `rgba(56, 255, 56, ${portalPulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(ep.x + ep.width / 2, ep.y + ep.height / 2, ep.width * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(56, 255, 56, ${portalPulse})`;
      ctx.beginPath();
      ctx.arc(ep.x + ep.width / 2, ep.y + ep.height / 2, ep.width * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38ff38';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ep.x + ep.width / 2, ep.y + ep.height / 2, ep.width * 0.6 + Math.sin(t * 0.1) * 4, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const angle = t * 0.05 + (i * Math.PI * 2) / 6;
        const dist = ep.width * 0.5;
        const sx = ep.x + ep.width / 2 + Math.cos(angle) * dist;
        const sy = ep.y + ep.height / 2 + Math.sin(angle) * dist;
        ctx.fillStyle = `rgba(56,255,56,${0.5 + Math.sin(t * 0.1 + i) * 0.3})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(100,100,100,0.4)';
      ctx.beginPath();
      ctx.arc(ep.x + ep.width / 2, ep.y + ep.height / 2, ep.width * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(100,100,100,0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(ep.x + ep.width / 2, ep.y + ep.height / 2, ep.width * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#888';
      ctx.font = '9px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('🔒', ep.x + ep.width / 2, ep.y + ep.height / 2 + 4);
      ctx.textAlign = 'left';
    }

    collectibles.forEach(collectible => {
      if (collectible.collected) return;
      const sparkleT = t * 0.05;
      for (let i = 0; i < 5; i++) {
        const angle = sparkleT + (i * Math.PI * 2) / 5;
        const dist = 14 + Math.sin(sparkleT * 2 + i) * 3;
        const sx = collectible.x + 10 + Math.cos(angle) * dist;
        const sy = collectible.y + 10 + Math.sin(angle) * dist;
        ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(sparkleT * 3 + i) * 0.3})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = collectible.color;
      const bob = Math.sin(t * 0.06 + collectible.x) * 3;

      switch (collectible.type) {
        case 'key':
          ctx.fillRect(collectible.x + 5, collectible.y + 5 + bob, 10, 10);
          ctx.fillRect(collectible.x + 15, collectible.y + 8 + bob, 4, 4);
          ctx.fillStyle = 'rgba(255,215,0,0.3)';
          ctx.beginPath();
          ctx.arc(collectible.x + 10, collectible.y + 10 + bob, 12, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'gem':
          ctx.beginPath();
          ctx.moveTo(collectible.x + 10, collectible.y + bob);
          ctx.lineTo(collectible.x + 20, collectible.y + 10 + bob);
          ctx.lineTo(collectible.x + 10, collectible.y + 20 + bob);
          ctx.lineTo(collectible.x, collectible.y + 10 + bob);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.moveTo(collectible.x + 10, collectible.y + bob);
          ctx.lineTo(collectible.x + 15, collectible.y + 10 + bob);
          ctx.lineTo(collectible.x + 10, collectible.y + 10 + bob);
          ctx.closePath();
          ctx.fill();
          break;
        case 'coin':
          ctx.beginPath();
          ctx.arc(collectible.x + 10, collectible.y + 10 + bob, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.arc(collectible.x + 8, collectible.y + 8 + bob, 3, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'heart':
          ctx.beginPath();
          ctx.arc(collectible.x + 6, collectible.y + 8 + bob, 6, 0, Math.PI * 2);
          ctx.arc(collectible.x + 14, collectible.y + 8 + bob, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(collectible.x + 10, collectible.y + 20 + bob);
          ctx.lineTo(collectible.x, collectible.y + 12 + bob);
          ctx.lineTo(collectible.x + 20, collectible.y + 12 + bob);
          ctx.closePath();
          ctx.fill();
          break;
        case 'powerup':
          ctx.fillRect(collectible.x + 2, collectible.y + 2 + bob, 16, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(collectible.x + 8, collectible.y + 4 + bob, 4, 12);
          ctx.fillRect(collectible.x + 4, collectible.y + 8 + bob, 12, 4);
          break;
      }
    });

    enemies.forEach(enemy => {
      if (!enemy.alive) return;
      const eTime = t * 0.08;

      ctx.fillStyle = enemy.color;
      ctx.fillRect(enemy.x + 2, enemy.y + 2, enemy.width - 4, enemy.height * 0.55);

      ctx.beginPath();
      ctx.arc(enemy.x + enemy.width / 2, enemy.y + 3, enemy.width * 0.35, 0, Math.PI * 2);
      ctx.fill();

      const legSwing = Math.sin(eTime + enemy.x) * 4;
      ctx.fillRect(enemy.x + 3, enemy.y + enemy.height * 0.55, 4, enemy.height * 0.45);
      ctx.save();
      ctx.translate(enemy.x + enemy.width - 7, enemy.y + enemy.height * 0.55);
      ctx.rotate(legSwing * 0.1);
      ctx.fillRect(0, 0, 4, enemy.height * 0.45);
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(enemy.x + 3, enemy.y + 3, 3, 3);
      ctx.fillRect(enemy.x + enemy.width - 6, enemy.y + 3, 3, 3);
      ctx.fillStyle = '#000000';
      ctx.fillRect(enemy.x + 4, enemy.y + 4, 1, 1);
      ctx.fillRect(enemy.x + enemy.width - 5, enemy.y + 4, 1, 1);
    });

    particles.forEach(particle => {
      const alpha = particle.life / 30;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      const sz = particle.size || 2;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, sz * alpha, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    const px = player.x;
    const py = player.y;
    const pw = player.width;
    const ph = player.height;
    const isMoving = Math.abs(player.vx) > 0.5;
    const isJumping = !player.onGround;
    const facingRight = player.vx >= 0;

    if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    let scaleX = 1;
    let scaleY = 1;
    if (isJumping && player.vy < -5) { scaleX = 0.85; scaleY = 1.15; }
    else if (isJumping && player.vy > 5) { scaleX = 1.1; scaleY = 0.9; }

    if (isMoving && player.onGround && Math.random() < 0.4) {
      setParticles(prev => [...prev, {
        x: px + pw / 2 + (facingRight ? -8 : 8),
        y: py + ph - 2,
        vx: (facingRight ? -1 : 1) * (Math.random() * 1.5),
        vy: -Math.random() * 1.5,
        life: 15,
        color: 'rgba(150,150,180,0.6)',
        size: 2 + Math.random() * 2,
      }]);
    }

    const bodyColor = player.health > 25 ? '#4299e1' : '#f56565';
    const armLegColor = player.health > 25 ? '#3182ce' : '#e53e3e';
    const headColor = player.health > 25 ? '#63b3ed' : '#fc8181';
    const idleBob = isMoving ? 0 : Math.sin(t * 0.05) * 1.5;

    ctx.save();
    ctx.translate(px + pw / 2, py + ph / 2 + idleBob);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-(px + pw / 2), -(py + ph / 2));

    const legAngle = isMoving ? Math.sin(t * 0.15) * 0.5 : Math.sin(t * 0.03) * 0.05;
    const armAngle = isMoving ? Math.sin(t * 0.15 + Math.PI) * 0.4 : Math.sin(t * 0.04) * 0.08;

    ctx.fillStyle = armLegColor;
    ctx.save();
    ctx.translate(px + pw / 2 - 2, py + ph * 0.65);
    ctx.rotate(legAngle);
    ctx.fillRect(-2, 0, 4, ph * 0.35);
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(-3, ph * 0.3, 6, 4);
    ctx.restore();

    ctx.fillStyle = armLegColor;
    ctx.save();
    ctx.translate(px + pw / 2 + 2, py + ph * 0.65);
    ctx.rotate(-legAngle);
    ctx.fillRect(-2, 0, 4, ph * 0.35);
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(-3, ph * 0.3, 6, 4);
    ctx.restore();

    ctx.fillStyle = bodyColor;
    ctx.fillRect(px + 3, py + 10 + idleBob, pw - 6, ph * 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(px + 4, py + 11 + idleBob, pw - 8, 3);

    ctx.fillStyle = armLegColor;
    ctx.save();
    ctx.translate(px + 2, py + 12 + idleBob);
    ctx.rotate(armAngle);
    ctx.fillRect(-2, 0, 4, ph * 0.3);
    ctx.restore();

    ctx.save();
    ctx.translate(px + pw - 2, py + 12 + idleBob);
    ctx.rotate(-armAngle);
    ctx.fillRect(-2, 0, 4, ph * 0.3);
    ctx.restore();

    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + 6 + idleBob, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    const eyeOffX = facingRight ? 2 : -2;
    ctx.fillRect(px + pw / 2 - 4 + eyeOffX, py + 4 + idleBob, 3, 3);
    ctx.fillRect(px + pw / 2 + 1 + eyeOffX, py + 4 + idleBob, 3, 3);
    ctx.fillStyle = '#000000';
    ctx.fillRect(px + pw / 2 - 3 + eyeOffX, py + 5 + idleBob, 1, 1);
    ctx.fillRect(px + pw / 2 + 2 + eyeOffX, py + 5 + idleBob, 1, 1);

    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`Score: ${score}`, 20, 30);
    ctx.fillText(`Keys: ${player.keys}/2`, 20, 55);
    ctx.fillText(`Time: ${levelTime.toFixed(1)}s`, 650, 30);
    ctx.fillText(`Level: ${level + 1}`, 650, 55);

    ctx.fillStyle = '#4a5568';
    ctx.fillRect(20, 70, 200, 20);
    ctx.fillStyle = player.health > 50 ? '#38a169' : player.health > 25 ? '#d69e2e' : '#e53e3e';
    ctx.fillRect(20, 70, (player.health / player.maxHealth) * 200, 20);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(20, 70, 200, 20);

    ctx.restore();
  }, [player, platforms, collectibles, enemies, particles, score, level, levelTime, screenShake, exitPortal]);

  const startGame = () => {
    setLevel(0);
    setGameTime(0);
    setScore(0);
    loadLevel(0);
    setGameState('playing');
  };

  const resetGame = () => {
    setGameState('menu');
    setLevel(0);
    setScore(0);
    setGameTime(0);
    setLevelTime(0);
    loadLevel(0);
  };

  const gemsCollected = collectibles.filter(c => c.collected && c.type === 'gem').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Link href="/super-engine">
              <Button variant="ghost" className="text-gray-300 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                Crystal Quest Platformer
              </h1>
              <p className="text-gray-400">Physics-based puzzle platformer with collectibles and enemies</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Badge className="bg-purple-500/20 text-purple-400">Puzzle Platform</Badge>
            <Badge className="bg-blue-500/20 text-blue-400">Single Player</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <Target className="w-5 h-5 mr-2 text-purple-400" />
                    Level {level + 1} - {levelData.name}
                  </div>
                  <div className="flex items-center space-x-2">
                    {gameState === 'menu' && (
                      <Button onClick={startGame} className="bg-green-500 hover:bg-green-600 text-white">
                        <Play className="w-4 h-4 mr-2" /> Start Game
                      </Button>
                    )}
                    {gameState === 'playing' && (
                      <Button onClick={() => setGameState('paused')} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                        <Pause className="w-4 h-4 mr-2" /> Pause
                      </Button>
                    )}
                    {gameState === 'paused' && (
                      <Button onClick={() => setGameState('playing')} className="bg-green-500 hover:bg-green-600 text-white">
                        <Play className="w-4 h-4 mr-2" /> Resume
                      </Button>
                    )}
                    {(gameState === 'completed' || gameState === 'gameOver') && (
                      <Button onClick={startGame} className="bg-green-500 hover:bg-green-600 text-white">
                        <RotateCcw className="w-4 h-4 mr-2" /> Play Again
                      </Button>
                    )}
                    <Button onClick={resetGame} variant="outline" className="border-gray-600 text-gray-300">
                      <RotateCcw className="w-4 h-4 mr-2" /> Reset
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="w-full bg-gray-900 rounded-lg border border-gray-600"
                />

                {gameState === 'menu' && (
                  <div className="absolute inset-0 bg-black/80 rounded-lg flex items-center justify-center z-10">
                    <div className="text-center space-y-6">
                      <div className="text-6xl mb-4">🏰</div>
                      <h2 className="text-3xl font-bold text-white">Crystal Quest</h2>
                      <p className="text-gray-300 max-w-md">
                        Navigate through challenging platforms, collect crystals and keys,
                        defeat enemies by stomping them, and reach the exit portal!
                      </p>
                      <div className="flex space-x-6 justify-center">
                        <div className="text-center">
                          <Key className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-400">Collect 2 Keys</p>
                        </div>
                        <div className="text-center">
                          <Gem className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-400">Find Gems</p>
                        </div>
                        <div className="text-center">
                          <Target className="w-6 h-6 text-green-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-400">Reach Portal</p>
                        </div>
                      </div>
                      <Button onClick={startGame} className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 text-lg">
                        <Play className="w-5 h-5 mr-2" /> Start Game
                      </Button>
                      <p className="text-xs text-gray-500">WASD / Arrow Keys to move • Space to jump • Stomp enemies from above</p>
                    </div>
                  </div>
                )}

                {gameState === 'paused' && (
                  <div className="absolute inset-0 bg-black/80 rounded-lg flex items-center justify-center z-10">
                    <div className="text-center space-y-4">
                      <Pause className="w-16 h-16 text-white mx-auto" />
                      <h2 className="text-2xl font-bold text-white">Game Paused</h2>
                      <Button onClick={() => setGameState('playing')} className="bg-green-500 hover:bg-green-600 text-white">
                        Continue Playing
                      </Button>
                    </div>
                  </div>
                )}

                {gameState === 'gameOver' && (
                  <div className="absolute inset-0 bg-black/85 rounded-lg flex items-center justify-center z-10">
                    <div className="text-center space-y-4">
                      <div className="text-6xl mb-2">💀</div>
                      <h2 className="text-3xl font-bold text-red-400">Game Over</h2>
                      <p className="text-gray-300">You were defeated! Final score: <span className="text-yellow-400 font-bold">{score}</span></p>
                      <p className="text-gray-400 text-sm">Level {level + 1} • Time: {gameTime.toFixed(1)}s</p>
                      <Button onClick={startGame} className="bg-green-500 hover:bg-green-600 text-white px-8">
                        <RotateCcw className="w-4 h-4 mr-2" /> Try Again
                      </Button>
                    </div>
                  </div>
                )}

                {gameState === 'completed' && (
                  <div className="absolute inset-0 bg-black/85 rounded-lg flex items-center justify-center z-10">
                    <div className="text-center space-y-4">
                      <div className="text-6xl mb-2">🏆</div>
                      <h2 className="text-3xl font-bold text-yellow-400">Victory!</h2>
                      <p className="text-gray-300">You completed all levels!</p>
                      <div className="flex justify-center gap-8 text-sm">
                        <div><span className="text-gray-400">Score:</span> <span className="text-yellow-400 font-bold">{score}</span></div>
                        <div><span className="text-gray-400">Time:</span> <span className="text-blue-400 font-bold">{gameTime.toFixed(1)}s</span></div>
                      </div>
                      <Button onClick={startGame} className="bg-green-500 hover:bg-green-600 text-white px-8">
                        <RotateCcw className="w-4 h-4 mr-2" /> Play Again
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4">
                  <div className="flex space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <Key className="w-4 h-4 text-yellow-400" />
                      <span className="text-gray-400">Keys</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Gem className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-400">Gems</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Heart className="w-4 h-4 text-red-400" />
                      <span className="text-gray-400">Health</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Zap className="w-4 h-4 text-green-400" />
                      <span className="text-gray-400">Spring</span>
                    </div>
                  </div>

                  <div className="text-sm text-gray-400">
                    WASD / Arrow Keys: Move • Space: Jump • Stomp enemies!
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                  Game Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Score</span>
                    <span className="text-white font-bold">{score.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Health</span>
                    <span className="text-white font-bold">{player.health}/{player.maxHealth}</span>
                  </div>
                  <Progress
                    value={(player.health / player.maxHealth) * 100}
                    className="h-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Level</div>
                    <div className="text-white font-bold">{level + 1}/{LEVELS.length}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Keys</div>
                    <div className="text-yellow-400 font-bold">{player.keys}/2</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Time</div>
                    <div className="text-blue-400 font-bold">{levelTime.toFixed(1)}s</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Enemies</div>
                    <div className="text-red-400 font-bold">{enemies.filter(e => !e.alive).length}/{enemies.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-green-400" />
                  Objectives
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={`flex items-center space-x-2 ${player.keys >= 2 ? 'text-green-400' : 'text-gray-400'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${player.keys >= 2 ? 'bg-green-400 border-green-400' : 'border-gray-400'}`}>
                    {player.keys >= 2 && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span>Collect 2 Keys ({player.keys}/2)</span>
                </div>

                <div className={`flex items-center space-x-2 ${gemsCollected >= 2 ? 'text-green-400' : 'text-gray-400'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${gemsCollected >= 2 ? 'bg-green-400 border-green-400' : 'border-gray-400'}`}>
                    {gemsCollected >= 2 && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span>Find 2 Gems ({gemsCollected}/2)</span>
                </div>

                <div className={`flex items-center space-x-2 ${score >= 200 ? 'text-green-400' : 'text-gray-400'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${score >= 200 ? 'bg-green-400 border-green-400' : 'border-gray-400'}`}>
                    {score >= 200 && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span>Score 200+ ({score}/200)</span>
                </div>

                <div className={`flex items-center space-x-2 ${exitPortal.active ? 'text-green-400' : 'text-gray-400'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${exitPortal.active ? 'bg-green-400 border-green-400' : 'border-gray-400'}`}>
                    {exitPortal.active && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span>{exitPortal.active ? 'Portal Open! Go!' : 'Unlock Exit Portal'}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-gray-400">
                <p>• Jump on enemies to defeat them</p>
                <p>• Collect 2 keys to open the exit portal</p>
                <p>• Green platforms are springs — extra bounce!</p>
                <p>• Yellow dashed platforms break when stepped on</p>
                <p>• Falling off costs 25 health</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
