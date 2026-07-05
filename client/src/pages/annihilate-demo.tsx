/**
 * Annihilate Demo — 6 Grudge Race Characters
 *
 * Loads any of the 6 Grudge faction characters (Human, Elf, Dwarf, Orc,
 * Barbarian, Undead) with weapon-type-specific loadouts and the full
 * XState-style FSM from the Grudge Engine annihilate core.
 *
 * Features:
 *   - Character Select dropdown (6 races with different loadouts)
 *   - Add Enemy dropdown (spawn AI enemies of any race)
 *   - Weapon Animation dropdown (swap FBX weapon skill packs at runtime)
 *   - Full FSM combat: combo attacks, charge, block, dash, jump, whirlwind
 *
 * Controls (Grudge standard):
 *   WASD              — move
 *   LMB               — light attack (3-hit combo)
 *   RMB               — heavy attack / bash / whirlwind
 *   Space             — jump / double jump
 *   Shift             — dash
 *   1                 — block (hold for combos)
 *   2                 — launch (uppercut)
 *   3                 — bash (keyboard alt)
 *   Block + ↓→LMB     — hadouken
 *   Block + →↓→LMB    — shoryuken
 *   Block + ↓←Space   — ajejebloken
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { getPrefab } from '@shared/character-prefabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Swords, Users, ChevronDown } from 'lucide-react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import {
  GrudgeEngine,
  BaseCharacter,
  CharacterFSM,
  createFSM,
  RoleControls,
  BaseAi,
  GROUP_ROLE,
  GROUP_SCENE,
  GROUP_ENEMY,
  GROUP_ENEMY_ATTACKER,
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

// ─── Character Presets ───────────────────────────────────────────────────────

interface CharacterPreset {
  id: string;
  name: string;
  race: CharacterRace;
  weapon: WeaponType;
  tint: number;
  emissive: number;
  description: string;
  attackSpeed: number;
  speed: number;
  health: number;
}

const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'human-warrior', name: 'Human Warrior', race: 'human',
    weapon: 'sword-shield', tint: 0xc4a35a, emissive: 0x221a08,
    description: 'Sword & Shield • Balanced',
    attackSpeed: 1.4, speed: 0.11, health: 100,
  },
  {
    id: 'elf-ranger', name: 'Elf Ranger', race: 'elf',
    weapon: 'longbow', tint: 0x7ec881, emissive: 0x082208,
    description: 'Longbow • Fast & Agile',
    attackSpeed: 1.8, speed: 0.13, health: 80,
  },
  {
    id: 'dwarf-guardian', name: 'Dwarf Guardian', race: 'dwarf',
    weapon: 'great-sword', tint: 0xb07843, emissive: 0x1a0e06,
    description: '2H Great Sword • Heavy Tank',
    attackSpeed: 1.0, speed: 0.09, health: 130,
  },
  {
    id: 'orc-berserker', name: 'Orc Berserker', race: 'orc',
    weapon: 'great-sword', tint: 0x5a8a4a, emissive: 0x0a1a06,
    description: '2H Great Sword • Raw Power',
    attackSpeed: 1.2, speed: 0.10, health: 120,
  },
  {
    id: 'barbarian-warlord', name: 'Barbarian Warlord', race: 'barbarian',
    weapon: 'sword-shield', tint: 0xd4845a, emissive: 0x1a0a04,
    description: 'Sword & Shield • Relentless',
    attackSpeed: 1.6, speed: 0.12, health: 110,
  },
  {
    id: 'undead-mage', name: 'Undead Mage', race: 'undead',
    weapon: 'magic-caster', tint: 0x8a7ecf, emissive: 0x0c0a1e,
    description: 'Magic Staff • Dark Arts',
    attackSpeed: 1.3, speed: 0.10, health: 85,
  },
];

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
    this.attackSpeed = preset.attackSpeed;
    this.speed = preset.speed;
    this.health = preset.health;
    this.maxHealth = preset.health;
  }

  buildFSM(): CharacterFSM {
    return createFSM(
      {
        id: this.preset.id,
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
          playBlock:            () => this.fadeToAction('block'),
          playBashStart:        () => { if (this.oaction['punchStart']) this.oaction['punchStart'].timeScale = this.attackSpeed; this.fadeToAction('punchStart'); },
          playAttackStart:      () => { if (this.oaction['punchStart']) this.oaction['punchStart'].timeScale = this.attackSpeed; this.fadeToAction('punchStart'); },
          playAttack:           () => { if (this.oaction['punch']) this.oaction['punch'].timeScale = this.attackSpeed; this.fadeToAction('punch', 0); },
          playCharged1:         () => { this.chargedLevel = 1; },
          playCharged2:         () => { this.chargedLevel = 2; },
          playChargeAttack:     () => { if (this.oaction['punch']) this.oaction['punch'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('punch', 0); },
          playChargeFistStart:  () => { if (this.oaction['fistStart']) this.oaction['fistStart'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('fistStart'); },
          playChargeFist:       () => { if (this.oaction['fist']) this.oaction['fist'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('fist', 0); },
          playChargeStrikeStart:() => { if (this.oaction['strikeStart']) this.oaction['strikeStart'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('strikeStart'); },
          playChargeStrike:     () => { if (this.oaction['strike']) this.oaction['strike'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('strike', 0); },
          playChargeStrikeEnd:  () => { if (this.oaction['strikeEnd']) this.oaction['strikeEnd'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('strikeEnd', 0); },
          playFistStart:        () => { if (this.oaction['fistStart']) this.oaction['fistStart'].timeScale = this.attackSpeed; this.fadeToAction('fistStart'); },
          playFist:             () => { if (this.oaction['fist']) this.oaction['fist'].timeScale = this.attackSpeed; this.fadeToAction('fist', 0); },
          playStrikeStart:      () => { if (this.oaction['strikeStart']) this.oaction['strikeStart'].timeScale = this.attackSpeed; this.fadeToAction('strikeStart'); },
          playStrike:           () => { if (this.oaction['strike']) this.oaction['strike'].timeScale = this.attackSpeed; this.fadeToAction('strike', 0); },
          playStrikeEnd:        () => { if (this.oaction['strikeEnd']) this.oaction['strikeEnd'].timeScale = this.attackSpeed; this.fadeToAction('strikeEnd', 0); },
          playHadouken:         () => { if (this.oaction['punch']) this.oaction['punch'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('punch', 0); },
          playShoryuken:        () => { if (this.oaction['strike']) this.oaction['strike'].timeScale = this.attackSpeed; this.fadeToAction('strike', 0); setTimeout(() => { this.body.velocity.y = 5; }, 150); },
          playLaunchStart:      () => {
            if (this.oaction['strike']) this.oaction['strike'].timeScale = this.attackSpeed;
            this.fadeToAction('strike', 0);
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
          },
          playDashAttack:       () => { if (this.oaction['dashAttack']) { this.oaction['dashAttack'].timeScale = this.attackSpeed; this.fadeToAction('dashAttack'); } },
          playAirDash:          () => {
            this.fadeToAction('fall', 0);
            this.tmpVec3.set(this.facing.x, 0, this.facing.y).normalize().multiplyScalar(11);
            this.body.velocity.x = this.tmpVec3.x; this.body.velocity.y = 0; this.body.velocity.z = this.tmpVec3.z;
            this._timeoutAirDash = setTimeout(() => this.service.send('finish'), 500);
          },
          exitAirDash:          () => { if (this._timeoutAirDash) clearTimeout(this._timeoutAirDash); this.body.velocity.set(0, 0, 0); },
          playJump:             () => { this.fadeToAction('jump'); this.body.velocity.set(0, 0, 0); },
          jump:                 () => { this.body.velocity.y = 5.2; },
          playAirAttack:        () => { if (this.oaction['punch']) this.oaction['punch'].timeScale = this.attackSpeed; this.fadeToAction('punch', 0); this.body.velocity.y = this.airLiftVelocity; },
          playAirFist:          () => { if (this.oaction['fist']) this.oaction['fist'].timeScale = this.attackSpeed; this.fadeToAction('fist', 0); this.body.velocity.y = this.airLiftVelocity; },
          playAirStrike:        () => { if (this.oaction['strike']) this.oaction['strike'].timeScale = this.attackSpeed; this.fadeToAction('strike', 0); this.body.velocity.y = this.airLiftVelocity; },
          playAirBashStart:     () => { if (this.oaction['jumpAttackStart']) { this.oaction['jumpAttackStart'].timeScale = this.attackSpeed; this.fadeToAction('jumpAttackStart'); } this.body.velocity.y = 20; },
          playAirBash:          () => { if (this.oaction['jumpAttack']) { this.oaction['jumpAttack'].timeScale = this.attackSpeed * 5; this.fadeToAction('jumpAttack'); } this.body.velocity.y = -this.body.position.y * 3.5; },
          playHit:              () => { if (this.oaction['hit']) { this.oaction['hit'].timeScale = 3; this.fadeToAction('hit'); } },
          playWhirlwind:        () => {
            this.fadeToAction('whirlwind', 0);
            const start = Date.now(); const dur = this.whirlwindOneTurnDuration * 1000; const base = this.mesh.rotation.y;
            const step = () => { if (!this.service.matches('whirlwind')) return; const elapsed = (Date.now() - start) % dur; this.mesh.rotation.y = base + (elapsed / dur) * Math.PI * 2; this._tweenWhirlwind = requestAnimationFrame(step); };
            this._tweenWhirlwind = requestAnimationFrame(step);
          },
          exitWhirlwind:        () => { if (this._tweenWhirlwind) cancelAnimationFrame(this._tweenWhirlwind); },
          playClimb:            () => {
            // Use a real climbing/locomotion clip so the character isn't frozen
            // on the wall. Falls back gracefully when a model lacks a climb clip.
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
          playAjejebloken:      () => { this.fadeToAction('whirlwind', 0); },
          exitAjejebloken:      () => { this.setFacing(this.facing.x, this.facing.y); },
          setMassZero:          () => { this.body.mass = 0; },
          restoreMass:          () => { this.body.mass = this.mass; },
        },
        guards: { notAir: () => !this.isAir },
      }
    );
  }

  async load(callback?: () => void): Promise<void> {
    const engine = this._engine;
    let gltf: any;
    try {
      gltf = await this._loadGltf(`/models/grudge/${this.preset.race}.glb`);
    } catch {
      gltf = await this._loadGltf('/models/maria/all.gltf');
    }
    this.gltf = gltf;
    this.mesh = gltf.scene;

    // Apply race color tint
    this.mesh.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true; child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          if (child.material.color) child.material.color.lerp(new THREE.Color(this.preset.tint), 0.35);
          if (child.material.emissive) child.material.emissive.set(this.preset.emissive);
        }
      }
    });
    engine.scene.add(this.mesh);
    this.mixer = new THREE.AnimationMixer(this.mesh);
    if (gltf.animations?.length > 0) {
      gltf.animations.forEach((clip: THREE.AnimationClip) => { this.oaction[clip.name] = this.mixer.clipAction(clip); });
    }
    // Fallback to Maria animations if GLB has none
    if (!this.oaction['idle'] || !this.oaction['running']) {
      try {
        const fallback = await this._loadGltf('/models/maria/all.gltf');
        fallback.animations.forEach((clip: THREE.AnimationClip) => { if (!this.oaction[clip.name]) this.oaction[clip.name] = this.mixer.clipAction(clip); });
      } catch { /* skip */ }
    }
    this._onLoaded('idle');
    this.setFacing(0, -1);
    callback?.();
  }

  /** Load FBX weapon animation pack — overrides matching action clips */
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
    if (loaded.includes('idle') && this.oaction['idle']) this.fadeToAction('idle');
    return loaded;
  }
}

