/**
 * Annihilate Demo — Warlords combat sandbox (grudge6 / Toon-RTS D1 heroes)
 *
 * 24 heroes (6 races × 4 classes) · weapon FBX packs · CharacterFSM · Cannon-ES
 * · BaseAi · CombatVfx · multi-mesh equipment wardrobe.
 *
 * Hotkeys SSOT: ROLE_HOTKEYS in `@/engine` RoleControls (Ctrl=block, 1=dash attack).
 * Stack / deps: docs/ANNIHILATE_GRUDGE6_STACK.md
 *
 * Console noise: "translate-page" / runtime.lastError = browser extensions, not engine.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { isPortalEmbedMode } from '@/lib/embed-mode';
import {
  CHARACTER_PREFABS,
  getPrefab,
  type CharacterPrefab,
  type ClassId,
} from '@shared/character-prefabs';
import type { EquipmentVisibilityMode } from '@shared/character-meshes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Swords, Users, ChevronDown } from 'lucide-react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import {
  GrudgeEngine,
  BaseCharacter,
  CharacterFSM,
  createFSM,
  RoleControls,
  ROLE_HOTKEYS,
  BaseAi,
  Attacker,
  CombatVfx,
  GameCamera,
  loadRaceWithEquipment,
  setRaceEquipmentMode,
  prefabFromRaceClass,
  GROUP_ROLE,
  GROUP_SCENE,
  GROUP_ENEMY,
  GROUP_ENEMY_ATTACKER,
  GROUP_ROLE_ATTACKER,
  GROUP_TRIGGER,
  CharacterOptions,
  CharacterRace,
  RACE_CONFIGS,
} from '@/engine';

// ─── Weapon Animation Packs ──────────────────────────────────────────────────

type WeaponType = 'sword-shield' | 'great-sword' | 'longbow' | 'magic-caster';

interface WeaponAnimMap {
  label: string;
  basePath: string;
  clips: Record<string, string>;
}

const WEAPON_PACKS: Record<WeaponType, WeaponAnimMap> = {
  'sword-shield': {
    label: '1H Sword & Shield',
    basePath: '/models/animations/sword-shield/',
    clips: {
      idle:       'sword and shield idle.fbx',
      running:    'sword and shield run.fbx',
      walk:       'sword and shield walk.fbx',
      punch:      'sword and shield attack.fbx',
      fist:       'sword and shield attack (2).fbx',
      strike:     'sword and shield slash.fbx',
      strikeEnd:  'sword and shield slash (2).fbx',
      block:      'sword and shield block idle.fbx',
      hit:        'sword and shield impact.fbx',
      jump:       'sword and shield jump.fbx',
      dashAttack: 'sword and shield kick.fbx',
      death:      'sword and shield death.fbx',
    },
  },
  'great-sword': {
    label: '2H Great Sword',
    basePath: '/models/animations/great-sword/',
    clips: {
      idle:       'great sword idle.fbx',
      running:    'great sword run.fbx',
      walk:       'great sword walk.fbx',
      punch:      'great sword attack.fbx',
      fist:       'great sword slash.fbx',
      strike:     'great sword slash (2).fbx',
      whirlwind:  'great sword high spin attack.fbx',
      block:      'great sword blocking.fbx',
      hit:        'great sword impact.fbx',
      jump:       'great sword jump.fbx',
      dashAttack: 'great sword kick.fbx',
      punchStart: 'great sword power up.fbx',
      death:      'two handed sword death.fbx',
    },
  },
  'longbow': {
    label: 'Longbow',
    basePath: '/models/animations/longbow/',
    clips: {
      idle:    'standing idle 01.fbx',
      running: 'standing run forward.fbx',
      walk:    'standing walk forward.fbx',
      fall:    'standing run back.fbx',
    },
  },
  'magic-caster': {
    label: 'Magic Caster',
    basePath: '/models/animations/magic-caster/',
    clips: {
      idle:    'standing idle.fbx',
      running: 'Standing Run Forward.fbx',
      walk:    'Standing Walk Forward.fbx',
      punch:   'Standing 1H Magic Attack 01.fbx',
      strike:  'Standing 2H Magic Area Attack 02.fbx',
      jump:    'Standing Jump.fbx',
      death:   'Standing React Death Backward.fbx',
      hit:     'Standing React Large From Front.fbx',
    },
  },
};

// ─── Character Presets (24 Warlords heroes from CHARACTER_PREFABS) ───────────

interface CharacterPreset {
  id: string;
  name: string;
  race: CharacterRace;
  classId: ClassId;
  weapon: WeaponType;
  tint: number;
  emissive: number;
  description: string;
  attackSpeed: number;
  speed: number;
  health: number;
  classColor: string;
  lore: string;
}

const CLASS_WEAPON: Record<ClassId, WeaponType> = {
  warrior: 'sword-shield',
  mage: 'magic-caster',
  ranger: 'longbow',
  worge: 'great-sword',
};

const RACE_TINT: Record<CharacterRace, { tint: number; emissive: number }> = {
  human: { tint: 0xc4a35a, emissive: 0x221a08 },
  elf: { tint: 0x7ec881, emissive: 0x082208 },
  dwarf: { tint: 0xb07843, emissive: 0x1a0e06 },
  orc: { tint: 0x5a8a4a, emissive: 0x0a1a06 },
  barbarian: { tint: 0xd4845a, emissive: 0x1a0a04 },
  undead: { tint: 0x8a7ecf, emissive: 0x0c0a1e },
};

const CLASS_STATS: Record<ClassId, { attackSpeed: number; speed: number; health: number }> = {
  warrior: { attackSpeed: 1.35, speed: 0.11, health: 120 },
  mage: { attackSpeed: 1.25, speed: 0.10, health: 85 },
  ranger: { attackSpeed: 1.7, speed: 0.13, health: 90 },
  worge: { attackSpeed: 1.45, speed: 0.125, health: 110 },
};

function prefabToPreset(p: CharacterPrefab): CharacterPreset {
  const race = p.race as CharacterRace;
  const tint = RACE_TINT[race] ?? RACE_TINT.human;
  const stats = CLASS_STATS[p.classId] ?? CLASS_STATS.warrior;
  const weapon = CLASS_WEAPON[p.classId] ?? 'sword-shield';
  return {
    id: p.id.replace(/_/g, '-'),
    name: p.name,
    race,
    classId: p.classId,
    weapon,
    tint: tint.tint,
    emissive: tint.emissive,
    description: `${WEAPON_PACKS[weapon]?.label ?? weapon} • ${p.faction}`,
    attackSpeed: stats.attackSpeed,
    speed: stats.speed * (RACE_CONFIGS[race]?.speedMult ?? 1),
    health: stats.health + (p.baseStats.VIT * 4) + (p.baseStats.STR * 2),
    classColor: p.classColor,
    lore: p.lore,
  };
}

const CHARACTER_PRESETS: CharacterPreset[] = CHARACTER_PREFABS.map(prefabToPreset);

// ─── Melee hitbox (Attacker + damage + VFX) ──────────────────────────────────

class MeleeHitbox extends Attacker {
  private _vfx: CombatVfx | null = null;
  private _damage = 14;
  private _onHit?: (target: BaseCharacter, amount: number) => void;
  private _lastHitAt = 0;

  constructor(opts: { isEnemy?: boolean; vfx?: CombatVfx; damage?: number; onHit?: (t: BaseCharacter, n: number) => void } = {}) {
    super({
      num: 1,
      collisionGroup: opts.isEnemy ? GROUP_ENEMY_ATTACKER : GROUP_ROLE_ATTACKER,
      collisionMask: opts.isEnemy
        ? (GROUP_ROLE | GROUP_ENEMY)
        : (GROUP_ENEMY | GROUP_ENEMY_ATTACKER),
      addToWorld: true,
    });
    this._vfx = opts.vfx ?? null;
    this._damage = opts.damage ?? 14;
    this._onHit = opts.onHit;
    // Sphere hit volume in front of the fist/blade
    this.body.addShape(new CANNON.Sphere(0.55));
  }

  setVfx(vfx: CombatVfx | null) {
    this._vfx = vfx;
  }

  update(_dt: number): void {
    if (!this.owner?.body) return;
    const o = this.owner;
    const reach = 1.15;
    const y = o.body.position.y + 0.35;
    this.body.position.set(
      o.body.position.x + o.facing.x * reach,
      y,
      o.body.position.z + o.facing.y * reach,
    );
    this.body.velocity.set(0, 0, 0);
  }

  collide(event: any, isBeginCollide: boolean): void {
    if (!isBeginCollide || !this.owner) return;
    if (!this.owner.service.hasTag('canDamage')) return;

    const target: BaseCharacter | null = event.body?.belongTo ?? null;
    if (!target || !target.isCharacter || target === this.owner) return;
    // Friendly fire: role only hits enemies, enemies only hit role
    if (this.owner.isRole && !target.isEnemy) return;
    if (this.owner.isEnemy && !target.isRole) return;

    const now = performance.now();
    if (now - this._lastHitAt < 180) return;
    this._lastHitAt = now;

    const charged = (this.owner as { chargedLevel?: number }).chargedLevel ?? 0;
    const dmg = this._damage * (1 + charged * 0.35);
    target.takeDamage(dmg);
    this._onHit?.(target, dmg);

    const pos = {
      x: target.body.position.x,
      y: target.body.position.y,
      z: target.body.position.z,
    };
    this._vfx?.burst(pos, 'hit', 32, 5.5);
    this._vfx?.ring(pos, 'slash', 0.9);
  }
}

// ─── Helper UI ───────────────────────────────────────────────────────────────

function ControlRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div>
      <span className="text-white">{keys}</span> {label}
    </div>
  );
}

function Dropdown({
  label, icon, items, onSelect, className = '',
}: {
  label: string;
  icon: React.ReactNode;
  items: { id: string; name: string; sub?: string }[];
  onSelect: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/70 border border-purple-500/40 text-purple-200 text-xs font-medium hover:bg-purple-900/40 hover:border-purple-400/60 transition-all">
        {icon} {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 min-w-[220px] rounded-lg bg-gray-900/95 border border-purple-500/30 shadow-xl shadow-black/50 backdrop-blur-sm overflow-hidden">
          {items.map((item) => (
            <button key={item.id} onClick={() => { onSelect(item.id); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-xs hover:bg-purple-800/30 transition-colors border-b border-gray-800/50 last:border-0">
              <div className="text-white font-medium">{item.name}</div>
              {item.sub && <div className="text-gray-400 text-[10px] mt-0.5">{item.sub}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthBar({ current, max, name, race }: { current: number; max: number; name: string; race: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="bg-black/60 rounded-lg px-3 py-2 border border-gray-700/50 min-w-[160px]">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-amber-300 font-bold">{name}</span>
        <span className="text-gray-400 capitalize">{race}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-gray-800">
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`,
            background: pct > 50 ? 'linear-gradient(90deg,#22c55e,#4ade80)' :
                        pct > 25 ? 'linear-gradient(90deg,#eab308,#facc15)' :
                                   'linear-gradient(90deg,#dc2626,#ef4444)' }} />
      </div>
      <div className="text-[9px] text-gray-500 mt-0.5 text-right">{current}/{max} HP</div>
    </div>
  );
}

// ─── GrudgeCharacter — configurable per-preset ───────────────────────────────

class GrudgeCharacter extends BaseCharacter {
  preset: CharacterPreset;
  /** Canonical Grudge6 prefab (equipment slots / class gear) */
  charPrefab: CharacterPrefab;
  /** Multi-mesh wardrobe mode — players default unarmed (Toon-RTS D1 rule) */
  equipmentMode: EquipmentVisibilityMode = 'unarmed';
  isRole = true;
  isEnemy = false;
  attackSpeed = 1.4;
  chargeAttackCoe = 2.0;
  chargedLevel = 0;
  whirlwindOneTurnDuration = 0.3;
  liftDistance = 3.7;
  airLiftVelocity = 1.5;
  climbContactSign = 1;
  detectorRadius = 8;
  hitbox: MeleeHitbox | null = null;
  vfx: CombatVfx | null = null;
  meshSourceUrl = '';

  private _tweenWhirlwind: any = null;
  private _timeoutLaunch: ReturnType<typeof setTimeout> | null = null;
  private _timeoutAirDash: ReturnType<typeof setTimeout> | null = null;

  constructor(preset: CharacterPreset, opts: CharacterOptions = {}) {
    super({
      position: opts.position ?? new THREE.Vector3(-2, 2, 0),
      collisionGroup: opts.collisionGroup ?? GROUP_ROLE,
      collisionMask: opts.collisionMask ?? (GROUP_SCENE | GROUP_ROLE | GROUP_ENEMY | GROUP_ENEMY_ATTACKER | GROUP_TRIGGER),
      race: preset.race,
    });
    this.preset = preset;
    this.charPrefab = prefabFromRaceClass(preset.race, preset.classId);
    this.attackSpeed = preset.attackSpeed;
    this.speed = preset.speed;
    this.health = preset.health;
    this.maxHealth = preset.health;
  }

  /** Switch wardrobe meshes: unarmed (default) vs class equipped gear. */
  setEquipmentMode(mode: EquipmentVisibilityMode) {
    if (!this.mesh) return;
    this.equipmentMode = mode;
    setRaceEquipmentMode(this.mesh, this.charPrefab, mode);
  }

  attachCombat(vfx: CombatVfx, onHit?: (t: BaseCharacter, n: number) => void) {
    this.vfx = vfx;
    this.hitbox?.destroy();
    this.hitbox = new MeleeHitbox({ vfx, damage: 16, onHit });
    this.hitbox.owner = this;
  }

  private _fxAttack(kind: 'slash' | 'magic' | 'charge' = 'slash') {
    if (!this.vfx || !this.body) return;
    const origin = { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z };
    this.vfx.slashArc(origin, this.facing.x, this.facing.y, kind);
  }

  private _fxDash() {
    if (!this.vfx || !this.body) return;
    this.vfx.burst(
      { x: this.body.position.x, y: this.body.position.y - 0.2, z: this.body.position.z },
      'dash',
      20,
      3.5,
    );
  }

  buildFSM(): CharacterFSM {
    return createFSM(
      {
        id: this.preset?.id ?? 'grudge-role',
        initial: 'loading',
        states: {
          loading: { on: { loaded: 'idle' } },
          idle:   { entry: 'playIdle', on: { run: 'run', attack: 'attackStartWithCharge', bash: 'bashStart', launch: 'launchStart', jump: 'jump', hit: 'hit', dash: 'dash', block: 'block', air: 'airIdle' } },
          block:  { entry: 'playBlock', on: { keyLUp: 'idle', hadouken: 'hadouken', shoryuken: 'shoryuken', ajejebloken: 'ajejebloken' } },
          hadouken:    { entry: 'playHadouken', on: { finish: 'idle', hit: 'hit', dash: 'dash' }, tags: ['canDamage'] },
          shoryuken:   { entry: 'playShoryuken', on: { finish: 'fall', hit: 'hit', dash: 'dash' }, tags: ['canDamage', 'canLaunch'] },
          ajejebloken: { entry: 'playAjejebloken', exit: 'exitAjejebloken', on: { hit: 'hit' }, after: { 2000: 'idle' }, tags: ['canDamage'] },
          run:  { entry: 'playRun', on: { stop: 'idle', attack: 'attackStartWithCharge', bash: 'bashStart', launch: 'launchStart', jump: 'jump', hit: 'hit', dash: 'dash', air: 'airIdle', block: 'block' }, tags: ['canMove'] },
          bashStart:              { entry: 'playBashStart', on: { finish: 'whirlwind', hit: 'hit', dash: 'dash', keyUUp: 'bashStartNotWhirlwind' } },
          bashStartNotWhirlwind:  { on: { finish: 'idle', hit: 'hit', dash: 'dash' } },
          attackStartWithCharge:  { entry: 'playAttackStart', on: { finish: 'charging', hit: 'hit', dash: 'dash', keyJUp: 'attackStart' } },
          charging:    { on: { keyJUp: 'attack', hit: 'hit', dash: 'dash' }, after: { 500: 'charged1' } },
          charged1:    { entry: 'playCharged1', on: { keyJUp: 'chargeAttack', hit: 'hit', dash: 'dash' }, after: { 500: 'charged2' } },
          charged2:    { entry: 'playCharged2', on: { keyJUp: 'chargeAttack', hit: 'hit', dash: 'dash' } },
          chargeAttack:       { entry: 'playChargeAttack', on: { finish: 'idle', attack: 'chargeFistStart', hit: 'hit', dash: 'dash' }, tags: ['canDamage'] },
          chargeFistStart:    { entry: 'playChargeFistStart', on: { finish: 'chargeFist', hit: 'hit', dash: 'dash' } },
          chargeFist:         { entry: 'playChargeFist', on: { finish: 'idle', attack: 'chargeStrikeStart', hit: 'hit', dash: 'dash' }, tags: ['canDamage'] },
          chargeStrikeStart:  { entry: 'playChargeStrikeStart', on: { finish: 'chargeStrike', hit: 'hit', dash: 'dash' } },
          chargeStrike:       { entry: 'playChargeStrike', on: { finish: 'chargeStrikeEnd', hit: 'hit', dash: 'dash' }, tags: ['canDamage', 'knockDown'] },
          chargeStrikeEnd:    { entry: 'playChargeStrikeEnd', on: { finish: 'idle', hit: 'hit', dash: 'dash' } },
          attackStart: { on: { finish: 'attack', hit: 'hit', dash: 'dash' } },
          attack:      { entry: 'playAttack', on: { finish: 'idle', attack: 'fistStart', hit: 'hit', dash: 'dash' }, tags: ['canDamage'] },
          launchStart:     { entry: 'playLaunchStart', on: { finish: 'launchWithJump', hit: 'hit', dash: 'dash', keyOUp: 'launch' }, tags: ['canDamage', 'canLaunch'] },
          launchWithJump:  { on: { finish: 'fall', hit: 'hit', dash: 'dash' }, tags: ['canDamage', 'canLaunch'] },
          launch:          { entry: 'playLaunch', on: { finish: 'idle', hit: 'hit', dash: 'dash' }, tags: ['canDamage', 'canLaunch'] },
          fistStart:   { entry: 'playFistStart', on: { finish: 'fist', hit: 'hit', dash: 'dash' } },
          fist:        { entry: 'playFist', on: { finish: 'idle', attack: 'strikeStart', hit: 'hit', dash: 'dash' }, tags: ['canDamage'] },
          strikeStart: { entry: 'playStrikeStart', on: { finish: 'strike', hit: 'hit', dash: 'dash' } },
          strike:      { entry: 'playStrike', on: { finish: 'strikeEnd', hit: 'hit', dash: 'dash' }, tags: ['canDamage', 'knockDown'] },
          strikeEnd:   { entry: 'playStrikeEnd', on: { finish: 'idle', hit: 'hit', dash: 'dash' } },
          jump:        { entry: ['playJump', 'jump'], on: { finish: 'fall', land: 'idle', attack: 'airAttack', bash: 'airBashStart', jump: 'doubleJump', hit: 'hit', dash: 'airDash', climb: 'climb' }, tags: ['canMove'] },
          airIdle:     { entry: 'playAirIdle', on: { land: 'idle', attack: 'airAttack', bash: 'airBashStart', jump: 'jump', hit: 'hit', dash: 'airDash', climb: 'climb' }, tags: ['canMove'] },
          fall:        { entry: 'playFall', on: { land: 'idle', attack: 'airAttack', bash: 'airBashStart', jump: 'doubleJump', hit: 'hit', dash: 'airDash', climb: 'climb' }, tags: ['canMove'] },
          doubleFall:  { entry: 'playFall', on: { land: 'idle', attack: 'airAttack', bash: 'airBashStart', hit: 'hit', dash: 'airDash', climb: 'climb' }, tags: ['canMove'] },
          dashFall:    { entry: 'playFall', on: { land: 'idle', bash: 'airBashStart', hit: 'hit', climb: 'climb' }, tags: ['canMove'] },
          airBashStart: { entry: 'playAirBashStart', on: { finish: 'airBash', hit: 'hit' } },
          airBash:      { entry: 'playAirBash', on: { finish: 'idle', hit: 'hit' }, tags: ['canDamage', 'knockDown'] },
          climb:        { entry: 'playClimb', exit: 'exitClimb', on: { jump: 'jump', land: 'idle' } },
          airAttack:    { entry: 'playAirAttack', on: { finish: 'doubleFall', attack: 'airFist' }, tags: ['canDamage'] },
          airFist:      { entry: 'playAirFist', on: { finish: 'doubleFall', attack: 'airStrike' }, tags: ['canDamage'] },
          airStrike:    { entry: 'playAirStrike', on: { finish: 'doubleFall' }, tags: ['canDamage'] },
          doubleJump:   { entry: ['playJump', 'jump'], on: { finish: 'doubleFall', land: 'idle', attack: 'airAttack', bash: 'airBashStart', hit: 'hit', dash: 'airDash', climb: 'climb' }, tags: ['canMove'] },
          hit:          { entry: 'playHit', on: { hit: 'hit', finish: { target: 'idle', cond: 'notAir' } } },
          dash:         { entry: 'playDash', on: { attack: 'dashAttack' }, after: { 300: 'idle' } },
          dashAttack:   { entry: 'playDashAttack', on: { finish: 'idle', hit: 'hit' }, tags: ['canDamage'] },
          airDash:      { entry: ['playAirDash', 'setMassZero'], exit: ['exitAirDash', 'restoreMass'], on: { finish: 'dashFall', land: 'idle', hit: 'hit', climb: 'climb', bash: 'airBashStart' } },
          whirlwind:    { entry: 'playWhirlwind', exit: 'exitWhirlwind', on: { keyUUp: 'attack', hit: 'hit', dash: 'dash' }, tags: ['canDamage'] },
        },
      },
      {
        actions: {
          playIdle:             () => { this.fadeToAction('idle'); this.chargedLevel = 0; },
          playRun:              () => this.fadeToAction('running'),
          playFall:             () => this.fadeToAction('fall', 0.3),
          playAirIdle:          () => this.fadeToAction('fall', 0.3),
          playBlock:            () => { this.fadeToAction('block'); this.vfx?.ring({ x: this.body.position.x, y: this.body.position.y - 0.5, z: this.body.position.z }, 'block', 0.7); },
          playBashStart:        () => { if (this.oaction['punchStart']) this.oaction['punchStart'].timeScale = this.attackSpeed; this.fadeToAction('punchStart'); },
          playAttackStart:      () => { if (this.oaction['punchStart']) this.oaction['punchStart'].timeScale = this.attackSpeed; this.fadeToAction('punchStart'); },
          playAttack:           () => { if (this.oaction['punch']) this.oaction['punch'].timeScale = this.attackSpeed; this.fadeToAction('punch', 0); this._fxAttack(this.preset.weapon === 'magic-caster' ? 'magic' : 'slash'); },
          playCharged1:         () => { this.chargedLevel = 1; this.vfx?.burst({ x: this.body.position.x, y: this.body.position.y + 0.5, z: this.body.position.z }, 'charge', 12, 2); },
          playCharged2:         () => { this.chargedLevel = 2; this.vfx?.burst({ x: this.body.position.x, y: this.body.position.y + 0.5, z: this.body.position.z }, 'charge', 18, 2.5); },
          playChargeAttack:     () => { if (this.oaction['punch']) this.oaction['punch'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('punch', 0); this._fxAttack('charge'); },
          playChargeFistStart:  () => { if (this.oaction['fistStart']) this.oaction['fistStart'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('fistStart'); },
          playChargeFist:       () => { if (this.oaction['fist']) this.oaction['fist'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('fist', 0); this._fxAttack('charge'); },
          playChargeStrikeStart:() => { if (this.oaction['strikeStart']) this.oaction['strikeStart'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('strikeStart'); },
          playChargeStrike:     () => { if (this.oaction['strike']) this.oaction['strike'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('strike', 0); this._fxAttack('charge'); },
          playChargeStrikeEnd:  () => { if (this.oaction['strikeEnd']) this.oaction['strikeEnd'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('strikeEnd', 0); },
          playFistStart:        () => { if (this.oaction['fistStart']) this.oaction['fistStart'].timeScale = this.attackSpeed; this.fadeToAction('fistStart'); },
          playFist:             () => { if (this.oaction['fist']) this.oaction['fist'].timeScale = this.attackSpeed; this.fadeToAction('fist', 0); this._fxAttack(); },
          playStrikeStart:      () => { if (this.oaction['strikeStart']) this.oaction['strikeStart'].timeScale = this.attackSpeed; this.fadeToAction('strikeStart'); },
          playStrike:           () => { if (this.oaction['strike']) this.oaction['strike'].timeScale = this.attackSpeed; this.fadeToAction('strike', 0); this._fxAttack(); },
          playStrikeEnd:        () => { if (this.oaction['strikeEnd']) this.oaction['strikeEnd'].timeScale = this.attackSpeed; this.fadeToAction('strikeEnd', 0); },
          playHadouken:         () => { if (this.oaction['punch']) this.oaction['punch'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('punch', 0); this._fxAttack('magic'); this.vfx?.burst({ x: this.body.position.x + this.facing.x * 1.5, y: this.body.position.y + 0.8, z: this.body.position.z + this.facing.y * 1.5 }, 'magic', 40, 7); },
          playShoryuken:        () => { if (this.oaction['strike']) this.oaction['strike'].timeScale = this.attackSpeed; this.fadeToAction('strike', 0); setTimeout(() => { this.body.velocity.y = 5; }, 150); this._fxAttack('charge'); },
          playLaunchStart:      () => {
            if (this.oaction['strike']) this.oaction['strike'].timeScale = this.attackSpeed;
            this.fadeToAction('strike', 0);
            this._fxAttack();
            this._timeoutLaunch = setTimeout(() => { this.body.position.y += this.liftDistance; this.body.velocity.y = 0; this.service.send('finish'); }, 150);
          },
          playLaunch:           () => { if (this._timeoutLaunch) clearTimeout(this._timeoutLaunch); },
          playDash:             () => {
            if (this.oaction['dash']) this.oaction['dash'].timeScale = 2;
            this.fadeToAction('dash');
            if (this.direction.lengthSq() > 0) this.facing.copy(this.direction);
            this.mesh.rotation.y = -this.facing.angle() + Math.PI / 2;
            this.tmpVec3.set(this.facing.x, 0, this.facing.y).normalize().multiplyScalar(15);
            this.body.velocity.x = this.tmpVec3.x; this.body.velocity.z = this.tmpVec3.z;
            this._fxDash();
          },
          playDashAttack:       () => { if (this.oaction['dashAttack']) { this.oaction['dashAttack'].timeScale = this.attackSpeed; this.fadeToAction('dashAttack'); } this._fxAttack(); },
          playAirDash:          () => {
            this.fadeToAction('fall', 0);
            this.tmpVec3.set(this.facing.x, 0, this.facing.y).normalize().multiplyScalar(11);
            this.body.velocity.x = this.tmpVec3.x; this.body.velocity.y = 0; this.body.velocity.z = this.tmpVec3.z;
            this._timeoutAirDash = setTimeout(() => this.service.send('finish'), 500);
            this._fxDash();
          },
          exitAirDash:          () => { if (this._timeoutAirDash) clearTimeout(this._timeoutAirDash); this.body.velocity.set(0, 0, 0); },
          playJump:             () => { this.fadeToAction('jump'); this.body.velocity.set(0, 0, 0); },
          jump:                 () => { this.body.velocity.y = 5.2; },
          playAirAttack:        () => { if (this.oaction['punch']) this.oaction['punch'].timeScale = this.attackSpeed; this.fadeToAction('punch', 0); this.body.velocity.y = this.airLiftVelocity; this._fxAttack(); },
          playAirFist:          () => { if (this.oaction['fist']) this.oaction['fist'].timeScale = this.attackSpeed; this.fadeToAction('fist', 0); this.body.velocity.y = this.airLiftVelocity; this._fxAttack(); },
          playAirStrike:        () => { if (this.oaction['strike']) this.oaction['strike'].timeScale = this.attackSpeed; this.fadeToAction('strike', 0); this.body.velocity.y = this.airLiftVelocity; this._fxAttack(); },
          playAirBashStart:     () => { if (this.oaction['jumpAttackStart']) { this.oaction['jumpAttackStart'].timeScale = this.attackSpeed; this.fadeToAction('jumpAttackStart'); } this.body.velocity.y = 20; },
          playAirBash:          () => { if (this.oaction['jumpAttack']) { this.oaction['jumpAttack'].timeScale = this.attackSpeed * 5; this.fadeToAction('jumpAttack'); } this.body.velocity.y = -this.body.position.y * 3.5; this._fxAttack('charge'); },
          playHit:              () => {
            if (this.oaction['hit']) { this.oaction['hit'].timeScale = 3; this.fadeToAction('hit'); }
            this.vfx?.burst({ x: this.body.position.x, y: this.body.position.y + 0.8, z: this.body.position.z }, 'hit', 16, 3);
          },
          playWhirlwind:        () => {
            this.fadeToAction('whirlwind', 0);
            this.vfx?.ring({ x: this.body.position.x, y: this.body.position.y - 0.4, z: this.body.position.z }, 'slash', 1.6);
            const start = Date.now(); const dur = this.whirlwindOneTurnDuration * 1000; const base = this.mesh.rotation.y;
            const step = () => { if (!this.service.matches('whirlwind')) return; const elapsed = (Date.now() - start) % dur; this.mesh.rotation.y = base + (elapsed / dur) * Math.PI * 2; this._tweenWhirlwind = requestAnimationFrame(step); };
            this._tweenWhirlwind = requestAnimationFrame(step);
          },
          exitWhirlwind:        () => { if (this._tweenWhirlwind) cancelAnimationFrame(this._tweenWhirlwind); },
          playClimb:            () => {
            const climbClip = ['climb', 'climbing', 'climbUp', 'ladder', 'walk', 'running', 'idle']
              .find((n) => this.oaction[n]);
            if (climbClip) {
              if (this.oaction[climbClip]) this.oaction[climbClip].timeScale = 1;
              this.fadeToAction(climbClip, 0.15);
            }
            this.body.mass = 0;
            this.body.velocity.set(0, 0, 0);
          },
          exitClimb:            () => { this.body.mass = this.mass; },
          playAjejebloken:      () => { this.fadeToAction('whirlwind', 0); this.vfx?.burst({ x: this.body.position.x, y: this.body.position.y, z: this.body.position.z }, 'magic', 36, 6); },
          exitAjejebloken:      () => { this.setFacing(this.facing.x, this.facing.y); },
          setMassZero:          () => { this.body.mass = 0; },
          restoreMass:          () => { this.body.mass = this.mass; },
        },
        guards: { notAir: () => !this.isAir },
      }
    );
  }

  destroy(): void {
    this.hitbox?.destroy();
    this.hitbox = null;
    super.destroy();
  }

  /**
   * Load Toon-RTS D1 multi-mesh race wardrobe.
   * Default visibility = **unarmed** (armor only) — never show all weapon meshes.
   */
  async load(callback?: () => void): Promise<void> {
    const engine = this._engine;
    try {
      const loaded = await loadRaceWithEquipment({
        race: this.preset.race,
        prefab: this.charPrefab,
        mode: 'unarmed',
        tint: this.preset.tint,
        emissive: this.preset.emissive,
        enemy: false,
        targetHeight: 1.75 * (RACE_CONFIGS[this.preset.race]?.bodyScale ?? 1),
      });
      this.mesh = loaded.scene;
      this.meshSourceUrl = loaded.sourceUrl;
      this.equipmentMode = loaded.mode;
      this.gltf = { scene: loaded.scene, animations: loaded.animations };
      engine.scene.add(this.mesh);
      this.mixer = new THREE.AnimationMixer(this.mesh);
      loaded.animations.forEach((clip) => {
        this.oaction[clip.name] = this.mixer.clipAction(clip);
      });
    } catch {
      // Last-resort Maria placeholder (no multi-mesh wardrobe)
      const gltf = await this._loadGltf('/models/maria/all.gltf');
      this.gltf = gltf;
      this.mesh = gltf.scene;
      engine.scene.add(this.mesh);
      this.mixer = new THREE.AnimationMixer(this.mesh);
      gltf.animations?.forEach((clip: THREE.AnimationClip) => {
        this.oaction[clip.name] = this.mixer.clipAction(clip);
      });
      this.meshSourceUrl = '/models/maria/all.gltf';
    }

    if (!this.oaction['idle'] || !this.oaction['running']) {
      try {
        const fallback = await this._loadGltf('/models/maria/all.gltf');
        fallback.animations.forEach((clip: THREE.AnimationClip) => {
          if (!this.oaction[clip.name]) this.oaction[clip.name] = this.mixer.clipAction(clip);
        });
      } catch { /* skip */ }
    }
    this._onLoaded('idle');
    this.setFacing(0, -1);
    callback?.();
  }

  /** Load FBX weapon animation pack — also equips class gear meshes (weapons visible). */
  async loadWeaponPack(weaponType: WeaponType): Promise<string[]> {
    const pack = WEAPON_PACKS[weaponType];
    if (!pack) return [];
    const fbxLoader = new FBXLoader();
    const loaded: string[] = [];
    for (const [actionName, fileName] of Object.entries(pack.clips)) {
      try {
        const fbx = await fbxLoader.loadAsync(pack.basePath + encodeURIComponent(fileName));
        if (fbx.animations.length > 0) {
          const clip = fbx.animations[0]; clip.name = actionName;
          if (this.oaction[actionName]) this.oaction[actionName].stop();
          this.oaction[actionName] = this.mixer.clipAction(clip);
          if (this.oneShotAnims.includes(actionName)) { this.oaction[actionName].loop = THREE.LoopOnce; this.oaction[actionName].clampWhenFinished = true; }
          loaded.push(actionName);
        }
      } catch { /* skip failed FBX loads */ }
    }
    // Weapon skill pack selected → show class equipment meshes (sword/shield/bow/staff)
    this.setEquipmentMode('equipped');
    if (loaded.includes('idle') && this.oaction['idle']) this.fadeToAction('idle');
    return loaded;
  }
}

// ─── GrudgeEnemy — AI-controlled ─────────────────────────────────────────────

class GrudgeEnemy extends BaseCharacter {
  preset: CharacterPreset;
  charPrefab: CharacterPrefab;
  equipmentMode: EquipmentVisibilityMode = 'equipped';
  isRole = false; isEnemy = true;
  attackSpeed = 1.4; chargeAttackCoe = 2.0; chargedLevel = 0;
  whirlwindOneTurnDuration = 0.3; liftDistance = 3.7; airLiftVelocity = 1.5;
  climbContactSign = 1; detectorRadius = 10;
  hitbox: MeleeHitbox | null = null;
  vfx: CombatVfx | null = null;

  constructor(preset: CharacterPreset, opts: CharacterOptions = {}) {
    super({
      position: opts.position ?? new THREE.Vector3(4, 2, 0),
      collisionGroup: GROUP_ENEMY,
      collisionMask: GROUP_SCENE | GROUP_ROLE | GROUP_ENEMY | GROUP_TRIGGER,
      race: preset.race,
    });
    this.preset = preset;
    this.charPrefab = prefabFromRaceClass(preset.race, preset.classId);
    this.attackSpeed = preset.attackSpeed;
    this.speed = preset.speed * 0.7;
    this.health = preset.health;
    this.maxHealth = preset.health;
  }

  attachCombat(vfx: CombatVfx, onHit?: (t: BaseCharacter, n: number) => void) {
    this.vfx = vfx;
    this.hitbox?.destroy();
    this.hitbox = new MeleeHitbox({ isEnemy: true, vfx, damage: 10, onHit });
    this.hitbox.owner = this;
  }

  buildFSM(): CharacterFSM {
    return createFSM(
      {
        id: `enemy-${this.preset?.id ?? 'enemy'}`, initial: 'loading',
        states: {
          loading: { on: { loaded: 'idle' } },
          idle:    { entry: 'playIdle', on: { run: 'run', attack: 'attack', hit: 'hit', air: 'airIdle' }, tags: ['canFacing'] },
          run:     { entry: 'playRun', on: { stop: 'idle', attack: 'attack', hit: 'hit', air: 'airIdle' }, tags: ['canMove', 'canFacing'] },
          attack:  { entry: 'playAttack', on: { finish: 'idle', hit: 'hit' }, tags: ['canDamage'] },
          hit:     { entry: 'playHit', on: { finish: 'idle', hit: 'hit' } },
          airIdle: { entry: 'playFall', on: { land: 'idle', hit: 'hit' }, tags: ['canMove', 'canFacing'] },
        },
      },
      {
        actions: {
          playIdle:   () => this.fadeToAction('idle'),
          playRun:    () => this.fadeToAction('running'),
          playAttack: () => {
            if (this.oaction['punch']) { this.oaction['punch'].timeScale = this.attackSpeed; this.fadeToAction('punch', 0); }
            this.vfx?.slashArc(
              { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z },
              this.facing.x, this.facing.y, 'slash',
            );
          },
          playHit:    () => {
            if (this.oaction['hit']) { this.oaction['hit'].timeScale = 3; this.fadeToAction('hit'); }
            this.vfx?.burst({ x: this.body.position.x, y: this.body.position.y + 0.6, z: this.body.position.z }, 'hit', 14, 3);
          },
          playFall:   () => this.fadeToAction('fall', 0.3),
        },
        guards: {},
      }
    );
  }

  /** AI spawns **equipped** with class gear (lane-hero style). */
  async load(callback?: () => void): Promise<void> {
    const engine = this._engine;
    try {
      const loaded = await loadRaceWithEquipment({
        race: this.preset.race,
        prefab: this.charPrefab,
        mode: 'equipped',
        tint: this.preset.tint,
        emissive: this.preset.emissive,
        enemy: true,
        targetHeight: 1.65 * (RACE_CONFIGS[this.preset.race]?.bodyScale ?? 1),
      });
      this.mesh = loaded.scene;
      this.equipmentMode = loaded.mode;
      this.gltf = { scene: loaded.scene, animations: loaded.animations };
      engine.scene.add(this.mesh);
      this.mixer = new THREE.AnimationMixer(this.mesh);
      loaded.animations.forEach((clip) => {
        this.oaction[clip.name] = this.mixer.clipAction(clip);
      });
    } catch {
      const gltf = await this._loadGltf('/models/maria/all.gltf');
      this.gltf = gltf;
      this.mesh = gltf.scene;
      this.mesh.scale.setScalar(0.95);
      engine.scene.add(this.mesh);
      this.mixer = new THREE.AnimationMixer(this.mesh);
      gltf.animations?.forEach((clip: THREE.AnimationClip) => {
        this.oaction[clip.name] = this.mixer.clipAction(clip);
      });
    }
    if (!this.oaction['idle'] || !this.oaction['running']) {
      try {
        const fb = await this._loadGltf('/models/maria/all.gltf');
        fb.animations.forEach((clip: THREE.AnimationClip) => {
          if (!this.oaction[clip.name]) this.oaction[clip.name] = this.mixer.clipAction(clip);
        });
      } catch { /* skip */ }
    }
    this._onLoaded('idle');
    this.setFacing(0, 1);
    callback?.();
  }

  destroy(): void {
    this.hitbox?.destroy();
    this.hitbox = null;
    if (this.health <= 0 && this.vfx && this.body) {
      this.vfx.burst({ x: this.body.position.x, y: this.body.position.y, z: this.body.position.z }, 'death', 40, 6);
    }
    super.destroy();
  }
}

// ─── React Page ──────────────────────────────────────────────────────────────

interface EnemyInstance { character: GrudgeEnemy; ai: BaseAi; preset: CharacterPreset; }

function resolveInitialPreset(heroParam: string | null): CharacterPreset {
  if (heroParam) {
    const dashed = heroParam.replace(/_/g, '-');
    const underscored = heroParam.replace(/-/g, '_');
    const exact = CHARACTER_PRESETS.find((p) => p.id === dashed || p.id === underscored);
    if (exact) return exact;

    const prefab = getPrefab(underscored) ?? getPrefab(dashed);
    if (prefab) {
      const mapped = CHARACTER_PRESETS.find((p) => p.id === prefab.id.replace(/_/g, '-'));
      if (mapped) return mapped;
      const raceClass = CHARACTER_PRESETS.find((p) => p.race === prefab.race && p.classId === prefab.classId);
      if (raceClass) return raceClass;
      const raceMatch = CHARACTER_PRESETS.find((p) => p.race === prefab.race);
      if (raceMatch) return raceMatch;
    }
  }
  return CHARACTER_PRESETS[0];
}

export default function AnnihilateDemo() {
  const [location] = useLocation();
  const embedMode = isPortalEmbedMode();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GrudgeEngine | null>(null);
  const roleRef = useRef<GrudgeCharacter | null>(null);
  const controlsRef = useRef<RoleControls | null>(null);
  const enemiesRef = useRef<EnemyInstance[]>([]);
  const vfxRef = useRef<CombatVfx | null>(null);
  const camRef = useRef<GameCamera | null>(null);

  const [fsmState, setFsmState] = useState('loading');
  const [loaded, setLoaded] = useState(false);
  const [activePreset, setActivePreset] = useState<CharacterPreset>(CHARACTER_PRESETS[0]);
  const [enemyCount, setEnemyCount] = useState(0);
  const [weaponPackLabel, setWeaponPackLabel] = useState('');
  const [loadingWeapon, setLoadingWeapon] = useState(false);
  const [info, setInfo] = useState('Initializing…');
  const [playerHealth, setPlayerHealth] = useState(100);
  const [playerMaxHealth, setPlayerMaxHealth] = useState(100);
  const [comboHits, setComboHits] = useState(0);
  const [equipmentMode, setEquipmentModeUi] = useState<EquipmentVisibilityMode>('unarmed');

  useEffect(() => {
    document.title = 'Annihilate Demo — Grudge Studio';
    return () => { document.title = 'Rec0deD:88 — Grudge Studio Gaming Portal'; };
  }, []);

  const spawnCharacter = useCallback(async (preset: CharacterPreset) => {
    const engine = engineRef.current;
    const vfx = vfxRef.current;
    if (!engine || !vfx) return;
    if (controlsRef.current) { controlsRef.current.destroy(); controlsRef.current = null; }
    if (roleRef.current) { roleRef.current.destroy(); roleRef.current = null; }
    setLoaded(false); setLoadingWeapon(true);
    setInfo(`Loading ${preset.name}…`); setFsmState('loading');
    const character = new GrudgeCharacter(preset, { position: new THREE.Vector3(-2, 2, 0) });
    try {
      await character.load();
      character.enableFootIK();
      character.attachCombat(vfx, (_t, _n) => {
        setComboHits((c) => c + 1);
        camRef.current?.shake(0.22);
      });
      const controls = new RoleControls(character);
      controlsRef.current = controls;
      roleRef.current = character;
      engine.setRole(character);
      camRef.current?.setTarget(character.mesh);
      character.service.onTransition((state: string) => setFsmState(state));
      setPlayerHealth(character.health);
      setPlayerMaxHealth(character.maxHealth);

      setEquipmentModeUi(character.equipmentMode);
      setInfo(`Loading ${WEAPON_PACKS[preset.weapon]?.label ?? preset.weapon} animations…`);
      const loadedClips = await character.loadWeaponPack(preset.weapon);
      setEquipmentModeUi(character.equipmentMode);
      setActivePreset(preset);
      setWeaponPackLabel(WEAPON_PACKS[preset.weapon]?.label || '');
      setLoadingWeapon(false);
      setLoaded(true);
      setInfo(
        loadedClips.length > 0
          ? `${preset.name} • ${character.meshSourceUrl.includes('toon-rts') ? 'Toon-RTS D1' : 'local'} • ${character.equipmentMode} • ${WEAPON_PACKS[preset.weapon]?.label} (${loadedClips.length} clips)`
          : `${preset.name} • ${character.equipmentMode} wardrobe • embedded anims`,
      );
    } catch (err) {
      console.error('[AnnihilateDemo] character load failed', err);
      setLoadingWeapon(false);
      setInfo(`Failed to load ${preset.name}. Check /models/grudge assets and retry.`);
    }
  }, []);

  const spawnEnemy = useCallback(async (presetId: string) => {
    const engine = engineRef.current; const role = roleRef.current; const vfx = vfxRef.current;
    if (!engine || !role || !vfx) return;
    const preset = CHARACTER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const angle = Math.random() * Math.PI * 2; const dist = 6 + Math.random() * 4;
    const pos = new THREE.Vector3(role.body.position.x + Math.cos(angle) * dist, 2, role.body.position.z + Math.sin(angle) * dist);
    const enemy = new GrudgeEnemy(preset, { position: pos });
    await enemy.load(() => {
      enemy.enableFootIK();
      enemy.attachCombat(vfx, (target) => {
        if (target.isRole) {
          setPlayerHealth(target.health);
          camRef.current?.shake(0.35);
        }
      });
      const ai = new BaseAi(enemy, 1.5);
      enemiesRef.current.push({ character: enemy, ai, preset });
      setEnemyCount(enemiesRef.current.length);
      vfx.ring({ x: pos.x, y: 0.1, z: pos.z }, 'magic', 1.2);
    });
  }, []);

  const switchWeaponPack = useCallback(async (weaponType: WeaponType) => {
    const role = roleRef.current; if (!role) return;
    setLoadingWeapon(true); setInfo(`Loading ${WEAPON_PACKS[weaponType].label} animations…`);
    const result = await role.loadWeaponPack(weaponType);
    setWeaponPackLabel(WEAPON_PACKS[weaponType].label); setLoadingWeapon(false);
    setInfo(result.length > 0 ? `${WEAPON_PACKS[weaponType].label} — ${result.length} clips loaded` : `${WEAPON_PACKS[weaponType].label} — using fallback anims`);
  }, []);

  const clearEnemies = useCallback(() => {
    for (const e of enemiesRef.current) { e.ai.destroy(); e.character.destroy(); }
    enemiesRef.current = []; setEnemyCount(0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.style.width = '100%'; canvas.style.height = '100%';
    canvas.width = canvas.clientWidth || window.innerWidth;
    canvas.height = canvas.clientHeight || window.innerHeight;
    const engine = GrudgeEngine.getInstance();
    engine.init(canvas); engine.addGround(0x1e1030, 80); engineRef.current = engine;

    // Combat VFX + camera (best engine systems)
    const vfx = new CombatVfx(engine.scene);
    vfxRef.current = vfx;
    engine.addToUpdate(vfx);

    const cam = GameCamera.getInstance(engine.camera);
    cam.setMode('ISOMETRIC');
    cam.configure({ distance: 14, height: 12, lerpAlpha: 0.1, fov: 48 });
    camRef.current = cam;
    engine.addToUpdate(cam);

    // Atmosphere — torch-like fill lights around arena
    const torchA = new THREE.PointLight(0xff6622, 1.2, 28);
    torchA.position.set(8, 4, 6);
    engine.scene.add(torchA);
    const torchB = new THREE.PointLight(0x6644ff, 0.9, 24);
    torchB.position.set(-9, 3.5, -5);
    engine.scene.add(torchB);

    // ── Test obstacles for the movement fixes ──────────────────────────────
    engine.addBox({ size: [10, 0.5, 6], position: [11, 1.1, 0], rotation: [0, 0, -0.3], color: 0x24407a });
    engine.addBox({ size: [6, 4, 6], position: [-11, 2, 0], color: 0x47307a });
    engine.addBox({ size: [4, 0.7, 4], position: [-3.5, 0.35, 5], color: 0x33235e });

    engine.start();

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'grudge:game:ready', game: 'annihilate-demo' }, '*');
    }

    const heroParam = new URLSearchParams(location.split('?')[1] ?? '').get('hero');
    spawnCharacter(resolveInitialPreset(heroParam));

    // Keep HP bar in sync while player takes damage from AI
    const hpPoll = window.setInterval(() => {
      const role = roleRef.current;
      if (role) setPlayerHealth(role.health);
      // Cull dead enemies
      const before = enemiesRef.current.length;
      enemiesRef.current = enemiesRef.current.filter((e) => {
        if (e.character.health > 0) return true;
        e.ai.destroy();
        e.character.destroy();
        return false;
      });
      if (enemiesRef.current.length !== before) setEnemyCount(enemiesRef.current.length);
    }, 200);

    const ro = new ResizeObserver(() => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = c.clientWidth || window.innerWidth;
      c.height = c.clientHeight || window.innerHeight;
      engine.renderer.setSize(c.width, c.height);
      engine.camera.aspect = c.width / c.height;
      engine.camera.updateProjectionMatrix();
    });
    ro.observe(canvas);

    return () => {
      window.clearInterval(hpPoll);
      ro.disconnect();
      clearEnemies();
      controlsRef.current?.destroy();
      roleRef.current?.destroy();
      vfx.destroy();
      vfxRef.current = null;
      cam.destroy();
      camRef.current = null;
      engine.destroy();
      engineRef.current = null;
    };
  }, [location, spawnCharacter, clearEnemies]); // eslint-disable-line react-hooks/exhaustive-deps

  const characterItems = CHARACTER_PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    sub: p.description,
  }));
  const enemyItems = [
    ...CHARACTER_PRESETS.map((p) => ({
      id: p.id,
      name: `Spawn ${p.name}`,
      sub: `${RACE_CONFIGS[p.race].name} • ${WEAPON_PACKS[p.weapon]?.label}`,
    })),
    { id: '__clear__', name: '✕ Clear All Enemies', sub: 'Remove all spawned enemies' },
  ];
  const weaponItems = (Object.entries(WEAPON_PACKS) as [WeaponType, WeaponAnimMap][]).map(([id, pack]) => ({
    id, name: pack.label, sub: `${Object.keys(pack.clips).length} animation clips`,
  }));

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-950">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 p-3 flex-wrap">
        {!embedMode && (
          <>
            <Link href="/super-engine">
              <Button variant="outline" size="sm" className="border-purple-500/50 text-purple-300 hover:bg-purple-900/30 bg-black/60 h-9">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </Link>
            <div className="h-6 w-px bg-purple-500/20" />
          </>
        )}
        <Dropdown label={activePreset.name} icon={<Swords className="w-3.5 h-3.5" />} items={characterItems}
          onSelect={(id) => { const p = CHARACTER_PRESETS.find((c) => c.id === id); if (p) spawnCharacter(p); }} />
        <Dropdown label={`Enemies (${enemyCount})`} icon={<Users className="w-3.5 h-3.5" />} items={enemyItems}
          onSelect={(id) => { if (id === '__clear__') { clearEnemies(); return; } spawnEnemy(id); }} />
        <Dropdown label={loadingWeapon ? 'Loading…' : (weaponPackLabel || 'Weapon Anims')} icon={<Swords className="w-3.5 h-3.5" />}
          items={weaponItems} onSelect={(id) => switchWeaponPack(id as WeaponType)} />
        {loaded && (
          <button
            type="button"
            onClick={() => {
              const role = roleRef.current;
              if (!role) return;
              const next: EquipmentVisibilityMode = role.equipmentMode === 'unarmed' ? 'equipped' : 'unarmed';
              role.setEquipmentMode(next);
              setEquipmentModeUi(next);
              setInfo(`${role.preset.name} • mesh wardrobe: ${next}`);
            }}
            className="px-3 py-2 rounded-lg bg-black/70 border border-amber-500/40 text-amber-200 text-xs font-medium hover:bg-amber-900/30"
            title="Toggle Toon-RTS multi-mesh equipment visibility"
          >
            Gear: {equipmentMode}
          </button>
        )}
        <div className="flex-1" />
        <div className="flex flex-col items-end gap-1">
          <div className="bg-black/70 px-3 py-1 rounded text-xs font-mono text-green-400">
            State: <span className="text-white">{fsmState}</span>
            {comboHits > 0 && <span className="ml-2 text-amber-300">Hits {comboHits}</span>}
          </div>
          <div className="bg-black/70 px-3 py-1 rounded text-[10px] text-gray-400 max-w-xs truncate">{info}</div>
        </div>
      </div>

      {/* ── Health bar ─────────────────────────────────────────────────── */}
      {loaded && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
          <HealthBar current={playerHealth} max={playerMaxHealth} name={activePreset.name} race={activePreset.race} />
        </div>
      )}

      {/* ── Loading overlay ────────────────────────────────────────────── */}
      {!loaded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-950/90">
          <div className="text-center">
            <div className="text-4xl font-black text-purple-400 mb-3 animate-pulse">GRUDGE ENGINE</div>
            <div className="text-gray-400">{info}</div>
          </div>
        </div>
      )}

      {/* ── Controls legend (SSOT = ROLE_HOTKEYS) ─────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20 bg-black/70 rounded-lg px-4 py-3 text-xs text-gray-400 space-y-0.5 max-h-[46vh] overflow-y-auto">
        <div className="text-purple-300 font-bold mb-1">GRUDGE6 — Controls</div>
        {ROLE_HOTKEYS.map((row) => (
          <ControlRow key={row.keys + row.label} keys={row.keys} label={row.label} />
        ))}
        <ControlRow keys="Jump→Wall + W" label="Climb wall / mantle ledge" />
        <div className="pt-1 text-[9px] text-gray-600 max-w-[220px]">
          Select a hero (right list) · Gear toggles multi-mesh · Weapon packs reload clips
        </div>
      </div>

      {/* ── Character roster (24 heroes, scrollable) ───────────────────── */}
      {loaded && (
        <div className="absolute bottom-4 right-4 z-20 w-[240px] max-h-[42vh] overflow-y-auto flex flex-col gap-1 items-stretch pr-1">
          {CHARACTER_PRESETS.map((p) => (
            <button key={p.id} onClick={() => spawnCharacter(p)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all text-left ${
                activePreset.id === p.id
                  ? 'bg-purple-800/60 border border-purple-400/50 text-white'
                  : 'bg-black/50 border border-gray-700/30 text-gray-400 hover:bg-purple-900/30 hover:text-white'
              }`}>
              <div className="w-3 h-3 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: p.classColor || `#${p.tint.toString(16).padStart(6, '0')}` }} />
              <span className="font-medium truncate flex-1">{p.name}</span>
              <span className="text-[9px] text-gray-500 capitalize shrink-0">{p.classId}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Feature badges ─────────────────────────────────────────────── */}
      {loaded && (
        <div className="absolute top-20 right-4 z-10 flex flex-col gap-1 items-end">
          {['Toon-RTS D1 multi-mesh', 'Unarmed default', 'Class equip meshes', 'CombatVfx + Hitboxes', 'CharacterFSM Combos', '24 Warlords Heroes'].map((f) => (
            <Badge key={f} className="bg-purple-900/60 text-purple-300 text-[10px] border-purple-500/20">{f}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
