import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Pause, RotateCcw, Shield, Crown } from "lucide-react";
import { useLocation } from "wouter";

type Skin = "fantasy" | "futuristic";

interface TowerDef {
  name: string;
  cost: number;
  damage: number;
  range: number;
  fireRate: number;
  color: string;
  icon: string;
  fantasySrc: string;
  futuristicSrc: string;
  projSrc: string;
  hitEffect: string;
  description: string;
}

interface Tower {
  id: number;
  type: number;
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  cooldown: number;
  level: number;
}

interface Enemy {
  id: number;
  type: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  pathIndex: number;
  pathProgress: number;
  reward: number;
  isBoss: boolean;
  frozen: number;
}

interface Projectile {
  x: number;
  y: number;
  angle: number;
  targetId: number;
  damage: number;
  speed: number;
  type: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface SpriteEffect {
  x: number;
  y: number;
  src: string;
  life: number;
  maxLife: number;
  scale: number;
  sheetType: "single" | "vstrip" | "hstrip";
  frameCount: number;
  frameW: number;
  frameH: number;
  horizontal: boolean;
}

const CELL = 64;
const COLS = 15;
const ROWS = 10;

const GRASS_TILES = [
  "/td-assets/map/grass_1.png",
  "/td-assets/map/grass_1_3.png",
  "/td-assets/map/grass_1_4.png",
  "/td-assets/map/grass_1_5.png",
  "/td-assets/map/grass_1_8.png",
];

interface SheetDef {
  src: string;
  type: "single" | "vstrip" | "hstrip";
  frameCount: number;
  frameW: number;
  frameH: number;
}

const EFFECT_DEFS: Record<string, SheetDef> = {
  fire:      { src: "/td-assets/effects/fire.png",         type: "vstrip", frameCount: 8, frameW: 909, frameH: 300 },
  freeze:    { src: "/td-assets/effects/freeze.png",       type: "vstrip", frameCount: 8, frameW: 909, frameH: 300 },
  damage:    { src: "/td-assets/effects/damage.png",       type: "vstrip", frameCount: 8, frameW: 909, frameH: 300 },
  stone:     { src: "/td-assets/effects/stone.png",        type: "vstrip", frameCount: 8, frameW: 909, frameH: 300 },
  smoke:     { src: "/td-assets/effects/Circle_smoke.png", type: "single", frameCount: 1, frameW: 128, frameH: 128 },
  skull:     { src: "/td-assets/effects/Smoke_scull.png",  type: "single", frameCount: 1, frameW: 128, frameH: 128 },
  magic1:    { src: "/td-assets/effects/magic1.png",       type: "hstrip", frameCount: 10, frameW: 72,  frameH: 72 },
  magic2:    { src: "/td-assets/effects/magic2.png",       type: "hstrip", frameCount: 10, frameW: 72,  frameH: 72 },
  magic3:    { src: "/td-assets/effects/magic3.png",       type: "hstrip", frameCount: 10, frameW: 72,  frameH: 72 },
  magic4:    { src: "/td-assets/effects/magic4.png",       type: "hstrip", frameCount: 4,  frameW: 72,  frameH: 72 },
  magic5:    { src: "/td-assets/effects/magic5.png",       type: "hstrip", frameCount: 4,  frameW: 72,  frameH: 72 },
  archerHit: { src: "/td-assets/archer-tower/explosion2.png", type: "single", frameCount: 1, frameW: 124, frameH: 124 },
  cannonHit: { src: "/td-assets/archer-tower/explosion_big.png", type: "single", frameCount: 1, frameW: 231, frameH: 206 },
};

const ARCHER_BASES = [
  "/td-assets/archer-tower/base_lv1.png",
  "/td-assets/archer-tower/base_lv2.png",
  "/td-assets/archer-tower/base_lv3.png",
  "/td-assets/archer-tower/base_lv4.png",
  "/td-assets/archer-tower/base_lv5.png",
  "/td-assets/archer-tower/base_lv6.png",
  "/td-assets/archer-tower/base_lv7.png",
];

const MAGIC_BASES = [
  "/td-assets/magic-tower/base_lv1.png",
  "/td-assets/magic-tower/base_lv2.png",
  "/td-assets/magic-tower/base_lv3.png",
  "/td-assets/magic-tower/base_lv4.png",
  "/td-assets/magic-tower/base_lv5.png",
  "/td-assets/magic-tower/base_lv6.png",
  "/td-assets/magic-tower/base_lv7.png",
  "/td-assets/magic-tower/base_lv8.png",
  "/td-assets/magic-tower/base_lv9.png",
  "/td-assets/magic-tower/base_lv10.png",
];

const TOWER_DEFS: TowerDef[] = [
  { name: "Archer", cost: 50, damage: 15, range: 150, fireRate: 0.8, color: "#4CAF50", icon: "🏹", fantasySrc: "/td-assets/archer-tower/base_lv1.png", futuristicSrc: "/td-assets/turrets/turret01_idle.png", projSrc: "/td-assets/archer-tower/arrow_proj.png", hitEffect: "archerHit", description: "Fast attack, low damage" },
  { name: "Cannon", cost: 100, damage: 40, range: 120, fireRate: 1.5, color: "#FF9800", icon: "💣", fantasySrc: "/td-assets/archer-tower/base_lv4.png", futuristicSrc: "/td-assets/turrets/turret03_idle.png", projSrc: "/td-assets/projectiles/Bomb.png", hitEffect: "cannonHit", description: "Splash damage, slow" },
  { name: "Lightning", cost: 150, damage: 25, range: 180, fireRate: 0.5, color: "#2196F3", icon: "⚡", fantasySrc: "/td-assets/magic-tower/base_lv4.png", futuristicSrc: "/td-assets/turrets/turret05_idle.png", projSrc: "/td-assets/magic-tower/bolt3.png", hitEffect: "magicHit", description: "Chain lightning, fast" },
  { name: "Sniper", cost: 200, damage: 80, range: 250, fireRate: 2.5, color: "#9C27B0", icon: "🎯", fantasySrc: "/td-assets/archer-tower/base_lv6.png", futuristicSrc: "/td-assets/turrets/turret07_idle.png", projSrc: "/td-assets/projectiles/Bullet.png", hitEffect: "sniperHit", description: "High damage, long range" },
  { name: "Frost", cost: 125, damage: 10, range: 140, fireRate: 0.6, color: "#00BCD4", icon: "❄️", fantasySrc: "/td-assets/magic-tower/base_lv7.png", futuristicSrc: "/td-assets/turrets/turret09_idle.png", projSrc: "/td-assets/magic-tower/bolt4.png", hitEffect: "frostHit", description: "Slows enemies" },
];

const PATH = [
  { x: 0, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 7 },
  { x: 8, y: 7 }, { x: 8, y: 3 }, { x: 11, y: 3 }, { x: 11, y: 6 }, { x: 14, y: 6 }, { x: 15, y: 6 },
];

const WAVES = [
  { count: 8, hpMul: 1, spdMul: 1, reward: 10, bossEvery: 0 },
  { count: 10, hpMul: 1.3, spdMul: 1.1, reward: 12, bossEvery: 0 },
  { count: 12, hpMul: 1.6, spdMul: 1.1, reward: 14, bossEvery: 0 },
  { count: 10, hpMul: 2, spdMul: 1.2, reward: 16, bossEvery: 5 },
  { count: 14, hpMul: 2.5, spdMul: 1.2, reward: 18, bossEvery: 0 },
  { count: 12, hpMul: 3, spdMul: 1.3, reward: 20, bossEvery: 4 },
  { count: 16, hpMul: 3.5, spdMul: 1.3, reward: 22, bossEvery: 0 },
  { count: 14, hpMul: 4, spdMul: 1.4, reward: 25, bossEvery: 3 },
  { count: 18, hpMul: 5, spdMul: 1.4, reward: 28, bossEvery: 0 },
  { count: 15, hpMul: 6, spdMul: 1.5, reward: 30, bossEvery: 3 },
  { count: 20, hpMul: 8, spdMul: 1.5, reward: 35, bossEvery: 0 },
  { count: 1, hpMul: 50, spdMul: 0.8, reward: 200, bossEvery: 1 },
];

function pathPixel(idx: number, prog: number) {
  const i = Math.min(idx, PATH.length - 2);
  const a = PATH[i], b = PATH[i + 1];
  return { x: (a.x + (b.x - a.x) * prog) * CELL + CELL / 2, y: (a.y + (b.y - a.y) * prog) * CELL + CELL / 2 };
}

const pathGrid: boolean[][] = [];
function buildPathGrid() {
  if (pathGrid.length > 0) return;
  for (let r = 0; r < ROWS; r++) { pathGrid[r] = []; for (let c = 0; c < COLS; c++) pathGrid[r][c] = false; }
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    for (let c = Math.min(a.x, b.x); c <= Math.max(a.x, b.x); c++)
      for (let r = Math.min(a.y, b.y); r <= Math.max(a.y, b.y); r++)
        if (c < COLS && r < ROWS) pathGrid[r][c] = true;
  }
}

