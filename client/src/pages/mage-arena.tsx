import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Play, Users, Swords, Shield, Zap, Heart } from "lucide-react";
import { HEROES, type HeroId, type GameMode, type ArenaPlayer } from "@shared/mage-arena-types";

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = "landing" | "hero_select" | "lobby" | "game";

interface Projectile {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  color: string;
  damage: number;
  ownerId: string; // "local" | playerId | "enemy"
  life: number;    // frames remaining
  isAoe?: boolean;
  aoeRadius?: number;
}

interface Effect {
  id: number;
  x: number; y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number; maxLife: number;
  type: "ring" | "flash" | "beam" | "totem";
  toX?: number; toY?: number; // for beam
}

interface Enemy {
  id: string;
  x: number; y: number;
  health: number; maxHealth: number;
  type: "grunt" | "elite" | "boss";
  speed: number;
  attackCooldown: number;
  stunTimer: number;
}

interface RemotePlayer extends ArenaPlayer {
  lastUpdate: number;
}

let _pid = 0;
function uid() { return ++_pid; }

// ─── Component ────────────────────────────────────────────────────────────────
export default function MageArena() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [mode, setMode] = useState<GameMode>("solo");
  const [heroId, setHeroId] = useState<HeroId>("death_mage");
  const [playerName] = useState(() => `Hero${Math.floor(Math.random() * 9000) + 1000}`);
  const [roomId, setRoomId] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [lobbyPlayers, setLobbyPlayers] = useState<ArenaPlayer[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [matchResult, setMatchResult] = useState<{ won: boolean; kills: number; wave: number } | null>(null);
  const [hud, setHud] = useState({
    health: 100, maxHealth: 100, mana: 100, maxMana: 100,
    wave: 1, kills: 0, qcd: 0, ecd: 0, rcd: 0,
    shielded: false, stoneHardened: false,
  });
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localPid = useRef<string>("");
  const animRef = useRef<number>(0);

  // ── Game state (mutable ref, never triggers re-render) ───────────────────
  const gs = useRef({
    heroId: "death_mage" as HeroId,
    mode: "solo" as GameMode,
    isHost: false,
    player: {
      x: 480, y: 320, angle: 0,
      health: 80, maxHealth: 80,
      mana: 150, maxMana: 150,
      alive: true, kills: 0, deaths: 0,
      shielded: false, stoneHardened: false,
      hardSkinTimer: 0, shieldTimer: 0,
    },
    remotePlayers: new Map<string, RemotePlayer>(),
    enemies: [] as Enemy[],
    projectiles: [] as Projectile[],
    effects: [] as Effect[],
    totems: [] as { id: number; x: number; y: number; color: string; timer: number; fireTimer: number; ownerId: string }[],
    keys: {} as Record<string, boolean>,
    mouseX: 480, mouseY: 320,
    // per-ability cooldowns in frames (60fps)
    basicCD: 0, qCD: 0, eCD: 0, rCD: 0,
    manaRegen: 0,
    lastStatBroadcast: 0,
    wave: 1, waveTimer: 0, waveActive: false,
    enemyIdCounter: 0,
    started: false,
  });

  // ── Canvas helpers ────────────────────────────────────────────────────────
  const drawHero = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number, angle: number,
    hid: HeroId, shielded = false, stone = false, isLocal = false,
    name?: string, healthPct = 1,
  ) => {
    const hero = HEROES[hid];
    const radius = 22;
    ctx.save();
    ctx.translate(x, y);

    // glow
    ctx.shadowBlur = 14;
    ctx.shadowColor = hero.color;
    ctx.fillStyle = hero.color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // inner circle
    ctx.shadowBlur = 0;
    ctx.fillStyle = hero.rimColor;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    // direction indicator
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * 28, Math.sin(angle) * 28);
    ctx.stroke();

    // shield ring
    if (shielded) {
      ctx.strokeStyle = "#fffde7";
      ctx.lineWidth = 4;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#ffff00";
      ctx.beginPath();
      ctx.arc(0, 0, radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (stone) {
      ctx.strokeStyle = "#aab7b8";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // local player indicator
    if (isLocal) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, -radius - 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // health bar
    const bw = 50;
    ctx.fillStyle = "#333";
    ctx.fillRect(x - bw / 2, y - radius - 14, bw, 5);
    const col = healthPct > 0.5 ? "#2ecc71" : healthPct > 0.25 ? "#f1c40f" : "#e74c3c";
    ctx.fillStyle = col;
    ctx.fillRect(x - bw / 2, y - radius - 14, bw * healthPct, 5);

    // name tag
    if (name) {
      ctx.fillStyle = "#ccc";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(name, x, y - radius - 18);
    }
  }, []);

  const drawEnemy = useCallback((ctx: CanvasRenderingContext2D, e: Enemy) => {
    const size = e.type === "boss" ? 36 : e.type === "elite" ? 28 : 20;
    const color = e.type === "boss" ? "#8B0000" : e.type === "elite" ? "#c0392b" : "#4a1a1a";
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (e.type !== "grunt") {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, size + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    const hp = e.health / e.maxHealth;
    ctx.fillStyle = "#222";
    ctx.fillRect(e.x - 20, e.y - size - 10, 40, 5);
    ctx.fillStyle = hp > 0.5 ? "#2ecc71" : hp > 0.25 ? "#f1c40f" : "#e74c3c";
    ctx.fillRect(e.x - 20, e.y - size - 10, 40 * hp, 5);
  }, []);

  // ── Spawn enemy ──────────────────────────────────────────────────────────
  const spawnEnemy = useCallback((type: Enemy["type"] = "grunt") => {
    const g = gs.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = 420 + Math.random() * 180;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const hp = type === "boss" ? 600 : type === "elite" ? 220 : 100;
    g.enemyIdCounter++;
    g.enemies.push({
      id: `e${g.enemyIdCounter}`,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      health: hp, maxHealth: hp,
      type,
      speed: type === "boss" ? 1.2 : type === "elite" ? 2.2 : 2,
      attackCooldown: 0,
      stunTimer: 0,
    });
  }, []);

  // ── Ability casting ───────────────────────────────────────────────────────
  const castAbility = useCallback((abilityKey: "basic" | "q" | "e" | "r") => {
    const g = gs.current;
    const hero = HEROES[g.heroId];
    const p = g.player;
    const ability = hero[abilityKey];
    const cdKey: Record<string, keyof typeof g> = {
      basic: "basicCD", q: "qCD", e: "eCD", r: "rCD"
    };
    const cdField = cdKey[abilityKey];
    if ((g[cdField] as number) > 0) return;
    if (p.mana < ability.mana) return;
    p.mana -= ability.mana;
    (g[cdField] as any) = Math.round(ability.cooldown * 60);

    const pid = uid();
    const tx = g.mouseX, ty = g.mouseY;
    const dx = tx - p.x, dy = ty - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist, ny = dy / dist;

    // Send cast to server
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const qiMap = { basic: 0, q: 1, e: 2, r: 3 };
      wsRef.current.send(JSON.stringify({ t: "cast", qi: qiMap[abilityKey], tx, ty }));
    }

    // ── Death Mage ──
    if (g.heroId === "death_mage") {
      if (abilityKey === "basic") {
        g.projectiles.push({ id: pid, x: p.x, y: p.y, vx: nx * 14, vy: ny * 14, radius: 7, color: "#d355e8", damage: 30, ownerId: "local", life: 60 });
      } else if (abilityKey === "q") {
        // Soul Drain: AOE around player, heal
        g.enemies.forEach(e => {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < 160) { e.health -= 18; }
        });
        p.health = Math.min(p.maxHealth, p.health + 12);
        g.effects.push({ id: pid, x: p.x, y: p.y, radius: 0, maxRadius: 160, color: "#8e44ad", life: 25, maxLife: 25, type: "ring" });
      } else if (abilityKey === "e") {
        // Blink
        const blinkDist = Math.min(270, dist);
        p.x = p.x + nx * blinkDist;
        p.y = p.y + ny * blinkDist;
        g.effects.push({ id: pid, x: p.x, y: p.y, radius: 0, maxRadius: 60, color: "#e8c3f8", life: 18, maxLife: 18, type: "flash" });
      } else {
        // Death Nova
        g.enemies.forEach(e => {
          if (Math.hypot(e.x - p.x, e.y - p.y) < 300) e.health -= 130;
        });
        g.effects.push({ id: pid, x: p.x, y: p.y, radius: 0, maxRadius: 300, color: "#c0392b", life: 30, maxLife: 30, type: "ring" });
      }
    }

    // ── Holy Paladin ──
    if (g.heroId === "holy_paladin") {
      if (abilityKey === "basic") {
        g.enemies.forEach(e => {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          const aToE = Math.atan2(e.y - p.y, e.x - p.x);
          const diff = Math.abs(aToE - p.angle);
          if (d < 95 && diff < 1.0) e.health -= 50;
        });
        g.effects.push({ id: pid, x: p.x, y: p.y, radius: 0, maxRadius: 95, color: "#fff176", life: 12, maxLife: 12, type: "flash" });
      } else if (abilityKey === "q") {
        p.shielded = true;
        p.shieldTimer = Math.round(2.5 * 60);
        g.effects.push({ id: pid, x: p.x, y: p.y, radius: 30, maxRadius: 50, color: "#fffde7", life: 20, maxLife: 20, type: "ring" });
      } else if (abilityKey === "e") {
        // Consecrate: AOE heal + damage
        g.enemies.forEach(e => { if (Math.hypot(e.x - p.x, e.y - p.y) < 200) e.health -= 22; });
        p.health = Math.min(p.maxHealth, p.health + 18);
        g.effects.push({ id: pid, x: p.x, y: p.y, radius: 0, maxRadius: 200, color: "#ffd54f", life: 28, maxLife: 28, type: "ring" });
      } else {
        // Wrath Beam
        g.projectiles.push({ id: pid, x: p.x, y: p.y, vx: nx * 16, vy: ny * 16, radius: 18, color: "#ffffff", damage: 160, ownerId: "local", life: 50, isAoe: false });
        g.effects.push({ id: pid + 1, x: p.x, y: p.y, radius: 8, maxRadius: 18, color: "#fffde7", life: 20, maxLife: 20, type: "beam", toX: p.x + nx * 620, toY: p.y + ny * 620 });
      }
    }

    // ── Orc Shaman ──
    if (g.heroId === "orc_shaman") {
      if (abilityKey === "basic") {
        g.projectiles.push({ id: pid, x: p.x, y: p.y, vx: nx * 13, vy: ny * 13, radius: 6, color: "#a8ff3e", damage: 28, ownerId: "local", life: 55 });
      } else if (abilityKey === "q") {
        g.enemies.forEach(e => { if (Math.hypot(e.x - p.x, e.y - p.y) < 190) { e.health -= 55; e.stunTimer = 90; } });
        g.effects.push({ id: pid, x: p.x, y: p.y, radius: 0, maxRadius: 190, color: "#82e0aa", life: 22, maxLife: 22, type: "ring" });
      } else if (abilityKey === "e") {
        // Storm Totem
        g.totems.push({ id: pid, x: tx, y: ty, color: "#2ecc71", timer: 480, fireTimer: 0, ownerId: "local" });
        g.effects.push({ id: uid(), x: tx, y: ty, radius: 0, maxRadius: 30, color: "#27ae60", life: 15, maxLife: 15, type: "flash" });
      } else {
        // Storm Call: 5 lightning strikes around target
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const sx = tx + Math.cos(a) * 100, sy = ty + Math.sin(a) * 100;
          g.effects.push({ id: uid(), x: sx, y: sy, radius: 0, maxRadius: 90, color: "#c8ff3e", life: 20, maxLife: 20, type: "flash" });
          g.enemies.forEach(e => { if (Math.hypot(e.x - sx, e.y - sy) < 90) e.health -= 90; });
        }
      }
    }

    // ── Stone Guardian ──
    if (g.heroId === "stone_guardian") {
      if (abilityKey === "basic") {
        g.enemies.forEach(e => {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          const aToE = Math.atan2(e.y - p.y, e.x - p.x);
          const diff = Math.abs(aToE - p.angle);
          if (d < 110 && diff < 1.1) e.health -= 60;
        });
        g.effects.push({ id: pid, x: p.x, y: p.y, radius: 0, maxRadius: 110, color: "#bdc3c7", life: 14, maxLife: 14, type: "flash" });
      } else if (abilityKey === "q") {
        p.stoneHardened = true;
        p.hardSkinTimer = 240;
        g.effects.push({ id: pid, x: p.x, y: p.y, radius: 25, maxRadius: 45, color: "#aab7b8", life: 20, maxLife: 20, type: "ring" });
      } else if (abilityKey === "e") {
        g.enemies.forEach(e => { if (Math.hypot(e.x - p.x, e.y - p.y) < 230) { e.health -= 45; e.stunTimer = 120; } });
        g.effects.push({ id: pid, x: p.x, y: p.y, radius: 0, maxRadius: 230, color: "#a04000", life: 32, maxLife: 32, type: "ring" });
      } else {
        // Meteor: delayed AOE at cursor
        setTimeout(() => {
          g.enemies.forEach(e => { if (Math.hypot(e.x - tx, e.y - ty) < 100) e.health -= 210; });
          g.effects.push({ id: uid(), x: tx, y: ty, radius: 0, maxRadius: 100, color: "#e74c3c", life: 30, maxLife: 30, type: "ring" });
        }, 1200);
        // Anticipation marker
        g.effects.push({ id: pid, x: tx, y: ty, radius: 0, maxRadius: 100, color: "rgba(231,76,60,0.4)", life: 72, maxLife: 72, type: "ring" });
      }
    }
  }, []);

  // ── Game loop ─────────────────────────────────────────────────────────────
  const startGameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gs.current;
    const hero = HEROES[g.heroId];

    // Init player stats from hero
    g.player.maxHealth = hero.maxHealth;
    g.player.health = hero.maxHealth;
    g.player.maxMana = hero.maxMana;
    g.player.mana = hero.maxMana;
    g.player.x = canvas.width / 2;
    g.player.y = canvas.height / 2;

    // Spawn initial enemies for solo / PvE host
    if (g.mode === "solo" || (g.mode === "pve" && g.isHost)) {
      for (let i = 0; i < 5; i++) spawnEnemy();
    }

    let frame = 0;

    const loop = () => {
      if (gameOver) { cancelAnimationFrame(animRef.current); return; }
      frame++;
      const p = g.player;

      // ── Background ──
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = "#0d0d1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const gridSize = 64;
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
      // Arena circle
      ctx.strokeStyle = hero.color + "55";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 380, 0, Math.PI * 2);
      ctx.stroke();

      // ── Movement ──
      if (p.alive) {
        const spd = hero.speed;
        if (g.keys["w"] || g.keys["arrowup"])    p.y -= spd;
        if (g.keys["s"] || g.keys["arrowdown"])  p.y += spd;
        if (g.keys["a"] || g.keys["arrowleft"])  p.x -= spd;
        if (g.keys["d"] || g.keys["arrowright"]) p.x += spd;
        p.x = Math.max(24, Math.min(canvas.width - 24, p.x));
        p.y = Math.max(24, Math.min(canvas.height - 24, p.y));
        p.angle = Math.atan2(g.mouseY - p.y, g.mouseX - p.x);
      }

      // ── Cooldown tick ──
      if (g.basicCD > 0) g.basicCD--;
      if (g.qCD > 0) g.qCD--;
      if (g.eCD > 0) g.eCD--;
      if (g.rCD > 0) g.rCD--;

      // ── Shield timers ──
      if (p.shieldTimer > 0) { p.shieldTimer--; if (p.shieldTimer === 0) p.shielded = false; }
      if (p.hardSkinTimer > 0) { p.hardSkinTimer--; if (p.hardSkinTimer === 0) p.stoneHardened = false; }

      // ── Mana regen ──
      g.manaRegen++;
      if (g.manaRegen > 40) { p.mana = Math.min(p.maxMana, p.mana + 1); g.manaRegen = 0; }

      // ── Enemy update (solo/PvE host) ──
      const isEnemyHost = g.mode === "solo" || (g.mode === "pve" && g.isHost);
      if (isEnemyHost) {
        // Wave spawning
        g.waveTimer++;
        if (!g.waveActive && g.waveTimer > 840) {
          g.wave++;
          g.waveTimer = 0;
          g.waveActive = true;
          const count = g.wave + 3;
          for (let i = 0; i < count; i++) spawnEnemy("grunt");
          if (g.wave % 3 === 0) spawnEnemy("elite");
          if (g.wave % 5 === 0) spawnEnemy("boss");
        }
        if (g.enemies.length < 3) { spawnEnemy(); }
        if (g.enemies.length === 0) g.waveActive = false;

        // Tick enemies
        for (let i = g.enemies.length - 1; i >= 0; i--) {
          const e = g.enemies[i];
          if (e.stunTimer > 0) { e.stunTimer--; }
          else {
            const dx = p.x - e.x, dy = p.y - e.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 50) { e.x += (dx / d) * e.speed; e.y += (dy / d) * e.speed; }
            e.attackCooldown--;
            if (e.attackCooldown <= 0 && d < 280) {
              g.projectiles.push({
                id: uid(), x: e.x, y: e.y,
                vx: (dx / d) * 5, vy: (dy / d) * 5,
                radius: 6, color: "#e74c3c",
                damage: e.type === "boss" ? 25 : e.type === "elite" ? 14 : 8,
                ownerId: e.id, life: 80,
              });
              e.attackCooldown = e.type === "boss" ? 55 : e.type === "elite" ? 80 : 110;
            }
          }
          drawEnemy(ctx, e);
          if (e.health <= 0) {
            p.kills++;
            g.enemies.splice(i, 1);
          }
        }

        // Broadcast enemy state to co-op partners (every 3 frames)
        if (g.mode === "pve" && wsRef.current?.readyState === WebSocket.OPEN && frame % 3 === 0) {
          wsRef.current.send(JSON.stringify({
            t: "enemies",
            list: g.enemies.map(e => ({ id: e.id, x: e.x, y: e.y, health: e.health, maxHealth: e.maxHealth, type: e.type, speed: e.speed, attackCooldown: e.attackCooldown })),
          }));
        }
      } else {
        // Non-host just draws enemy list from server
        g.enemies.forEach(e => drawEnemy(ctx, e));
      }

      // ── Totems ──
      for (let i = g.totems.length - 1; i >= 0; i--) {
        const t = g.totems[i];
        t.timer--;
        t.fireTimer--;
        // Draw totem
        ctx.fillStyle = t.color;
        ctx.shadowBlur = 10; ctx.shadowColor = t.color;
        ctx.beginPath(); ctx.arc(t.x, t.y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Totem fires
        if (t.fireTimer <= 0) {
          t.fireTimer = 28;
          let closest: Enemy | null = null;
          let minDist = 320;
          g.enemies.forEach(e => {
            const d = Math.hypot(e.x - t.x, e.y - t.y);
            if (d < minDist) { minDist = d; closest = e; }
          });
          if (closest) {
            const dx = (closest as Enemy).x - t.x, dy = (closest as Enemy).y - t.y, dd = Math.hypot(dx, dy) || 1;
            g.projectiles.push({ id: uid(), x: t.x, y: t.y, vx: dx / dd * 11, vy: dy / dd * 11, radius: 5, color: t.color, damage: 20, ownerId: t.ownerId, life: 40 });
          }
        }
        if (t.timer <= 0) g.totems.splice(i, 1);
      }

      // ── Projectiles ──
      for (let i = g.projectiles.length - 1; i >= 0; i--) {
        const proj = g.projectiles[i];
        proj.x += proj.vx; proj.y += proj.vy; proj.life--;
        if (proj.life <= 0 || proj.x < 0 || proj.x > canvas.width || proj.y < 0 || proj.y > canvas.height) {
          g.projectiles.splice(i, 1);
          continue;
        }

        // Draw projectile
        ctx.shadowBlur = 8; ctx.shadowColor = proj.color;
        ctx.fillStyle = proj.color;
        ctx.beginPath(); ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Hit enemies (player-owned)
        if (proj.ownerId === "local" || proj.ownerId.startsWith("totem")) {
          for (let j = g.enemies.length - 1; j >= 0; j--) {
            const e = g.enemies[j];
            if (Math.hypot(proj.x - e.x, proj.y - e.y) < proj.radius + 20) {
              e.health -= proj.damage;
              g.projectiles.splice(i, 1);
              if (e.health <= 0) { p.kills++; g.enemies.splice(j, 1); }
              break;
            }
          }
        }

        // Enemy projectiles hit local player
        if (!proj.ownerId.startsWith("local") && proj.ownerId !== "local" && !proj.ownerId.startsWith("totem")) {
          if (Math.hypot(proj.x - p.x, proj.y - p.y) < proj.radius + 22) {
            if (!p.shielded) {
              const dmg = p.stoneHardened ? Math.floor(proj.damage * 0.3) : proj.damage;
              p.health -= dmg;
              if (p.health <= 0) {
                p.alive = false;
                p.deaths++;
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ t: "dead", kills: p.kills }));
                }
                if (g.mode === "solo") {
                  cancelAnimationFrame(animRef.current);
                  setMatchResult({ won: false, kills: p.kills, wave: g.wave });
                  setGameOver(true);
                  return;
                }
              }
            }
            g.projectiles.splice(i, 1);
          }
        }
      }

      // ── Effects ──
      for (let i = g.effects.length - 1; i >= 0; i--) {
        const ef = g.effects[i];
        ef.life--;
        if (ef.life <= 0) { g.effects.splice(i, 1); continue; }
        const alpha = ef.life / ef.maxLife;
        const progress = 1 - alpha;

        ctx.globalAlpha = alpha;
        if (ef.type === "ring") {
          const r = ef.radius + (ef.maxRadius - ef.radius) * progress;
          ctx.strokeStyle = ef.color;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 12; ctx.shadowColor = ef.color;
          ctx.beginPath(); ctx.arc(ef.x, ef.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0;
        } else if (ef.type === "flash") {
          const r = ef.radius + (ef.maxRadius - ef.radius) * progress;
          ctx.fillStyle = ef.color;
          ctx.shadowBlur = 18; ctx.shadowColor = ef.color;
          ctx.beginPath(); ctx.arc(ef.x, ef.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        } else if (ef.type === "beam" && ef.toX !== undefined) {
          ctx.strokeStyle = ef.color;
          ctx.lineWidth = ef.radius * 2 * alpha;
          ctx.shadowBlur = 20; ctx.shadowColor = ef.color;
          ctx.beginPath(); ctx.moveTo(ef.x, ef.y); ctx.lineTo(ef.toX, ef.toY!); ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
      }

      // ── Remote players ──
      g.remotePlayers.forEach((rp) => {
        if (!rp.alive) return;
        drawHero(ctx, rp.x, rp.y, rp.angle, rp.heroId as HeroId,
          rp.shielded, rp.stoneHardened, false, rp.name, rp.health / rp.maxHealth);
      });

      // ── Local player ──
      if (p.alive) {
        drawHero(ctx, p.x, p.y, p.angle, g.heroId, p.shielded, p.stoneHardened, true,
          "You", p.health / p.maxHealth);
      }

      // ── Broadcast state ──
      const now = Date.now();
      if (wsRef.current?.readyState === WebSocket.OPEN && now - g.lastStatBroadcast > 50) {
        g.lastStatBroadcast = now;
        wsRef.current.send(JSON.stringify({
          t: "state",
          x: Math.round(p.x), y: Math.round(p.y), ang: +p.angle.toFixed(2),
          hp: p.health, mp: Math.round(p.mana), sh: p.shielded,
        }));
      }

      // ── HUD update (every 6 frames) ──
      if (frame % 6 === 0) {
        setHud({
          health: p.health, maxHealth: p.maxHealth,
          mana: p.mana, maxMana: p.maxMana,
          wave: g.wave, kills: p.kills,
          qcd: g.qCD, ecd: g.eCD, rcd: g.rCD,
          shielded: p.shielded, stoneHardened: p.stoneHardened,
        });
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
  }, [drawEnemy, drawHero, spawnEnemy, gameOver]);

  // ── WebSocket connection ───────────────────────────────────────────────────
  const connectWs = useCallback((rid: string, hid: HeroId, playerMode: GameMode, name: string) => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/arena`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ t: "join", rid, hid, name, mode: playerMode }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const g = gs.current;

        if (msg.t === "joined") {
          localPid.current = msg.pid;
          setRoomId(msg.rid);
          setIsHost(msg.isHost);
          g.isHost = msg.isHost;
          const players: ArenaPlayer[] = msg.players || [];
          setLobbyPlayers(players);
          players.forEach((rp: ArenaPlayer) => {
            g.remotePlayers.set(rp.id, { ...rp, lastUpdate: Date.now() });
          });
        }

        if (msg.t === "pjoin") {
          const rp: RemotePlayer = { ...msg.p, lastUpdate: Date.now() };
          gs.current.remotePlayers.set(rp.id, rp);
          setLobbyPlayers(prev => [...prev.filter(p => p.id !== rp.id), rp]);
        }

        if (msg.t === "pleave") {
          gs.current.remotePlayers.delete(msg.pid);
          setLobbyPlayers(prev => prev.filter(p => p.id !== msg.pid));
        }

        if (msg.t === "pstate") {
          for (const upd of msg.players) {
            const existing = g.remotePlayers.get(upd.id);
            if (existing) Object.assign(existing, upd, { lastUpdate: Date.now() });
          }
        }

        if (msg.t === "cast") {
          // Visual effect for remote player cast
          const rp = g.remotePlayers.get(msg.pid);
          if (rp && msg.qi >= 0) {
            const colors = ["#d355e8", "#f1c40f", "#a8ff3e", "#7f8c8d"];
            const abilColors: Record<string, string[]> = {
              death_mage: ["#d355e8", "#8e44ad", "#e8c3f8", "#c0392b"],
              holy_paladin: ["#fff176", "#fffde7", "#ffd54f", "#ffffff"],
              orc_shaman: ["#a8ff3e", "#82e0aa", "#2ecc71", "#c8ff3e"],
              stone_guardian: ["#bdc3c7", "#aab7b8", "#a04000", "#e74c3c"],
            };
            const col = (abilColors[rp.heroId] || colors)[msg.qi];
            g.effects.push({ id: uid(), x: rp.x, y: rp.y, radius: 0, maxRadius: 60, color: col, life: 18, maxLife: 18, type: "flash" });
          }
        }

        if (msg.t === "enemies") {
          // Non-host: update enemy list from host
          if (!g.isHost) {
            g.enemies = (msg.list || []).map((e: any) => ({
              ...e,
              stunTimer: e.stunTimer ?? 0,
            }));
          }
        }

        if (msg.t === "started") {
          g.started = true;
          setScreen("game");
          startGameLoop();
        }

        if (msg.t === "ended") {
          const won = msg.wid === localPid.current;
          cancelAnimationFrame(animRef.current);
          setMatchResult({ won, kills: g.player.kills, wave: g.wave });
          setGameOver(true);
        }
      } catch { }
    };

    ws.onclose = () => { };
  }, [startGameLoop]);

  // ── Input listeners (game screen) ─────────────────────────────────────────
  useEffect(() => {
    if (screen !== "game") return;
    const g = gs.current;

    const onKeyDown = (e: KeyboardEvent) => {
      g.keys[e.key.toLowerCase()] = true;
      if (e.key === "q") castAbility("q");
      if (e.key === "e") castAbility("e");
      if (e.key === "r") castAbility("r");
    };
    const onKeyUp = (e: KeyboardEvent) => { g.keys[e.key.toLowerCase()] = false; };
    const onMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      g.mouseX = e.clientX - rect.left;
      g.mouseY = e.clientY - rect.top;
    };
    const onClick = () => castAbility("basic");

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("click", onClick);
    };
  }, [screen, castAbility]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      wsRef.current?.close();
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    gs.current.heroId = heroId;
    gs.current.mode = mode;
    if (mode === "solo") {
      gs.current.isHost = true;
      gs.current.started = true;
      setScreen("game");
      setTimeout(() => startGameLoop(), 60);
    } else {
      // Multiplayer: go to lobby first
      const rid = mode === "pvp" ? (joinRoomId.trim().toUpperCase() || "") : "";
      connectWs(rid, heroId, mode, playerName);
      setScreen("lobby");
    }
  }, [heroId, mode, joinRoomId, playerName, connectWs, startGameLoop]);

  const handleStartMatch = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ t: "start" }));
  }, []);

  const copyRoom = useCallback(() => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  const hero = HEROES[heroId];

  // ══════════════════════════════════════════════════════════════════════════
  // ── SCREENS ──────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── Landing ──
  if (screen === "landing") return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/40 to-gray-950 flex flex-col items-center justify-center p-8 relative">
      <Link href="/super-engine">
        <Button variant="outline" className="absolute top-4 left-4 border-purple-500/50 text-purple-300 hover:bg-purple-900/30">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </Link>

      <div className="text-center mb-10">
        <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 mb-3">
          MAGE ARENA
        </h1>
        <p className="text-gray-400 text-xl">Choose your mode. Pick your hero. Destroy everything.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-10">
        {(["solo", "pvp", "pve"] as GameMode[]).map(m => {
          const labels = { solo: "Solo Practice", pvp: "PvP Arena", pve: "PvE Co-op" };
          const descs = {
            solo: "Survive endless waves of enemies. Practice your hero kit.",
            pvp: "1v1 to 4-player deathmatch. Last hero standing wins.",
            pve: "Co-op survival. Up to 4 players vs escalating waves.",
          };
          const icons = { solo: <Shield />, pvp: <Swords />, pve: <Users /> };
          const colors = { solo: "border-blue-500/40 hover:border-blue-400", pvp: "border-red-500/40 hover:border-red-400", pve: "border-green-500/40 hover:border-green-400" };
          return (
            <button key={m} onClick={() => setMode(m)}
              className={`border-2 rounded-xl p-6 text-left transition-all cursor-pointer ${colors[m]} ${mode === m ? "bg-gray-800/80 scale-105" : "bg-gray-900/40 hover:bg-gray-800/40"}`}>
              <div className="text-2xl mb-3 text-white">{icons[m]}</div>
              <h3 className="text-lg font-bold text-white mb-1">{labels[m]}</h3>
              <p className="text-gray-400 text-sm">{descs[m]}</p>
              {mode === m && <Badge className="mt-3 bg-purple-700">Selected</Badge>}
            </button>
          );
        })}
      </div>

      {mode === "pvp" && (
        <div className="mb-6">
          <p className="text-gray-400 text-sm text-center mb-2">Join existing room (leave blank to create)</p>
          <input
            value={joinRoomId} onChange={e => setJoinRoomId(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            className="bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded text-center font-mono tracking-widest uppercase"
            maxLength={12}
          />
        </div>
      )}

      <Button onClick={() => setScreen("hero_select")}
        className="bg-gradient-to-r from-purple-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 text-white px-14 py-5 text-xl font-bold">
        Choose Hero →
      </Button>
    </div>
  );

  // ── Hero Select ──
  if (screen === "hero_select") return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" onClick={() => setScreen("landing")} className="border-gray-600 text-gray-300">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-3xl font-black text-white">Choose Your Hero</h1>
        <Badge className="bg-purple-800 text-purple-200 ml-2">{mode === "solo" ? "Solo" : mode === "pvp" ? "PvP" : "Co-op"}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10 max-w-5xl mx-auto">
        {(Object.values(HEROES)).map(h => (
          <button key={h.id} onClick={() => setHeroId(h.id as HeroId)}
            className={`border-2 rounded-xl p-5 text-left transition-all cursor-pointer ${heroId === h.id ? "scale-105" : "opacity-70 hover:opacity-100"}`}
            style={{ borderColor: heroId === h.id ? h.color : h.color + "44", background: heroId === h.id ? h.rimColor + "cc" : "#1a1a2a" }}>
            <div className="text-4xl mb-3">{h.emoji}</div>
            <h3 className="text-white font-bold text-lg mb-1">{h.name}</h3>
            <p className="text-gray-400 text-xs mb-3">{h.lore}</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-300">
                <span>❤️ HP</span><span style={{ color: h.color }}>{h.maxHealth}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>💧 MP</span><span style={{ color: h.color }}>{h.maxMana}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>⚡ Speed</span><span style={{ color: h.color }}>{h.speed}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Kit details */}
      <div className="max-w-3xl mx-auto bg-gray-900/80 border rounded-xl p-6" style={{ borderColor: hero.color + "55" }}>
        <h2 className="text-xl font-bold mb-4" style={{ color: hero.color }}>{hero.name} — Ability Kit</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["basic", "q", "e", "r"] as const).map((key, i) => {
            const ab = hero[key];
            const labels = ["Click", "Q", "E", "R"];
            return (
              <div key={key} className="bg-gray-800/60 rounded-lg p-3 border" style={{ borderColor: ab.color + "55" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono bg-gray-700 px-2 py-0.5 rounded text-white">{labels[i]}</span>
                  <span className="text-sm font-bold" style={{ color: ab.color }}>{ab.name}</span>
                </div>
                <p className="text-gray-400 text-xs mb-2">{ab.desc}</p>
                <div className="flex gap-2 text-xs flex-wrap">
                  {ab.damage > 0 && <span className="text-red-400">⚔ {ab.damage}</span>}
                  <span className="text-blue-400">💧 {ab.mana}</span>
                  <span className="text-yellow-400">⏱ {ab.cooldown}s</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center mt-8">
        <Button onClick={handlePlay}
          className="text-xl px-16 py-5 font-bold"
          style={{ background: `linear-gradient(135deg, ${hero.color}, ${hero.rimColor})` }}>
          <Play className="w-5 h-5 mr-2" />
          {mode === "solo" ? "Enter Arena" : "Find / Create Room"}
        </Button>
      </div>
    </div>
  );

  // ── Lobby ──
  if (screen === "lobby") return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-black text-white mb-2">LOBBY</h1>
      <p className="text-gray-400 mb-6">{mode === "pvp" ? "PvP Deathmatch" : "PvE Co-op"}</p>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 w-full max-w-md mb-6">
        <div className="flex items-center gap-3 mb-6">
          <p className="text-gray-400 text-sm">Room Code</p>
          <span className="font-mono text-2xl font-bold text-white tracking-widest">{roomId || "..."}</span>
          <button onClick={copyRoom} className="text-gray-400 hover:text-white">
            {copied ? "✓" : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Players in Room</p>
          {/* Local player */}
          <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
            <span style={{ color: hero.color }}>{hero.emoji}</span>
            <span className="text-white font-medium">{playerName} (You)</span>
            <span className="text-gray-500 text-xs">{hero.name}</span>
            {isHost && <Badge className="ml-auto bg-yellow-800 text-yellow-200">Host</Badge>}
          </div>
          {lobbyPlayers.map(lp => {
            const lpHero = HEROES[lp.heroId as HeroId];
            return (
              <div key={lp.id} className="flex items-center gap-3 bg-gray-800/60 rounded-lg px-4 py-3">
                <span style={{ color: lpHero?.color }}>{lpHero?.emoji}</span>
                <span className="text-white">{lp.name}</span>
                <span className="text-gray-500 text-xs">{lpHero?.name}</span>
              </div>
            );
          })}
        </div>

        {isHost ? (
          <Button onClick={handleStartMatch}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-4 text-lg"
            disabled={lobbyPlayers.length === 0 && mode === "pvp"}>
            <Play className="w-5 h-5 mr-2" />
            Start Match {mode === "pvp" && lobbyPlayers.length === 0 && "(waiting for players…)"}
          </Button>
        ) : (
          <div className="text-center text-gray-400 py-4">Waiting for host to start…</div>
        )}
      </div>

      <Button variant="outline" onClick={() => { wsRef.current?.close(); setScreen("landing"); }}
        className="border-gray-700 text-gray-400">
        Leave Room
      </Button>
    </div>
  );

  // ── Game Over ──
  if (gameOver && matchResult) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center max-w-md">
        <h1 className="text-5xl font-black mb-2" style={{ color: matchResult.won ? "#2ecc71" : "#e74c3c" }}>
          {matchResult.won ? "VICTORY" : "DEFEATED"}
        </h1>
        <div className="text-gray-300 space-y-1 my-6 text-lg">
          <div>Kills: <span className="text-white font-bold">{matchResult.kills}</span></div>
          {mode !== "pvp" && <div>Wave Reached: <span className="text-white font-bold">{matchResult.wave}</span></div>}
          <div>Hero: <span style={{ color: hero.color }}>{hero.name}</span></div>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => { setGameOver(false); setMatchResult(null); setScreen("landing"); gs.current.remotePlayers.clear(); gs.current.enemies = []; gs.current.projectiles = []; gs.current.effects = []; gs.current.totems = []; gs.current.player.alive = true; gs.current.player.kills = 0; gs.current.wave = 1; gs.current.waveTimer = 0; }}
            className="bg-purple-700 hover:bg-purple-600 text-white px-8 py-3">
            Play Again
          </Button>
          <Link href="/super-engine">
            <Button variant="outline" className="border-gray-600 text-gray-300 px-8 py-3">Exit</Button>
          </Link>
        </div>
      </div>
    </div>
  );

  // ── GAME ──
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Top-left HUD */}
      <div className="absolute top-4 left-4 space-y-2 z-10">
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg">
          <Heart className="w-4 h-4 text-red-400" />
          <div className="w-32 h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 transition-all duration-100 rounded-full"
              style={{ width: `${Math.max(0, (hud.health / hud.maxHealth) * 100)}%` }} />
          </div>
          <span className="text-white text-xs font-mono">{Math.max(0, Math.floor(hud.health))}/{hud.maxHealth}</span>
        </div>
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg">
          <Zap className="w-4 h-4 text-blue-400" />
          <div className="w-32 h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-100 rounded-full"
              style={{ width: `${(hud.mana / hud.maxMana) * 100}%` }} />
          </div>
          <span className="text-white text-xs font-mono">{Math.floor(hud.mana)}/{hud.maxMana}</span>
        </div>
        {hud.shielded && <Badge className="bg-yellow-800 text-yellow-200">🛡 Shielded</Badge>}
        {hud.stoneHardened && <Badge className="bg-gray-700 text-gray-200">🪨 Stone Skin</Badge>}
      </div>

      {/* Top-right: wave / kills */}
      <div className="absolute top-4 right-4 text-right z-10 space-y-1">
        <Badge className="text-lg px-4 font-bold" style={{ background: hero.color }}>
          Wave {hud.wave}
        </Badge>
        <div className="text-gray-300 text-sm font-mono bg-black/60 px-3 py-1 rounded">
          Kills: {hud.kills}
        </div>
        {mode !== "solo" && roomId && (
          <div className="text-gray-500 text-xs font-mono bg-black/60 px-3 py-1 rounded">
            Room: {roomId}
          </div>
        )}
      </div>

      {/* Bottom ability bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {(["basic", "q", "e", "r"] as const).map((key, i) => {
          const ab = hero[key];
          const labels = ["Click", "Q", "E", "R"];
          const cds = [0, hud.qcd, hud.ecd, hud.rcd];
          const cdMax = [0, hero.q.cooldown * 60, hero.e.cooldown * 60, hero.r.cooldown * 60];
          const pct = cdMax[i] > 0 ? cds[i] / cdMax[i] : 0;
          const ready = cds[i] <= 0;
          return (
            <div key={key} className="relative w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center text-white text-xs font-bold bg-gray-900/80"
              style={{ borderColor: ready ? ab.color : "#444" }}>
              <span style={{ color: ab.color }}>{labels[i]}</span>
              <span className="text-gray-400" style={{ fontSize: "9px" }}>{ab.name.split(" ")[0]}</span>
              {pct > 0 && (
                <div className="absolute inset-0 rounded-lg bg-black/60 flex items-center justify-center">
                  <span className="text-xs text-gray-300 font-mono">{(cds[i] / 60).toFixed(1)}s</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 text-gray-600 text-xs z-10">
        WASD Move · Mouse Aim · Click/Q/E/R Abilities
      </div>

      {/* Remote players scoreboard */}
      {gs.current.remotePlayers.size > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-black/70 rounded-lg px-4 py-2 flex gap-6">
            {Array.from(gs.current.remotePlayers.values()).map(rp => {
              const rpHero = HEROES[rp.heroId as HeroId];
              return (
                <div key={rp.id} className="text-center text-xs">
                  <span style={{ color: rpHero?.color }}>{rpHero?.emoji} {rp.name}</span>
                  <div className="text-gray-400">{rp.kills}K / {rp.deaths}D</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
