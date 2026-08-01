/**
 * AVERNUS ARENA — grudge6 / Toon RTS combat pit
 *
 * Opening page → REST session → Danger Room controls + GameCamera FOLLOW
 * Characters: loadRaceWithEquipment · weapon packs · RoleControls · FSM skills
 *
 * Live: https://grudge-studio.com/avernus-arena
 * Stack: docs/ANNIHILATE_GRUDGE6_STACK.md + avernus/*
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Swords,
  Skull,
  Crown,
  Shield,
  Users,
  Play,
  Loader2,
  Trophy,
} from 'lucide-react';
import * as THREE from 'three';

import {
  GrudgeEngine,
  RoleControls,
  BaseAi,
  CombatVfx,
  GameCamera,
  RACE_CONFIGS,
  type CharacterRace,
} from '@/engine';
import { isPortalEmbedMode } from '@/lib/embed-mode';

import {
  AVERNUS_HEROES,
  RACE_DEFAULTS,
  resolveHero,
  type AvernusHeroPreset,
} from './avernus/characters';
import { WEAPONS, packForWeapon, type WeaponType } from './avernus/weapons';
import { WEAPON_PACKS, type WeaponPackId } from './avernus/weaponPacks';
import { GAME_MODES, MODE_LIST, type GameMode, generateInfiniteWave } from './avernus/modes';
import { NPC_PROFILES } from './avernus/ai';
import {
  fetchAvernusConfig,
  createAvernusSession,
  submitAvernusScore,
  fetchAvernusLeaderboard,
  type AvernusConfig,
  type LeaderboardEntry,
} from './avernus/api';
import { AvernusHero, AvernusEnemy, buildAvernusArena } from './avernus/combat';
import { AVERNUS_ART, ARENA_RADIUS_M } from './avernus/assets';
import { preloadAvernusAnims, bakedCacheStats } from './avernus/bakedAnimSystem';
import {
  DANGER_HOLD_TAP_SEC,
  DANGER_INPUT_LEGEND,
  DANGER_KEY_CHIPS,
} from './avernus/dangerInputMap';
import type { SkillBindKey } from './avernus/weaponPacks';

type Phase = 'opening' | 'loading' | 'playing' | 'results';

interface EnemyInstance {
  character: AvernusEnemy;
  ai: BaseAi;
}

const MODE_ICONS: Record<GameMode, ReactNode> = {
  survival: <Skull className="w-5 h-5" />,
  team_deathmatch: <Users className="w-5 h-5" />,
  boss_rush: <Crown className="w-5 h-5" />,
  escort: <Shield className="w-5 h-5" />,
};

function HealthBar({
  current,
  max,
  name,
}: {
  current: number;
  max: number;
  name: string;
}) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="min-w-[220px] rounded-lg border border-amber-500/30 bg-black/75 px-3 py-2 backdrop-blur">
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-amber-200/80">
        <span>{name}</span>
        <span>
          {Math.ceil(current)} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-700 via-amber-600 to-amber-400 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Danger Room skill strip: F class · R ultimate · 1–4 signatures (not Q/E). */
