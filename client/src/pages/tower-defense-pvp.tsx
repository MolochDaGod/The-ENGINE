import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Swords, Shield, Crown, Send, Bot, User } from "lucide-react";
import { useLocation } from "wouter";

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED CONSTANTS (mirrors tower-defense.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

const CELL = 48; // smaller cells for split view
const COLS = 12;
const ROWS = 8;

interface TowerDef {
  name: string; cost: number; damage: number; range: number;
  fireRate: number; color: string; icon: string; description: string;
}

const TOWER_DEFS: TowerDef[] = [
  { name: "Archer",    cost: 50,  damage: 15,  range: 120, fireRate: 0.8,  color: "#4CAF50", icon: "🏹", description: "Fast, low damage" },
  { name: "Cannon",    cost: 100, damage: 40,  range: 100, fireRate: 1.5,  color: "#FF9800", icon: "💣", description: "Splash damage" },
  { name: "Lightning", cost: 150, damage: 25,  range: 140, fireRate: 0.5,  color: "#2196F3", icon: "⚡", description: "Chain lightning" },
  { name: "Sniper",    cost: 200, damage: 80,  range: 200, fireRate: 2.5,  color: "#9C27B0", icon: "🎯", description: "Long range" },
  { name: "Frost",     cost: 125, damage: 10,  range: 110, fireRate: 0.6,  color: "#00BCD4", icon: "❄️", description: "Slows enemies" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SEND-CREEP DEFINITIONS (BTD Battles style)
// ═══════════════════════════════════════════════════════════════════════════════

interface SendDef {
  name: string; cost: number; count: number; hp: number; speed: number;
  color: string; icon: string; isBoss: boolean; income: number;
}

const SEND_DEFS: SendDef[] = [
  { name: "Scout",   cost: 25,  count: 4, hp: 30,  speed: 70,  color: "#66BB6A", icon: "🐀", isBoss: false, income: 2 },
  { name: "Runner",  cost: 40,  count: 3, hp: 40,  speed: 90,  color: "#FFA726", icon: "🐺", isBoss: false, income: 3 },
  { name: "Brute",   cost: 60,  count: 2, hp: 120, speed: 35,  color: "#EF5350", icon: "🐻", isBoss: false, income: 5 },
  { name: "Swarm",   cost: 50,  count: 8, hp: 15,  speed: 60,  color: "#AB47BC", icon: "🦇", isBoss: false, income: 4 },
  { name: "Knight",  cost: 100, count: 2, hp: 200, speed: 40,  color: "#78909C", icon: "🛡️", isBoss: false, income: 8 },
  { name: "Titan",   cost: 250, count: 1, hp: 600, speed: 25,  color: "#F44336", icon: "👹", isBoss: true,  income: 20 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PATH
// ═══════════════════════════════════════════════════════════════════════════════

const PATH = [
  { x: 0, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 1 }, { x: 5, y: 1 },
  { x: 5, y: 6 }, { x: 8, y: 6 }, { x: 8, y: 2 }, { x: 11, y: 2 }, { x: 12, y: 2 },
];

function pathPixel(idx: number, prog: number) {
  const i = Math.min(idx, PATH.length - 2);
  const a = PATH[i], b = PATH[i + 1];
  return { x: (a.x + (b.x - a.x) * prog) * CELL + CELL / 2, y: (a.y + (b.y - a.y) * prog) * CELL + CELL / 2 };
}

const _pathGrid: boolean[][] = [];
function buildPathGrid() {
  if (_pathGrid.length > 0) return;
  for (let r = 0; r < ROWS; r++) { _pathGrid[r] = []; for (let c = 0; c < COLS; c++) _pathGrid[r][c] = false; }
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    for (let c = Math.min(a.x, b.x); c <= Math.max(a.x, b.x); c++)
      for (let r = Math.min(a.y, b.y); r <= Math.max(a.y, b.y); r++)
        if (c < COLS && r < ROWS) _pathGrid[r][c] = true;
  }
}

function isPath(c: number, r: number) {
  buildPathGrid();
  return r >= 0 && r < ROWS && c >= 0 && c < COLS && _pathGrid[r]?.[c];
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Tower {
  id: number; type: number; x: number; y: number;
  angle: number; targetAngle: number; cooldown: number; level: number;
}

interface Enemy {
  id: number; hp: number; maxHp: number; speed: number;
  pathIndex: number; pathProgress: number; x: number; y: number;
  color: string; isBoss: boolean; frozen: number; reward: number;
}

interface Projectile {
  x: number; y: number; angle: number; targetId: number;
  damage: number; speed: number; type: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

interface PlayerSide {
  towers: Tower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  gold: number;
  lives: number;
  income: number; // gold per income tick
  incomeTimer: number;
  nid: number;
}

function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function lerpAngle(from: number, to: number, t: number) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

function createSide(): PlayerSide {
  return {
    towers: [], enemies: [], projectiles: [], particles: [],
    gold: 200, lives: 25, income: 10, incomeTimer: 0, nid: 1,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const CANVAS_W = BOARD_W * 2 + 4; // two boards + divider
const CANVAS_H = BOARD_H;
const INCOME_INTERVAL = 6; // seconds between income ticks

export default function TowerDefensePvP() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selTower, setSelTower] = useState(0);
  const [gameState, setGameState] = useState<"menu" | "playing" | "ended">("menu");
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);

  // HUD state (synced from refs each frame)
  const [pGold, setPGold] = useState(200);
  const [pLives, setPLives] = useState(25);
  const [pIncome, setPIncome] = useState(10);
  const [aGold, setAGold] = useState(200);
  const [aLives, setALives] = useState(25);
  const [aIncome, setAIncome] = useState(10);

  const selTowerR = useRef(0);
  const gameStateR = useRef<"menu" | "playing" | "ended">("menu");
  const playerR = useRef<PlayerSide>(createSide());
  const aiR = useRef<PlayerSide>(createSide());
  const raf = useRef(0);
  const lastT = useRef(0);
  const aiActionT = useRef(0);

  useEffect(() => { selTowerR.current = selTower; }, [selTower]);

  // ── Send creeps to opponent ────────────────────────────────────────────────
  const sendCreeps = useCallback((senderSide: PlayerSide, targetSide: PlayerSide, defIdx: number) => {
    const def = SEND_DEFS[defIdx];
    if (!def || senderSide.gold < def.cost) return false;
    senderSide.gold -= def.cost;
    senderSide.income += def.income;
    for (let i = 0; i < def.count; i++) {
      targetSide.enemies.push({
        id: targetSide.nid++,
        hp: def.hp, maxHp: def.hp, speed: def.speed,
        pathIndex: 0, pathProgress: -i * 0.15, // stagger spawn
        x: 0, y: 0, color: def.color, isBoss: def.isBoss,
        frozen: 0, reward: Math.floor(def.cost / def.count / 2),
      });
    }
    return true;
  }, []);

  // ── Place tower on player side ────────────────────────────────────────────
  const placeTower = useCallback((col: number, row: number) => {
    if (gameStateR.current !== "playing") return;
    const side = playerR.current;
    if (isPath(col, row)) return;
    if (side.towers.some(t => Math.floor(t.x / CELL) === col && Math.floor(t.y / CELL) === row)) return;
    const def = TOWER_DEFS[selTowerR.current];
    if (side.gold < def.cost) return;
    side.gold -= def.cost;
    side.towers.push({
      id: side.nid++, type: selTowerR.current,
      x: col * CELL + CELL / 2, y: row * CELL + CELL / 2,
      angle: 0, targetAngle: 0, cooldown: 0, level: 1,
    });
  }, []);

  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current; if (!cv) return;
    const r = cv.getBoundingClientRect();
    const sx = cv.width / r.width, sy = cv.height / r.height;
    const x = (e.clientX - r.left) * sx, y = (e.clientY - r.top) * sy;
    // Only allow clicking on left (player) side
    if (x < BOARD_W) {
      const col = Math.floor(x / CELL), row = Math.floor(y / CELL);
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) placeTower(col, row);
    }
  }, [placeTower]);

  // ── Player sends creeps ──────────────────────────────────────────────────
  const playerSend = useCallback((defIdx: number) => {
    if (gameStateR.current !== "playing") return;
    sendCreeps(playerR.current, aiR.current, defIdx);
  }, [sendCreeps]);

  // ── Simulation tick for one side ──────────────────────────────────────────
  const tickSide = useCallback((side: PlayerSide, dt: number) => {
    // Income
    side.incomeTimer += dt;
    if (side.incomeTimer >= INCOME_INTERVAL) {
      side.incomeTimer -= INCOME_INTERVAL;
      side.gold += side.income;
    }

    // Enemy movement
    side.enemies.forEach(e => {
      if (e.pathProgress < 0) { e.pathProgress += dt * 0.5; return; } // stagger delay
      if (e.pathIndex >= PATH.length - 1) return;
      e.frozen = Math.max(0, e.frozen - dt);
      const spd = e.frozen > 0 ? e.speed * 0.4 : e.speed;
      const a = PATH[e.pathIndex], b = PATH[e.pathIndex + 1];
      const segLen = dist(a.x * CELL, a.y * CELL, b.x * CELL, b.y * CELL);
      e.pathProgress += (spd * dt) / segLen;
      if (e.pathProgress >= 1) { e.pathProgress = 0; e.pathIndex++; }
      if (e.pathIndex < PATH.length - 1) {
        const pos = pathPixel(e.pathIndex, Math.max(0, e.pathProgress));
        e.x = pos.x; e.y = pos.y;
      }
    });

    // Escaped enemies → lose lives
    const escaped = side.enemies.filter(e => e.pathIndex >= PATH.length - 1);
    if (escaped.length) {
      side.lives -= escaped.length;
      side.enemies = side.enemies.filter(e => e.pathIndex < PATH.length - 1);
    }

    // Tower targeting + firing
    side.towers.forEach(tw => {
      tw.cooldown -= dt;
      const def = TOWER_DEFS[tw.type];
      let tgt: Enemy | undefined, md = Infinity;
      side.enemies.forEach(e => {
        if (e.pathProgress < 0) return;
        const dd = dist(tw.x, tw.y, e.x, e.y);
        if (dd <= def.range && dd < md) { md = dd; tgt = e; }
      });
      if (tgt) tw.targetAngle = Math.atan2(tgt.y - tw.y, tgt.x - tw.x);
      tw.angle = lerpAngle(tw.angle, tw.targetAngle, Math.min(1, dt * 8));
      if (tw.cooldown <= 0 && tgt) {
        tw.cooldown = def.fireRate;
        const pa = Math.atan2(tgt.y - tw.y, tgt.x - tw.x);
        side.projectiles.push({
          x: tw.x + Math.cos(pa) * 16, y: tw.y + Math.sin(pa) * 16,
          angle: pa, targetId: tgt.id, damage: def.damage * tw.level,
          speed: 350, type: tw.type,
        });
      }
    });

    // Projectile movement + hit detection
    side.projectiles.forEach(p => {
      const tgt = side.enemies.find(e => e.id === p.targetId);
      if (!tgt) { p.speed = -1; return; }
      const ang = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      p.angle = ang;
      p.x += Math.cos(ang) * p.speed * dt;
      p.y += Math.sin(ang) * p.speed * dt;
      if (dist(p.x, p.y, tgt.x, tgt.y) < 14) {
        tgt.hp -= p.damage;
        p.speed = -1;
        // Frost slow
        if (p.type === 4) tgt.frozen = 2;
        // Cannon splash
        if (p.type === 1) {
          side.enemies.forEach(e2 => {
            if (e2.id !== tgt!.id && dist(e2.x, e2.y, tgt!.x, tgt!.y) < 50)
              e2.hp -= p.damage * 0.4;
          });
        }
        // Spark particles
        const def = TOWER_DEFS[p.type];
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 60;
          side.particles.push({
            x: tgt.x, y: tgt.y,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            life: 0.3 + Math.random() * 0.3, maxLife: 0.4,
            color: def.color, size: 2 + Math.random() * 3,
          });
        }
        // Kill
        if (tgt.hp <= 0) {
          side.gold += tgt.reward;
          // Death particles
          for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 80;
            side.particles.push({
              x: tgt.x, y: tgt.y,
              vx: Math.cos(a) * s, vy: Math.sin(a) * s,
              life: 0.4 + Math.random() * 0.4, maxLife: 0.6,
              color: "#ff4444", size: 3 + Math.random() * 4,
            });
          }
          side.enemies = side.enemies.filter(e => e.id !== tgt!.id);
        }
      }
    });
    side.projectiles = side.projectiles.filter(p => p.speed > 0);

    // Particles
    side.particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vy += 50 * dt; });
    side.particles = side.particles.filter(p => p.life > 0);
  }, []);

  // ── AI logic ──────────────────────────────────────────────────────────────
  const tickAI = useCallback((dt: number) => {
    const ai = aiR.current;
    const player = playerR.current;
    aiActionT.current -= dt;
    if (aiActionT.current > 0) return;
    aiActionT.current = 2 + Math.random() * 3; // act every 2-5 seconds

    // AI strategy: alternate between placing towers and sending creeps
    const shouldSend = Math.random() < 0.45 || ai.towers.length >= 8;
    if (shouldSend) {
      // Pick a send that AI can afford
      const affordable = SEND_DEFS
        .map((d, i) => ({ ...d, idx: i }))
        .filter(d => ai.gold >= d.cost);
      if (affordable.length > 0) {
        const pick = affordable[Math.floor(Math.random() * affordable.length)];
        sendCreeps(ai, player, pick.idx);
      }
    } else {
      // Place a tower at a random valid cell
      const affordable = TOWER_DEFS
        .map((d, i) => ({ ...d, idx: i }))
        .filter(d => ai.gold >= d.cost);
      if (affordable.length > 0) {
        const pick = affordable[Math.floor(Math.random() * affordable.length)];
        // Find open cells
        const open: { c: number; r: number }[] = [];
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (!isPath(c, r) && !ai.towers.some(t => Math.floor(t.x / CELL) === c && Math.floor(t.y / CELL) === r)) {
              open.push({ c, r });
            }
          }
        }
        if (open.length > 0) {
          // Prefer cells adjacent to path
          const adjacent = open.filter(p => {
            for (let dr = -1; dr <= 1; dr++)
              for (let dc = -1; dc <= 1; dc++)
                if (isPath(p.c + dc, p.r + dr)) return true;
            return false;
          });
          const pool = adjacent.length > 0 ? adjacent : open;
          const spot = pool[Math.floor(Math.random() * pool.length)];
          ai.gold -= pick.cost;
          ai.towers.push({
            id: ai.nid++, type: pick.idx,
            x: spot.c * CELL + CELL / 2, y: spot.r * CELL + CELL / 2,
            angle: 0, targetAngle: 0, cooldown: 0, level: 1,
          });
        }
      }
    }
  }, [sendCreeps]);

  // ── Draw one board ────────────────────────────────────────────────────────
  const drawBoard = useCallback((ctx: CanvasRenderingContext2D, side: PlayerSide, offsetX: number, label: string, labelColor: string, ts: number) => {
    ctx.save();
    ctx.translate(offsetX, 0);

    // Background
    ctx.fillStyle = "#12122a";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    // Grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isPath(c, r)) {
          ctx.fillStyle = "#2a2a55";
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
          // Road border
          ctx.strokeStyle = "rgba(80,80,255,0.12)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
        } else {
          ctx.fillStyle = (c + r) % 2 === 0 ? "#161636" : "#121230";
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = "rgba(40,40,80,0.12)";
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, BOARD_H); ctx.stroke(); }
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(BOARD_W, r * CELL); ctx.stroke(); }

    // Start/End markers
    const sp = pathPixel(0, 0);
    ctx.fillStyle = "rgba(40,200,40,0.8)";
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 7px Inter"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("IN", sp.x, sp.y);

    const ep = pathPixel(PATH.length - 2, 1);
    ctx.fillStyle = "rgba(200,40,40,0.8)";
    ctx.beginPath(); ctx.arc(ep.x, ep.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText("END", ep.x, ep.y);

    // Towers
    side.towers.forEach(tw => {
      const def = TOWER_DEFS[tw.type];
      // Range circle
      ctx.save(); ctx.globalAlpha = 0.04;
      ctx.beginPath(); ctx.arc(tw.x, tw.y, def.range, 0, Math.PI * 2);
      ctx.fillStyle = def.color; ctx.fill();
      ctx.restore();

      // Tower body
      ctx.save();
      ctx.translate(tw.x, tw.y);
      ctx.fillStyle = "#1a1a3e";
      ctx.beginPath(); ctx.arc(0, 0, CELL * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(0, 0, CELL * 0.28, 0, Math.PI * 2); ctx.fill();

      // Barrel
      ctx.rotate(tw.angle);
      ctx.fillStyle = def.color;
      ctx.fillRect(0, -2.5, CELL * 0.38, 5);
      ctx.restore();

      // Level badge
      if (tw.level > 1) {
        ctx.fillStyle = "#FFD700"; ctx.font = "bold 8px Inter"; ctx.textAlign = "center";
        ctx.fillText(`L${tw.level}`, tw.x, tw.y - CELL * 0.45);
      }
    });

    // Enemies
    side.enemies.forEach(e => {
      if (e.pathProgress < 0) return; // not yet spawned
      const sz = e.isBoss ? 18 : 12;
      const bob = Math.sin(ts * 0.005 + e.id) * 1.5;

      // Frozen aura
      if (e.frozen > 0) {
        ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = "#00BCD4";
        ctx.beginPath(); ctx.arc(e.x, e.y, sz + 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }

      // Body
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y + bob, sz, 0, Math.PI * 2); ctx.fill();

      // Boss ring
      if (e.isBoss) {
        ctx.strokeStyle = "#ff4444"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y + bob, sz + 3, 0, Math.PI * 2); ctx.stroke();
      }

      // Health bar
      const bw = sz * 2, bh = 3, bx = e.x - bw / 2, by = e.y - sz - 7;
      ctx.fillStyle = "#111"; ctx.fillRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
      const pct = e.hp / e.maxHp;
      ctx.fillStyle = pct > 0.5 ? "#4CAF50" : pct > 0.25 ? "#FF9800" : "#f44336";
      ctx.fillRect(bx, by, bw * pct, bh);
    });

    // Projectiles
    side.projectiles.forEach(p => {
      const def = TOWER_DEFS[p.type];
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -3); ctx.lineTo(-4, 3); ctx.closePath(); ctx.fill();
      ctx.restore();
      // Trail
      ctx.save(); ctx.globalAlpha = 0.15;
      ctx.strokeStyle = def.color; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(p.angle) * 6, p.y - Math.sin(p.angle) * 6);
      ctx.lineTo(p.x - Math.cos(p.angle) * 18, p.y - Math.sin(p.angle) * 18);
      ctx.stroke(); ctx.restore();
    });

    // Particles
    side.particles.forEach(p => {
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Side label
    ctx.fillStyle = labelColor; ctx.font = "bold 11px Inter"; ctx.textAlign = "center";
    ctx.fillText(label, BOARD_W / 2, 14);

    // Lives + gold HUD
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px Inter"; ctx.textAlign = "left";
    ctx.fillText(`❤️ ${side.lives}`, 6, BOARD_H - 8);
    ctx.fillStyle = "#FFD700"; ctx.textAlign = "right";
    ctx.fillText(`${side.gold}g (+${side.income}/tick)`, BOARD_W - 6, BOARD_H - 8);

    ctx.restore();
  }, []);

  // ── Main game loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== "playing") return;
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;

    // Reset sides
    playerR.current = createSide();
    aiR.current = createSide();
    aiActionT.current = 3;

    // Auto-send initial wave for both sides so there's action
    sendCreeps(playerR.current, aiR.current, 0); // player sends scouts to AI
    sendCreeps(aiR.current, playerR.current, 0); // AI sends scouts to player

    lastT.current = performance.now();

    const loop = (ts: number) => {
      const dt = Math.min((ts - lastT.current) / 1000, 0.05);
      lastT.current = ts;

      if (gameStateR.current !== "playing") return;

      // Simulate both sides
      tickSide(playerR.current, dt);
      tickSide(aiR.current, dt);
      tickAI(dt);

      // Check win/loss
      if (playerR.current.lives <= 0) {
        gameStateR.current = "ended";
        setGameState("ended"); setWinner("ai"); return;
      }
      if (aiR.current.lives <= 0) {
        gameStateR.current = "ended";
        setGameState("ended"); setWinner("player"); return;
      }

      // Sync HUD
      setPGold(playerR.current.gold);
      setPLives(playerR.current.lives);
      setPIncome(playerR.current.income);
      setAGold(aiR.current.gold);
      setALives(aiR.current.lives);
      setAIncome(aiR.current.income);

      // Draw
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = "#0a0a1a"; ctx.fillRect(0, 0, cv.width, cv.height);

      drawBoard(ctx, playerR.current, 0, "🛡️ YOU", "#4CAF50", ts);
      drawBoard(ctx, aiR.current, BOARD_W + 4, "🤖 OPPONENT", "#f44336", ts);

      // Center divider
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(BOARD_W, 0, 4, BOARD_H);

      // VS badge
      ctx.fillStyle = "#FFD700"; ctx.font = "bold 14px Inter"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("VS", BOARD_W + 2, BOARD_H / 2);

      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [gameState, tickSide, tickAI, drawBoard, sendCreeps]);

  // ── Start handler ─────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    gameStateR.current = "playing";
    setGameState("playing");
    setWinner(null);
  }, []);

  const restart = useCallback(() => {
    gameStateR.current = "playing";
    setGameState("playing");
    setWinner(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (gameState === "menu") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "linear-gradient(180deg, hsl(225,30%,6%), hsl(225,28%,10%))" }}>
        <div className="text-center max-w-lg mx-auto p-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/tower-defense")} className="absolute top-4 left-4 text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)]">
            <ArrowLeft className="w-4 h-4 mr-1" /> Tower Defense
          </Button>
          <div className="flex items-center justify-center gap-3 mb-4">
            <Swords className="w-10 h-10 text-[hsl(43,85%,55%)]" />
            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              TOWER WARS
            </h1>
            <Swords className="w-10 h-10 text-[hsl(43,85%,55%)]" />
          </div>
          <p className="text-lg text-[hsl(45,15%,60%)] mb-2">PvP Tower Defense</p>
          <p className="text-gray-400 mb-8 text-sm">
            Build towers to defend your side. Send creeps to overwhelm your opponent. 
            First to 0 lives loses. Earn income by sending — spend it on towers or more creeps!
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8 text-left bg-[hsl(225,25%,12%)] p-5 rounded-lg border border-[hsl(43,60%,30%)]/20">
            <div>
              <h3 className="text-[hsl(43,85%,55%)] font-bold mb-2 text-sm flex items-center gap-1"><Shield className="w-3 h-3" /> Defend</h3>
              <p className="text-gray-300 text-xs">Click your map to place towers</p>
              <p className="text-gray-300 text-xs">5 tower types with unique abilities</p>
              <p className="text-gray-300 text-xs">Frost slows, Cannon splashes</p>
            </div>
            <div>
              <h3 className="text-red-400 font-bold mb-2 text-sm flex items-center gap-1"><Send className="w-3 h-3" /> Attack</h3>
              <p className="text-gray-300 text-xs">Send creeps to the enemy side</p>
              <p className="text-gray-300 text-xs">Sending increases your income</p>
              <p className="text-gray-300 text-xs">6 creep types: Scouts to Titans</p>
            </div>
          </div>

          <Button onClick={startGame} className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white px-10 py-5 text-lg">
            <Play className="w-5 h-5 mr-2" /> Battle AI
          </Button>
        </div>
      </div>
    );
  }

  if (gameState === "ended") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "linear-gradient(180deg, hsl(225,30%,6%), hsl(225,28%,10%))" }}>
        <div className="text-center bg-[hsl(225,25%,10%)] p-12 rounded-xl border border-[hsl(43,60%,30%)]/30">
          <h1 className={`text-5xl font-bold mb-4 ${winner === "player" ? "text-[hsl(43,85%,55%)]" : "text-red-500"}`}>
            {winner === "player" ? "🏆 VICTORY!" : "💀 DEFEATED"}
          </h1>
          <p className="text-gray-300 text-lg mb-8">
            {winner === "player" ? "You destroyed the enemy base!" : "Your base has fallen..."}
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={restart} className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700">
              Play Again
            </Button>
            <Button variant="outline" onClick={() => setLocation("/tower-defense")} className="border-gray-500 text-gray-400">
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, hsl(225,30%,6%), hsl(225,28%,10%))" }}>
      {/* Header */}
      <header className="border-b border-[hsl(43,60%,30%)]/30 px-3 py-2" style={{ background: "linear-gradient(180deg, hsl(225,30%,10%), hsl(225,30%,8%))" }}>
        <div className="max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { gameStateR.current = "menu"; setGameState("menu"); }} className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Menu
            </Button>
            <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center gap-2">
              <Swords className="w-4 h-4 text-[hsl(43,85%,55%)]" /> TOWER WARS PVP
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-3 h-3 text-green-400" />
              <Badge variant="outline" className="border-green-600/50 text-green-400">❤️ {pLives}</Badge>
              <Badge variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)]"><Crown className="w-3 h-3 mr-1" /> {pGold}g</Badge>
              <span className="text-gray-500 text-xs">+{pIncome}/tick</span>
            </div>
            <span className="text-[hsl(43,85%,55%)] font-bold">VS</span>
            <div className="flex items-center gap-2">
              <Bot className="w-3 h-3 text-red-400" />
              <Badge variant="outline" className="border-red-600/50 text-red-400">❤️ {aLives}</Badge>
              <Badge variant="outline" className="border-gray-600 text-gray-400"><Crown className="w-3 h-3 mr-1" /> {aGold}g</Badge>
              <span className="text-gray-500 text-xs">+{aIncome}/tick</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Tower selection sidebar */}
        <aside className="w-full lg:w-52 border-b lg:border-b-0 lg:border-r border-[hsl(43,60%,30%)]/30 p-2 space-y-2 overflow-y-auto" style={{ background: "hsl(225,30%,7%)" }}>
          <div className="text-xs font-bold text-[hsl(43,85%,55%)] uppercase tracking-widest mb-1">🛡️ Towers</div>
          <div className="space-y-1">
            {TOWER_DEFS.map((def, i) => (
              <button key={i} onClick={() => setSelTower(i)}
                className={`w-full text-left p-1.5 rounded transition flex items-center gap-2 text-xs ${selTower === i ? "bg-[hsl(43,85%,55%)]/15 border border-[hsl(43,60%,30%)]" : "bg-[hsl(225,25%,15%)] hover:bg-[hsl(225,25%,20%)]"}`}>
                <div className="w-7 h-7 rounded flex items-center justify-center text-sm" style={{ background: `${def.color}22`, border: `1px solid ${def.color}44` }}>
                  {def.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[hsl(45,30%,90%)]">
                    <span>{def.name}</span>
                    <span className="text-[hsl(43,85%,55%)]">{def.cost}g</span>
                  </div>
                  <div className="text-[9px] text-[hsl(45,15%,60%)]">{def.description}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-[hsl(43,60%,30%)]/20 pt-2">
            <div className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">⚔️ Send Creeps</div>
            <div className="space-y-1">
              {SEND_DEFS.map((def, i) => (
                <button key={i} onClick={() => playerSend(i)}
                  className={`w-full text-left p-1.5 rounded transition flex items-center gap-2 text-xs ${pGold >= def.cost ? "bg-red-900/20 hover:bg-red-900/40 border border-red-800/30" : "bg-[hsl(225,25%,12%)] opacity-40 cursor-not-allowed"}`}
                  disabled={pGold < def.cost}>
                  <div className="w-7 h-7 rounded flex items-center justify-center text-sm" style={{ background: `${def.color}22`, border: `1px solid ${def.color}44` }}>
                    {def.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[hsl(45,30%,90%)]">
                      <span>{def.name} ×{def.count}</span>
                      <span className="text-red-400">{def.cost}g</span>
                    </div>
                    <div className="text-[9px] text-[hsl(45,15%,60%)]">
                      HP:{def.hp} SPD:{def.speed} | +{def.income} income
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 flex items-center justify-center p-2 overflow-auto">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onClick={onCanvasClick}
            className="border-2 border-[hsl(43,60%,30%)]/40 rounded-lg cursor-crosshair shadow-2xl"
            style={{ maxWidth: "100%", maxHeight: "100%" }}
          />
        </main>
      </div>
    </div>
  );
}