function isPath(c: number, r: number) {
  buildPathGrid();
  return r >= 0 && r < ROWS && c >= 0 && c < COLS && pathGrid[r][c];
}

function isAdjacentToPath(c: number, r: number) {
  return isPath(c - 1, r) || isPath(c + 1, r) || isPath(c, r - 1) || isPath(c, r + 1)
    || isPath(c - 1, r - 1) || isPath(c + 1, r - 1) || isPath(c - 1, r + 1) || isPath(c + 1, r + 1);
}

function pathNeighbors(c: number, r: number) {
  return {
    n: isPath(c, r - 1),
    s: isPath(c, r + 1),
    e: isPath(c + 1, r),
    w: isPath(c - 1, r),
  };
}

function dist(x1: number, y1: number, x2: number, y2: number) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }
function lerpAngle(from: number, to: number, t: number) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

const imgCache = new Map<string, HTMLImageElement>();
function loadImg(src: string) {
  if (imgCache.has(src)) return;
  const img = new Image();
  img.src = src;
  img.onload = () => imgCache.set(src, img);
  imgCache.set(src, img);
}
function getImg(src: string): HTMLImageElement | null {
  const img = imgCache.get(src);
  return (img && img.complete && img.naturalWidth > 0) ? img : null;
}

const grassMap: number[][] = [];
const decoList: { col: number; row: number; type: number }[] = [];
function generateMap() {
  if (grassMap.length > 0) return;
  buildPathGrid();
  for (let r = 0; r < ROWS; r++) {
    grassMap[r] = [];
    for (let c = 0; c < COLS; c++) grassMap[r][c] = Math.floor(Math.random() * GRASS_TILES.length);
  }
  const corners = [
    { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 },
    { col: 13, row: 0 }, { col: 14, row: 0 }, { col: 14, row: 1 },
    { col: 0, row: 8 }, { col: 0, row: 9 }, { col: 1, row: 9 },
    { col: 13, row: 9 }, { col: 14, row: 9 }, { col: 14, row: 8 },
    { col: 7, row: 0 }, { col: 7, row: 1 },
    { col: 12, row: 8 }, { col: 13, row: 8 },
  ];
  corners.forEach(pos => {
    if (!isPath(pos.col, pos.row) && !isAdjacentToPath(pos.col, pos.row)) {
      decoList.push({ col: pos.col, row: pos.row, type: Math.floor(Math.random() * 6) });
    }
  });
}