// ─── GrudgeEnemy — AI-controlled ─────────────────────────────────────────────

class GrudgeEnemy extends BaseCharacter {
  preset: CharacterPreset;
  isRole = false; isEnemy = true;
  attackSpeed = 1.4; chargeAttackCoe = 2.0; chargedLevel = 0;
  whirlwindOneTurnDuration = 0.3; liftDistance = 3.7; airLiftVelocity = 1.5;
  climbContactSign = 1; detectorRadius = 10;

  constructor(preset: CharacterPreset, opts: CharacterOptions = {}) {
    super({
      position: opts.position ?? new THREE.Vector3(4, 2, 0),
      collisionGroup: GROUP_ENEMY,
      collisionMask: GROUP_SCENE | GROUP_ROLE | GROUP_ENEMY | GROUP_TRIGGER,
      race: preset.race,
    });
    this.preset = preset;
    this.attackSpeed = preset.attackSpeed;
    this.speed = preset.speed * 0.7;
    this.health = preset.health;
    this.maxHealth = preset.health;
  }

  buildFSM(): CharacterFSM {
    return createFSM(
      {
        id: `enemy-${this.preset.id}`, initial: 'loading',
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
          playAttack: () => { if (this.oaction['punch']) { this.oaction['punch'].timeScale = this.attackSpeed; this.fadeToAction('punch', 0); } },
          playHit:    () => { if (this.oaction['hit']) { this.oaction['hit'].timeScale = 3; this.fadeToAction('hit'); } },
          playFall:   () => this.fadeToAction('fall', 0.3),
        },
        guards: {},
      }
    );
  }

  async load(callback?: () => void): Promise<void> {
    const engine = this._engine;
    let gltf: any;
    try { gltf = await this._loadGltf(`/models/grudge/${this.preset.race}.glb`); }
    catch { gltf = await this._loadGltf('/models/maria/all.gltf'); }
    this.gltf = gltf; this.mesh = gltf.scene;
    this.mesh.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true; child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          if (child.material.color) { child.material.color.lerp(new THREE.Color(this.preset.tint), 0.3); child.material.color.lerp(new THREE.Color(0xff2200), 0.15); }
          if (child.material.emissive) child.material.emissive.set(0x1a0400);
        }
      }
    });
    this.mesh.scale.setScalar(0.95);
    engine.scene.add(this.mesh);
    this.mixer = new THREE.AnimationMixer(this.mesh);
    if (gltf.animations?.length > 0) gltf.animations.forEach((clip: THREE.AnimationClip) => { this.oaction[clip.name] = this.mixer.clipAction(clip); });
    if (!this.oaction['idle'] || !this.oaction['running']) {
      try {
        const fb = await this._loadGltf('/models/maria/all.gltf');
        fb.animations.forEach((clip: THREE.AnimationClip) => { if (!this.oaction[clip.name]) this.oaction[clip.name] = this.mixer.clipAction(clip); });
      } catch { /* skip */ }
    }
    this._onLoaded('idle');
    this.setFacing(0, 1);
    callback?.();
  }
}