function SkillBar({
  packId,
  cooldowns,
}: {
  packId: WeaponPackId;
  cooldowns: Record<string, number>;
}) {
  const skills = WEAPON_PACKS[packId]?.skills ?? [];
  const order: SkillBindKey[] = ['F', 'R', '1', '2', '3', '4'];
  const sorted = order
    .map((k) => skills.find((s) => s.key === k))
    .filter(Boolean) as typeof skills;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-2">
        {sorted.map((s) => {
          const cd = cooldowns[s.key] ?? 0;
          const ready = cd <= 0;
          const accent =
            s.role === 'class'
              ? 'border-sky-400/50 text-sky-100'
              : s.role === 'ultimate'
                ? 'border-violet-400/50 text-violet-100'
                : 'border-amber-500/50 text-amber-100';
          return (
            <div
              key={s.key}
              className={`relative flex h-14 w-14 flex-col items-center justify-center rounded-lg border text-center ${
                ready ? `bg-black/70 ${accent}` : 'border-gray-700 bg-black/50 text-gray-500'
              }`}
              title={`${s.key} · ${s.name} (${s.role}): ${s.description}`}
            >
              <span className="text-[10px] font-bold opacity-90">{s.key}</span>
              <span className="px-0.5 text-[9px] leading-tight">{s.name.split(' ')[0]}</span>
              {!ready && (
                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60 text-sm font-mono text-white">
                  {cd.toFixed(1)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-[9px] text-amber-100/40">
        F class · R ultimate · 1–4 sig · Q swap · Hold Q radial · E interact
      </div>
    </div>
  );
}

/** Hold-Q mode / weapon radial (Danger Room style). */
function ModeRadial({
  open,
  weapons,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  weapons: { type: WeaponType; name: string; icon: string }[];
  current: WeaponType;
  onPick: (t: WeaponType) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close radial"
        onClick={onClose}
      />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="rounded-full border border-amber-500/40 bg-black/80 px-6 py-3 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-300">Mode / Weapon</div>
          <div className="text-[10px] text-amber-100/50">Hold Q · release to equip · Danger Room</div>
        </div>
        <div className="flex flex-wrap justify-center gap-2" style={{ maxWidth: 360 }}>
          {weapons.map((w) => (
            <button
              key={w.type}
              type="button"
              onClick={() => onPick(w.type)}
              className={`rounded-xl border px-3 py-2 text-xs ${
                current === w.type
                  ? 'border-amber-400 bg-amber-500/20 text-amber-50'
                  : 'border-white/15 bg-black/70 text-amber-100/80 hover:border-amber-500/40'
              }`}
            >
              <span className="mr-1">{w.icon}</span>
              {w.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AvernusArena() {
  const [location] = useLocation();
  const embedMode = isPortalEmbedMode();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const engineRef = useRef<GrudgeEngine | null>(null);
  const roleRef = useRef<AvernusHero | null>(null);
  const controlsRef = useRef<RoleControls | null>(null);
  const enemiesRef = useRef<EnemyInstance[]>([]);
  const vfxRef = useRef<CombatVfx | null>(null);
  const camRef = useRef<GameCamera | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const skillCdRef = useRef<Record<string, number>>({});
  const killsRef = useRef(0);
  const waveRef = useRef(0);
  const scoreRef = useRef(0);
  const spawningWaveRef = useRef(false);
  const runEndedRef = useRef(false);
  /** Danger Room Q hold (Studio: radialHoldT vs 0.18s tap) */
  const qHoldRef = useRef<{ armed: boolean; t0: number; timer: ReturnType<typeof setTimeout> | null }>({
    armed: false,
    t0: 0,
    timer: null,
  });
  const weaponRef = useRef(weapon);
  weaponRef.current = weapon;
  const radialOpenRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('opening');
  const [config, setConfig] = useState<AvernusConfig | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [mode, setMode] = useState<GameMode>('survival');
  const [race, setRace] = useState<CharacterRace>('human');
  const [weapon, setWeapon] = useState<WeaponType>('sword_shield');
  const [hero, setHero] = useState<AvernusHeroPreset>(() => RACE_DEFAULTS[0] ?? AVERNUS_HEROES[0]);
  const [info, setInfo] = useState('Preparing the pit…');
  const [fsmState, setFsmState] = useState('loading');
  const [playerHealth, setPlayerHealth] = useState(100);
  const [playerMaxHealth, setPlayerMaxHealth] = useState(100);
  const [kills, setKills] = useState(0);
  const [wave, setWave] = useState(0);
  const [score, setScore] = useState(0);
  const [comboHits, setComboHits] = useState(0);
  const [activePack, setActivePack] = useState<WeaponPackId>('sword-shield');
  const [skillCdUi, setSkillCdUi] = useState<Record<string, number>>({});
  const [enemyCount, setEnemyCount] = useState(0);
  const [radialOpen, setRadialOpen] = useState(false);
  const [flash, setFlash] = useState('');

  const [preloadPct, setPreloadPct] = useState(0);
  const [preloadDone, setPreloadDone] = useState(false);

  // Boot config + leaderboard + **baked anim warmup** (parallel, low lag at match start)
  useEffect(() => {
    document.title = 'Avernus Arena — Grudge Studio';
    fetchAvernusConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
    fetchAvernusLeaderboard(8).then(setLeaderboard);

    let cancelled = false;
    (async () => {
      try {
        await preloadAvernusAnims(
          ['sword-shield', 'longbow', 'magic-caster', 'unarmed', 'great-sword'],
          (done, total) => {
            if (!cancelled) setPreloadPct(Math.round((done / Math.max(1, total)) * 100));
          },
        );
        if (!cancelled) {
          setPreloadDone(true);
          const s = bakedCacheStats();
          console.info(
            `[Avernus] baked anim cache ready: ${s.clips} clips (${preloadPct || 100}%)`,
          );
        }
      } catch (e) {
        console.warn('[Avernus] anim preload partial', e);
        if (!cancelled) setPreloadDone(true);
      }
    })();

    return () => {
      cancelled = true;
      document.title = 'Rec0deD:88 — Grudge Studio Gaming Portal';
    };
  }, []);

  // Deep link ?hero=
  useEffect(() => {
    const heroParam = new URLSearchParams(location.split('?')[1] ?? '').get('hero');
    if (heroParam) {
      const h = resolveHero(heroParam);
      setHero(h);
      setRace(h.race);
      setWeapon(h.weaponType);
    }
  }, [location]);

  // Sync hero when race changes on opening
  useEffect(() => {
    if (phase !== 'opening') return;
    const match =
      AVERNUS_HEROES.find((h) => h.race === race && h.weaponType === weapon) ||
      AVERNUS_HEROES.find((h) => h.race === race) ||
      RACE_DEFAULTS.find((h) => h.race === race);
    if (match) setHero(match);
  }, [race, weapon, phase]);

  const clearEnemies = useCallback(() => {
    for (const e of enemiesRef.current) {
      e.ai.destroy();
      e.character.destroy();
    }
    enemiesRef.current = [];
    setEnemyCount(0);
  }, []);

  const spawnEnemyFromProfile = useCallback(async (role: keyof typeof NPC_PROFILES) => {
    const engine = engineRef.current;
    const roleChar = roleRef.current;
    const vfx = vfxRef.current;
    if (!engine || !roleChar || !vfx) return;

    const profile = NPC_PROFILES[role];
    const angle = Math.random() * Math.PI * 2;
    const dist = 8 + Math.random() * 6;
    const pos = new THREE.Vector3(
      roleChar.body.position.x + Math.cos(angle) * dist,
      2,
      roleChar.body.position.z + Math.sin(angle) * dist,
    );

    const enemy = new AvernusEnemy({
      race: profile.race,
      weaponPack: profile.weaponPack,
      health: profile.health,
      speed: profile.speed * 0.025,
      attackSpeed: 1.2 + profile.aggressionBias * 0.4,
      position: pos,
    });

    await enemy.load();
    enemy.enableFootIK();
    enemy.attachCombat(vfx, (target) => {
      if (target.isRole) {
        setPlayerHealth(target.health);
        camRef.current?.shake(0.32);
      }
    });
    const ai = new BaseAi(enemy, 1.4);
    enemiesRef.current.push({ character: enemy, ai });
    setEnemyCount(enemiesRef.current.length);
    vfx.ring({ x: pos.x, y: 0.1, z: pos.z }, 'magic', 1.1);
  }, []);

  const spawnWave = useCallback(
    async (waveNum: number) => {
      const modeCfg = GAME_MODES[mode];
      const def =
        waveNum <= modeCfg.waves.length
          ? modeCfg.waves[waveNum - 1]
          : modeCfg.infiniteWaves
            ? generateInfiniteWave(waveNum)
            : null;
      if (!def) return;
      setWave(waveNum);
      setInfo(def.bonus || `Wave ${waveNum}`);
      for (const entry of def.enemies) {
        for (let i = 0; i < entry.count; i++) {
          await spawnEnemyFromProfile(entry.role);
          await new Promise((r) => setTimeout(r, def.spawnDelay * 400));
        }
      }
    },
    [mode, spawnEnemyFromProfile],
  );

  const teardownEngine = useCallback(() => {
    clearEnemies();
    controlsRef.current?.destroy();
    controlsRef.current = null;
    roleRef.current?.destroy();
    roleRef.current = null;
    vfxRef.current?.destroy();
    vfxRef.current = null;
    camRef.current?.destroy();
    camRef.current = null;
    engineRef.current?.destroy();
    engineRef.current = null;
  }, [clearEnemies]);

  const endRun = useCallback(
    async (finalScore: number, finalKills: number, finalWave: number) => {
      setPhase('results');
      setScore(finalScore);
      const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
      await submitAvernusScore({
        sessionId: sessionIdRef.current ?? undefined,
        mode,
        race: hero.race,
        weapon,
        score: finalScore,
        kills: finalKills,
        wave: finalWave,
        durationSec,
      });
      fetchAvernusLeaderboard(8).then(setLeaderboard);
    },
    [mode, hero.race, weapon],
  );

  const startMatch = useCallback(async () => {
    setPhase('loading');
    setInfo('Opening Avernus session…');
    killsRef.current = 0;
    waveRef.current = 0;
    scoreRef.current = 0;
    runEndedRef.current = false;
    spawningWaveRef.current = false;
    setKills(0);
    setWave(0);
    setScore(0);
    setComboHits(0);
    skillCdRef.current = {};

    const session = await createAvernusSession({
      mode,
      race: hero.race,
      weapon,
      heroId: hero.id,
    });
    sessionIdRef.current = session.id;
    startedAtRef.current = Date.now();

    // Wait one frame so canvas mounts
    setPhase('playing');
  }, [mode, hero, weapon]);

  // Engine bootstrap when entering play
  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let hpPoll = 0;
    let skillPoll = 0;
    let ro: ResizeObserver | null = null;

    (async () => {
      setInfo(`Loading ${hero.name} (grudge6)…`);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.width = canvas.clientWidth || window.innerWidth;
      canvas.height = canvas.clientHeight || window.innerHeight;

      teardownEngine();

      const engine = GrudgeEngine.getInstance();
      engine.init(canvas);
      engine.addGround(0x1a1210, ARENA_RADIUS_M * 2.2);
      engineRef.current = engine;

      buildAvernusArena(engine.scene, ARENA_RADIUS_M);

      const vfx = new CombatVfx(engine.scene);
      vfxRef.current = vfx;
      engine.addToUpdate(vfx);

      // Danger Room–style TPS follow camera
      const cam = GameCamera.getInstance(engine.camera);
      cam.setMode('FOLLOW');
      cam.configure({
        distance: config?.camera.distance ?? 7.5,
        height: config?.camera.height ?? 3.8,
        lerpAlpha: 0.12,
        lookAhead: 1.5,
        fov: 68,
        fovSprint: 78,
      });
      camRef.current = cam;
      engine.addToUpdate(cam);

      // Atmosphere
      const fill = new THREE.HemisphereLight(0xffccaa, 0x1a0a18, 0.55);
      engine.scene.add(fill);

      engine.start();

      if (window.parent !== window) {
        window.parent.postMessage({ type: 'grudge:game:ready', game: 'avernus-arena' }, '*');
      }

      const packId = packForWeapon(weapon) as WeaponPackId;
      const character = new AvernusHero(hero, { position: new THREE.Vector3(0, 2, 0) });

      try {
        await character.load();
        if (cancelled) return;
        character.enableFootIK();
        character.attachCombat(vfx, () => {
          setComboHits((c) => c + 1);
          cam.shake(0.2);
        });
        const controls = new RoleControls(character);
        controlsRef.current = controls;
        roleRef.current = character;
        engine.setRole(character);
        cam.setTarget(character.mesh);
        character.service.onTransition((state: string) => setFsmState(state));
        setPlayerHealth(character.health);
        setPlayerMaxHealth(character.maxHealth);

        setInfo(`Binding baked Bip001 · ${WEAPON_PACKS[packId].label}…`);
        const clips = await character.loadWeaponPack(packId);
        setActivePack(packId);
        const cache = bakedCacheStats();
        setInfo(
          clips.length
            ? `${hero.name} · grudge6 · ${WEAPON_PACKS[packId].label} · ${clips.length} skills (cache ${cache.clips})`
            : `${hero.name} · embedded anims only`,
        );

        /**
         * Danger Room input (Studio.ts + quickActions.ts) — NOT invent Q/E/R/F abilities.
         * Q tap = swap weapon · Hold Q = mode/weapon radial
         * E = interact · F = class skill · R = ultimate/heavy · 1–4 = signatures
         * X roll · C parry (RoleControls also handles LMB/RMB/Space/Shift)
         */
        const fireSkillKey = (key: SkillBindKey) => {
          const pack = WEAPON_PACKS[character.activePack] ?? WEAPON_PACKS[packId];
          const skill = pack.skills.find((s) => s.key === key);
          if (!skill) return;
          const now = performance.now() / 1000;
          if ((skillCdRef.current[key] ?? 0) > now) return;
          if (character.castSkillAnim(skill.anim)) {
            skillCdRef.current[key] = now + skill.cooldown;
            character.service.send(key === 'R' ? 'bash' : 'attack');
            setFlash(`${key} · ${skill.name}`);
            window.setTimeout(() => setFlash(''), 700);
          }
        };

        const cycleWeapon = () => {
          const list = WEAPONS.map((w) => w.type);
          const i = list.indexOf(weaponRef.current);
          const next = list[(i + 1) % list.length];
          weaponRef.current = next;
          setWeapon(next);
          const nextPack = packForWeapon(next) as WeaponPackId;
          void character.loadWeaponPack(nextPack).then((clips) => {
            setActivePack(nextPack);
            setFlash(`SWAP · ${WEAPON_PACKS[nextPack].label} (${clips.length})`);
            window.setTimeout(() => setFlash(''), 900);
          });
        };

        const OWN = new Set([
          'KeyQ',
          'KeyE',
          'KeyR',
          'KeyF',
          'KeyX',
          'KeyC',
          'Digit1',
          'Digit2',
          'Digit3',
          'Digit4',
          'Numpad1',
          'Numpad2',
          'Numpad3',
          'Numpad4',
        ]);

        const onKeyDown = (e: KeyboardEvent) => {
          if (e.repeat) return;
          if (OWN.has(e.code)) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
          // Q: arm hold for radial; Shift+Q arsenal swap (= cycle weapon)
          if (e.code === 'KeyQ') {
            if (e.shiftKey) {
              cycleWeapon();
              return;
            }
            qHoldRef.current.armed = true;
            qHoldRef.current.t0 = performance.now() / 1000;
            if (qHoldRef.current.timer) clearTimeout(qHoldRef.current.timer);
            qHoldRef.current.timer = setTimeout(() => {
              if (qHoldRef.current.armed) {
                radialOpenRef.current = true;
                setRadialOpen(true);
              }
            }, DANGER_HOLD_TAP_SEC * 1000);
            return;
          }
          if (e.code === 'KeyE') {
            // Interact first · else forcefield guard (Studio KeyE)
            setFlash('INTERACT');
            character.service.send('block');
            window.setTimeout(() => {
              character.service.send('keyLUp');
              setFlash('');
            }, 400);
            return;
          }
          if (e.code === 'KeyF') {
            fireSkillKey('F');
            return;
          }
          if (e.code === 'KeyR') {
            fireSkillKey('R');
            return;
          }
          if (e.code === 'Digit1' || e.code === 'Numpad1') fireSkillKey('1');
          if (e.code === 'Digit2' || e.code === 'Numpad2') fireSkillKey('2');
          if (e.code === 'Digit3' || e.code === 'Numpad3') fireSkillKey('3');
          if (e.code === 'Digit4' || e.code === 'Numpad4') fireSkillKey('4');
          if (e.code === 'KeyX') {
            character.service.send('dash');
            setFlash('ROLL');
            window.setTimeout(() => setFlash(''), 400);
          }
          if (e.code === 'KeyC') {
            character.service.send('block');
            setFlash('PARRY');
            window.setTimeout(() => {
              character.service.send('keyLUp');
              setFlash('');
            }, 350);
          }
        };

        const onKeyUp = (e: KeyboardEvent) => {
          if (e.code !== 'KeyQ') return;
          e.preventDefault();
          e.stopImmediatePropagation();
          const held = performance.now() / 1000 - qHoldRef.current.t0;
          if (qHoldRef.current.timer) {
            clearTimeout(qHoldRef.current.timer);
            qHoldRef.current.timer = null;
          }
          qHoldRef.current.armed = false;
          // Quick tap: swap weapon (user SSOT + Studio short-hold path)
          if (held < DANGER_HOLD_TAP_SEC && !radialOpenRef.current) {
            cycleWeapon();
          }
        };

        // Capture phase so we win over RoleControls Digit1–4 / annihilate remaps
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp, true);

        // First wave
        spawningWaveRef.current = true;
        waveRef.current = 1;
        setWave(1);
        await spawnWave(1);
        spawningWaveRef.current = false;

        hpPoll = window.setInterval(() => {
          const role = roleRef.current;
          if (!role || runEndedRef.current) return;
          setPlayerHealth(role.health);

          let gained = 0;
          enemiesRef.current = enemiesRef.current.filter((e) => {
            if (e.character.health > 0) return true;
            e.ai.destroy();
            e.character.destroy();
            gained += 1;
            return false;
          });
          if (gained) {
            killsRef.current += gained;
            scoreRef.current += gained * GAME_MODES[mode].scorePerKill;
            setKills(killsRef.current);
            setScore(scoreRef.current);
          }
          setEnemyCount(enemiesRef.current.length);

          if (role.health <= 0) {
            runEndedRef.current = true;
            window.clearInterval(hpPoll);
            void endRun(scoreRef.current, killsRef.current, waveRef.current);
          }
        }, 250);

        // Wave clear watcher (single-flight)
        const waveWatch = window.setInterval(() => {
          if (cancelled || runEndedRef.current || !roleRef.current) return;
          if (roleRef.current.health <= 0) return;
          if (spawningWaveRef.current) return;
          if (enemiesRef.current.length > 0) return;

          const modeCfg = GAME_MODES[mode];
          const next = waveRef.current + 1;
          if (!modeCfg.infiniteWaves && next > modeCfg.waves.length) {
            runEndedRef.current = true;
            void endRun(
              scoreRef.current + modeCfg.scorePerWave,
              killsRef.current,
              waveRef.current,
            );
            return;
          }

          spawningWaveRef.current = true;
          waveRef.current = next;
          scoreRef.current += modeCfg.scorePerWave;
          setWave(next);
          setScore(scoreRef.current);
          void spawnWave(next).finally(() => {
            spawningWaveRef.current = false;
          });
        }, 1800);

        skillPoll = window.setInterval(() => {
          const now = performance.now() / 1000;
          const next: Record<string, number> = {};
          for (const [k, readyAt] of Object.entries(skillCdRef.current)) {
            next[k] = Math.max(0, readyAt - now);
          }
          setSkillCdUi(next);
        }, 100);

        ro = new ResizeObserver(() => {
          const c = canvasRef.current;
          if (!c || !engineRef.current) return;
          c.width = c.clientWidth || window.innerWidth;
          c.height = c.clientHeight || window.innerHeight;
          engine.renderer.setSize(c.width, c.height);
          engine.camera.aspect = c.width / c.height;
          engine.camera.updateProjectionMatrix();
        });
        ro.observe(canvas);

        // Cleanup extras on unmount
        (canvas as HTMLCanvasElement & { __avernusCleanup?: () => void }).__avernusCleanup = () => {
          window.removeEventListener('keydown', onKeyDown, true);
          window.removeEventListener('keyup', onKeyUp, true);
          if (qHoldRef.current.timer) clearTimeout(qHoldRef.current.timer);
          window.clearInterval(waveWatch);
        };
      } catch (err) {
        console.error('[Avernus] boot failed', err);
        setInfo(`Failed to load hero: ${err instanceof Error ? err.message : String(err)}`);
        setPhase('opening');
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(hpPoll);
      window.clearInterval(skillPoll);
      ro?.disconnect();
      const c = canvas as HTMLCanvasElement & { __avernusCleanup?: () => void };
      c.__avernusCleanup?.();
      teardownEngine();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'playing' ? 'play' : 'idle']);

  const raceHeroes = AVERNUS_HEROES.filter((h) => h.race === race);

  // ─── OPENING PAGE ────────────────────────────────────────────────────────
  if (phase === 'opening' || phase === 'loading') {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#0a0608] text-amber-50">
        {/* Backdrop */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(ellipse at 50% 20%, rgba(180,40,30,0.35), transparent 55%),
              radial-gradient(ellipse at 80% 80%, rgba(80,20,100,0.25), transparent 50%),
              url(${AVERNUS_ART.card})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'saturate(0.7) brightness(0.35)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[#0a0608]/85 to-black" />

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:py-10">
          <header className="flex flex-wrap items-center gap-3">
            {!embedMode && (
              <Link href="/">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-500/40 bg-black/50 text-amber-200 hover:bg-amber-950/40"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" /> Portal
                </Button>
              </Link>
            )}
            <Badge className="bg-red-900/60 text-amber-100">BETA · grudge6</Badge>
            <div className="flex-1" />
            <span className="text-xs text-amber-200/50">
              REST {config?.version ? `v${config.version}` : 'local'} ·{' '}
              {config?.camera.mode ?? 'FOLLOW'} cam
            </span>
          </header>

          <div className="text-center">
            <h1 className="font-heading text-4xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-500 to-red-800 md:text-6xl">
              AVERNUS ARENA
            </h1>
            <p className="mt-2 text-sm text-amber-100/70 md:text-base">
              Dark-fantasy pit combat · Toon RTS grudge6 heroes · Danger Room controls & weapon skills
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {/* Left: loadout */}
            <section className="rounded-2xl border border-amber-500/25 bg-black/60 p-5 shadow-2xl shadow-red-950/40 backdrop-blur">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-amber-400">
                <Swords className="h-4 w-4" /> Enter the Pit
              </h2>

              {/* Mode */}
              <div className="mb-5">
                <div className="mb-2 text-[11px] uppercase text-amber-200/50">Game Mode</div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {MODE_LIST.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        mode === m.id
                          ? 'border-amber-400 bg-amber-500/15 text-amber-50'
                          : 'border-white/10 bg-white/5 text-amber-100/70 hover:border-amber-500/30'
                      }`}
                    >
                      <div className="mb-1 text-amber-400">{MODE_ICONS[m.id]}</div>
                      <div className="text-xs font-bold">{m.name}</div>
                      <div className="mt-1 line-clamp-2 text-[10px] opacity-60">{m.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Race */}
              <div className="mb-5">
                <div className="mb-2 text-[11px] uppercase text-amber-200/50">Race (grudge6)</div>
                <div className="flex flex-wrap gap-2">
                  {(
                    ['human', 'barbarian', 'elf', 'dwarf', 'orc', 'undead'] as CharacterRace[]
                  ).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRace(r)}
                      className={`rounded-full border px-3 py-1.5 text-xs capitalize ${
                        race === r
                          ? 'border-amber-400 bg-amber-500/20 text-amber-50'
                          : 'border-white/10 text-amber-100/60 hover:border-amber-500/40'
                      }`}
                    >
                      {RACE_CONFIGS[r]?.name ?? r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class / hero */}
              <div className="mb-5">
                <div className="mb-2 text-[11px] uppercase text-amber-200/50">Champion</div>
                <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                  {raceHeroes.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        setHero(h);
                        setWeapon(h.weaponType);
                      }}
                      className={`rounded-lg border px-3 py-2 text-left text-xs ${
                        hero.id === h.id
                          ? 'border-amber-400 bg-amber-500/10'
                          : 'border-white/10 hover:border-amber-500/30'
                      }`}
                    >
                      <div className="font-semibold" style={{ color: h.classColor }}>
                        {h.name}
                      </div>
                      <div className="text-[10px] text-amber-100/50">{h.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Weapon */}
              <div className="mb-6">
                <div className="mb-2 text-[11px] uppercase text-amber-200/50">Weapon skills</div>
                <div className="flex flex-wrap gap-2">
                  {WEAPONS.map((w) => (
                    <button
                      key={w.type}
                      type="button"
                      onClick={() => setWeapon(w.type)}
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        weapon === w.type
                          ? 'border-amber-400 bg-black text-amber-50'
                          : 'border-white/10 text-amber-100/60'
                      }`}
                      style={weapon === w.type ? { boxShadow: `0 0 12px ${w.color}44` } : undefined}
                    >
                      <span className="mr-1">{w.icon}</span>
                      {w.name}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-amber-100/40">
                  Pack: {WEAPON_PACKS[packForWeapon(weapon)].label} · F class · R ultimate · 1–4 sig · Q
                  swap
                </div>
              </div>

              <div className="mb-3 text-[10px] text-amber-100/40">
                Baked Bip001 packs:{' '}
                {preloadDone ? (
                  <span className="text-green-400/80">ready ({bakedCacheStats().clips} clips)</span>
                ) : (
                  <span className="text-amber-300/70">warming cache {preloadPct}%…</span>
                )}
                {' · '}SkeletonUtils race kits · strip root motion · parallel load
              </div>

              <Button
                size="lg"
                disabled={phase === 'loading'}
                onClick={() => void startMatch()}
                className="w-full bg-gradient-to-r from-red-800 via-amber-700 to-amber-500 text-base font-bold text-black hover:from-red-700 hover:to-amber-400"
              >
                {phase === 'loading' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {info}
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" /> Enter Avernus
                  </>
                )}
              </Button>
            </section>

            {/* Right: controls + board */}
            <aside className="flex flex-col gap-4">
              <div className="rounded-2xl border border-purple-500/25 bg-black/60 p-4 backdrop-blur">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-purple-300">
                  Danger Room Controls (SSOT)
                </h3>
                <div className="space-y-1 font-mono text-[11px] text-purple-100/80">
                  {DANGER_INPUT_LEGEND.map((row) => (
                    <div key={row.keys} className="flex gap-2">
                      <span className="w-32 shrink-0 text-amber-300">{row.keys}</span>
                      <span>{row.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-purple-200/40">
                  From Open Danger Room: quickActions.ts · Studio.ts · DangerStartScreen — not invent Q/E as skills
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-black/60 p-4 backdrop-blur">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-400">
                  <Trophy className="h-3.5 w-3.5" /> Leaderboard
                </h3>
                {leaderboard.length === 0 ? (
                  <p className="text-xs text-amber-100/40">No scores yet — be the first blood.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {leaderboard.slice(0, 8).map((e, i) => (
                      <li
                        key={`${e.playerName}-${i}`}
                        className="flex justify-between text-xs text-amber-100/70"
                      >
                        <span>
                          #{i + 1} {e.playerName || 'Warlord'}
                        </span>
                        <span className="font-mono text-amber-300">{e.score}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-[11px] text-amber-100/50">
                <div className="mb-1 font-semibold text-amber-200/70">REST</div>
                <code className="block text-[10px] text-green-400/80">GET /api/avernus/config</code>
                <code className="block text-[10px] text-green-400/80">POST /api/avernus/session</code>
                <code className="block text-[10px] text-green-400/80">POST /api/scores</code>
                <code className="block text-[10px] text-green-400/80">
                  GET /api/leaderboards/avernus-arena
                </code>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS ─────────────────────────────────────────────────────────────
  if (phase === 'results') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0608] px-4 text-center text-amber-50">
        <h1 className="mb-2 text-4xl font-black tracking-widest text-amber-400">RUN ENDED</h1>
        <p className="mb-6 text-amber-100/60">
          Score <span className="font-mono text-amber-200">{score}</span> · Kills {kills} · Wave{' '}
          {wave}
        </p>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setPhase('opening');
              teardownEngine();
            }}
            className="bg-amber-600 text-black hover:bg-amber-500"
          >
            Return to Opening
          </Button>
          <Button
            variant="outline"
            className="border-amber-500/40 text-amber-200"
            onClick={() => void startMatch()}
          >
            Fight Again
          </Button>
        </div>
      </div>
    );
  }

  // ─── PLAYING ─────────────────────────────────────────────────────────────
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <ModeRadial
        open={radialOpen}
        weapons={WEAPONS.map((w) => ({ type: w.type, name: w.name, icon: w.icon }))}
        current={weapon}
        onPick={(t) => {
          weaponRef.current = t;
          setWeapon(t);
          radialOpenRef.current = false;
          setRadialOpen(false);
          const role = roleRef.current;
          if (!role) return;
          const nextPack = packForWeapon(t) as WeaponPackId;
          void role.loadWeaponPack(nextPack).then((clips) => {
            setActivePack(nextPack);
            setFlash(`EQUIP · ${WEAPON_PACKS[nextPack].label} (${clips.length})`);
            window.setTimeout(() => setFlash(''), 900);
          });
        }}
        onClose={() => {
          radialOpenRef.current = false;
          setRadialOpen(false);
        }}
      />

      {flash && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 rounded bg-black/70 px-4 py-2 font-mono text-sm font-bold tracking-wider text-amber-200">
          {flash}
        </div>
      )}

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex flex-wrap items-center gap-2 p-3">
        <Button
          size="sm"
          variant="outline"
          className="border-amber-500/40 bg-black/60 text-amber-200"
          onClick={() => {
            teardownEngine();
            setPhase('opening');
          }}
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Leave
        </Button>
        <Badge className="bg-black/70 text-amber-200">{GAME_MODES[mode].name}</Badge>
        <Badge variant="outline" className="border-purple-500/40 text-purple-200">
          Wave {wave}
        </Badge>
        <Badge variant="outline" className="border-red-500/40 text-red-200">
          Kills {kills}
        </Badge>
        <Badge variant="outline" className="border-amber-500/40 text-amber-200">
          Score {score}
        </Badge>
        <div className="flex-1" />
        <div className="rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-green-400">
          {fsmState}
          {comboHits > 0 && <span className="ml-2 text-amber-300">Hits {comboHits}</span>}
        </div>
      </div>

      <div className="absolute left-1/2 top-14 z-20 -translate-x-1/2">
        <HealthBar current={playerHealth} max={playerMaxHealth} name={hero.name} />
      </div>

      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
        <SkillBar packId={activePack} cooldowns={skillCdUi} />
        <div className="max-w-md truncate rounded bg-black/60 px-3 py-1 text-[10px] text-amber-100/50">
          {info} · enemies {enemyCount}
        </div>
      </div>

      {/* Mini help — Danger Room chips */}
      <div className="absolute bottom-4 left-3 z-20 hidden max-w-xs rounded border border-white/10 bg-black/50 p-2 font-mono text-[9px] text-white/40 md:block">
        {DANGER_KEY_CHIPS.join(' · ')}
      </div>
    </div>
  );
}