function drawRoadCell(ctx: CanvasRenderingContext2D, c: number, r: number, fan: boolean) {
  const nb = pathNeighbors(c, r);
  const cx = c * CELL + CELL / 2;
  const cy = r * CELL + CELL / 2;
  const roadW = CELL * 0.75;
  const half = roadW / 2;

  if (fan) {
    ctx.fillStyle = "#8a7a5a";
    ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    ctx.fillStyle = "#7a6a4a";
    if (nb.n) ctx.fillRect(cx - half, r * CELL, roadW, CELL / 2 + half);
    if (nb.s) ctx.fillRect(cx - half, cy - half, roadW, CELL / 2 + half);
    if (nb.e) ctx.fillRect(cx - half, cy - half, CELL / 2 + half, roadW);
    if (nb.w) ctx.fillRect(c * CELL, cy - half, CELL / 2 + half, roadW);
    if (!nb.n && !nb.s && !nb.e && !nb.w) ctx.fillRect(cx - half, cy - half, roadW, roadW);

    ctx.fillStyle = "#9a8a65";
    const innerW = roadW - 8;
    const innerH = innerW / 2;
    if (nb.n) ctx.fillRect(cx - innerW / 2, r * CELL, innerW, CELL / 2 + innerH);
    if (nb.s) ctx.fillRect(cx - innerW / 2, cy - innerH, innerW, CELL / 2 + innerH);
    if (nb.e) ctx.fillRect(cx - innerH, cy - innerW / 2, CELL / 2 + innerH, innerW);
    if (nb.w) ctx.fillRect(c * CELL, cy - innerW / 2, CELL / 2 + innerH, innerW);
    if (!nb.n && !nb.s && !nb.e && !nb.w) ctx.fillRect(cx - innerW / 2, cy - innerW / 2, innerW, innerW);

    ctx.fillStyle = "rgba(180,160,120,0.15)";
    for (let i = 0; i < 6; i++) {
      const dx = (c * 7 + i * 13) % CELL;
      const dy = (r * 11 + i * 17) % CELL;
      ctx.fillRect(c * CELL + dx, r * CELL + dy, 4, 4);
    }

    ctx.strokeStyle = "#6a5a3a";
    ctx.lineWidth = 2;
    if (!nb.n) { ctx.beginPath(); ctx.moveTo(cx - half, r * CELL + (CELL - roadW) / 2); ctx.lineTo(cx + half, r * CELL + (CELL - roadW) / 2); ctx.stroke(); }
    if (!nb.s) { ctx.beginPath(); ctx.moveTo(cx - half, r * CELL + CELL - (CELL - roadW) / 2); ctx.lineTo(cx + half, r * CELL + CELL - (CELL - roadW) / 2); ctx.stroke(); }
    if (!nb.e) { ctx.beginPath(); ctx.moveTo(c * CELL + CELL - (CELL - roadW) / 2, cy - half); ctx.lineTo(c * CELL + CELL - (CELL - roadW) / 2, cy + half); ctx.stroke(); }
    if (!nb.w) { ctx.beginPath(); ctx.moveTo(c * CELL + (CELL - roadW) / 2, cy - half); ctx.lineTo(c * CELL + (CELL - roadW) / 2, cy + half); ctx.stroke(); }
  } else {
    ctx.fillStyle = "#1e1e3e";
    ctx.fillRect(c * CELL, r * CELL, CELL, CELL);

    ctx.fillStyle = "#2a2a55";
    if (nb.n) ctx.fillRect(cx - half, r * CELL, roadW, CELL / 2 + half);
    if (nb.s) ctx.fillRect(cx - half, cy - half, roadW, CELL / 2 + half);
    if (nb.e) ctx.fillRect(cx - half, cy - half, CELL / 2 + half, roadW);
    if (nb.w) ctx.fillRect(c * CELL, cy - half, CELL / 2 + half, roadW);
    if (!nb.n && !nb.s && !nb.e && !nb.w) ctx.fillRect(cx - half, cy - half, roadW, roadW);

    ctx.strokeStyle = "rgba(80,80,255,0.25)";
    ctx.lineWidth = 1;
    if (nb.n && nb.s) {
      ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(cx, r * CELL); ctx.lineTo(cx, r * CELL + CELL); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (nb.e && nb.w) {
      ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(c * CELL, cy); ctx.lineTo(c * CELL + CELL, cy); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = "rgba(100,100,255,0.15)";
    ctx.lineWidth = 1;
    if (!nb.n) { ctx.beginPath(); ctx.moveTo(cx - half, r * CELL + (CELL - roadW) / 2); ctx.lineTo(cx + half, r * CELL + (CELL - roadW) / 2); ctx.stroke(); }
    if (!nb.s) { ctx.beginPath(); ctx.moveTo(cx - half, r * CELL + CELL - (CELL - roadW) / 2); ctx.lineTo(cx + half, r * CELL + CELL - (CELL - roadW) / 2); ctx.stroke(); }
    if (!nb.e) { ctx.beginPath(); ctx.moveTo(c * CELL + CELL - (CELL - roadW) / 2, cy - half); ctx.lineTo(c * CELL + CELL - (CELL - roadW) / 2, cy + half); ctx.stroke(); }
    if (!nb.w) { ctx.beginPath(); ctx.moveTo(c * CELL + (CELL - roadW) / 2, cy - half); ctx.lineTo(c * CELL + (CELL - roadW) / 2, cy + half); ctx.stroke(); }
  }
}

export default function TowerDefense() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [skin, setSkin] = useState<Skin>("fantasy");
  const [selTower, setSelTower] = useState(0);
  const [gold, setGold] = useState(200);
  const [lives, setLives] = useState(20);
  const [wave, setWave] = useState(0);
  const [score, setScore] = useState(0);
  const [state, setState] = useState<"idle" | "playing" | "paused" | "won" | "lost">("idle");

  const towersR = useRef<Tower[]>([]);
  const enemiesR = useRef<Enemy[]>([]);
  const projsR = useRef<Projectile[]>([]);
  const partsR = useRef<Particle[]>([]);
  const effectsR = useRef<SpriteEffect[]>([]);
  const spawnT = useRef(0);
  const spawned = useRef(0);
  const waveR = useRef(0);
  const goldR = useRef(200);
  const livesR = useRef(20);
  const scoreR = useRef(0);
  const nid = useRef(1);
  const raf = useRef(0);
  const lastT = useRef(0);
  const stateR = useRef<string>("idle");
  const skinR = useRef<Skin>("fantasy");
  const bgCanvas = useRef<HTMLCanvasElement | null>(null);
  const bgDrawn = useRef<string>("");

  useEffect(() => { skinR.current = skin; }, [skin]);

  useEffect(() => {
    generateMap();
    TOWER_DEFS.forEach(t => { loadImg(t.fantasySrc); loadImg(t.futuristicSrc); loadImg(t.projSrc); });
    GRASS_TILES.forEach(s => loadImg(s));
    Object.values(EFFECT_DEFS).forEach(d => loadImg(d.src));
    ARCHER_BASES.forEach(s => loadImg(s));
    MAGIC_BASES.forEach(s => loadImg(s));
    for (let i = 1; i <= 3; i++) loadImg(`/td-assets/archer-tower/arrow${i}.png`);
    for (let i = 1; i <= 3; i++) loadImg(`/td-assets/archer-tower/explosion${i}.png`);
    loadImg("/td-assets/archer-tower/explosion_big.png");
    for (let i = 38; i <= 50; i++) loadImg(`/td-assets/archer-tower/weapon_${i}.png`);
    for (let i = 1; i <= 4; i++) loadImg(`/td-assets/magic-tower/bolt${i}.png`);
    loadImg("/td-assets/magic-tower/orb1.png");
    loadImg("/td-assets/magic-tower/orb2.png");
    for (let i = 19; i <= 26; i++) loadImg(`/td-assets/magic-tower/beam_${i}.png`);
    loadImg("/td-assets/effects/magic2.png");
    loadImg("/td-assets/effects/magic4.png");
    loadImg("/td-assets/effects/magic5.png");
    for (let i = 1; i <= 4; i++) loadImg(`/td-assets/projectiles/Bullet${i}.png`);
    loadImg("/td-assets/projectiles/Lighter.png");
    for (let i = 1; i <= 10; i++) loadImg(`/td-assets/monsters/creature${i}.png`);
    for (let i = 1; i <= 5; i++) { loadImg(`/td-assets/monsters/topdown_0${i}.png`); loadImg(`/td-assets/monsters/boss_0${i}.png`); }
    for (let i = 1; i <= 25; i++) loadImg(`/td-assets/map/building_artboard_${i}.png`);
    loadImg("/td-assets/td-bg/bg1.png");
  }, []);

  const drawBg = useCallback((fan: boolean) => {
    const key = fan ? "f" : "s";
    if (bgDrawn.current === key && bgCanvas.current) return;
    if (!bgCanvas.current) {
      bgCanvas.current = document.createElement("canvas");
      bgCanvas.current.width = COLS * CELL;
      bgCanvas.current.height = ROWS * CELL;
    }
    const ctx = bgCanvas.current.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = fan ? "#3a6030" : "#12122a";
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (isPath(c, r)) continue;
      if (fan) {
        const idx = grassMap[r]?.[c] ?? 0;
        const img = getImg(GRASS_TILES[idx]);
        if (img) {
          ctx.drawImage(img, c * CELL, r * CELL, CELL, CELL);
        } else {
          ctx.fillStyle = (c + r) % 2 === 0 ? "#3a6830" : "#2e5828";
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        }
        if (isAdjacentToPath(c, r)) {
          ctx.fillStyle = "rgba(100,140,80,0.25)";
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        }
      } else {
        ctx.fillStyle = (c + r) % 2 === 0 ? "#161636" : "#121230";
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }

    ctx.strokeStyle = fan ? "rgba(60,90,40,0.15)" : "rgba(40,40,80,0.15)";
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, ROWS * CELL); ctx.stroke(); }
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(COLS * CELL, r * CELL); ctx.stroke(); }

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (isPath(c, r)) drawRoadCell(ctx, c, r, fan);
    }

    decoList.forEach(deco => {
      const src = `/td-assets/map/building_artboard_${deco.type + 10}.png`;
      const img = getImg(src);
      if (img) {
        ctx.globalAlpha = 0.5;
        ctx.drawImage(img, deco.col * CELL + 6, deco.row * CELL + 6, CELL - 12, CELL - 12);
        ctx.globalAlpha = 1;
      }
    });

    const sp = pathPixel(0, 0);
    ctx.fillStyle = fan ? "rgba(40,160,40,0.9)" : "rgba(40,40,220,0.9)";
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = fan ? "#1a5a1a" : "#2222aa"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 9px Inter"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("START", sp.x, sp.y);

    const ep = pathPixel(PATH.length - 2, 1);
    ctx.fillStyle = "rgba(200,40,40,0.9)";
    ctx.beginPath(); ctx.arc(ep.x, ep.y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#6a1a1a"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.fillText("END", ep.x, ep.y);

    bgDrawn.current = key;
  }, []);

  const reset = useCallback(() => {
    towersR.current = []; enemiesR.current = []; projsR.current = []; partsR.current = []; effectsR.current = [];
    spawnT.current = 0; spawned.current = 0; waveR.current = 0;
    goldR.current = 200; livesR.current = 20; scoreR.current = 0; nid.current = 1;
    setGold(200); setLives(20); setWave(0); setScore(0);
    setState("idle"); stateR.current = "idle";
  }, []);

  const startWave = useCallback(() => {
    if (waveR.current >= WAVES.length) { setState("won"); stateR.current = "won"; return; }
    spawned.current = 0; spawnT.current = 0;
    setState("playing"); stateR.current = "playing";
  }, []);

  const placeTower = useCallback((col: number, row: number) => {
    if (isPath(col, row)) return;
    if (towersR.current.some(t => Math.floor(t.x / CELL) === col && Math.floor(t.y / CELL) === row)) return;
    const def = TOWER_DEFS[selTower];
    if (goldR.current < def.cost) return;
    goldR.current -= def.cost; setGold(goldR.current);
    towersR.current.push({ id: nid.current++, type: selTower, x: col * CELL + CELL / 2, y: row * CELL + CELL / 2, angle: 0, targetAngle: 0, cooldown: 0, level: 1 });
  }, [selTower]);

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current; if (!cv) return;
    const r = cv.getBoundingClientRect();
    const sx = cv.width / r.width, sy = cv.height / r.height;
    const x = (e.clientX - r.left) * sx, y = (e.clientY - r.top) * sy;
    const col = Math.floor(x / CELL), row = Math.floor(y / CELL);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) placeTower(col, row);
  }, [placeTower]);

  const spark = useCallback((x: number, y: number, color: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 80;
      partsR.current.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.4, maxLife: 0.5, color, size: 2 + Math.random() * 4 });
    }
  }, []);

  const addEffect = useCallback((x: number, y: number, effectKey: string, scale?: number) => {
    const def = EFFECT_DEFS[effectKey];
    if (def) {
      const duration = def.type === "single" ? 0.5 : 0.6;
      effectsR.current.push({
        x, y, src: def.src, life: duration, maxLife: duration, scale: scale || 1,
        sheetType: def.type, frameCount: def.frameCount, frameW: def.frameW, frameH: def.frameH,
        horizontal: def.type === "hstrip",
      });
    } else if (effectKey.startsWith("/")) {
      effectsR.current.push({
        x, y, src: effectKey, life: 0.5, maxLife: 0.5, scale: scale || 1,
        sheetType: "single", frameCount: 1, frameW: 0, frameH: 0, horizontal: false,
      });
    }
  }, []);

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;

    const loop = (ts: number) => {
      const dt = Math.min((ts - lastT.current) / 1000, 0.05);
      lastT.current = ts;

      if (stateR.current === "playing") {
        const w = WAVES[waveR.current];
        if (w) {
          spawnT.current -= dt;
          if (spawnT.current <= 0 && spawned.current < w.count) {
            const boss = w.bossEvery > 0 && (spawned.current + 1) % w.bossEvery === 0;
            const hp = (boss ? 200 : 50) * w.hpMul;
            enemiesR.current.push({ id: nid.current++, type: Math.floor(Math.random() * (boss ? 5 : 10)), x: 0, y: 0, hp, maxHp: hp, speed: (50 + Math.random() * 20) * w.spdMul, pathIndex: 0, pathProgress: 0, reward: boss ? w.reward * 3 : w.reward, isBoss: boss, frozen: 0 });
            spawned.current++;
            spawnT.current = boss ? 2 : 0.8;
          }
        }

        enemiesR.current.forEach(e => {
          if (e.pathIndex >= PATH.length - 1) return;
          e.frozen = Math.max(0, e.frozen - dt);
          const spd = e.frozen > 0 ? e.speed * 0.4 : e.speed;
          const a = PATH[e.pathIndex], b = PATH[e.pathIndex + 1];
          const segLen = dist(a.x * CELL, a.y * CELL, b.x * CELL, b.y * CELL);
          e.pathProgress += (spd * dt) / segLen;
          if (e.pathProgress >= 1) { e.pathProgress = 0; e.pathIndex++; }
          const pos = pathPixel(e.pathIndex, e.pathProgress);
          e.x = pos.x; e.y = pos.y;
        });

        const esc = enemiesR.current.filter(e => e.pathIndex >= PATH.length - 1);
        if (esc.length) {
          livesR.current -= esc.length; setLives(livesR.current);
          enemiesR.current = enemiesR.current.filter(e => e.pathIndex < PATH.length - 1);
          if (livesR.current <= 0) { setState("lost"); stateR.current = "lost"; }
        }

        towersR.current.forEach(tw => {
          tw.cooldown -= dt;
          const def = TOWER_DEFS[tw.type];
          let tgt: Enemy | undefined, md = Infinity;
          enemiesR.current.forEach(e => { const dd = dist(tw.x, tw.y, e.x, e.y); if (dd <= def.range && dd < md) { md = dd; tgt = e; } });
          if (tgt) tw.targetAngle = Math.atan2(tgt.y - tw.y, tgt.x - tw.x);
          tw.angle = lerpAngle(tw.angle, tw.targetAngle, Math.min(1, dt * 8));
          if (tw.cooldown <= 0 && tgt) {
            tw.cooldown = def.fireRate;
            const pa = Math.atan2(tgt.y - tw.y, tgt.x - tw.x);
            projsR.current.push({ x: tw.x + Math.cos(pa) * 20, y: tw.y + Math.sin(pa) * 20, angle: pa, targetId: tgt.id, damage: def.damage * tw.level, speed: 400, type: tw.type });
          }
        });

        projsR.current.forEach(p => {
          const tgt = enemiesR.current.find(e => e.id === p.targetId);
          if (!tgt) { p.speed = -1; return; }
          const ang = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          p.angle = ang;
          p.x += Math.cos(ang) * p.speed * dt;
          p.y += Math.sin(ang) * p.speed * dt;
          if (dist(p.x, p.y, tgt.x, tgt.y) < 15) {
            tgt.hp -= p.damage; p.speed = -1;
            const def = TOWER_DEFS[p.type];
            const hitScale = tgt.isBoss ? 1.5 : 1;

            if (p.type === 0 || p.type === 3) {
              addEffect(tgt.x, tgt.y, "archerHit", hitScale);
              addEffect(tgt.x, tgt.y, "damage", hitScale * 0.7);
              spark(tgt.x, tgt.y, "#cc8800", 5);
            } else if (p.type === 1) {
              addEffect(tgt.x, tgt.y, "cannonHit", hitScale * 1.2);
              addEffect(tgt.x, tgt.y, "fire", hitScale);
              spark(tgt.x, tgt.y, "#ff6600", 10);
              enemiesR.current.forEach(e2 => { if (e2.id !== tgt!.id && dist(e2.x, e2.y, tgt!.x, tgt!.y) < 60) e2.hp -= p.damage * 0.4; });
            } else if (p.type === 2) {
              const mKey = `magic${1 + Math.floor(Math.random() * 3)}` as string;
              addEffect(tgt.x, tgt.y, mKey, hitScale);
              addEffect(tgt.x, tgt.y, "damage", hitScale * 0.6);
              spark(tgt.x, tgt.y, "#8855ff", 7);
            } else if (p.type === 4) {
              addEffect(tgt.x, tgt.y, "freeze", hitScale * 0.8);
              const fKey = `magic${4 + Math.floor(Math.random() * 2)}` as string;
              addEffect(tgt.x, tgt.y, fKey, hitScale * 0.7);
              spark(tgt.x, tgt.y, "#00E5FF", 6);
            } else {
              addEffect(tgt.x, tgt.y, "damage", hitScale);
              spark(tgt.x, tgt.y, def.color, 6);
            }

            if (p.type === 4) tgt.frozen = 2;

            if (tgt.hp <= 0) {
              goldR.current += tgt.reward; scoreR.current += tgt.reward * 10;
              setGold(goldR.current); setScore(scoreR.current);
              addEffect(tgt.x, tgt.y, "skull", 1.3);
              addEffect(tgt.x, tgt.y, "cannonHit", 1.0);
              spark(tgt.x, tgt.y, "#ff4444", 14);
              enemiesR.current = enemiesR.current.filter(e => e.id !== tgt!.id);
            }
          }
        });
        projsR.current = projsR.current.filter(p => p.speed > 0);

        partsR.current.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vy += 60 * dt; });
        partsR.current = partsR.current.filter(p => p.life > 0);

        effectsR.current.forEach(ef => { ef.life -= dt; });
        effectsR.current = effectsR.current.filter(ef => ef.life > 0);

        if (spawned.current >= (w?.count || 0) && enemiesR.current.length === 0 && stateR.current === "playing") {
          waveR.current++; setWave(waveR.current);
          if (waveR.current >= WAVES.length) { setState("won"); stateR.current = "won"; }
          else { goldR.current += 30 + waveR.current * 10; setGold(goldR.current); setState("idle"); stateR.current = "idle"; }
        }
      }

      const fan = skinR.current === "fantasy";
      const now = performance.now();
      drawBg(fan);
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (bgCanvas.current) ctx.drawImage(bgCanvas.current, 0, 0);

      towersR.current.forEach(tw => {
        const def = TOWER_DEFS[tw.type];
        ctx.save(); ctx.globalAlpha = 0.05; ctx.beginPath(); ctx.arc(tw.x, tw.y, def.range, 0, Math.PI * 2); ctx.fillStyle = def.color; ctx.fill(); ctx.restore();
        ctx.strokeStyle = `${def.color}18`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(tw.x, tw.y, def.range, 0, Math.PI * 2); ctx.stroke();

        if (fan) {
          const isArcher = tw.type === 0 || tw.type === 1 || tw.type === 3;
          const isMagic = tw.type === 2 || tw.type === 4;
          let baseSrc = def.fantasySrc;
          if (tw.level > 1) {
            const lvIdx = Math.min(tw.level - 1, (isArcher ? ARCHER_BASES.length : MAGIC_BASES.length) - 1);
            baseSrc = isArcher ? ARCHER_BASES[lvIdx] : MAGIC_BASES[lvIdx];
          }
          const baseImg = getImg(baseSrc);
          if (baseImg) {
            const aspect = baseImg.naturalWidth / baseImg.naturalHeight;
            const drawH = CELL * 1.2;
            const drawW = drawH * aspect;
            ctx.drawImage(baseImg, tw.x - drawW / 2, tw.y - drawH * 0.65, drawW, drawH);
          } else {
            ctx.fillStyle = def.color; ctx.fillRect(tw.x - 16, tw.y - 16, 32, 32);
          }

          if (isArcher) {
            let normalA = ((tw.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            const weapIdx = 38 + Math.round(normalA / (Math.PI * 2) * 12) % 13;
            const weapImg = getImg(`/td-assets/archer-tower/weapon_${weapIdx}.png`);
            if (weapImg) {
              const wSz = 28;
              const wAspect = weapImg.naturalWidth / weapImg.naturalHeight;
              ctx.drawImage(weapImg, tw.x - (wSz * wAspect) / 2, tw.y - CELL * 0.55 - wSz / 2, wSz * wAspect, wSz);
            }

            if (tw.cooldown > def.fireRate * 0.85) {
              ctx.save();
              const flashProg = (tw.cooldown - def.fireRate * 0.85) / (def.fireRate * 0.15);
              ctx.globalAlpha = flashProg * 0.7;
              ctx.fillStyle = "#fff";
              const fx = tw.x + Math.cos(tw.angle) * 22;
              const fy = tw.y - CELL * 0.4 + Math.sin(tw.angle) * 22;
              ctx.beginPath(); ctx.arc(fx, fy, 4 + flashProg * 3, 0, Math.PI * 2); ctx.fill();
              ctx.restore();
            }
          }

          if (isMagic) {
            const orbFrame = Math.floor(now / 400) % 2;
            const orbImg = getImg(`/td-assets/magic-tower/orb${orbFrame + 1}.png`);
            if (orbImg) {
              ctx.save();
              const hover = Math.sin(now / 300) * 3;
              const orbSz = 22;
              const orbY = tw.y - CELL * 0.6 + hover;
              ctx.globalAlpha = 0.3;
              ctx.fillStyle = tw.type === 4 ? "#00E5FF" : "#8844ff";
              ctx.beginPath(); ctx.arc(tw.x, orbY, orbSz * 0.7, 0, Math.PI * 2); ctx.fill();
              ctx.globalAlpha = 1;
              ctx.drawImage(orbImg, tw.x - orbSz / 2, orbY - orbSz / 2, orbSz, orbSz);
              ctx.restore();
            }

            if (tw.cooldown > def.fireRate * 0.7) {
              ctx.save();
              const beamProg = (tw.cooldown - def.fireRate * 0.7) / (def.fireRate * 0.3);
              const beamFrame = 19 + Math.floor(beamProg * 7.99);
              const beamImg = getImg(`/td-assets/magic-tower/beam_${beamFrame}.png`);
              if (beamImg) {
                ctx.globalAlpha = beamProg * 0.8;
                ctx.save();
                ctx.translate(tw.x, tw.y - CELL * 0.5);
                ctx.rotate(tw.angle + Math.PI / 2);
                const bH = 36, bW = bH * (beamImg.naturalWidth / beamImg.naturalHeight);
                ctx.drawImage(beamImg, -bW / 2, 0, bW, bH);
                ctx.restore();
              }
              ctx.globalAlpha = beamProg * 0.6;
              ctx.fillStyle = tw.type === 4 ? "#00E5FF" : "#aa66ff";
              const fx = tw.x + Math.cos(tw.angle) * 28;
              const fy = tw.y - CELL * 0.5 + Math.sin(tw.angle) * 28;
              ctx.beginPath(); ctx.arc(fx, fy, 6 + beamProg * 4, 0, Math.PI * 2); ctx.fill();
              ctx.restore();
            }
          }
        } else {
          const turretImg = getImg(def.futuristicSrc);
          const sz = CELL * 0.85;
          ctx.save();
          ctx.translate(tw.x, tw.y);
          ctx.rotate(tw.angle + Math.PI / 2);
          if (turretImg) {
            ctx.drawImage(turretImg, -sz / 2, -sz / 2, sz, sz);
          } else {
            ctx.fillStyle = def.color; ctx.fillRect(-16, -16, 32, 32);
          }
          ctx.restore();

          ctx.save();
          ctx.translate(tw.x, tw.y);
          ctx.rotate(tw.angle);
          ctx.strokeStyle = `${def.color}aa`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sz * 0.3, 0); ctx.lineTo(sz * 0.5, 0); ctx.stroke();
          ctx.restore();
        }

        if (tw.level > 1) { ctx.fillStyle = "#FFD700"; ctx.font = "bold 10px Inter"; ctx.textAlign = "center"; ctx.fillText(`Lv${tw.level}`, tw.x, tw.y - CELL * 0.7); }
      });

      enemiesR.current.forEach(e => {
        const src = e.isBoss ? `/td-assets/monsters/boss_0${(e.type % 5) + 1}.png` : `/td-assets/monsters/${e.type < 5 ? `topdown_0${e.type + 1}` : `creature${e.type - 4}`}.png`;
        const img = getImg(src);
        const sz = e.isBoss ? 48 : 32;

        if (e.frozen > 0) {
          ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = "#00BCD4";
          ctx.beginPath(); ctx.arc(e.x, e.y, sz / 2 + 5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#00E5FF"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
        }

        const bob = Math.sin(ts * 0.005 + e.id) * 2;
        if (img) { ctx.drawImage(img, e.x - sz / 2, e.y - sz / 2 + bob, sz, sz); }
        else { ctx.fillStyle = e.isBoss ? "#ff2222" : "#ff6644"; ctx.beginPath(); ctx.arc(e.x, e.y + bob, sz / 2, 0, Math.PI * 2); ctx.fill(); }

        if (e.isBoss) {
          ctx.save(); ctx.globalAlpha = 0.15 + Math.sin(ts * 0.003) * 0.08;
          ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(e.x, e.y, sz / 2 + 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }

        const bw = sz, bh = 4, bx = e.x - bw / 2, by = e.y - sz / 2 - 10;
        ctx.fillStyle = "#111"; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        const pct = e.hp / e.maxHp;
        ctx.fillStyle = pct > 0.5 ? "#4CAF50" : pct > 0.25 ? "#FF9800" : "#f44336";
        ctx.fillRect(bx, by, bw * pct, bh);
      });

      projsR.current.forEach(p => {
        const def = TOWER_DEFS[p.type];

        if (p.type === 0 || p.type === 3) {
          const arrowFrame = 1 + Math.floor(now / 120) % 3;
          const arrowImg = getImg(`/td-assets/archer-tower/arrow${arrowFrame}.png`);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
          if (arrowImg) {
            const arrowW = 30, arrowH = arrowW * (arrowImg.naturalHeight / arrowImg.naturalWidth);
            ctx.drawImage(arrowImg, -arrowW * 0.6, -arrowH / 2, arrowW, arrowH);
          } else {
            ctx.fillStyle = def.color; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -3); ctx.lineTo(-6, 3); ctx.closePath(); ctx.fill();
          }
          ctx.restore();

          ctx.save(); ctx.globalAlpha = 0.15;
          for (let t = 1; t <= 3; t++) {
            const tx = p.x - Math.cos(p.angle) * t * 8;
            const ty = p.y - Math.sin(p.angle) * t * 8;
            ctx.fillStyle = "#aa8833";
            ctx.beginPath(); ctx.arc(tx, ty, 2, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        } else if (p.type === 1) {
          const bombImg = getImg("/td-assets/projectiles/Bomb.png");
          ctx.save(); ctx.translate(p.x, p.y);
          const bobble = Math.sin(now / 80) * 2;
          if (bombImg) {
            ctx.drawImage(bombImg, -10, -10 + bobble, 20, 20);
          } else {
            ctx.fillStyle = "#FF9800"; ctx.beginPath(); ctx.arc(0, bobble, 7, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();

          ctx.save(); ctx.globalAlpha = 0.3;
          ctx.fillStyle = "#ff6600";
          for (let t = 1; t <= 4; t++) {
            const tx = p.x - Math.cos(p.angle) * t * 6 + (Math.random() - 0.5) * 4;
            const ty = p.y - Math.sin(p.angle) * t * 6 + (Math.random() - 0.5) * 4;
            ctx.beginPath(); ctx.arc(tx, ty, 3 - t * 0.5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        } else if (p.type === 2) {
          const boltFrame = 1 + Math.floor(now / 100) % 4;
          const boltImg = getImg(`/td-assets/magic-tower/bolt${boltFrame}.png`);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle + Math.PI / 2);
          if (boltImg) {
            const boltH = 22, boltW = boltH * (boltImg.naturalWidth / boltImg.naturalHeight);
            ctx.drawImage(boltImg, -boltW / 2, -boltH / 2, boltW, boltH);
          } else {
            ctx.fillStyle = "#4488ff"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();

          ctx.save(); ctx.globalAlpha = 0.35;
          ctx.strokeStyle = "#6699ff"; ctx.lineWidth = 2;
          for (let seg = 0; seg < 3; seg++) {
            const sx = p.x - Math.cos(p.angle) * (8 + seg * 10);
            const sy = p.y - Math.sin(p.angle) * (8 + seg * 10);
            const ex = sx - Math.cos(p.angle) * 8 + (Math.random() - 0.5) * 12;
            const ey = sy - Math.sin(p.angle) * 8 + (Math.random() - 0.5) * 12;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
          }
          ctx.restore();

          ctx.save(); ctx.globalAlpha = 0.2;
          ctx.fillStyle = "#88aaff";
          ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else if (p.type === 4) {
          const frostBolt = getImg("/td-assets/magic-tower/bolt4.png");
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle + Math.PI / 2);
          if (frostBolt) {
            const fbH = 20, fbW = fbH * (frostBolt.naturalWidth / frostBolt.naturalHeight);
            ctx.drawImage(frostBolt, -fbW / 2, -fbH / 2, fbW, fbH);
          } else {
            ctx.fillStyle = "#00BCD4"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();

          ctx.save(); ctx.globalAlpha = 0.2;
          ctx.fillStyle = "#00E5FF";
          ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
          for (let t = 1; t <= 4; t++) {
            const tx = p.x - Math.cos(p.angle) * t * 7 + (Math.random() - 0.5) * 6;
            const ty = p.y - Math.sin(p.angle) * t * 7 + (Math.random() - 0.5) * 6;
            ctx.globalAlpha = 0.15 / t;
            ctx.beginPath(); ctx.arc(tx, ty, 4 - t * 0.5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        } else {
          const bulletFrame = 1 + Math.floor(now / 150) % 4;
          const bulletImg = getImg(`/td-assets/projectiles/Bullet${bulletFrame}.png`);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
          if (bulletImg) {
            const bSz = 16;
            const bAspect = bulletImg.naturalWidth / bulletImg.naturalHeight;
            ctx.drawImage(bulletImg, -bSz * bAspect / 2, -bSz / 2, bSz * bAspect, bSz);
          } else {
            ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();

          ctx.save(); ctx.globalAlpha = 0.2;
          ctx.strokeStyle = def.color; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x - Math.cos(p.angle) * 8, p.y - Math.sin(p.angle) * 8);
          ctx.lineTo(p.x - Math.cos(p.angle) * 24, p.y - Math.sin(p.angle) * 24);
          ctx.stroke();
          ctx.restore();
        }
      });

      effectsR.current.forEach(ef => {
        const img = getImg(ef.src);
        if (!img) return;
        const progress = ef.life / ef.maxLife;
        const elapsed = 1 - progress;
        ctx.save();
        ctx.globalAlpha = Math.pow(progress, 0.5);

        if (ef.sheetType === "vstrip" && ef.frameCount > 1) {
          const frameIdx = Math.min(Math.floor(elapsed * ef.frameCount), ef.frameCount - 1);
          const sx = 0;
          const sy = frameIdx * ef.frameH;
          const drawSz = 56 * ef.scale;
          const aspect = ef.frameW / ef.frameH;
          const dw = drawSz * aspect, dh = drawSz;
          ctx.drawImage(img, sx, sy, ef.frameW, ef.frameH, ef.x - dw / 2, ef.y - dh / 2, dw, dh);
        } else if (ef.sheetType === "hstrip" && ef.frameCount > 1) {
          const frameIdx = Math.min(Math.floor(elapsed * ef.frameCount), ef.frameCount - 1);
          const sx = frameIdx * ef.frameW;
          const sy = 0;
          const drawSz = 48 * ef.scale;
          ctx.drawImage(img, sx, sy, ef.frameW, ef.frameH, ef.x - drawSz / 2, ef.y - drawSz / 2, drawSz, drawSz);
        } else {
          const isExplosion = ef.src.includes("explosion");
          let baseSz = isExplosion ? (ef.src.includes("big") ? 80 : 56) : 48;
          const expand = 0.6 + progress * 0.5;
          const sz = baseSz * ef.scale * expand;
          if (ef.frameW > 0 && ef.frameH > 0) {
            const aspect = ef.frameW / ef.frameH;
            ctx.drawImage(img, ef.x - (sz * aspect) / 2, ef.y - sz / 2, sz * aspect, sz);
          } else {
            const aspect = img.naturalWidth / img.naturalHeight;
            ctx.drawImage(img, ef.x - (sz * aspect) / 2, ef.y - sz / 2, sz * aspect, sz);
          }
        }
        ctx.restore();
      });

      partsR.current.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      if (stateR.current === "won" || stateR.current === "lost") {
        ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, 0, cv.width, cv.height);
        const isW = stateR.current === "won";
        ctx.shadowColor = isW ? "#FFD700" : "#ff4444"; ctx.shadowBlur = 20;
        ctx.fillStyle = isW ? "#FFD700" : "#ff4444";
        ctx.font = "bold 52px 'Cinzel', serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(isW ? "VICTORY!" : "DEFEATED", cv.width / 2, cv.height / 2 - 30);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#aaa"; ctx.font = "18px Inter"; ctx.fillText(`Final Score: ${scoreR.current}`, cv.width / 2, cv.height / 2 + 20);
        ctx.fillStyle = "#777"; ctx.font = "14px Inter"; ctx.fillText("Click 'Play Again' to restart", cv.width / 2, cv.height / 2 + 50);
      }

      raf.current = requestAnimationFrame(loop);
    };

    lastT.current = performance.now();
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [spark, addEffect, drawBg]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, hsl(225,30%,6%), hsl(225,28%,10%))' }}>
      <header className="border-b border-[hsl(43,60%,30%)]/30 px-4 py-3" style={{ background: 'linear-gradient(180deg, hsl(225,30%,10%), hsl(225,30%,8%))' }}>
        <div className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Home
            </Button>
            <h1 className="text-xl font-heading gold-text font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-[hsl(43,85%,55%)]" /> Tower Defense
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)]"><Crown className="w-3 h-3 mr-1" /> {gold} Gold</Badge>
            <Badge variant="outline" className="border-red-600/50 text-red-400">❤️ {lives}</Badge>
            <Badge variant="outline" className="border-[hsl(280,50%,50%)]/50 text-[hsl(280,70%,60%)]">Wave {wave + 1}/{WAVES.length}</Badge>
            <Badge variant="outline" className="border-[hsl(120,60%,40%)]/50 text-[hsl(120,60%,50%)]">Score: {score}</Badge>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="w-full md:w-60 border-b md:border-b-0 md:border-r border-[hsl(43,60%,30%)]/30 p-3 space-y-3 overflow-y-auto" style={{ background: 'hsl(225,30%,7%)' }}>
          <div>
            <div className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-widest mb-2" style={{ WebkitTextFillColor: 'unset' }}>Theme</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setSkin("fantasy"); bgDrawn.current = ""; }} className={`p-2 rounded text-xs font-heading transition ${skin === "fantasy" ? "bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]" : "bg-[hsl(225,25%,15%)] text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)]"}`}>
                ⚔️ Fantasy
              </button>
              <button onClick={() => { setSkin("futuristic"); bgDrawn.current = ""; }} className={`p-2 rounded text-xs font-heading transition ${skin === "futuristic" ? "bg-[hsl(220,80%,55%)]/20 text-[hsl(220,80%,70%)] border border-[hsl(220,60%,50%)]" : "bg-[hsl(225,25%,15%)] text-[hsl(45,15%,60%)] hover:text-[hsl(220,80%,70%)]"}`}>
                🚀 Futuristic
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-widest mb-2" style={{ WebkitTextFillColor: 'unset' }}>Towers</div>
            <div className="space-y-1.5">
              {TOWER_DEFS.map((def, i) => {
                const src = skin === "fantasy" ? def.fantasySrc : def.futuristicSrc;
                return (
                  <button key={i} onClick={() => setSelTower(i)} className={`w-full text-left p-2 rounded transition flex items-center gap-2 ${selTower === i ? "bg-[hsl(43,85%,55%)]/15 border border-[hsl(43,60%,30%)]" : "bg-[hsl(225,25%,15%)] hover:bg-[hsl(225,25%,20%)]"}`}>
                    <div className="w-9 h-9 rounded flex items-center justify-center text-lg overflow-hidden" style={{ background: `${def.color}22`, border: `1px solid ${def.color}44` }}>
                      <img src={src} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-heading text-[hsl(45,30%,90%)] flex items-center justify-between" style={{ WebkitTextFillColor: 'unset' }}>
                        <span>{def.name}</span>
                        <span className="text-[hsl(43,85%,55%)]">{def.cost}g</span>
                      </div>
                      <div className="text-[10px] text-[hsl(45,15%,60%)]">{def.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            {state === "idle" && (
              <Button onClick={startWave} className="w-full gilded-button" size="sm">
                <Play className="w-4 h-4 mr-2" /> {wave === 0 ? "Start Game" : `Wave ${wave + 1}`}
              </Button>
            )}
            {state === "playing" && (
              <Button onClick={() => { setState("paused"); stateR.current = "paused"; }} className="w-full dark-button" size="sm">
                <Pause className="w-4 h-4 mr-2" /> Pause
              </Button>
            )}
            {state === "paused" && (
              <Button onClick={() => { setState("playing"); stateR.current = "playing"; }} className="w-full gilded-button" size="sm">
                <Play className="w-4 h-4 mr-2" /> Resume
              </Button>
            )}
            {(state === "won" || state === "lost") && (
              <Button onClick={reset} className="w-full gilded-button" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" /> Play Again
              </Button>
            )}
          </div>

          <div className="text-[10px] text-[hsl(45,15%,60%)] font-body space-y-0.5 hidden md:block">
            <div className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-widest mb-1" style={{ WebkitTextFillColor: 'unset' }}>How to Play</div>
            <div>1. Select a tower type</div>
            <div>2. Click the map to place</div>
            <div>3. Start the wave and defend!</div>
            <div>Frost tower slows enemies</div>
            <div>Cannon does splash damage</div>
          </div>
        </aside>

        <main className="flex-1 flex items-center justify-center p-2 md:p-4 overflow-auto">
          <canvas
            ref={canvasRef}
            width={COLS * CELL}
            height={ROWS * CELL}
            onClick={onClick}
            className="border-2 border-[hsl(43,60%,30%)]/40 rounded-lg cursor-crosshair shadow-2xl"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          />
        </main>
      </div>
    </div>
  );
}