// ─── React Page ──────────────────────────────────────────────────────────────

interface EnemyInstance { character: GrudgeEnemy; ai: BaseAi; preset: CharacterPreset; }

function resolveInitialPreset(heroParam: string | null): CharacterPreset {
  if (heroParam) {
    const dashed = heroParam.replace(/_/g, '-');
    const exact = CHARACTER_PRESETS.find((p) => p.id === dashed);
    if (exact) return exact;

    const prefab = getPrefab(heroParam);
    if (prefab) {
      const raceMatch = CHARACTER_PRESETS.find((p) => p.race === prefab.race);
      if (raceMatch) return raceMatch;
    }
  }
  return CHARACTER_PRESETS[0];
}

export default function AnnihilateDemo() {
  const [location] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GrudgeEngine | null>(null);
  const roleRef = useRef<GrudgeCharacter | null>(null);
  const controlsRef = useRef<RoleControls | null>(null);
  const enemiesRef = useRef<EnemyInstance[]>([]);

  const [fsmState, setFsmState] = useState('loading');
  const [loaded, setLoaded] = useState(false);
  const [activePreset, setActivePreset] = useState<CharacterPreset>(CHARACTER_PRESETS[0]);
  const [enemyCount, setEnemyCount] = useState(0);
  const [weaponPackLabel, setWeaponPackLabel] = useState('');
  const [loadingWeapon, setLoadingWeapon] = useState(false);
  const [info, setInfo] = useState('Initializing…');
  const [playerHealth, setPlayerHealth] = useState(100);
  const [playerMaxHealth, setPlayerMaxHealth] = useState(100);

  useEffect(() => {
    document.title = 'Annihilate Demo — Grudge Studio';
    return () => { document.title = 'Rec0deD:88 — Grudge Studio Gaming Portal'; };
  }, []);

  const spawnCharacter = useCallback(async (preset: CharacterPreset) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (controlsRef.current) { controlsRef.current.destroy(); controlsRef.current = null; }
    if (roleRef.current) { roleRef.current.destroy(); roleRef.current = null; }
    setLoaded(false); setLoadingWeapon(true);
    setInfo(`Loading ${preset.name}…`); setFsmState('loading');
    const character = new GrudgeCharacter(preset, { position: new THREE.Vector3(-2, 2, 0) });
    try {
      await character.load();
      character.enableFootIK();
      const controls = new RoleControls(character);
      controlsRef.current = controls;
      roleRef.current = character;
      engine.setRole(character);
      character.service.onTransition((state: string) => setFsmState(state));
      setPlayerHealth(character.health);
      setPlayerMaxHealth(character.maxHealth);

      setInfo(`Loading ${WEAPON_PACKS[preset.weapon]?.label ?? preset.weapon} animations…`);
      const loadedClips = await character.loadWeaponPack(preset.weapon);
      setActivePreset(preset);
      setWeaponPackLabel(WEAPON_PACKS[preset.weapon]?.label || '');
      setLoadingWeapon(false);
      setLoaded(true);
      setInfo(
        loadedClips.length > 0
          ? `${preset.name} • ${WEAPON_PACKS[preset.weapon]?.label} (${loadedClips.length} clips)`
          : `${preset.name} • using embedded animations`,
      );
    } catch (err) {
      console.error('[AnnihilateDemo] character load failed', err);
      setLoadingWeapon(false);
      setInfo(`Failed to load ${preset.name}. Check /models/grudge assets and retry.`);
    }
  }, []);

  const spawnEnemy = useCallback(async (presetId: string) => {
    const engine = engineRef.current; const role = roleRef.current;
    if (!engine || !role) return;
    const preset = CHARACTER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const angle = Math.random() * Math.PI * 2; const dist = 6 + Math.random() * 4;
    const pos = new THREE.Vector3(role.body.position.x + Math.cos(angle) * dist, 2, role.body.position.z + Math.sin(angle) * dist);
    const enemy = new GrudgeEnemy(preset, { position: pos });
    await enemy.load(() => {
      enemy.enableFootIK();
      const ai = new BaseAi(enemy, 1.5);
      enemiesRef.current.push({ character: enemy, ai, preset });
      setEnemyCount(enemiesRef.current.length);
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

    // ── Test obstacles for the movement fixes ──────────────────────────────
    //  • ramp  → foot IK plants on the slope + slope-projected movement / push-off
    //  • block → jump into its face to wall-grab, hold W to climb, mantle the ledge (top)
    //  • step  → foot IK on a raised edge
    engine.addBox({ size: [10, 0.5, 6], position: [11, 1.1, 0], rotation: [0, 0, -0.3], color: 0x24407a });
    engine.addBox({ size: [6, 4, 6], position: [-11, 2, 0], color: 0x47307a });
    engine.addBox({ size: [4, 0.7, 4], position: [-3.5, 0.35, 5], color: 0x33235e });

    engine.start();

    const heroParam = new URLSearchParams(location.split('?')[1] ?? '').get('hero');
    spawnCharacter(resolveInitialPreset(heroParam));

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
      ro.disconnect();
      clearEnemies(); controlsRef.current?.destroy(); roleRef.current?.destroy();
      engine.destroy(); engineRef.current = null;
    };
  }, [location, spawnCharacter, clearEnemies]); // eslint-disable-line react-hooks/exhaustive-deps

  const characterItems = CHARACTER_PRESETS.map((p) => ({ id: p.id, name: p.name, sub: p.description }));
  const enemyItems = [
    ...CHARACTER_PRESETS.map((p) => ({ id: p.id, name: `Spawn ${p.name}`, sub: `${RACE_CONFIGS[p.race].name} • ${WEAPON_PACKS[p.weapon]?.label}` })),
    { id: '__clear__', name: '✕ Clear All Enemies', sub: 'Remove all spawned enemies' },
  ];
  const weaponItems = (Object.entries(WEAPON_PACKS) as [WeaponType, WeaponAnimMap][]).map(([id, pack]) => ({
    id, name: pack.label, sub: `${Object.keys(pack.clips).length} animation clips`,
  }));

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-950">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 p-3">
        <Link href="/super-engine">
          <Button variant="outline" size="sm" className="border-purple-500/50 text-purple-300 hover:bg-purple-900/30 bg-black/60 h-9">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
        <div className="h-6 w-px bg-purple-500/20" />
        <Dropdown label={activePreset.name} icon={<Swords className="w-3.5 h-3.5" />} items={characterItems}
          onSelect={(id) => { const p = CHARACTER_PRESETS.find((c) => c.id === id); if (p) spawnCharacter(p); }} />
        <Dropdown label={`Enemies (${enemyCount})`} icon={<Users className="w-3.5 h-3.5" />} items={enemyItems}
          onSelect={(id) => { if (id === '__clear__') { clearEnemies(); return; } spawnEnemy(id); }} />
        <Dropdown label={loadingWeapon ? 'Loading…' : (weaponPackLabel || 'Weapon Anims')} icon={<Swords className="w-3.5 h-3.5" />}
          items={weaponItems} onSelect={(id) => switchWeaponPack(id as WeaponType)} />
        <div className="flex-1" />
        <div className="flex flex-col items-end gap-1">
          <div className="bg-black/70 px-3 py-1 rounded text-xs font-mono text-green-400">
            State: <span className="text-white">{fsmState}</span>
          </div>
          <div className="bg-black/70 px-3 py-1 rounded text-[10px] text-gray-400">{info}</div>
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

      {/* ── Controls legend ────────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20 bg-black/70 rounded-lg px-4 py-3 text-xs text-gray-400 space-y-0.5">
        <div className="text-purple-300 font-bold mb-1">GRUDGE ENGINE — Annihilate Core</div>
        <ControlRow keys="WASD" label="Move" />
        <ControlRow keys="LMB" label="Attack (light combo)" />
        <ControlRow keys="RMB" label="Heavy / Bash / Whirlwind" />
        <ControlRow keys="Space" label="Jump / Double Jump" />
        <ControlRow keys="Jump→Wall + W" label="Climb wall / mantle ledge" />
        <ControlRow keys="Shift" label="Dash" />
        <ControlRow keys="1" label="Block (hold for combos)" />
        <ControlRow keys="2" label="Launch (uppercut)" />
        <ControlRow keys="3" label="Bash (keyboard alt)" />
        <ControlRow keys="Block + ↓→LMB" label="Hadouken" />
        <ControlRow keys="Block + →↓→LMB" label="Shoryuken" />
        <ControlRow keys="Block + ↓←Space" label="Ajejebloken" />
      </div>

      {/* ── Character roster ───────────────────────────────────────────── */}
      {loaded && (
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 items-end">
          {CHARACTER_PRESETS.map((p) => (
            <button key={p.id} onClick={() => spawnCharacter(p)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
                activePreset.id === p.id
                  ? 'bg-purple-800/60 border border-purple-400/50 text-white'
                  : 'bg-black/50 border border-gray-700/30 text-gray-400 hover:bg-purple-900/30 hover:text-white'
              }`}>
              <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: `#${p.tint.toString(16).padStart(6, '0')}` }} />
              <span className="font-medium">{p.name}</span>
              <span className="text-[10px] text-gray-500">{WEAPON_PACKS[p.weapon]?.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Feature badges ─────────────────────────────────────────────── */}
      {loaded && (
        <div className="absolute bottom-[280px] right-4 z-10 flex flex-col gap-1 items-end">
          {['6 Grudge Race GLBs', 'FBX Weapon Anim Packs', 'CharacterFSM + Combos', 'Cannon-ES Physics', 'BaseAi Enemies', 'Race Stats System'].map((f) => (
            <Badge key={f} className="bg-purple-900/60 text-purple-300 text-[10px] border-purple-500/20">{f}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
