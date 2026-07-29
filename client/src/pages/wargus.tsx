import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import heroStoneGuardian from "@assets/heroes/stone_guardian.png";
import heroDeathMage from "@assets/heroes/death_mage.png";
import heroHolyPaladin from "@assets/heroes/holy_paladin.png";
import heroOrcShaman from "@assets/heroes/orc_shaman.png";
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { type AnimatedUnit, createRTSAnimatedUnit, preloadRTS, RTS_MODEL_MAP, GrudgeAssets } from '@/lib/grudge-assets';
import { FACTIONS, getBuildingsForFaction, getUnitsForFaction, getUnit, getBuilding, ALL_BUILDINGS, ALL_UNITS, type FactionId, type BuildingDef, type UnitDef, type UnitRole, type BuildingRole } from '@shared/grudge-rts-data';

type Faction = FactionId;
type UnitType = string;
type BuildingType = string;
type ResourceType = 'gold' | 'lumber';
type GameMode = 'menu' | 'pve' | 'pvp';
type OrderType = 'move' | 'attack' | 'attackmove' | 'patrol' | 'stop' | 'hold' | 'gather' | 'build' | 'repair';

// ════════════════════════════════════════════════════════════════
// Canonical Grudge CDN paths (from grudge-warlords-assets + grudge-d1-r2 skills)
// ════════════════════════════════════════════════════════════════
const CDN      = 'https://assets.grudge-studio.com';
const UI_CDN   = 'https://ui.grudge-studio.com';
const PORT_CDN = 'https://client.grudge-studio.com/images/portraits';

// Map sizes: Standard (1×), Large (4×), Epic (8×)
type MapSizeKey = 'standard' | 'large' | 'epic';
const MAP_SIZE_CFG: Record<MapSizeKey, { tiles: number; fog: number; label: string; desc: string }> = {
  standard: { tiles: 128,  fog: 128, label: 'Standard (1×)',  desc: '128×128 • ~15 min match' },
  large:    { tiles: 512,  fog: 256, label: 'Large (4×)',     desc: '512×512 • ~40 min match' },
  epic:     { tiles: 1024, fog: 512, label: 'Epic (8×)',      desc: '1024×1024 • 90+ min epic' },
};

// Equipment slots (matches ObjectStore equipment.json slots)
type EquipSlot = 'weapon' | 'offhand' | 'armor' | 'helmet' | 'boots' | 'ring';

interface EquipItem {
  id:           string;
  name:         string;
  slot:         EquipSlot;
  tier:         1 | 2 | 3 | 4 | 5;
  tierColor:    string;          // from ObjectStore equipment.json tiers[n].color
  emoji:        string;
  iconUrl:      string;          // canonical CDN path from ObjectStore / R2
  damageBonus?: number;
  armorBonus?:  number;
  speedBonus?:  number;          // world units/sec
  rangeBonus?:  number;
  atkSpeedMul?: number;          // multiplier e.g. 1.15 = 15% faster attacks
  manaBonus?:   number;
  hpBonus?:     number;
  description:  string;
}

interface UnitEquip {
  weapon?:  EquipItem;
  offhand?: EquipItem;
  armor?:   EquipItem;
  helmet?:  EquipItem;
  boots?:   EquipItem;
  ring?:    EquipItem;
}

interface UnitAbility {
  id:          string;
  name:        string;
  emoji:       string;
  iconUrl:     string;           // CDN icon
  hotkey:      string;           // Q/W/E/R/T
  cooldown:    number;           // seconds
  manaCost:    number;
  description: string;
  lastUsed:    number;           // game-time seconds when last cast
  passive:     boolean;
}

/** PVE enemy mapping */
const ENEMY_FACTION: Record<FactionId, FactionId> = { crusade: 'legion', fabled: 'legion', legion: 'crusade' };

interface Position3D { x: number; y: number; z: number; }

interface GameUnit {
  id: string;
  type: UnitType;
  faction: Faction;
  position: Position3D;
  targetPosition: Position3D | null;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  damage: number;
  armor: number;
  range: number;
  speed: number;
  isSelected: boolean;
  currentOrder: OrderType | null;
  attackTarget: string | null;
  repairTarget: string | null;
  patrolStart: Position3D | null;
  patrolEnd: Position3D | null;
  carryingResource: { type: ResourceType; amount: number } | null;
  gatherTarget: string | null;
  lastGatherTarget: string | null;
  groupNumber: number | null;
  mesh?: THREE.Mesh | THREE.Object3D;
  selectionRing?: THREE.Mesh;
  healthBar?: THREE.Group;
  animUnit?: AnimatedUnit;
  isVisible: boolean;
  lastSeenPosition: Position3D | null;
  // Equipment & abilities (WC3-style per-unit)
  equipment: UnitEquip;
  abilities: UnitAbility[];
  lastAttackTime: number;     // game-time seconds of last attack
  attackCooldown: number;     // seconds between attacks (base before equip)
}

interface GameBuilding {
  id: string;
  type: BuildingType;
  faction: Faction;
  position: Position3D;
  health: number;
  maxHealth: number;
  isConstructing: boolean;
  constructionProgress: number;
  productionQueue: UnitType[];
  productionProgress: number;
  rallyPoint: Position3D | null;
  mesh?: THREE.Mesh;
  auxMeshes?: THREE.Mesh[];
  healthBar?: THREE.Group;
  isVisible: boolean;
}

interface ResourceNode {
  id: string;
  type: ResourceType;
  position: Position3D;
  amount: number;
  mesh?: THREE.Mesh;
  trunkMesh?: THREE.Mesh;
}

interface FogCell {
  explored: boolean;
  visible: boolean;
}

// ── Data Bridge: shared data-layer → game-stat lookups ──

interface UnitStatsBridge {
  name: string; icon: string;
  cost: { gold: number; lumber: number };
  health: number; damage: number; armor: number; range: number; speed: number;
  buildTime: number; commands: string[]; pop: number; role: UnitRole;
}

interface BuildingStatsBridge {
  name: string; icon: string;
  cost: { gold: number; lumber: number };
  health: number; buildTime: number; food: number;
  trains: string[]; role: BuildingRole;
}

function commandsForRole(role: UnitRole): string[] {
  switch (role) {
    case 'worker': return ['move', 'stop', 'attack', 'repair', 'gather', 'build'];
    case 'siege': return ['move', 'stop', 'attack', 'patrol'];
    default: return ['move', 'stop', 'attack', 'patrol', 'hold'];
  }
}

const _UNIT_MAP = new Map<string, UnitStatsBridge>();
ALL_UNITS.forEach(d => _UNIT_MAP.set(d.id, {
  name: d.name, icon: d.icon,
  cost: { gold: d.cost.gold, lumber: d.cost.wood },
  health: d.hp, damage: d.atk, armor: d.def,
  range: d.rng, speed: d.spd / 15, buildTime: d.buildTime,
  commands: commandsForRole(d.role), pop: d.pop, role: d.role,
}));

const _BLDG_MAP = new Map<string, BuildingStatsBridge>();
ALL_BUILDINGS.forEach(d => _BLDG_MAP.set(d.id, {
  name: d.name, icon: d.icon,
  cost: { gold: d.cost.gold, lumber: d.cost.wood },
  health: d.hp, buildTime: d.buildTime, food: d.food,
  trains: d.trains, role: d.role,
}));

const _DFLT_U: UnitStatsBridge = { name: '?', icon: '❓', cost: { gold: 50, lumber: 0 }, health: 50, damage: 5, armor: 0, range: 1.5, speed: 2.5, buildTime: 15, commands: ['move', 'stop'], pop: 1, role: 'melee' };
const _DFLT_B: BuildingStatsBridge = { name: '?', icon: '❓', cost: { gold: 200, lumber: 100 }, health: 500, buildTime: 20, food: 0, trains: [], role: 'economy' };

function uStat(id: string): UnitStatsBridge { return _UNIT_MAP.get(id) || _DFLT_U; }
function bStat(id: string): BuildingStatsBridge { return _BLDG_MAP.get(id) || _DFLT_B; }
function isWorkerUnit(id: string) { return uStat(id).role === 'worker'; }
function isTownHall(id: string) { return bStat(id).role === 'economy'; }
function isTowerBldg(id: string) { return bStat(id).role === 'defense'; }
function isRangedUnit(id: string) { const r = uStat(id).role; return r === 'ranged' || r === 'siege' || r === 'support' || r === 'air'; }
function factionPrimary(f: FactionId): number { return FACTIONS[f].colors.primary; }
function factionHex(f: FactionId): string { return '#' + factionPrimary(f).toString(16).padStart(6, '0'); }

/** Get faction's starting entity IDs */
function factionStart(f: FactionId) {
  const bs = getBuildingsForFaction(f);
  const us = getUnitsForFaction(f);
  return {
    townHall: bs.find(b => b.role === 'economy')!.id,
    farm: bs.find(b => b.role === 'population')!.id,
    barracks: bs.find(b => b.role === 'melee_production')!.id,
    worker: us.find(u => u.role === 'worker')!.id,
    melee: us.find(u => u.role === 'melee')!.id,
  };
}

const COMMAND_ICONS: Record<string, { icon: string; name: string; hotkey: string }> = {
  move: { icon: '👆', name: 'Move', hotkey: 'M' },
  stop: { icon: '⏹️', name: 'Stop', hotkey: 'S' },
  attack: { icon: '⚔️', name: 'Attack', hotkey: 'A' },
  attackmove: { icon: '🎯', name: 'Attack Move', hotkey: 'A' },
  patrol: { icon: '🔄', name: 'Patrol', hotkey: 'P' },
  hold: { icon: '🛑', name: 'Hold Position', hotkey: 'H' },
  gather: { icon: '⛏️', name: 'Gather', hotkey: 'G' },
  build: { icon: '🔨', name: 'Build', hotkey: 'B' },
  repair: { icon: '🔧', name: 'Repair', hotkey: 'R' }
};

// Dynamic map dimensions — updated when game starts via startGame(mapSizeKey)
let MAP_SIZE       = 128;
let FOG_GRID_SIZE  = 128;
const VISION_RANGE = 8;

interface FloatingText {
  sprite: THREE.Sprite;
  startY: number;
  life: number;
  maxLife: number;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  fadeOut: boolean;
  type: 'spark' | 'fire' | 'dust' | 'arrow_trail';
}

interface PhysicsProjectile {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  damage: number;
  targetId: string | null;
  faction: Faction;
  life: number;
  trailMeshes: THREE.Mesh[];
}

interface PhysicsDebris {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  life: number;
}

interface FallingTree {
  mesh: THREE.Mesh;
  trunkMesh: THREE.Mesh | null;
  pivotGroup: THREE.Group;
  fallSpeed: number;
  currentAngle: number;
  maxAngle: number;
  life: number;
}

function createTextCanvas(text: string, color: string, fontSize: number = 48): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 32);
  return canvas;
}

const TERRAIN_COLORS = {
  grass: 0x3d5c2f,
  dirt: 0x5c4a2f,
  darkGrass: 0x2d4a1f,
  rock: 0x6b6b6b,
  sand: 0xc2a867,
  snow: 0xe8e8e8,
};

// ════════════════════════════════════════════════════════════════
// Equipment Library — icons from ObjectStore / R2 CDN
// Tier colors match ObjectStore equipment.json: T1=#9ca3af T2=#22c55e T3=#3b82f6
// ════════════════════════════════════════════════════════════════
const EQUIP_LIBRARY: EquipItem[] = [
  // —— Tier 1 (grey) weapons
  { id:'iron_sword',   name:'Iron Sword',    slot:'weapon',  tier:1, tierColor:'#9ca3af', emoji:'⚔️', iconUrl:`${CDN}/icons/weapons/sword.png`,         damageBonus:5,  description:'Dependable iron blade.' },
  { id:'wooden_bow',   name:'Wooden Bow',    slot:'weapon',  tier:1, tierColor:'#9ca3af', emoji:'🏹', iconUrl:`${CDN}/icons/weapons/bow.png`,           damageBonus:4, rangeBonus:0.5, description:'Simple but effective.' },
  { id:'oak_staff',    name:'Oak Staff',     slot:'weapon',  tier:1, tierColor:'#9ca3af', emoji:'🪄', iconUrl:`${CDN}/icons/weapons/staff.png`,         damageBonus:3, rangeBonus:1, manaBonus:20, description:'Channels mana.' },
  { id:'wood_shield',  name:'Wooden Shield', slot:'offhand', tier:1, tierColor:'#9ca3af', emoji:'🛡️', iconUrl:`${CDN}/icons/weapons/shield.png`,       armorBonus:4,  description:'Basic wooden defence.' },
  { id:'leather_arm',  name:'Leather Armor', slot:'armor',   tier:1, tierColor:'#9ca3af', emoji:'🥋', iconUrl:`${CDN}/icons/equipment/armor/leather.png`,   armorBonus:3,  description:'Light and flexible.' },
  { id:'iron_helm',    name:'Iron Helm',     slot:'helmet',  tier:1, tierColor:'#9ca3af', emoji:'⛑️', iconUrl:`${CDN}/icons/equipment/helmets/iron.png`, armorBonus:2, hpBonus:10, description:'Basic head protection.' },
  { id:'sprint_boots', name:'Sprint Boots',  slot:'boots',   tier:1, tierColor:'#9ca3af', emoji:'👟', iconUrl:`${CDN}/icons/equipment/boots/sprint.png`, speedBonus:0.4, description:'Light footwear.' },
  { id:'battle_ring',  name:'Battle Ring',   slot:'ring',    tier:1, tierColor:'#9ca3af', emoji:'💍', iconUrl:`${CDN}/icons/equipment/rings/battle.png`,  damageBonus:2, armorBonus:1, description:'Minor combat boost.' },
  // —— Tier 2 (green) weapons
  { id:'steel_sword',  name:'Steel Sword',   slot:'weapon',  tier:2, tierColor:'#22c55e', emoji:'⚔️', iconUrl:`${CDN}/icons/weapons/swords/bloodfeud_blade.png`, damageBonus:10, atkSpeedMul:1.05, description:'Quality forged steel.' },
  { id:'elven_bow',    name:'Elven Bow',     slot:'weapon',  tier:2, tierColor:'#22c55e', emoji:'🏹', iconUrl:`${CDN}/icons/weapons/bow.png`,           damageBonus:8, rangeBonus:1, atkSpeedMul:1.1, description:'Moonwood crafted.' },
  { id:'war_staff',    name:'War Staff',     slot:'weapon',  tier:2, tierColor:'#22c55e', emoji:'🪄', iconUrl:`${CDN}/icons/weapons/staff.png`,         damageBonus:7, rangeBonus:1.5, manaBonus:40, description:'Amplifies magic.' },
  { id:'iron_shield',  name:'Iron Shield',   slot:'offhand', tier:2, tierColor:'#22c55e', emoji:'🛡️', iconUrl:`${CDN}/icons/weapons/shield.png`,       armorBonus:8, hpBonus:15, description:'Solid iron defence.' },
  { id:'chainmail',    name:'Chainmail',     slot:'armor',   tier:2, tierColor:'#22c55e', emoji:'⛓️', iconUrl:`${CDN}/icons/equipment/armor/chain.png`,     armorBonus:6, hpBonus:20, description:'Interlocked rings.' },
  { id:'steel_helm',   name:'Steel Helm',    slot:'helmet',  tier:2, tierColor:'#22c55e', emoji:'⛑️', iconUrl:`${CDN}/icons/equipment/helmets/steel.png`, armorBonus:4, hpBonus:25, description:'Full steel protection.' },
  { id:'war_boots',    name:'War Boots',     slot:'boots',   tier:2, tierColor:'#22c55e', emoji:'👞', iconUrl:`${CDN}/icons/equipment/boots/war.png`,   speedBonus:0.3, armorBonus:2, description:'Reinforced boots.' },
  { id:'war_ring',     name:'War Ring',      slot:'ring',    tier:2, tierColor:'#22c55e', emoji:'💍', iconUrl:`${CDN}/icons/equipment/rings/war.png`,    damageBonus:4, atkSpeedMul:1.08, description:'Battle magic ring.' },
  // —— Tier 3 (blue/rare) weapons
  { id:'runic_blade',  name:'Runic Blade',   slot:'weapon',  tier:3, tierColor:'#3b82f6', emoji:'🗡️', iconUrl:`${CDN}/icons/weapons/swords/wraithfang.png`, damageBonus:18, atkSpeedMul:1.15, description:'Ancient runes pulse.' },
  { id:'warbow',       name:'War Bow',       slot:'weapon',  tier:3, tierColor:'#3b82f6', emoji:'🏹', iconUrl:`${CDN}/icons/weapons/bow.png`,           damageBonus:15, rangeBonus:2, atkSpeedMul:1.15, description:'Deadly longbow.' },
  { id:'arcane_staff', name:'Arcane Staff',  slot:'weapon',  tier:3, tierColor:'#3b82f6', emoji:'🪄', iconUrl:`${CDN}/icons/weapons/staff.png`,         damageBonus:14, rangeBonus:2, manaBonus:80, atkSpeedMul:1.1, description:'Crackles with power.' },
  { id:'tower_shield', name:'Tower Shield',  slot:'offhand', tier:3, tierColor:'#3b82f6', emoji:'🛡️', iconUrl:`${CDN}/icons/weapons/shield.png`,       armorBonus:14, hpBonus:40, description:'Near-impenetrable.' },
  { id:'plate_armor',  name:'Plate Armor',   slot:'armor',   tier:3, tierColor:'#3b82f6', emoji:'🧶', iconUrl:`${CDN}/icons/equipment/armor/plate.png`,    armorBonus:12, hpBonus:50, description:'Pinnacle of protection.' },
  { id:'warlord_helm', name:'Warlord Helm',  slot:'helmet',  tier:3, tierColor:'#3b82f6', emoji:'⛑️', iconUrl:`${CDN}/icons/equipment/helmets/warlord.png`, armorBonus:7, hpBonus:40, damageBonus:3, description:'Inspires fear.' },
  { id:'winged_boots', name:'Winged Boots',  slot:'boots',   tier:3, tierColor:'#3b82f6', emoji:'👟', iconUrl:`${CDN}/icons/equipment/boots/winged.png`, speedBonus:0.8, atkSpeedMul:1.1, description:'Fleet-footed swiftness.' },
  { id:'bloodthirst',  name:'Bloodthirst',   slot:'ring',    tier:3, tierColor:'#3b82f6', emoji:'💍', iconUrl:`${CDN}/icons/equipment/rings/bloodthirst.png`, damageBonus:8, atkSpeedMul:1.12, hpBonus:30, description:'Grows with kills.' },
];

// Portrait CDN paths by unit race (canonical: client.grudge-studio.com/images/portraits)
const UNIT_RACE: Record<string, string> = {
  sky_serf:'human', valor_guard:'human', fate_lancer:'barbarian', rune_marksman:'human',
  thunder_charger:'human', cosmic_ram:'human', wisdom_seer:'human', raven_scout:'barbarian', eye_watcher:'human',
  grove_tender:'elf', root_warden:'dwarf', stone_sentinel:'dwarf', leaf_archer:'elf',
  grove_rider:'elf', treant_ram:'dwarf', nature_channeler:'elf', bark_scout:'elf', sylph_watcher:'elf',
  thrall_worker:'orc', chaos_grunt:'orc', doom_berserker:'undead', shadow_hunter:'orc',
  warg_rider:'orc', doom_catapult:'orc', hex_shaman:'undead', plague_bat:'orc', void_wraith:'undead',
};

function getUnitPortrait(unitType: string): string {
  const race = UNIT_RACE[unitType] || 'human';
  return `${PORT_CDN}/${race}.png`;
}

// Ability definitions by unit role (Q/W/E/R/T hotkeys)
const ROLE_ABILITIES: Record<string, UnitAbility[]> = {
  worker:  [
    { id:'repair',    name:'Repair',     emoji:'🔧', iconUrl:`${CDN}/icons/abilities/repair.png`,      hotkey:'Q', cooldown:0,  manaCost:0,  description:'Repair buildings', lastUsed:-999, passive:false },
  ],
  melee:   [
    { id:'slash',     name:'Slash',      emoji:'⚔️', iconUrl:`${CDN}/icons/weapons/sword.png`,          hotkey:'Q', cooldown:3,  manaCost:10, description:'Swift slash +15% dmg', lastUsed:-999, passive:false },
    { id:'battle_cry',name:'Battle Cry', emoji:'📣', iconUrl:`${CDN}/icons/abilities/battle_cry.png`,   hotkey:'W', cooldown:15, manaCost:20, description:'+20% ATK for 5s (AoE)', lastUsed:-999, passive:false },
    { id:'shield_wall',name:'Shield Wall',emoji:'🛡️', iconUrl:`${CDN}/icons/weapons/shield.png`,   hotkey:'E', cooldown:20, manaCost:30, description:'Reduce dmg 50% for 3s', lastUsed:-999, passive:false },
  ],
  ranged:  [
    { id:'aimed_shot',name:'Aimed Shot', emoji:'🎯', iconUrl:`${CDN}/icons/abilities/aimed_shot.png`,  hotkey:'Q', cooldown:4,  manaCost:15, description:'High-dmg aimed shot', lastUsed:-999, passive:false },
    { id:'volley',    name:'Volley',     emoji:'🏹', iconUrl:`${CDN}/icons/weapons/bow.png`,            hotkey:'W', cooldown:12, manaCost:25, description:'AoE arrow volley', lastUsed:-999, passive:false },
  ],
  cavalry: [
    { id:'charge',    name:'Charge',     emoji:'🐴', iconUrl:`${CDN}/icons/abilities/charge.png`,       hotkey:'Q', cooldown:8,  manaCost:20, description:'Gap-close + 2× dmg hit', lastUsed:-999, passive:false },
    { id:'trample',   name:'Trample',    emoji:'💨', iconUrl:`${CDN}/icons/abilities/trample.png`,      hotkey:'W', cooldown:18, manaCost:30, description:'AoE knockback trample', lastUsed:-999, passive:false },
  ],
  siege:   [
    { id:'barrage',   name:'Barrage',    emoji:'💣', iconUrl:`${CDN}/icons/abilities/barrage.png`,      hotkey:'Q', cooldown:20, manaCost:30, description:'Rapid multi-shot', lastUsed:-999, passive:false },
  ],
  support: [
    { id:'heal',      name:'Heal',       emoji:'💚', iconUrl:`${CDN}/icons/abilities/heal.png`,         hotkey:'Q', cooldown:8,  manaCost:30, description:'Restore ally HP', lastUsed:-999, passive:false },
    { id:'ward',      name:'Ward',       emoji:'🛡️', iconUrl:`${CDN}/icons/abilities/ward.png`,    hotkey:'W', cooldown:20, manaCost:40, description:'Protective ward', lastUsed:-999, passive:false },
  ],
  recon:   [
    { id:'stealth',   name:'Stealth',    emoji:'👁️', iconUrl:`${CDN}/icons/abilities/stealth.png`, hotkey:'Q', cooldown:12, manaCost:15, description:'Vanish briefly', lastUsed:-999, passive:false },
  ],
  air:     [
    { id:'dive_bomb', name:'Dive Bomb',  emoji:'🦅', iconUrl:`${CDN}/icons/abilities/dive_bomb.png`,   hotkey:'Q', cooldown:10, manaCost:20, description:'Aerial AoE strike', lastUsed:-999, passive:false },
  ],
};

// ── Effective-stat helpers (apply equipment bonuses) ──
function getEffectiveDmg(unit: GameUnit): number {
  return unit.damage
    + (unit.equipment.weapon?.damageBonus  ?? 0)
    + (unit.equipment.ring?.damageBonus    ?? 0)
    + (unit.equipment.helmet?.damageBonus  ?? 0);
}
function getEffectiveArmor(unit: GameUnit): number {
  return unit.armor
    + (unit.equipment.armor?.armorBonus   ?? 0)
    + (unit.equipment.offhand?.armorBonus ?? 0)
    + (unit.equipment.helmet?.armorBonus  ?? 0)
    + (unit.equipment.boots?.armorBonus   ?? 0);
}
function getEffectiveSpeed(unit: GameUnit): number {
  return unit.speed + (unit.equipment.boots?.speedBonus ?? 0);
}
function getEffectiveRange(unit: GameUnit): number {
  return unit.range + (unit.equipment.weapon?.rangeBonus ?? 0);
}
function getAttackCooldown(unit: GameUnit): number {
  // base cooldown from speed stat; 1 attack per ~1.2s at speed 4
  const baseCD = Math.max(0.5, 5 / (unit.speed + 1));
  const mul = (unit.equipment.weapon?.atkSpeedMul ?? 1) * (unit.equipment.ring?.atkSpeedMul ?? 1);
  return baseCD / mul;
}

export default function Wargus() {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const fogMeshRef = useRef<THREE.Mesh | null>(null);
  const placementPreviewRef = useRef<THREE.Mesh | null>(null);
  
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [playerFaction, setPlayerFaction] = useState<Faction>('crusade');
  const [mapSizeKey, setMapSizeKey] = useState<MapSizeKey>('standard');
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [gameTime, setGameTime] = useState(0);

  // Edge-scroll mouse tracking
  const mousePosRef    = useRef<{x:number;y:number}>({x:0,y:0});
  // Game time accumulator (seconds) — used for attack cooldowns
  const gameTotalTimeRef = useRef(0);
  // Double-click detection
  const lastClickRef   = useRef<{time:number;x:number;z:number}>({time:0,x:-1,z:-1});
  // Selected unit for equipment panel reactivity
  const [selectedEquipUnit, setSelectedEquipUnit] = useState<string|null>(null);
  
  const unitsRef = useRef<GameUnit[]>([]);
  const buildingsRef = useRef<GameBuilding[]>([]);
  const resourceNodesRef = useRef<ResourceNode[]>([]);
  const fogGridRef = useRef<FogCell[][]>([]);
  const unitGroupsRef = useRef<Record<number, string[]>>({});
  
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [buildingToBuild, setBuildingToBuild] = useState<BuildingType | null>(null);
  const [currentCommand, setCurrentCommand] = useState<OrderType | null>(null);
  const [resources, setResources] = useState<Record<FactionId, { gold: number; lumber: number }>>({
    crusade: { gold: 2000, lumber: 1000 },
    fabled: { gold: 2000, lumber: 1000 },
    legion: { gold: 2000, lumber: 1000 },
  });
  const [food, setFood] = useState<Record<FactionId, { used: number; max: number }>>({
    crusade: { used: 5, max: 9 },
    fabled: { used: 5, max: 9 },
    legion: { used: 5, max: 9 },
  });
  
  const [cameraPosition, setCameraPosition] = useState({ x: 10, z: 10 });
  const [cameraZoom, setCameraZoom] = useState(1);
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [cursorStyle, setCursorStyle] = useState('default');
  const [dragSelect, setDragSelect] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const composerRef = useRef<EffectComposer | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const fireParticlesRef = useRef<Map<string, THREE.Mesh[]>>(new Map());
  const physicsWorldRef = useRef<CANNON.World | null>(null);
  const physicsProjectilesRef = useRef<PhysicsProjectile[]>([]);
  const physicsDebrisRef = useRef<PhysicsDebris[]>([]);
  const fallingTreesRef = useRef<FallingTree[]>([]);
  const groundBodyRef = useRef<CANNON.Body | null>(null);
  
  const gameLoopRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isInitializedRef = useRef(false);
  const pendingGameRef = useRef<{ mode: GameMode; faction: Faction } | null>(null);

  const initFogGrid = useCallback(() => {
    const grid: FogCell[][] = [];
    for (let x = 0; x < FOG_GRID_SIZE; x++) {
      grid[x] = [];
      for (let z = 0; z < FOG_GRID_SIZE; z++) {
        grid[x][z] = { explored: false, visible: false };
      }
    }
    fogGridRef.current = grid;
  }, []);

  const updateFogOfWar = useCallback(() => {
    const grid = fogGridRef.current;
    for (let x = 0; x < FOG_GRID_SIZE; x++) {
      for (let z = 0; z < FOG_GRID_SIZE; z++) {
        grid[x][z].visible = false;
      }
    }
    
    const playerUnits = unitsRef.current.filter(u => u.faction === playerFaction);
    const playerBuildings = buildingsRef.current.filter(b => b.faction === playerFaction);
    
    const revealArea = (wx: number, wz: number, range: number) => {
      const cellX = Math.floor((wx / MAP_SIZE) * FOG_GRID_SIZE);
      const cellZ = Math.floor((wz / MAP_SIZE) * FOG_GRID_SIZE);
      const cellRange = Math.ceil((range / MAP_SIZE) * FOG_GRID_SIZE);
      
      for (let dx = -cellRange; dx <= cellRange; dx++) {
        for (let dz = -cellRange; dz <= cellRange; dz++) {
          const nx = cellX + dx;
          const nz = cellZ + dz;
          if (nx >= 0 && nx < FOG_GRID_SIZE && nz >= 0 && nz < FOG_GRID_SIZE) {
            if (dx * dx + dz * dz <= cellRange * cellRange) {
              grid[nx][nz].explored = true;
              grid[nx][nz].visible = true;
            }
          }
        }
      }
    };
    
    playerUnits.forEach(u => revealArea(u.position.x, u.position.z, VISION_RANGE));
    playerBuildings.forEach(b => revealArea(b.position.x, b.position.z, VISION_RANGE + 2));
    
    unitsRef.current.forEach(unit => {
      if (unit.faction !== playerFaction) {
        const cellX = Math.floor((unit.position.x / MAP_SIZE) * FOG_GRID_SIZE);
        const cellZ = Math.floor((unit.position.z / MAP_SIZE) * FOG_GRID_SIZE);
        if (cellX >= 0 && cellX < FOG_GRID_SIZE && cellZ >= 0 && cellZ < FOG_GRID_SIZE) {
          unit.isVisible = grid[cellX][cellZ].visible;
          if (unit.isVisible) {
            unit.lastSeenPosition = { ...unit.position };
          }
        }
        if (unit.mesh) {
          unit.mesh.visible = unit.isVisible;
        }
        if (unit.selectionRing) {
          unit.selectionRing.visible = unit.isVisible;
        }
        if (unit.healthBar) {
          unit.healthBar.visible = unit.isVisible;
        }
      }
    });
    
    buildingsRef.current.forEach(building => {
      if (building.faction !== playerFaction) {
        const cellX = Math.floor((building.position.x / MAP_SIZE) * FOG_GRID_SIZE);
        const cellZ = Math.floor((building.position.z / MAP_SIZE) * FOG_GRID_SIZE);
        if (cellX >= 0 && cellX < FOG_GRID_SIZE && cellZ >= 0 && cellZ < FOG_GRID_SIZE) {
          building.isVisible = grid[cellX][cellZ].visible || grid[cellX][cellZ].explored;
        }
        if (building.mesh) {
          building.mesh.visible = building.isVisible;
        }
        if (building.healthBar) {
          building.healthBar.visible = building.isVisible && grid[cellX][cellZ].visible;
        }
      }
    });
    
    updateFogMesh();
  }, [playerFaction]);

  const updateFogMesh = useCallback(() => {
    if (!fogMeshRef.current) return;
    const geometry = fogMeshRef.current.geometry as THREE.PlaneGeometry;
    const colors = geometry.attributes.color;
    
    for (let i = 0; i < FOG_GRID_SIZE; i++) {
      for (let j = 0; j < FOG_GRID_SIZE; j++) {
        const idx = i * FOG_GRID_SIZE + j;
        const cell = fogGridRef.current[i]?.[j];
        if (cell) {
          const alpha = cell.visible ? 0 : cell.explored ? 0.5 : 1;
          colors.setXYZ(idx, alpha, alpha, alpha);
        }
      }
    }
    colors.needsUpdate = true;
  }, []);

  const renderMinimap = useCallback(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const scale = canvas.width / MAP_SIZE;
    
    for (let x = 0; x < FOG_GRID_SIZE; x++) {
      for (let z = 0; z < FOG_GRID_SIZE; z++) {
        const cell = fogGridRef.current[x]?.[z];
        if (cell && cell.explored) {
          const wx = (x / FOG_GRID_SIZE) * canvas.width;
          const wz = (z / FOG_GRID_SIZE) * canvas.height;
          const cellSize = canvas.width / FOG_GRID_SIZE;
          ctx.fillStyle = cell.visible ? '#2d5016' : '#1a3009';
          ctx.fillRect(wx, wz, cellSize + 1, cellSize + 1);
        }
      }
    }
    
    resourceNodesRef.current.forEach(r => {
      const x = r.position.x * scale;
      const z = r.position.z * scale;
      const cellX = Math.floor((r.position.x / MAP_SIZE) * FOG_GRID_SIZE);
      const cellZ = Math.floor((r.position.z / MAP_SIZE) * FOG_GRID_SIZE);
      if (fogGridRef.current[cellX]?.[cellZ]?.explored) {
        ctx.fillStyle = r.type === 'gold' ? '#ffd700' : '#228b22';
        ctx.beginPath();
        ctx.arc(x, z, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    buildingsRef.current.forEach(b => {
      const x = b.position.x * scale;
      const z = b.position.z * scale;
      if (b.faction === playerFaction || b.isVisible) {
        ctx.fillStyle = factionHex(b.faction);
        const size = isTownHall(b.type) ? 6 : 4;
        ctx.fillRect(x - size/2, z - size/2, size, size);
      }
    });
    
    unitsRef.current.forEach(u => {
      if (u.faction === playerFaction || u.isVisible) {
        const x = u.position.x * scale;
        const z = u.position.z * scale;
        ctx.fillStyle = factionHex(u.faction);
        if (u.isSelected) {
          ctx.fillStyle = '#00ff00';
        }
        ctx.beginPath();
        ctx.arc(x, z, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    const viewX = cameraPosition.x * scale;
    const viewZ = cameraPosition.z * scale;
    const viewW = (20 / cameraZoom) * scale;
    const viewH = (15 / cameraZoom) * scale;
    ctx.strokeRect(viewX - viewW/2, viewZ - viewH/2, viewW, viewH);
  }, [cameraPosition, cameraZoom, playerFaction]);

  const createUnit = useCallback((type: UnitType, faction: Faction, x: number, z: number): GameUnit => {
    const stats = uStat(type);
    // Default starter equipment by role (T1 items from EQUIP_LIBRARY)
    const defaultEquip: UnitEquip = {};
    const role = stats.role;
    if (role === 'melee' || role === 'worker') {
      defaultEquip.weapon  = EQUIP_LIBRARY.find(e => e.id === 'iron_sword');
      defaultEquip.offhand = EQUIP_LIBRARY.find(e => e.id === 'wood_shield');
      defaultEquip.armor   = EQUIP_LIBRARY.find(e => e.id === 'leather_arm');
    } else if (role === 'ranged' || role === 'recon') {
      defaultEquip.weapon = EQUIP_LIBRARY.find(e => e.id === 'wooden_bow');
      defaultEquip.armor  = EQUIP_LIBRARY.find(e => e.id === 'leather_arm');
    } else if (role === 'support' || role === 'air') {
      defaultEquip.weapon = EQUIP_LIBRARY.find(e => e.id === 'oak_staff');
    } else if (role === 'cavalry') {
      defaultEquip.weapon = EQUIP_LIBRARY.find(e => e.id === 'iron_sword');
      defaultEquip.armor  = EQUIP_LIBRARY.find(e => e.id === 'leather_arm');
    }
    // Deep-clone abilities so each unit has its own lastUsed counters
    const abilityDefs = ROLE_ABILITIES[role] || ROLE_ABILITIES['melee'];
    const abilities   = abilityDefs.map(a => ({ ...a, lastUsed: -999 }));

    const baseMana   = role === 'support' ? 100 : role === 'air' ? 80 : 60;

    const unit: GameUnit = {
      id: `unit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      faction,
      position: { x, y: 0.5, z },
      targetPosition: null,
      health: stats.health,
      maxHealth: stats.health,
      mana: baseMana,
      maxMana: baseMana,
      damage: stats.damage,
      armor: stats.armor,
      range: stats.range,
      speed: stats.speed,
      isSelected: false,
      currentOrder: null,
      attackTarget: null,
      repairTarget: null,
      patrolStart: null,
      patrolEnd: null,
      carryingResource: null,
      gatherTarget: null,
      lastGatherTarget: null,
      groupNumber: null,
      isVisible: true,
      lastSeenPosition: null,
      equipment: defaultEquip,
      abilities,
      lastAttackTime: -999,
      attackCooldown: Math.max(0.5, 5 / (stats.speed + 1)),
    };
    
    if (sceneRef.current) {
      const role = stats.role;
      const size = role === 'cavalry' ? 0.6 : role === 'siege' ? 0.8 : 0.45;
      const fColor = factionPrimary(faction);
      const modelScale = role === 'siege' ? 0.8 : role === 'cavalry' ? 0.6 : 0.5;

      // Try loading animated 3D model from CDN (type IS the data-layer entity ID)
      if (RTS_MODEL_MAP[type]) {
        createRTSAnimatedUnit(type, fColor, modelScale).then(animUnit => {
          if (animUnit && sceneRef.current) {
            animUnit.setPosition(x, 0, z);
            animUnit.root.userData = { unitId: unit.id };
            sceneRef.current.add(animUnit.root);
            unit.mesh = animUnit.root;
            unit.animUnit = animUnit;
          }
        });
      }

      // Immediate fallback mesh (shown until GLB loads)
      if (!unit.mesh) {
        const geometry = new THREE.CapsuleGeometry(size * 0.4, size * 0.6, 8, 16);
        const material = new THREE.MeshStandardMaterial({ color: fColor, metalness: 0.4, roughness: 0.6 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, size * 0.5, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { unitId: unit.id };
        sceneRef.current.add(mesh);
        unit.mesh = mesh;
      }

      // Selection ring
      const ringGeometry = new THREE.RingGeometry(size * 0.6, size * 0.8, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0 
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.05, z);
      sceneRef.current.add(ring);
      unit.selectionRing = ring;
      
      // Health bar
      const healthBarGroup = new THREE.Group();
      const bgGeometry = new THREE.PlaneGeometry(0.8, 0.12);
      const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
      const bg = new THREE.Mesh(bgGeometry, bgMaterial);
      healthBarGroup.add(bg);
      const fgGeometry = new THREE.PlaneGeometry(0.75, 0.08);
      const fgMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
      const fg = new THREE.Mesh(fgGeometry, fgMaterial);
      fg.position.z = 0.01;
      fg.name = 'healthFill';
      healthBarGroup.add(fg);
      healthBarGroup.position.set(x, size * 1.8, z);
      healthBarGroup.rotation.x = -Math.PI / 4;
      sceneRef.current.add(healthBarGroup);
      unit.healthBar = healthBarGroup;
    }
    
    return unit;
  }, []);

  const createBuilding = useCallback((type: BuildingType, faction: Faction, x: number, z: number, isConstructing: boolean = false): GameBuilding => {
    const stats = bStat(type);
    const building: GameBuilding = {
      id: `building-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      faction,
      position: { x, y: 0, z },
      health: isConstructing ? stats.health * 0.1 : stats.health,
      maxHealth: stats.health,
      isConstructing,
      constructionProgress: isConstructing ? 0 : 100,
      productionQueue: [],
      productionProgress: 0,
      rallyPoint: null,
      isVisible: true
    };
    
    if (sceneRef.current) {
      const bRole = stats.role;
      const fColor = factionPrimary(faction);
      // Faction accent colours: Crusade=gold, Fabled=wood-brown, Legion=void-purple
      const accentColor = faction === 'crusade' ? 0xd4a800
                        : faction === 'fabled'  ? 0x5c3a1e
                        : 0x330033;

      // Role-appropriate geometry
      const size   = bRole === 'economy' ? 3.2 : bRole === 'population' ? 2.0 : 2.6;
      const height = bRole === 'defense' ? 5.0
                   : bRole === 'economy'  ? 4.0
                   : bRole === 'mage_production' ? 4.5
                   : 2.8;

      let mainGeometry: THREE.BufferGeometry;
      if (bRole === 'defense') {
        // Tower: octagonal cylinder
        mainGeometry = new THREE.CylinderGeometry(size * 0.5, size * 0.6, height, 8);
      } else if (bRole === 'cavalry_production' || bRole === 'siege_production') {
        // Stable / workshop: wide low barn shape
        mainGeometry = new THREE.BoxGeometry(size * 1.4, height * 0.75, size);
      } else {
        mainGeometry = new THREE.BoxGeometry(size, height, size);
      }

      const material = new THREE.MeshStandardMaterial({
        color: fColor,
        metalness: faction === 'legion' ? 0.3 : 0.05,
        roughness: faction === 'fabled' ? 0.95 : 0.85,
        transparent: isConstructing,
        opacity: isConstructing ? 0.5 : 1,
      });
      const mesh = new THREE.Mesh(mainGeometry, material);
      mesh.position.set(x, height / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { buildingId: building.id };
      sceneRef.current.add(mesh);
      building.mesh = mesh;

      building.auxMeshes = [];

      if (isTowerBldg(type)) {
        // Battlements: 4 corner merlons + pointy roof
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2;
          const mGeom = new THREE.BoxGeometry(0.45, 0.7, 0.45);
          const mMat  = new THREE.MeshStandardMaterial({ color: fColor });
          const merlon = new THREE.Mesh(mGeom, mMat);
          merlon.position.set(
            x + Math.cos(ang) * size * 0.4,
            height + 0.35,
            z + Math.sin(ang) * size * 0.4,
          );
          sceneRef.current.add(merlon);
          building.auxMeshes.push(merlon);
        }
        const roofGeom = new THREE.ConeGeometry(size * 0.6, 1.5, 6);
        const roofMat  = new THREE.MeshStandardMaterial({ color: accentColor });
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.set(x, height + 0.75, z);
        sceneRef.current.add(roof);
        building.auxMeshes.push(roof);
      } else if (bRole === 'economy') {
        // Town-hall banner
        const poleGeom = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6);
        const poleMat  = new THREE.MeshStandardMaterial({ color: 0x8b6914 });
        const pole = new THREE.Mesh(poleGeom, poleMat);
        pole.position.set(x, height + 0.9, z + size * 0.4);
        sceneRef.current.add(pole);
        building.auxMeshes.push(pole);
        const flagGeom = new THREE.PlaneGeometry(0.9, 0.55);
        const flagMat  = new THREE.MeshBasicMaterial({ color: accentColor, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeom, flagMat);
        flag.position.set(x + 0.45, height + 1.4, z + size * 0.4);
        sceneRef.current.add(flag);
        building.auxMeshes.push(flag);
      } else if (bRole === 'mage_production') {
        // Glowing arcane orb atop mage tower
        const orbColor = faction === 'crusade' ? 0x88aaff
                       : faction === 'fabled'  ? 0x66ee88
                       : 0xff44aa;
        const orbGeom = new THREE.SphereGeometry(0.35, 12, 12);
        const orbMat  = new THREE.MeshStandardMaterial({
          color: orbColor, emissive: orbColor, emissiveIntensity: 1.2,
        });
        const orb = new THREE.Mesh(orbGeom, orbMat);
        orb.position.set(x, height + 0.35, z);
        sceneRef.current.add(orb);
        building.auxMeshes.push(orb);
      }

      // Async GLB swap: try loading a 3D model from CDN and replace primitive geometry
      if (RTS_MODEL_MAP[type]) {
        GrudgeAssets.getInstance()
          .loadRTSModel(type, fColor, 1)
          .then((model) => {
            if (!model || !sceneRef.current || !building.mesh) return;
            // Only swap if building still alive and mesh is the original primitive
            sceneRef.current.remove(building.mesh);
            model.position.set(x, 0, z);
            model.userData = { buildingId: building.id };
            model.castShadow = true;
            model.receiveShadow = true;
            if (isConstructing) {
              model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                  if (m?.isMeshStandardMaterial) { m.transparent = true; m.opacity = 0.5; m.needsUpdate = true; }
                }
              });
            }
            sceneRef.current.add(model);
            building.mesh = model as unknown as THREE.Mesh;
          })
          .catch(() => { /* keep primitive */ });
      }
      
      const healthBarGroup = new THREE.Group();
      const bgGeometry = new THREE.PlaneGeometry(size, 0.25);
      const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
      const bg = new THREE.Mesh(bgGeometry, bgMaterial);
      healthBarGroup.add(bg);
      const fgGeometry = new THREE.PlaneGeometry(size * 0.95, 0.18);
      const fgMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
      const fg = new THREE.Mesh(fgGeometry, fgMaterial);
      fg.position.z = 0.01;
      fg.name = 'healthFill';
      healthBarGroup.add(fg);
      healthBarGroup.position.set(x, height + 1.5, z);
      healthBarGroup.rotation.x = -Math.PI / 4;
      sceneRef.current.add(healthBarGroup);
      building.healthBar = healthBarGroup;
    }
    
    return building;
  }, []);

  const createResourceNode = useCallback((type: ResourceType, x: number, z: number, amount: number): ResourceNode => {
    const node: ResourceNode = {
      id: `resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      position: { x, y: 0, z },
      amount
    };
    
    if (sceneRef.current) {
      if (type === 'gold') {
        // Immediate gold-mine placeholder crystal cluster
        const geometry = new THREE.DodecahedronGeometry(1.2);
        const material = new THREE.MeshStandardMaterial({
          color: 0xffd700, metalness: 0.9, roughness: 0.1,
          emissive: 0xffaa00, emissiveIntensity: 0.6,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 1.2, z);
        mesh.castShadow = true;
        mesh.userData = { resourceId: node.id };
        sceneRef.current.add(mesh);
        node.mesh = mesh;

        // Async CDN crate swap
        GrudgeAssets.getInstance().loadModel('env_crate').then((gltf) => {
          if (!gltf || !sceneRef.current || !node.mesh) return;
          sceneRef.current.remove(node.mesh!);
          const crate = gltf.scene.clone();
          crate.position.set(x, 0, z);
          crate.scale.setScalar(0.9);
          crate.userData = { resourceId: node.id };
          crate.traverse(c => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).castShadow = true; });
          sceneRef.current.add(crate);
          node.mesh = crate as unknown as THREE.Mesh;
        }).catch(() => {});
      } else {
        // Immediate cone+cylinder tree placeholder
        const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.32, 2.2, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, 1.1, z);
        trunk.castShadow = true;
        sceneRef.current.add(trunk);
        node.trunkMesh = trunk;

        const leavesGeometry = new THREE.ConeGeometry(1.3, 2.8, 8);
        const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x1f7a1f });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.set(x, 3.5, z);
        leaves.castShadow = true;
        leaves.userData = { resourceId: node.id };
        sceneRef.current.add(leaves);
        node.mesh = leaves;

        // Async CDN tree swap — pick one of 4 toon-shooter tree variants
        const treeKey = `env_tree_${(Math.floor(Math.random() * 4) + 1)}`;
        GrudgeAssets.getInstance().loadModel(treeKey).then((gltf) => {
          if (!gltf || !sceneRef.current || !node.mesh || !node.trunkMesh) return;
          sceneRef.current.remove(node.mesh!);
          sceneRef.current.remove(node.trunkMesh!);
          const tree = gltf.scene.clone();
          tree.position.set(x, 0, z);
          tree.scale.setScalar(1.0 + Math.random() * 0.3);
          tree.userData = { resourceId: node.id };
          tree.traverse(c => { if ((c as THREE.Mesh).isMesh) {
            (c as THREE.Mesh).castShadow = true;
            (c as THREE.Mesh).receiveShadow = true;
          }});
          sceneRef.current.add(tree);
          node.mesh = tree as unknown as THREE.Mesh;
          node.trunkMesh = undefined; // merged into single GLB
        }).catch(() => {});
      }
    }
    
    return node;
  }, []);

  const spawnFloatingText = useCallback((text: string, x: number, y: number, z: number, color: string) => {
    if (!sceneRef.current) return;
    const canvas = createTextCanvas(text, color);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(2, 0.5, 1);
    sceneRef.current.add(sprite);
    floatingTextsRef.current.push({ sprite, startY: y, life: 0, maxLife: 1.5 });
  }, []);

  const updateFloatingTexts = useCallback((dt: number) => {
    floatingTextsRef.current = floatingTextsRef.current.filter(ft => {
      ft.life += dt;
      const progress = ft.life / ft.maxLife;
      ft.sprite.position.y = ft.startY + progress * 3;
      (ft.sprite.material as THREE.SpriteMaterial).opacity = 1 - progress;
      if (ft.life >= ft.maxLife) {
        sceneRef.current?.remove(ft.sprite);
        ft.sprite.material.dispose();
        return false;
      }
      return true;
    });
  }, []);

  const spawnParticles = useCallback((x: number, y: number, z: number, type: Particle['type'], count: number = 5) => {
    if (!sceneRef.current) return;
    for (let i = 0; i < count; i++) {
      let geometry: THREE.BufferGeometry;
      let material: THREE.MeshBasicMaterial;
      let velocity: THREE.Vector3;
      let maxLife: number;

      switch (type) {
        case 'spark':
          geometry = new THREE.SphereGeometry(0.06, 4, 4);
          material = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 1 });
          velocity = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4);
          maxLife = 0.3 + Math.random() * 0.3;
          break;
        case 'fire':
          geometry = new THREE.SphereGeometry(0.12, 4, 4);
          material = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xff4400 : 0xffaa00, transparent: true, opacity: 0.9 });
          velocity = new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 2 + 1.5, (Math.random() - 0.5) * 0.8);
          maxLife = 0.5 + Math.random() * 0.5;
          break;
        case 'dust':
          geometry = new THREE.SphereGeometry(0.05, 3, 3);
          material = new THREE.MeshBasicMaterial({ color: 0x886644, transparent: true, opacity: 0.5 });
          velocity = new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 0.5 + 0.2, (Math.random() - 0.5) * 1.5);
          maxLife = 0.4 + Math.random() * 0.3;
          break;
        case 'arrow_trail':
          geometry = new THREE.SphereGeometry(0.04, 3, 3);
          material = new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.7 });
          velocity = new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.2, (Math.random() - 0.5) * 0.3);
          maxLife = 0.2 + Math.random() * 0.2;
          break;
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
      sceneRef.current.add(mesh);
      particlesRef.current.push({ mesh, velocity, life: 0, maxLife, fadeOut: true, type });
    }
  }, []);

  const updateParticles = useCallback((dt: number) => {
    particlesRef.current = particlesRef.current.filter(p => {
      p.life += dt;
      if (p.life >= p.maxLife) {
        sceneRef.current?.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        return false;
      }
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      if (p.type === 'fire') {
        p.velocity.y += dt * 0.5;
      } else {
        p.velocity.y -= dt * 3;
      }
      if (p.fadeOut) {
        const progress = p.life / p.maxLife;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
        const s = 1 - progress * 0.5;
        p.mesh.scale.set(s, s, s);
      }
      return true;
    });
  }, []);

  const updateBuildingFireEffects = useCallback((dt: number) => {
    if (!sceneRef.current) return;
    buildingsRef.current.forEach(building => {
      const healthPct = building.health / building.maxHealth;
      if (healthPct < 0.25 && healthPct > 0) {
        if (Math.random() < dt * 8) {
          spawnParticles(
            building.position.x + (Math.random() - 0.5) * 2,
            building.mesh ? building.mesh.position.y + 1 : 2,
            building.position.z + (Math.random() - 0.5) * 2,
            'fire', 3
          );
        }
      }
    });
  }, [spawnParticles]);

  const updateWaterAnimation = useCallback((time: number) => {
    if (!waterMeshRef.current) return;
    const geo = waterMeshRef.current.geometry as THREE.PlaneGeometry;
    const verts = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < verts.length; i += 3) {
      verts[i + 2] = Math.sin(verts[i] * 0.5 + time * 1.5) * 0.08 + Math.cos(verts[i + 1] * 0.7 + time * 1.2) * 0.05;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    const mat = waterMeshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.6 + Math.sin(time * 0.5) * 0.1;
  }, []);

  const spawnPhysicsProjectile = useCallback((
    startX: number, startY: number, startZ: number,
    targetX: number, targetZ: number,
    damage: number, targetId: string | null, faction: Faction,
    projectileType: 'arrow' | 'ballista' | 'magic'
  ) => {
    if (!sceneRef.current || !physicsWorldRef.current) return;
    
    const dx = targetX - startX;
    const dz = targetZ - startZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Faction-specific projectile colours
    const fColor = factionPrimary(faction);
    const fEmissive = faction === 'crusade' ? 0x3355cc
                    : faction === 'fabled'  ? 0x227722
                    : 0x881100;
    
    let meshGeom: THREE.BufferGeometry;
    let meshMat: THREE.MeshStandardMaterial;
    let mass = 0.5;
    
    if (projectileType === 'ballista') {
      // Thick bolt — faction-wood colour with metal tip
      meshGeom = new THREE.CylinderGeometry(0.055, 0.04, 1.4, 8);
      meshMat  = new THREE.MeshStandardMaterial({
        color:            0x6b4423,
        emissive:         fEmissive,
        emissiveIntensity: 0.25,
        metalness:        0.4,
        roughness:        0.6,
      });
      mass = 2.5;
    } else if (projectileType === 'magic') {
      // Glowing arcane orb — faction tinted
      meshGeom = new THREE.SphereGeometry(0.22, 10, 10);
      meshMat  = new THREE.MeshStandardMaterial({
        color:            fColor,
        emissive:         fColor,
        emissiveIntensity: 1.4,
        metalness:        0,
        roughness:        0,
        transparent:      true,
        opacity:          0.88,
      });
      mass = 0.3;
    } else {
      // Slim arrow — faction-coloured shaft
      meshGeom = new THREE.CylinderGeometry(0.025, 0.015, 0.7, 6);
      meshMat  = new THREE.MeshStandardMaterial({
        color:    faction === 'fabled' ? 0x4a8a3a : 0x9b7a2a,
        emissive: fEmissive,
        emissiveIntensity: 0.1,
      });
      mass = 0.2;
    }
    
    const mesh = new THREE.Mesh(meshGeom, meshMat);
    mesh.position.set(startX, startY, startZ);
    mesh.castShadow = true;
    sceneRef.current.add(mesh);
    
    const shape = projectileType === 'magic' 
      ? new CANNON.Sphere(0.2) 
      : new CANNON.Cylinder(0.05, 0.05, projectileType === 'ballista' ? 1.2 : 0.6, 6);
    const body = new CANNON.Body({ mass, shape });
    body.position.set(startX, startY, startZ);
    
    const speed = projectileType === 'ballista' ? 12 : projectileType === 'magic' ? 15 : 18;
    const arcHeight = projectileType === 'ballista' ? 8 : projectileType === 'magic' ? 3 : 5;
    const vx = (dx / dist) * speed;
    const vz = (dz / dist) * speed;
    const flightTime = dist / speed;
    const vy = (arcHeight / flightTime) + (9.82 * flightTime * 0.5);
    
    body.velocity.set(vx, vy, vz);
    physicsWorldRef.current.addBody(body);
    
    physicsProjectilesRef.current.push({
      mesh,
      body,
      damage,
      targetId,
      faction,
      life: 0,
      trailMeshes: []
    });
  }, []);

  const spawnBuildingDebris = useCallback((building: GameBuilding) => {
    if (!sceneRef.current || !physicsWorldRef.current) return;
    
    const debrisCount = 6 + Math.floor(Math.random() * 4);
    const size = isTownHall(building.type) ? 3 : 2;
    
    for (let i = 0; i < debrisCount; i++) {
      const debrisSize = 0.3 + Math.random() * 0.6;
      const geom = Math.random() > 0.5 
        ? new THREE.BoxGeometry(debrisSize, debrisSize, debrisSize)
        : new THREE.TetrahedronGeometry(debrisSize);
      const color = factionPrimary(building.faction);
      const mat = new THREE.MeshStandardMaterial({ 
        color: color + Math.floor(Math.random() * 0x222222),
        roughness: 0.9 
      });
      const mesh = new THREE.Mesh(geom, mat);
      const px = building.position.x + (Math.random() - 0.5) * size;
      const py = size * 0.5 + Math.random() * 2;
      const pz = building.position.z + (Math.random() - 0.5) * size;
      mesh.position.set(px, py, pz);
      mesh.castShadow = true;
      sceneRef.current.add(mesh);
      
      const shape = new CANNON.Box(new CANNON.Vec3(debrisSize / 2, debrisSize / 2, debrisSize / 2));
      const body = new CANNON.Body({ mass: 1 + Math.random() * 2, shape });
      body.position.set(px, py, pz);
      body.velocity.set(
        (Math.random() - 0.5) * 8,
        3 + Math.random() * 6,
        (Math.random() - 0.5) * 8
      );
      body.angularVelocity.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      physicsWorldRef.current.addBody(body);
      
      physicsDebrisRef.current.push({ mesh, body, life: 0 });
    }
  }, []);

  const spawnFallingTree = useCallback((resourceNode: ResourceNode) => {
    if (!sceneRef.current || !resourceNode.mesh || !resourceNode.trunkMesh) return;
    
    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(resourceNode.position.x, 0, resourceNode.position.z);
    sceneRef.current.add(pivotGroup);
    
    const trunk = resourceNode.trunkMesh;
    const leaves = resourceNode.mesh;
    sceneRef.current.remove(trunk);
    sceneRef.current.remove(leaves);
    
    trunk.position.set(0, 1, 0);
    leaves.position.set(0, 3.25, 0);
    pivotGroup.add(trunk);
    pivotGroup.add(leaves);
    
    const fallDirection = Math.random() * Math.PI * 2;
    
    fallingTreesRef.current.push({
      mesh: leaves,
      trunkMesh: trunk,
      pivotGroup,
      fallSpeed: 0.5 + Math.random() * 0.5,
      currentAngle: 0,
      maxAngle: Math.PI / 2,
      life: 0,
    });
    
    const axis = new THREE.Vector3(Math.sin(fallDirection), 0, Math.cos(fallDirection));
    pivotGroup.userData.fallAxis = axis;
  }, []);

  const updatePhysics = useCallback((dt: number) => {
    if (!physicsWorldRef.current) return;
    
    physicsWorldRef.current.step(1 / 60, dt, 3);
    
    physicsProjectilesRef.current = physicsProjectilesRef.current.filter(proj => {
      proj.life += dt;
      
      proj.mesh.position.set(
        proj.body.position.x,
        proj.body.position.y,
        proj.body.position.z
      );
      
      const vel = proj.body.velocity;
      if (vel.length() > 0.1) {
        const dir = new THREE.Vector3(vel.x, vel.y, vel.z).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion();
        const axis = new THREE.Vector3().crossVectors(up, dir).normalize();
        if (axis.length() > 0.001) {
          const angle = Math.acos(Math.min(1, Math.max(-1, up.dot(dir))));
          quat.setFromAxisAngle(axis, angle);
          proj.mesh.quaternion.copy(quat);
        }
      }
      
      if (proj.body.position.y <= 0.1 || proj.life > 5) {
        if (proj.targetId) {
          const targetUnit = unitsRef.current.find(u => u.id === proj.targetId);
          const targetBuilding = buildingsRef.current.find(b => b.id === proj.targetId);
          const target = targetUnit || targetBuilding;
          if (target && target.health > 0) {
            const hitDist = Math.sqrt(
              Math.pow(proj.mesh.position.x - target.position.x, 2) +
              Math.pow(proj.mesh.position.z - target.position.z, 2)
            );
            if (hitDist < 3) {
              const armor = targetUnit ? targetUnit.armor : 0;
              target.health -= Math.max(1, proj.damage - armor);
              if (target.healthBar) {
                const healthFill = target.healthBar.children.find(c => c.name === 'healthFill') as THREE.Mesh;
                if (healthFill) {
                  const pct = Math.max(0, target.health / target.maxHealth);
                  healthFill.scale.x = pct;
                  (healthFill.material as THREE.MeshBasicMaterial).color.setHex(
                    pct > 0.5 ? 0x00ff00 : pct > 0.25 ? 0xffff00 : 0xff0000
                  );
                }
              }
              spawnFloatingText(`-${proj.damage}`, target.position.x, 3, target.position.z, '#FF4444');
            }
          }
        }
        
        sceneRef.current?.remove(proj.mesh);
        proj.mesh.geometry.dispose();
        (proj.mesh.material as THREE.Material).dispose();
        proj.trailMeshes.forEach(t => {
          sceneRef.current?.remove(t);
          t.geometry.dispose();
          (t.material as THREE.Material).dispose();
        });
        physicsWorldRef.current?.removeBody(proj.body);
        return false;
      }
      
      if (proj.life > 0.05 && Math.random() < dt * 30) {
        if (sceneRef.current) {
          const trailGeom = new THREE.SphereGeometry(0.045, 4, 4);
          // Trail colour matches projectile faction tint
          const pMat = proj.mesh.material as THREE.MeshStandardMaterial;
          const trailBaseColor = pMat?.emissive
            ? pMat.emissive.getHex()
            : (pMat?.color?.getHex() ?? 0xffaa00);
          const trailMat = new THREE.MeshBasicMaterial({
            color: trailBaseColor, transparent: true, opacity: 0.55,
          });
          const trailMesh = new THREE.Mesh(trailGeom, trailMat);
          trailMesh.position.copy(proj.mesh.position);
          sceneRef.current.add(trailMesh);
          proj.trailMeshes.push(trailMesh);
          if (proj.trailMeshes.length > 10) {
            const old = proj.trailMeshes.shift()!;
            sceneRef.current.remove(old);
            old.geometry.dispose();
            (old.material as THREE.Material).dispose();
          }
        }
      }
      proj.trailMeshes.forEach((t, i) => {
        const age = (proj.trailMeshes.length - i) / proj.trailMeshes.length;
        (t.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - age);
        const s = 1 - age * 0.5;
        t.scale.set(s, s, s);
      });
      
      return true;
    });
    
    physicsDebrisRef.current = physicsDebrisRef.current.filter(debris => {
      debris.life += dt;
      
      debris.mesh.position.set(
        debris.body.position.x,
        debris.body.position.y,
        debris.body.position.z
      );
      debris.mesh.quaternion.set(
        debris.body.quaternion.x,
        debris.body.quaternion.y,
        debris.body.quaternion.z,
        debris.body.quaternion.w
      );
      
      if (debris.life > 3) {
        const fadeProgress = (debris.life - 3) / 2;
        (debris.mesh.material as THREE.MeshStandardMaterial).transparent = true;
        (debris.mesh.material as THREE.MeshStandardMaterial).opacity = 1 - fadeProgress;
      }
      
      if (debris.life > 5) {
        sceneRef.current?.remove(debris.mesh);
        debris.mesh.geometry.dispose();
        (debris.mesh.material as THREE.Material).dispose();
        physicsWorldRef.current?.removeBody(debris.body);
        return false;
      }
      return true;
    });
    
    fallingTreesRef.current = fallingTreesRef.current.filter(tree => {
      tree.life += dt;
      tree.currentAngle += tree.fallSpeed * dt * 2;
      
      if (tree.currentAngle >= tree.maxAngle) {
        tree.currentAngle = tree.maxAngle;
      }
      
      const axis = tree.pivotGroup.userData.fallAxis as THREE.Vector3;
      if (axis) {
        tree.pivotGroup.setRotationFromAxisAngle(axis, tree.currentAngle);
      }
      
      if (tree.life > 3) {
        const fadeProgress = (tree.life - 3) / 2;
        [tree.mesh, tree.trunkMesh].forEach(m => {
          if (m) {
            (m.material as THREE.MeshStandardMaterial).transparent = true;
            (m.material as THREE.MeshStandardMaterial).opacity = 1 - fadeProgress;
          }
        });
      }
      
      if (tree.life > 5) {
        sceneRef.current?.remove(tree.pivotGroup);
        [tree.mesh, tree.trunkMesh].forEach(m => {
          if (m) {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
          }
        });
        return false;
      }
      return true;
    });
  }, [spawnFloatingText]);

  const [webglError, setWebglError] = useState(false);

  const initializeScene = useCallback(() => {
    if (!containerRef.current || isInitializedRef.current) return;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 50, 200);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 400);
    camera.position.set(10, 25, 35);
    camera.lookAt(10, 0, 10);
    cameraRef.current = camera;
    
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
      setWebglError(true);
      return;
    }
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(containerRef.current.clientWidth, containerRef.current.clientHeight),
      0.3,
      0.4,
      0.85
    );
    composer.addPass(bloomPass);
    composerRef.current = composer;
    
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffffcc, 1.2);
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    scene.add(sunLight);
    
    const groundRes = 128;
    const groundGeometry = new THREE.PlaneGeometry(MAP_SIZE + 16, MAP_SIZE + 16, groundRes, groundRes);
    const vertices = groundGeometry.attributes.position.array as Float32Array;
    const groundColors = new Float32Array((groundRes + 1) * (groundRes + 1) * 3);
    
    for (let i = 0; i <= groundRes; i++) {
      for (let j = 0; j <= groundRes; j++) {
        const idx = (i * (groundRes + 1) + j);
        const vIdx = idx * 3;
        const wx = (j / groundRes) * (MAP_SIZE + 16) - 8;
        const wz = (i / groundRes) * (MAP_SIZE + 16) - 8;
        
        const borderDist = Math.min(wx, wz, MAP_SIZE - wx, MAP_SIZE - wz);
        let height = 0;
        
        if (borderDist < 0) {
          height = 3 + Math.abs(borderDist) * 1.2 + Math.random() * 0.5;
        } else if (borderDist < 3) {
          const t = 1 - borderDist / 3;
          height = t * t * 3 + Math.random() * 0.3;
        } else {
          height = Math.random() * 0.15;
          const cx = MAP_SIZE / 2, cz = MAP_SIZE / 2;
          const distCenter = Math.sqrt((wx - cx) * (wx - cx) + (wz - cz) * (wz - cz));
          if (distCenter < 10) {
            height = -0.1;
          }
        }
        vertices[vIdx + 2] = height;
        
        let r: number, g: number, b: number;
        if (borderDist < 0) {
          r = 0.42; g = 0.42; b = 0.42;
        } else if (borderDist < 2) {
          const t = borderDist / 2;
          r = 0.42 * (1 - t) + 0.36 * t;
          g = 0.42 * (1 - t) + 0.30 * t;
          b = 0.42 * (1 - t) + 0.18 * t;
        } else if (borderDist < 5) {
          r = 0.36; g = 0.30; b = 0.18;
        } else {
          r = 0.24 + Math.random() * 0.06;
          g = 0.36 + Math.random() * 0.06;
          b = 0.18 + Math.random() * 0.04;
          const distCenter = Math.sqrt((wx - MAP_SIZE / 2) ** 2 + (wz - MAP_SIZE / 2) ** 2);
          if (distCenter < 10) {
            r = 0.75 + Math.random() * 0.05;
            g = 0.66 + Math.random() * 0.05;
            b = 0.40 + Math.random() * 0.05;
          }
        }
        groundColors[vIdx] = r;
        groundColors[vIdx + 1] = g;
        groundColors[vIdx + 2] = b;
      }
    }
    groundGeometry.setAttribute('color', new THREE.BufferAttribute(groundColors, 3));
    groundGeometry.computeVertexNormals();
    
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      vertexColors: true,
      roughness: 1,
      metalness: 0
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(MAP_SIZE / 2, 0, MAP_SIZE / 2);
    ground.receiveShadow = true;
    ground.name = 'ground';
    scene.add(ground);
    
    const waterGeometry = new THREE.PlaneGeometry(18, 14, 32, 32);
    const waterVerts = waterGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < waterVerts.length; i += 3) {
      waterVerts[i + 2] = Math.sin(waterVerts[i] * 0.5) * 0.05;
    }
    const waterMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a7ab5,
      transparent: true,
      opacity: 0.65,
      roughness: 0.05,
      metalness: 0.8,
      emissive: 0x0a2a40,
      emissiveIntensity: 0.15
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(MAP_SIZE / 2, 0.05, MAP_SIZE / 2);
    scene.add(water);
    waterMeshRef.current = water;
    
    const borderEdge = 4;
    for (let i = 0; i < 20; i++) {
      const side = Math.floor(Math.random() * 4);
      let rx: number, rz: number;
      if (side === 0) { rx = Math.random() * MAP_SIZE; rz = -borderEdge * Math.random(); }
      else if (side === 1) { rx = Math.random() * MAP_SIZE; rz = MAP_SIZE + borderEdge * Math.random(); }
      else if (side === 2) { rx = -borderEdge * Math.random(); rz = Math.random() * MAP_SIZE; }
      else { rx = MAP_SIZE + borderEdge * Math.random(); rz = Math.random() * MAP_SIZE; }
      const rockSize = 0.5 + Math.random() * 1.5;
      const rockGeom = new THREE.DodecahedronGeometry(rockSize, 0);
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x555555 + Math.floor(Math.random() * 0x222222), roughness: 0.9 });
      const rock = new THREE.Mesh(rockGeom, rockMat);
      rock.position.set(rx, rockSize * 0.4 + 2, rz);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      scene.add(rock);
    }
    
    const fogGeometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, FOG_GRID_SIZE - 1, FOG_GRID_SIZE - 1);
    const colors = new Float32Array(FOG_GRID_SIZE * FOG_GRID_SIZE * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = 1;
      colors[i + 1] = 1;
      colors[i + 2] = 1;
    }
    fogGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const fogMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x000000,
      transparent: true,
      opacity: 0.7,
      vertexColors: true
    });
    const fogMesh = new THREE.Mesh(fogGeometry, fogMaterial);
    fogMesh.rotation.x = -Math.PI / 2;
    fogMesh.position.set(MAP_SIZE / 2, 0.5, MAP_SIZE / 2);
    scene.add(fogMesh);
    fogMeshRef.current = fogMesh;
    
    const previewGeom = new THREE.BoxGeometry(2.5, 2, 2.5);
    const previewMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: 0.4,
      wireframe: true
    });
    const previewMesh = new THREE.Mesh(previewGeom, previewMat);
    previewMesh.visible = false;
    scene.add(previewMesh);
    placementPreviewRef.current = previewMesh;
    
    initFogGrid();
    
    const physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    });
    physicsWorld.broadphase = new CANNON.NaiveBroadphase();
    physicsWorld.defaultContactMaterial.friction = 0.5;
    physicsWorld.defaultContactMaterial.restitution = 0.3;
    physicsWorldRef.current = physicsWorld;
    
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    physicsWorld.addBody(groundBody);
    groundBodyRef.current = groundBody;
    
    isInitializedRef.current = true;
  }, [initFogGrid]);

  const initializeGameEntities = useCallback((faction: Faction, mode: GameMode) => {
    if (!sceneRef.current) return;

    const newUnits: GameUnit[] = [];
    const newBuildings: GameBuilding[] = [];
    const newResources: ResourceNode[] = [];

    const MS = MAP_SIZE;
    const start = factionStart(faction);

    // WC3-style: player at bottom-left, enemy at top-right
    const pX = Math.round(MS * 0.12), pZ = Math.round(MS * 0.12);
    const eX = Math.round(MS * 0.88), eZ = Math.round(MS * 0.88);

    // — Player base —
    newBuildings.push(createBuilding(start.townHall, faction, pX, pZ, false));
    newBuildings.push(createBuilding(start.farm,     faction, pX + 6,  pZ - 4, false));
    newBuildings.push(createBuilding(start.barracks, faction, pX - 6,  pZ + 4, false));
    for (let i = 0; i < 5; i++) {
      newUnits.push(createUnit(start.worker, faction, pX + 4 + (i % 3) * 1.4, pZ + Math.floor(i / 3) * 1.4));
    }
    for (let i = 0; i < 4; i++) {
      newUnits.push(createUnit(start.melee, faction, pX + i * 1.5, pZ + 5));
    }

    // — Enemy base —
    if (mode === 'pve' || mode === 'pvp') {
      const ef = ENEMY_FACTION[faction];
      const eStart = factionStart(ef);
      newBuildings.push(createBuilding(eStart.townHall, ef, eX,     eZ,     false));
      newBuildings.push(createBuilding(eStart.barracks, ef, eX - 6, eZ,     false));
      newBuildings.push(createBuilding(eStart.farm,     ef, eX + 5, eZ - 4, false));
      for (let i = 0; i < 5; i++) {
        newUnits.push(createUnit(eStart.worker, ef, eX + 4 + (i % 3) * 1.4, eZ + Math.floor(i / 3) * 1.4));
      }
      for (let i = 0; i < 5; i++) {
        newUnits.push(createUnit(eStart.melee, ef, eX - 3 + i * 1.4, eZ + 5));
      }
    }

    // — Gold mines: near each base + 5 contested central mines —
    newResources.push(createResourceNode('gold', pX + MS*0.08, pZ - MS*0.05, 15000));
    newResources.push(createResourceNode('gold', eX - MS*0.05, eZ - MS*0.05, 15000));
    // Top-left and bottom-right expansion mines
    newResources.push(createResourceNode('gold', MS*0.1,  MS*0.8, 8000));
    newResources.push(createResourceNode('gold', MS*0.9,  MS*0.2, 8000));
    // Contested center mines (3-lane junction)
    const cx = MS / 2, cz = MS / 2;
    newResources.push(createResourceNode('gold', cx,          cz,          10000));
    newResources.push(createResourceNode('gold', cx - MS*0.12,cz - MS*0.1, 7000));
    newResources.push(createResourceNode('gold', cx + MS*0.12,cz + MS*0.1, 7000));
    newResources.push(createResourceNode('gold', cx - MS*0.12,cz + MS*0.1, 6000));
    newResources.push(createResourceNode('gold', cx + MS*0.12,cz - MS*0.1, 6000));

    // — Lumber belts near bases and jungle zones between lanes —
    for (let i = 0; i < 14; i++) {
      newResources.push(createResourceNode('lumber', pX + 12 + (i % 4) * 2.8, pZ + Math.floor(i/4) * 2.8, 160));
      newResources.push(createResourceNode('lumber', eX -  8 - (i % 4) * 2.8, eZ + Math.floor(i/4) * 2.8, 160));
    }
    // Top-left and bottom-right jungle zones
    for (let i = 0; i < 20; i++) {
      const jx = MS*0.15 + Math.random()*MS*0.25, jz = MS*0.45 + Math.random()*MS*0.3;
      newResources.push(createResourceNode('lumber', jx, jz, 130));
      newResources.push(createResourceNode('lumber', MS - jx, MS - jz, 130));
    }
    // Scattered lumber across open map
    const lumberCount = Math.round(40 * (MS / 128));
    for (let i = 0; i < lumberCount; i++) {
      const x = 20 + Math.random() * (MS - 40);
      const z = 20 + Math.random() * (MS - 40);
      if (Math.abs(x - cx) > 14 || Math.abs(z - cz) > 12) {
        newResources.push(createResourceNode('lumber', x, z, 120));
      }
    }

    unitsRef.current = newUnits;
    buildingsRef.current = newBuildings;
    resourceNodesRef.current = newResources;
    
    setResources({
      crusade: { gold: 2000, lumber: 1000 },
      fabled: { gold: 2000, lumber: 1000 },
      legion: { gold: 2000, lumber: 1000 },
    });
    setFood({
      crusade: { used: 5, max: 9 },
      fabled: { used: 5, max: 9 },
      legion: { used: 5, max: 9 },
    });
    
    const MS2 = MAP_SIZE;
    setCameraPosition({ x: Math.round(MS2*0.12), z: Math.round(MS2*0.12) });
  }, [createUnit, createBuilding, createResourceNode]);

  const startGame = useCallback((mode: GameMode, faction: Faction, szKey: MapSizeKey = mapSizeKey) => {
    // Apply dynamic map dimensions from MAP_SIZE_CFG
    const cfg = MAP_SIZE_CFG[szKey];
    MAP_SIZE      = cfg.tiles;
    FOG_GRID_SIZE = cfg.fog;
    gameTotalTimeRef.current = 0;
    setMapSizeKey(szKey);
    setGameMode(mode);
    setPlayerFaction(faction);
    setIsPaused(false);
    setGameTime(0);
    setSelectedUnits([]);
    setSelectedBuilding(null);
    setBuildingToBuild(null);
    setCurrentCommand(null);
    setShowBuildMenu(false);
    
    if (sceneRef.current) {
      unitsRef.current.forEach(u => {
        if (u.mesh) sceneRef.current?.remove(u.mesh);
        if (u.selectionRing) sceneRef.current?.remove(u.selectionRing);
        if (u.healthBar) sceneRef.current?.remove(u.healthBar);
      });
      buildingsRef.current.forEach(b => {
        if (b.mesh) sceneRef.current?.remove(b.mesh);
        if (b.healthBar) sceneRef.current?.remove(b.healthBar);
        if (b.auxMeshes) b.auxMeshes.forEach(m => sceneRef.current?.remove(m));
      });
      resourceNodesRef.current.forEach(r => {
        if (r.mesh) sceneRef.current?.remove(r.mesh);
        if (r.trunkMesh) sceneRef.current?.remove(r.trunkMesh);
      });
      floatingTextsRef.current.forEach(ft => {
        sceneRef.current?.remove(ft.sprite);
        ft.sprite.material.dispose();
      });
      floatingTextsRef.current = [];
    }
    
    physicsProjectilesRef.current.forEach(proj => {
      sceneRef.current?.remove(proj.mesh);
      proj.mesh.geometry.dispose();
      (proj.mesh.material as THREE.Material).dispose();
      proj.trailMeshes.forEach(t => {
        sceneRef.current?.remove(t);
        t.geometry.dispose();
        (t.material as THREE.Material).dispose();
      });
      physicsWorldRef.current?.removeBody(proj.body);
    });
    physicsProjectilesRef.current = [];
    
    physicsDebrisRef.current.forEach(debris => {
      sceneRef.current?.remove(debris.mesh);
      debris.mesh.geometry.dispose();
      (debris.mesh.material as THREE.Material).dispose();
      physicsWorldRef.current?.removeBody(debris.body);
    });
    physicsDebrisRef.current = [];
    
    fallingTreesRef.current.forEach(tree => {
      sceneRef.current?.remove(tree.pivotGroup);
      [tree.mesh, tree.trunkMesh].forEach(m => {
        if (m) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    });
    fallingTreesRef.current = [];
    
    unitsRef.current = [];
    buildingsRef.current = [];
    resourceNodesRef.current = [];
    
    initFogGrid();
    updateFogMesh();
    unitGroupsRef.current = {};
    
    if (isInitializedRef.current && sceneRef.current) {
      initializeGameEntities(faction, mode);
    } else {
      pendingGameRef.current = { mode, faction };
    }
  }, [initFogGrid, initializeGameEntities, updateFogMesh]);

  const issueOrder = useCallback((order: OrderType, targetX?: number, targetZ?: number, targetId?: string) => {
    if (selectedUnits.length === 0) return;
    
    unitsRef.current = unitsRef.current.map((unit, idx) => {
      if (selectedUnits.includes(unit.id)) {
        const offsetX = (idx % 3) * 1.5;
        const offsetZ = Math.floor(idx / 3) * 1.5;
        
        switch (order) {
          case 'move':
            return { 
              ...unit, 
              currentOrder: order,
              targetPosition: targetX !== undefined ? { x: targetX + offsetX, y: 0.5, z: (targetZ || 0) + offsetZ } : null,
              attackTarget: null,
              gatherTarget: null,
              lastGatherTarget: null,
              patrolStart: null,
              patrolEnd: null
            };
          case 'attack':
            return {
              ...unit,
              currentOrder: order,
              attackTarget: targetId || null,
              targetPosition: targetX !== undefined ? { x: targetX, y: 0.5, z: targetZ || 0 } : null,
              gatherTarget: null,
              lastGatherTarget: null
            };
          case 'attackmove':
            return {
              ...unit,
              currentOrder: order,
              targetPosition: targetX !== undefined ? { x: targetX + offsetX, y: 0.5, z: (targetZ || 0) + offsetZ } : null,
              attackTarget: null,
              gatherTarget: null,
              lastGatherTarget: null
            };
          case 'patrol':
            return {
              ...unit,
              currentOrder: order,
              patrolStart: { ...unit.position },
              patrolEnd: targetX !== undefined ? { x: targetX, y: 0.5, z: targetZ || 0 } : null,
              targetPosition: targetX !== undefined ? { x: targetX, y: 0.5, z: targetZ || 0 } : null,
              attackTarget: null,
              gatherTarget: null,
              lastGatherTarget: null
            };
          case 'repair':
            if (isWorkerUnit(unit.type) && targetId) {
              const targetBuilding = buildingsRef.current.find(b => b.id === targetId);
              if (targetBuilding && targetBuilding.faction === unit.faction) {
                return {
                  ...unit,
                  currentOrder: order,
                  repairTarget: targetId,
                  attackTarget: null,
                  targetPosition: { x: targetBuilding.position.x, y: 0.5, z: targetBuilding.position.z },
                  gatherTarget: null,
                  lastGatherTarget: null
                };
              }
            }
            return unit;
          case 'stop':
            return {
              ...unit,
              currentOrder: null,
              targetPosition: null,
              attackTarget: null,
              repairTarget: null,
              gatherTarget: null,
              lastGatherTarget: null,
              patrolStart: null,
              patrolEnd: null
            };
          case 'hold':
            return {
              ...unit,
              currentOrder: order,
              targetPosition: null,
              attackTarget: null,
              gatherTarget: null,
              lastGatherTarget: null
            };
          case 'gather':
            return {
              ...unit,
              currentOrder: order,
              gatherTarget: targetId || null,
              lastGatherTarget: targetId || null,
              targetPosition: targetX !== undefined ? { x: targetX, y: 0.5, z: targetZ || 0 } : null,
              attackTarget: null
            };
          default:
            return unit;
        }
      }
      return unit;
    });
    
    setCurrentCommand(null);
  }, [selectedUnits]);

  const getTargetAtPosition = useCallback((screenX: number, screenY: number) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = ((screenX - rect.left) / rect.width) * 2 - 1;
    const my = -((screenY - rect.top) / rect.height) * 2 + 1;
    const tempMouse = new THREE.Vector2(mx, my);
    const tempRay = new THREE.Raycaster();
    tempRay.setFromCamera(tempMouse, cameraRef.current);
    const intersects = tempRay.intersectObjects(sceneRef.current.children, true);
    const ground = intersects.find(i => i.object.name === 'ground');
    const targetPos = ground?.point;
    if (!targetPos) return { type: 'none' as const };
    const enemyUnit = unitsRef.current.find(u =>
      u.faction !== playerFaction && u.isVisible &&
      Math.abs(u.position.x - targetPos.x) < 1.5 && Math.abs(u.position.z - targetPos.z) < 1.5
    );
    if (enemyUnit) return { type: 'enemy' as const, pos: targetPos, id: enemyUnit.id };
    const enemyBuilding = buildingsRef.current.find(b =>
      b.faction !== playerFaction && b.isVisible &&
      Math.abs(b.position.x - targetPos.x) < 2.5 && Math.abs(b.position.z - targetPos.z) < 2.5
    );
    if (enemyBuilding) return { type: 'enemy' as const, pos: targetPos, id: enemyBuilding.id };
    const resource = resourceNodesRef.current.find(r =>
      Math.abs(r.position.x - targetPos.x) < 1.5 && Math.abs(r.position.z - targetPos.z) < 1.5
    );
    if (resource) return { type: 'resource' as const, pos: targetPos, id: resource.id };
    const friendlyBuilding = buildingsRef.current.find(b =>
      b.faction === playerFaction &&
      Math.abs(b.position.x - targetPos.x) < 2.5 && Math.abs(b.position.z - targetPos.z) < 2.5 &&
      b.health < b.maxHealth
    );
    if (friendlyBuilding) return { type: 'repair' as const, pos: targetPos, id: friendlyBuilding.id };
    const friendlyUnit = unitsRef.current.find(u =>
      u.faction === playerFaction &&
      Math.abs(u.position.x - targetPos.x) < 1.5 && Math.abs(u.position.z - targetPos.z) < 1.5
    );
    if (friendlyUnit) return { type: 'friendly' as const, pos: targetPos, id: friendlyUnit.id };
    return { type: 'ground' as const, pos: targetPos };
  }, [playerFaction]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0 || gameMode === 'menu') return;
    if (buildingToBuild || currentCommand) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  }, [gameMode, buildingToBuild, currentCommand]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (e.button !== 0 || gameMode === 'menu') return;
    
    if (isDraggingRef.current && dragSelect) {
      if (!containerRef.current || !cameraRef.current || !sceneRef.current) {
        setDragSelect(null);
        dragStartRef.current = null;
        setTimeout(() => { isDraggingRef.current = false; }, 50);
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const minX = Math.min(dragSelect.startX, dragSelect.endX);
      const maxX = Math.max(dragSelect.startX, dragSelect.endX);
      const minY = Math.min(dragSelect.startY, dragSelect.endY);
      const maxY = Math.max(dragSelect.startY, dragSelect.endY);
      
      const selected: string[] = [];
      const unitScreenRadius = rect.width * 0.025;
      unitsRef.current.forEach(unit => {
        if (unit.faction !== playerFaction || !unit.mesh) return;
        if (!unit.isVisible) return;
        const pos3 = new THREE.Vector3(unit.position.x, unit.position.y + 0.5, unit.position.z);
        pos3.project(cameraRef.current!);
        if (pos3.z < -1 || pos3.z > 1) return;
        const sx = ((pos3.x + 1) / 2) * rect.width + rect.left;
        const sy = ((-pos3.y + 1) / 2) * rect.height + rect.top;
        if (sx + unitScreenRadius >= minX && sx - unitScreenRadius <= maxX &&
            sy + unitScreenRadius >= minY && sy - unitScreenRadius <= maxY) {
          selected.push(unit.id);
        }
      });
      const maxGroupSize = 12;
      const trimmed = selected.slice(0, maxGroupSize);
      if (trimmed.length > 0) {
        if (e.shiftKey) {
          setSelectedUnits(prev => {
            const merged = Array.from(new Set([...prev, ...trimmed]));
            return merged.slice(0, maxGroupSize);
          });
        } else {
          setSelectedUnits(trimmed);
          setSelectedBuilding(null);
        }
      }
      setDragSelect(null);
      dragStartRef.current = null;
      setTimeout(() => { isDraggingRef.current = false; }, 50);
      return;
    }
    
    dragStartRef.current = null;
    isDraggingRef.current = false;
    setDragSelect(null);
  }, [gameMode, dragSelect, playerFaction]);

  const handleClick = useCallback((e: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current || gameMode === 'menu') return;
    if (isDraggingRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
    
    const groundIntersect = intersects.find(i => i.object.name === 'ground');
    const targetPos = groundIntersect?.point;
    
    if (e.button === 2 || currentCommand) {
      // RMB on ground while a building is selected → set rally point
      if (e.button === 2 && selectedBuilding && selectedUnits.length === 0 && targetPos) {
        const building = buildingsRef.current.find(b => b.id === selectedBuilding);
        if (building && building.faction === playerFaction) {
          building.rallyPoint = { x: targetPos.x, y: 0.5, z: targetPos.z };
          spawnFloatingText('🚩 Rally', targetPos.x, 2, targetPos.z, '#00FF88');
        }
        return;
      }
      if (selectedUnits.length > 0 && targetPos) {
        const target = getTargetAtPosition(e.clientX, e.clientY);
        if (currentCommand === 'attack' && target?.type === 'enemy') {
          issueOrder('attack', targetPos.x, targetPos.z, target.id);
        } else if (currentCommand === 'gather' && target?.type === 'resource') {
          issueOrder('gather', targetPos.x, targetPos.z, target.id);
        } else if (currentCommand === 'patrol') {
          issueOrder('patrol', targetPos.x, targetPos.z);
        } else if (currentCommand === 'repair' && target?.type === 'repair') {
          issueOrder('repair', targetPos.x, targetPos.z, target.id);
        } else if (currentCommand) {
          issueOrder(currentCommand, targetPos.x, targetPos.z);
        } else if (target?.type === 'enemy') {
          issueOrder('attack', targetPos.x, targetPos.z, target.id);
        } else if (target?.type === 'resource' && unitsRef.current.some(u => selectedUnits.includes(u.id) && isWorkerUnit(u.type))) {
          issueOrder('gather', targetPos.x, targetPos.z, target.id);
        } else {
          issueOrder('move', targetPos.x, targetPos.z);
        }
      }
      setCurrentCommand(null);
      return;
    }
    
    if (buildingToBuild && targetPos) {
      const stats = bStat(buildingToBuild);
      if (resources[playerFaction].gold >= stats.cost.gold && resources[playerFaction].lumber >= stats.cost.lumber) {
        const newBuilding = createBuilding(buildingToBuild, playerFaction, targetPos.x, targetPos.z, true);
        buildingsRef.current.push(newBuilding);
        
        setResources(prev => ({
          ...prev,
          [playerFaction]: {
            gold: prev[playerFaction].gold - stats.cost.gold,
            lumber: prev[playerFaction].lumber - stats.cost.lumber
          }
        }));
        
        setBuildingToBuild(null);
        setShowBuildMenu(false);
        if (placementPreviewRef.current) {
          placementPreviewRef.current.visible = false;
        }
      }
      return;
    }
    
    let clickedUnitId: string | null = null;
    let clickedBuildingId: string | null = null;
    
    for (const intersect of intersects) {
      if (intersect.object.userData?.unitId) {
        const unit = unitsRef.current.find(u => u.id === intersect.object.userData.unitId);
        if (unit && unit.faction === playerFaction) {
          clickedUnitId = unit.id;
          break;
        }
      }
      if (intersect.object.userData?.buildingId) {
        const building = buildingsRef.current.find(b => b.id === intersect.object.userData.buildingId);
        if (building && building.faction === playerFaction) {
          clickedBuildingId = building.id;
          break;
        }
      }
    }
    
    if (clickedUnitId) {
      if (e.ctrlKey || e.shiftKey) {
        setSelectedUnits(prev => 
          prev.includes(clickedUnitId!) 
            ? prev.filter(id => id !== clickedUnitId)
            : [...prev, clickedUnitId!]
        );
      } else {
        setSelectedUnits([clickedUnitId]);
        setSelectedBuilding(null);
        setShowBuildMenu(false);
      }
    } else if (clickedBuildingId) {
      setSelectedBuilding(clickedBuildingId);
      setSelectedUnits([]);
      setShowBuildMenu(false);
    } else {
      if (!e.ctrlKey && !e.shiftKey) {
        setSelectedUnits([]);
        setSelectedBuilding(null);
        setShowBuildMenu(false);
      }
    }
  }, [gameMode, selectedUnits, buildingToBuild, playerFaction, resources, currentCommand, createBuilding, issueOrder, getTargetAtPosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
    
    if (dragStartRef.current && e.button !== 2) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDraggingRef.current = true;
        setDragSelect({
          startX: dragStartRef.current.x,
          startY: dragStartRef.current.y,
          endX: e.clientX,
          endY: e.clientY
        });
      }
      return;
    }
    
    if (buildingToBuild) {
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
      const groundIntersect = intersects.find(i => i.object.name === 'ground');
      
      if (groundIntersect && placementPreviewRef.current) {
        const pos = groundIntersect.point;
        placementPreviewRef.current.position.set(pos.x, 1, pos.z);
        placementPreviewRef.current.visible = true;
        
        const canPlace = !buildingsRef.current.some(b => 
          Math.abs(b.position.x - pos.x) < 4 && Math.abs(b.position.z - pos.z) < 4
        );
        (placementPreviewRef.current.material as THREE.MeshBasicMaterial).color.setHex(canPlace ? 0x00ff00 : 0xff0000);
      }
      setCursorStyle('crosshair');
      return;
    }
    
    if (currentCommand) {
      const cmdCursors: Record<string, string> = {
        attack: 'crosshair', move: 'pointer', patrol: 'crosshair',
        gather: 'grab', repair: 'help', build: 'cell'
      };
      setCursorStyle(cmdCursors[currentCommand] || 'crosshair');
      return;
    }
    
    if (selectedUnits.length > 0 && gameMode !== 'menu') {
      const target = getTargetAtPosition(e.clientX, e.clientY);
      if (target?.type === 'enemy') setCursorStyle('crosshair');
      else if (target?.type === 'resource') setCursorStyle('grab');
      else if (target?.type === 'repair') setCursorStyle('help');
      else setCursorStyle('default');
    } else {
      setCursorStyle('default');
    }
  }, [buildingToBuild, currentCommand, selectedUnits, gameMode, getTargetAtPosition]);

  const trainUnit = useCallback((unitType: UnitType) => {
    if (!selectedBuilding) return;
    
    const building = buildingsRef.current.find(b => b.id === selectedBuilding);
    if (!building || building.faction !== playerFaction || building.isConstructing) return;
    
    const stats = uStat(unitType);
    
    if (resources[playerFaction].gold >= stats.cost.gold && 
        resources[playerFaction].lumber >= stats.cost.lumber &&
        food[playerFaction].used < food[playerFaction].max) {
      
      setResources(prev => ({
        ...prev,
        [playerFaction]: {
          gold: prev[playerFaction].gold - stats.cost.gold,
          lumber: prev[playerFaction].lumber - stats.cost.lumber
        }
      }));
      
      building.productionQueue.push(unitType);
    }
  }, [selectedBuilding, playerFaction, resources, food]);

  const updateGame = useCallback((deltaTime: number) => {
    if (isPaused || gameMode === 'menu') return;

    // Advance game clock (used for attack cooldowns)
    gameTotalTimeRef.current += deltaTime;
    const NOW = gameTotalTimeRef.current;

    setGameTime(prev => prev + deltaTime);
    updateFogOfWar();
    
    unitsRef.current = unitsRef.current.map(unit => {
      if (unit.targetPosition) {
        const dx = unit.targetPosition.x - unit.position.x;
        const dz = unit.targetPosition.z - unit.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < 0.3) {
          if (unit.gatherTarget) {
            const resource = resourceNodesRef.current.find(r => r.id === unit.gatherTarget);
            if (resource && resource.amount > 0) {
              const gatherAmount = Math.min(10, resource.amount);
              resource.amount -= gatherAmount;
              unit.carryingResource = { type: resource.type, amount: gatherAmount };
              
              if (resource.amount <= 0) {
                if (resource.type === 'lumber' && resource.mesh && resource.trunkMesh) {
                  spawnFallingTree(resource);
                  resource.mesh = undefined;
                  resource.trunkMesh = undefined;
                } else {
                  if (resource.mesh) sceneRef.current?.remove(resource.mesh);
                  if (resource.trunkMesh) sceneRef.current?.remove(resource.trunkMesh);
                }
              }
              
              const townhall = buildingsRef.current.find(b => isTownHall(b.type) && b.faction === unit.faction);
              if (townhall) {
                unit.targetPosition = { x: townhall.position.x + 3, y: 0.5, z: townhall.position.z };
                unit.gatherTarget = null;
              }
            } else {
              unit.gatherTarget = null;
              if (unit.lastGatherTarget) {
                const nearbyResource = resourceNodesRef.current.find(r =>
                  r.amount > 0 && r.type === (resource?.type || 'gold') &&
                  Math.abs(r.position.x - unit.position.x) < 10 &&
                  Math.abs(r.position.z - unit.position.z) < 10
                );
                if (nearbyResource) {
                  unit.gatherTarget = nearbyResource.id;
                  unit.lastGatherTarget = nearbyResource.id;
                  unit.targetPosition = { x: nearbyResource.position.x, y: 0.5, z: nearbyResource.position.z };
                } else {
                  unit.lastGatherTarget = null;
                  unit.targetPosition = null;
                  unit.currentOrder = null;
                }
              }
            }
          } else if (unit.carryingResource) {
            const townhall = buildingsRef.current.find(b => 
              isTownHall(b.type) && 
              b.faction === unit.faction &&
              Math.abs(b.position.x - unit.position.x) < 5 &&
              Math.abs(b.position.z - unit.position.z) < 5
            );
            if (townhall) {
              const resType = unit.carryingResource.type;
              const resAmount = unit.carryingResource.amount;
              unit.carryingResource = null;
              const textColor = resType === 'gold' ? '#FFD700' : '#22DD22';
              const textIcon = resType === 'gold' ? '💰' : '🪵';
              spawnFloatingText(`+${resAmount} ${textIcon}`, townhall.position.x, 5, townhall.position.z, textColor);
              setResources(prev => ({
                ...prev,
                [unit.faction]: {
                  ...prev[unit.faction],
                  [resType]: prev[unit.faction][resType] + resAmount
                }
              }));
              
              if (unit.lastGatherTarget) {
                const lastResource = resourceNodesRef.current.find(r => r.id === unit.lastGatherTarget);
                if (lastResource && lastResource.amount > 0) {
                  unit.gatherTarget = unit.lastGatherTarget;
                  unit.currentOrder = 'gather';
                  unit.targetPosition = { x: lastResource.position.x, y: 0.5, z: lastResource.position.z };
                } else {
                  const nearbyResource = resourceNodesRef.current.find(r =>
                    r.amount > 0 && r.type === resType &&
                    Math.abs(r.position.x - unit.position.x) < 15 &&
                    Math.abs(r.position.z - unit.position.z) < 15
                  );
                  if (nearbyResource) {
                    unit.gatherTarget = nearbyResource.id;
                    unit.lastGatherTarget = nearbyResource.id;
                    unit.currentOrder = 'gather';
                    unit.targetPosition = { x: nearbyResource.position.x, y: 0.5, z: nearbyResource.position.z };
                  } else {
                    unit.lastGatherTarget = null;
                    unit.currentOrder = null;
                  }
                }
              }
            }
          } else if (unit.currentOrder === 'patrol' && unit.patrolStart && unit.patrolEnd) {
            const distToStart = Math.sqrt(
              Math.pow(unit.position.x - unit.patrolStart.x, 2) + 
              Math.pow(unit.position.z - unit.patrolStart.z, 2)
            );
            const distToEnd = Math.sqrt(
              Math.pow(unit.position.x - unit.patrolEnd.x, 2) + 
              Math.pow(unit.position.z - unit.patrolEnd.z, 2)
            );
            if (distToEnd < 1) {
              unit.targetPosition = { ...unit.patrolStart };
            } else if (distToStart < 1) {
              unit.targetPosition = { ...unit.patrolEnd };
            }
            return { ...unit, targetPosition: unit.targetPosition };
          }
          
          if (!unit.gatherTarget && !unit.carryingResource && unit.currentOrder !== 'patrol') {
            return { ...unit, targetPosition: null };
          }
        } else {
          const moveSpeed = unit.speed * deltaTime;
          const moveX = (dx / dist) * Math.min(moveSpeed, dist);
          const moveZ = (dz / dist) * Math.min(moveSpeed, dist);
          
          const newPos = {
            x: unit.position.x + moveX,
            y: unit.position.y,
            z: unit.position.z + moveZ
          };
          
          if (unit.animUnit) {
            unit.animUnit.setPosition(newPos.x, 0, newPos.z);
            unit.animUnit.lookAt(unit.targetPosition.x, unit.targetPosition.z);
            if (unit.animUnit.state !== 'run' && unit.animUnit.state !== 'attack' && unit.animUnit.state !== 'hurt') {
              unit.animUnit.play('run');
            }
          } else if (unit.mesh) {
            unit.mesh.position.set(newPos.x, unit.mesh.position.y, newPos.z);
            (unit.mesh as THREE.Mesh).lookAt?.(unit.targetPosition.x, unit.mesh.position.y, unit.targetPosition.z);
          }
          if (unit.selectionRing) {
            unit.selectionRing.position.set(newPos.x, 0.05, newPos.z);
          }
          if (unit.healthBar) {
            unit.healthBar.position.set(newPos.x, unit.healthBar.position.y, newPos.z);
          }
          
          if (Math.random() < deltaTime * 3) {
            spawnParticles(newPos.x, 0.1, newPos.z, 'dust', 2);
          }
          
          if (unit.currentOrder === 'attackmove') {
            const nearbyEnemy = unitsRef.current.find(u => 
              u.faction !== unit.faction && u.isVisible &&
              Math.sqrt(Math.pow(u.position.x - unit.position.x, 2) + Math.pow(u.position.z - unit.position.z, 2)) < unit.range + 2
            );
            if (nearbyEnemy) {
              return { ...unit, position: newPos, attackTarget: nearbyEnemy.id };
            }
          }
          
          return { ...unit, position: newPos };
        }
      }
      
      if (unit.attackTarget) {
        const target = unitsRef.current.find(u => u.id === unit.attackTarget) ||
                       buildingsRef.current.find(b => b.id === unit.attackTarget);
        
        if (target && target.health > 0) {
          const dx = target.position.x - unit.position.x;
          const dz = target.position.z - unit.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          
          const effectiveRange = getEffectiveRange(unit);
          if (dist <= effectiveRange) {
            const isRanged = isRangedUnit(unit.type);
            const atkCD = getAttackCooldown(unit);

            // Face the target
            if (unit.animUnit) unit.animUnit.lookAt(target.position.x, target.position.z);

            // Cooldown-based attack check (replaces random-chance approach)
            if (NOW - unit.lastAttackTime >= atkCD) {
              unit.lastAttackTime = NOW;

              if (isRanged) {
                if (unit.animUnit && unit.animUnit.state !== 'attack2') unit.animUnit.play('attack2');
                const projType = uStat(unit.type).role === 'siege' ? 'ballista'
                               : uStat(unit.type).role === 'support' ? 'magic' : 'arrow';
                spawnPhysicsProjectile(
                  unit.position.x, unit.position.y + 1.2, unit.position.z,
                  target.position.x, target.position.z,
                  getEffectiveDmg(unit), unit.attackTarget!, unit.faction, projType
                );
              } else {
                if (unit.animUnit && unit.animUnit.state !== 'attack' && unit.animUnit.state !== 'hurt') {
                  unit.animUnit.play('attack');
                }
                const targetArmor = 'equipment' in target
                  ? getEffectiveArmor(target as GameUnit)
                  : ('armor' in target ? (target as any).armor : 0);
                const rawDmg = Math.max(1, getEffectiveDmg(unit) - targetArmor);
                target.health -= rawDmg;

                if ('animUnit' in target && (target as GameUnit).animUnit) {
                  const tUnit = target as GameUnit;
                  if (tUnit.animUnit && tUnit.animUnit.state !== 'hurt' && tUnit.animUnit.state !== 'death') {
                    tUnit.animUnit.play('hurt');
                  }
                }
                spawnFloatingText(`-${rawDmg}`, target.position.x, 3, target.position.z, '#FF4444');
                spawnParticles(target.position.x, 1.0, target.position.z, 'spark', 4);

                if (target.healthBar) {
                  const healthFill = target.healthBar.children.find(c => c.name === 'healthFill') as THREE.Mesh;
                  if (healthFill) {
                    const hp = Math.max(0, target.health / target.maxHealth);
                    healthFill.scale.x = hp;
                    (healthFill.material as THREE.MeshBasicMaterial).color.setHex(
                      hp > 0.5 ? 0x00ff00 : hp > 0.25 ? 0xffff00 : 0xff0000
                    );
                  }
                }
              }
            }
          } else {
            return { ...unit, targetPosition: { x: target.position.x, y: 0.5, z: target.position.z } };
          }
        } else {
          return { ...unit, attackTarget: null };
        }
      }
      
      if (unit.currentOrder === 'hold') {
        const nearbyEnemy = unitsRef.current.find(u => 
          u.faction !== unit.faction && u.isVisible &&
          Math.sqrt(Math.pow(u.position.x - unit.position.x, 2) + Math.pow(u.position.z - unit.position.z, 2)) < unit.range
        );
        if (nearbyEnemy) {
          return { ...unit, attackTarget: nearbyEnemy.id };
        }
      }
      
      if (unit.currentOrder === 'repair' && unit.repairTarget) {
        const targetBuilding = buildingsRef.current.find(b => b.id === unit.repairTarget);
        if (targetBuilding && targetBuilding.health < targetBuilding.maxHealth) {
          const dx = targetBuilding.position.x - unit.position.x;
          const dz = targetBuilding.position.z - unit.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          
          if (dist <= 3) {
            const repairAmount = 5 * deltaTime;
            targetBuilding.health = Math.min(targetBuilding.maxHealth, targetBuilding.health + repairAmount);
            
            if (targetBuilding.healthBar) {
              const healthFill = targetBuilding.healthBar.children.find(c => c.name === 'healthFill') as THREE.Mesh;
              if (healthFill) {
                const healthPercent = targetBuilding.health / targetBuilding.maxHealth;
                healthFill.scale.x = healthPercent;
                (healthFill.material as THREE.MeshBasicMaterial).color.setHex(
                  healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000
                );
              }
            }
            
            if (targetBuilding.health >= targetBuilding.maxHealth) {
              return { ...unit, currentOrder: null, repairTarget: null, targetPosition: null };
            }
          } else {
            return { ...unit, targetPosition: { x: targetBuilding.position.x, y: 0.5, z: targetBuilding.position.z } };
          }
        } else {
          return { ...unit, currentOrder: null, repairTarget: null };
        }
      }
      
      return unit;
    });
    
    unitsRef.current = unitsRef.current.filter(unit => {
      if (unit.health <= 0) {
        // Play death animation, then remove after it finishes
        if (unit.animUnit && !unit.animUnit.isDead) {
          unit.animUnit.play('death');
          // Schedule removal after death animation (1.5s)
          setTimeout(() => {
            if (unit.mesh) sceneRef.current?.remove(unit.mesh);
            if (unit.animUnit) unit.animUnit.dispose();
          }, 1500);
        } else if (!unit.animUnit) {
          if (unit.mesh) sceneRef.current?.remove(unit.mesh);
        }
        if (unit.selectionRing) sceneRef.current?.remove(unit.selectionRing);
        if (unit.healthBar) sceneRef.current?.remove(unit.healthBar);
        setFood(prev => ({
          ...prev,
          [unit.faction]: { ...prev[unit.faction], used: Math.max(0, prev[unit.faction].used - 1) }
        }));
        return false;
      }
      // Set idle animation for units not doing anything
      if (unit.animUnit && !unit.targetPosition && !unit.attackTarget && unit.animUnit.state !== 'idle' && unit.animUnit.state !== 'hurt') {
        unit.animUnit.play('idle');
      }
      return true;
    });
    
    buildingsRef.current = buildingsRef.current.map(building => {
      if (building.isConstructing) {
        const newProgress = building.constructionProgress + deltaTime * 1.5;
        building.health = building.maxHealth * (newProgress / 100);
        
        if (newProgress >= 100) {
          building.isConstructing = false;
          building.constructionProgress = 100;
          building.health = building.maxHealth;
          
          if (building.mesh) {
            (building.mesh.material as THREE.MeshStandardMaterial).transparent = false;
            (building.mesh.material as THREE.MeshStandardMaterial).opacity = 1;
          }
          
          const stats = bStat(building.type);
          if (stats.food > 0) {
            setFood(prev => ({
              ...prev,
              [building.faction]: { ...prev[building.faction], max: prev[building.faction].max + stats.food }
            }));
          }
        } else {
          building.constructionProgress = newProgress;
        }
      }
      
      if (building.productionQueue.length > 0 && !building.isConstructing) {
        const unitType = building.productionQueue[0];
        const unitStats = uStat(unitType);
        building.productionProgress += (deltaTime * 100 / unitStats.buildTime);
        
        if (building.productionProgress >= 100) {
          const rallyX = building.rallyPoint?.x || building.position.x + 3;
          const rallyZ = building.rallyPoint?.z || building.position.z;
          const newUnit = createUnit(unitType, building.faction, rallyX, rallyZ);
          unitsRef.current.push(newUnit);
          
          setFood(prev => ({
            ...prev,
            [building.faction]: { ...prev[building.faction], used: prev[building.faction].used + 1 }
          }));
          
          building.productionQueue.shift();
          building.productionProgress = 0;
        }
      }
      
      if (isTowerBldg(building.type) && !building.isConstructing) {
        const towerRange = 6;
        const nearbyEnemy = unitsRef.current.find(u =>
          u.faction !== building.faction && u.isVisible &&
          Math.sqrt(Math.pow(u.position.x - building.position.x, 2) + Math.pow(u.position.z - building.position.z, 2)) < towerRange
        );
        if (nearbyEnemy && Math.random() < deltaTime * 1.2) {
          spawnPhysicsProjectile(
            building.position.x, 4.5, building.position.z,
            nearbyEnemy.position.x, nearbyEnemy.position.z,
            8, nearbyEnemy.id, building.faction,
            'arrow'
          );
        }
      }
      
      return building;
    });
    
    buildingsRef.current = buildingsRef.current.filter(building => {
      if (building.health <= 0) {
        spawnBuildingDebris(building);
        if (building.mesh) sceneRef.current?.remove(building.mesh);
        if (building.healthBar) sceneRef.current?.remove(building.healthBar);
        if (building.auxMeshes) building.auxMeshes.forEach(m => sceneRef.current?.remove(m));
        const stats = bStat(building.type);
        if (stats.food > 0) {
          setFood(prev => ({
            ...prev,
            [building.faction]: { ...prev[building.faction], max: Math.max(0, prev[building.faction].max - stats.food) }
          }));
        }
        return false;
      }
      return true;
    });
    
    unitsRef.current.forEach(unit => {
      if (unit.selectionRing) {
        const isSelected = selectedUnits.includes(unit.id);
        (unit.selectionRing.material as THREE.MeshBasicMaterial).opacity = isSelected ? 0.8 : 0;
      }
    });
    
    if (gameMode === 'pve') {
      const enemyFaction: Faction = ENEMY_FACTION[playerFaction];
      const enemyUnits = unitsRef.current.filter(u => u.faction === enemyFaction);
      const enemyBuildings = buildingsRef.current.filter(b => b.faction === enemyFaction);
      
      if (Math.random() < 0.03 * deltaTime && resources[enemyFaction].gold >= 600) {
        const barracks = enemyBuildings.find(b => bStat(b.type).role === 'melee_production' && !b.isConstructing && b.productionQueue.length < 5);
        if (barracks && food[enemyFaction].used < food[enemyFaction].max) {
          barracks.productionQueue.push(factionStart(enemyFaction).melee);
          setResources(prev => ({
            ...prev,
            [enemyFaction]: { ...prev[enemyFaction], gold: prev[enemyFaction].gold - 600 }
          }));
        }
      }
      
      const idleEnemyUnits = enemyUnits.filter(u => !u.targetPosition && !u.attackTarget && !isWorkerUnit(u.type));
      if (idleEnemyUnits.length >= 6 && Math.random() < 0.015 * deltaTime) {
        const playerBuildings = buildingsRef.current.filter(b => b.faction === playerFaction);
        if (playerBuildings.length > 0) {
          const target = playerBuildings[0];
          idleEnemyUnits.forEach(unit => {
            unit.currentOrder = 'attackmove';
            unit.targetPosition = { x: target.position.x, y: 0.5, z: target.position.z };
          });
        }
      }
    }
    
    updateFloatingTexts(deltaTime);
    updatePhysics(deltaTime);
    renderMinimap();
  }, [isPaused, gameMode, selectedUnits, playerFaction, createUnit, resources, food, updateFogOfWar, renderMinimap, spawnFloatingText, updateFloatingTexts, spawnParticles, updatePhysics, spawnPhysicsProjectile, spawnBuildingDebris, spawnFallingTree]);

  useEffect(() => {
    if (gameMode !== 'menu' && containerRef.current && !isInitializedRef.current) {
      setTimeout(() => {
        if (containerRef.current && containerRef.current.clientWidth > 0) {
          initializeScene();
          if (pendingGameRef.current) {
            const { faction, mode } = pendingGameRef.current;
            initializeGameEntities(faction, mode);
            pendingGameRef.current = null;
          }
        }
      }, 100);
    }
  }, [gameMode, initializeScene, initializeGameEntities]);

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    
    const EDGE_MARGIN = 30; // px from viewport edge triggers pan
    const EDGE_SPEED  = 12; // world units/sec

    const animate = () => {
      const now = performance.now();
      const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      
      if (gameMode !== 'menu') {
        updateGame(deltaTime);
        updateParticles(deltaTime);
        updateBuildingFireEffects(deltaTime);
        unitsRef.current.forEach(u => {
          if (u.animUnit) u.animUnit.update(deltaTime);
        });

        // ── Edge scroll: pan camera when mouse is near viewport edges ──
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const mx = mousePosRef.current.x - rect.left;
          const my = mousePosRef.current.y - rect.top;
          const w = rect.width, h = rect.height;
          let dx = 0, dz = 0;
          if (mx > 0 && mx < w && my > 0 && my < h) {
            if (mx < EDGE_MARGIN)   dx -= EDGE_SPEED * deltaTime;
            if (mx > w-EDGE_MARGIN) dx += EDGE_SPEED * deltaTime;
            if (my < EDGE_MARGIN)   dz -= EDGE_SPEED * deltaTime;
            if (my > h-EDGE_MARGIN) dz += EDGE_SPEED * deltaTime;
          }
          if (dx !== 0 || dz !== 0) {
            setCameraPosition(prev => ({
              x: Math.max(5, Math.min(MAP_SIZE-5, prev.x + dx)),
              z: Math.max(5, Math.min(MAP_SIZE-5, prev.z + dz)),
            }));
          }
        }
      }
      
      const elapsed = now / 1000;
      updateWaterAnimation(elapsed);
      
      if (cameraRef.current) {
        const height = 25 / cameraZoom;
        const offset = 25 / cameraZoom;
        cameraRef.current.position.x = cameraPosition.x;
        cameraRef.current.position.z = cameraPosition.z + offset;
        cameraRef.current.position.y = height;
        cameraRef.current.lookAt(cameraPosition.x, 0, cameraPosition.z);
      }
      
      if (composerRef.current) {
        composerRef.current.render();
      } else {
        rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
      }
      gameLoopRef.current = requestAnimationFrame(animate);
    };
    
    lastTimeRef.current = performance.now();
    gameLoopRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameMode, cameraPosition, cameraZoom, updateGame, updateParticles, updateBuildingFireEffects, updateWaterAnimation]);

  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;
    
    const onContextMenu = (e: Event) => { e.preventDefault(); handleClick(e as MouseEvent); };
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);

    // Track mouse position globally for edge-scroll
    const trackMouse = (e: MouseEvent) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', trackMouse);
    
    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', trackMouse);
    };
  }, [handleClick, handleMouseMove, handleMouseDown, handleMouseUp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameMode === 'menu') return;
      
      const moveSpeed = 2;
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          setCameraPosition(prev => ({ ...prev, z: Math.max(5, prev.z - moveSpeed) }));
          break;
        case 'arrowdown':
        case 's':
          if (!e.ctrlKey) setCameraPosition(prev => ({ ...prev, z: Math.min(MAP_SIZE - 5, prev.z + moveSpeed) }));
          break;
        case 'arrowleft':
        case 'a':
          setCameraPosition(prev => ({ ...prev, x: Math.max(5, prev.x - moveSpeed) }));
          break;
        case 'arrowright':
        case 'd':
          setCameraPosition(prev => ({ ...prev, x: Math.min(MAP_SIZE - 5, prev.x + moveSpeed) }));
          break;
        case 'escape':
          setBuildingToBuild(null);
          setCurrentCommand(null);
          setShowBuildMenu(false);
          if (placementPreviewRef.current) placementPreviewRef.current.visible = false;
          break;
        case ' ':
          e.preventDefault();
          setIsPaused(prev => !prev);
          break;
        case 'm':
          setCurrentCommand('move');
          break;
        case 'a':
          setCurrentCommand('attack');
          break;
        case 'p':
          setCurrentCommand('patrol');
          break;
        case 'h':
          issueOrder('hold');
          break;
        case 's':
          if (!e.ctrlKey) issueOrder('stop');
          break;
        case 'b':
          if (selectedUnits.some(id => { const found = unitsRef.current.find(u => u.id === id); return found && isWorkerUnit(found.type); })) {
            setShowBuildMenu(true);
          }
          break;
        case 'g':
          setCurrentCommand('gather');
          break;
        case 'f': {
          // F — center camera on selected units / buildings
          const selU = unitsRef.current.filter(u => selectedUnits.includes(u.id));
          if (selU.length > 0) {
            const cx = selU.reduce((s, u) => s + u.position.x, 0) / selU.length;
            const cz = selU.reduce((s, u) => s + u.position.z, 0) / selU.length;
            setCameraPosition({ x: Math.max(5, Math.min(MAP_SIZE-5, cx)), z: Math.max(5, Math.min(MAP_SIZE-5, cz)) });
          } else if (selectedBuilding) {
            const b = buildingsRef.current.find(b => b.id === selectedBuilding);
            if (b) setCameraPosition({ x: Math.max(5, Math.min(MAP_SIZE-5, b.position.x)), z: Math.max(5, Math.min(MAP_SIZE-5, b.position.z)) });
          }
          break;
        }
        case 'tab': {
          e.preventDefault();
          // Tab — cycle to next idle player unit
          const idle = unitsRef.current.filter(u =>
            u.faction === playerFaction && !u.attackTarget && !u.targetPosition
          );
          if (idle.length > 0) {
            const cur = selectedUnits[0];
            const idx = idle.findIndex(u => u.id === cur);
            const next = idle[(idx + 1) % idle.length];
            setSelectedUnits([next.id]);
            setSelectedBuilding(null);
            setCameraPosition({ x: Math.max(5, Math.min(MAP_SIZE-5, next.position.x)), z: Math.max(5, Math.min(MAP_SIZE-5, next.position.z)) });
          }
          break;
        }
        case 'z': {
          // Z — select all on-screen units of same type
          if (selectedUnits.length > 0) {
            const first = unitsRef.current.find(u => u.id === selectedUnits[0]);
            if (first) {
              const sameType = unitsRef.current
                .filter(u => u.faction === playerFaction && u.type === first.type && u.isVisible)
                .slice(0, 12)
                .map(u => u.id);
              if (sameType.length > 0) setSelectedUnits(sameType);
            }
          }
          break;
        }
      }

      // Ctrl+A — select all visible player units
      if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const all = unitsRef.current
          .filter(u => u.faction === playerFaction && u.isVisible)
          .slice(0, 24)
          .map(u => u.id);
        if (all.length > 0) { setSelectedUnits(all); setSelectedBuilding(null); }
      }
      
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const groupNum = parseInt(e.key);
        if (selectedUnits.length > 0) {
          const oldGroup = unitGroupsRef.current[groupNum] || [];
          oldGroup.forEach(id => {
            const u = unitsRef.current.find(unit => unit.id === id);
            if (u && u.groupNumber === groupNum) u.groupNumber = null;
          });
          unitGroupsRef.current[groupNum] = [...selectedUnits];
          selectedUnits.forEach(id => {
            const u = unitsRef.current.find(unit => unit.id === id);
            if (u) u.groupNumber = groupNum;
          });
        }
      } else if (!e.ctrlKey && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        const groupNum = parseInt(e.key);
        const group = unitGroupsRef.current[groupNum];
        if (group && group.length > 0) {
          const validIds = group.filter(id => unitsRef.current.some(u => u.id === id));
          unitGroupsRef.current[groupNum] = validIds;
          if (validIds.length > 0) {
            setSelectedUnits(validIds);
            setSelectedBuilding(null);
            setShowBuildMenu(false);
          }
        }
      }
    };
    
    const handleWheel = (e: WheelEvent) => {
      setCameraZoom(prev => Math.max(0.5, Math.min(2.5, prev + e.deltaY * -0.001)));
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [gameMode, selectedUnits, issueOrder]);

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * MAP_SIZE;
    const z = ((e.clientY - rect.top) / rect.height) * MAP_SIZE;
    
    if (e.button === 2 && selectedUnits.length > 0) {
      issueOrder('move', x, z);
    } else {
      setCameraPosition({ x: Math.max(5, Math.min(MAP_SIZE - 5, x)), z: Math.max(5, Math.min(MAP_SIZE - 5, z)) });
    }
  }, [selectedUnits, issueOrder]);

  if (gameMode === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a0a00] via-[#2d1810] to-[#1a0a00] text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0 grid grid-cols-2 grid-rows-2 opacity-20">
          <img src={heroStoneGuardian} alt="" className="w-full h-full object-cover" />
          <img src={heroDeathMage}     alt="" className="w-full h-full object-cover" />
          <img src={heroHolyPaladin}   alt="" className="w-full h-full object-cover" />
          <img src={heroOrcShaman}     alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#1a0a00]/70 via-[#2d1810]/50 to-[#1a0a00]/80" />
        <div className="absolute top-4 left-4 z-10">
          <Link href="/super-engine">
            <Button variant="outline" className="border-amber-600 text-amber-400 hover:bg-amber-600 hover:text-black">
              <ArrowLeft className="w-4 h-4 mr-2" />Back
            </Button>
          </Link>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 gap-6">
          <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-800"
              style={{textShadow:'3px 3px 8px rgba(0,0,0,0.9)'}}>WARGUS</h1>
          <p className="text-amber-300/70 text-sm -mt-4">3D Real-Time Strategy • Grudge Studio • Canonical Assets from R2/D1</p>

          {/* ─ Map Size Selector ─ */}
          <div className="bg-[#1c0f08]/90 border-2 border-amber-800 rounded-xl p-4 w-full max-w-lg">
            <h2 className="text-amber-400 text-sm font-bold tracking-widest uppercase mb-3 border-b border-amber-900 pb-2">🗺️ Map Size</h2>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(MAP_SIZE_CFG) as MapSizeKey[]).map(k => {
                const cfg = MAP_SIZE_CFG[k];
                const isActive = mapSizeKey === k;
                return (
                  <button key={k}
                    onClick={() => setMapSizeKey(k)}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all
                      ${isActive ? 'border-amber-400 bg-amber-900/60 text-amber-200'
                                 : 'border-amber-900/60 bg-black/30 text-amber-500 hover:border-amber-700 hover:bg-amber-900/30'}`}
                  >
                    <span className="text-2xl mb-1">{k==='standard'?'🗻':k==='large'?'🌍':'🌌'}</span>
                    <span className="font-bold text-xs">{cfg.label}</span>
                    <span className="text-[10px] opacity-70 mt-0.5">{cfg.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─ Faction + Mode Selector ─ */}
          <div className="bg-[#1c0f08]/90 border-2 border-amber-800 rounded-xl p-4 w-full max-w-lg">
            <h2 className="text-amber-400 text-sm font-bold tracking-widest uppercase mb-3 border-b border-amber-900 pb-2">⚔️ Select Faction</h2>
            <div className="space-y-2">
              {[
                { id:'crusade', label:'CRUSADE', sub:`${FACTIONS.crusade.races.join(' + ')} • ${FACTIONS.crusade.motto}`, color:'blue',  left:'👑', right:'🛡️' },
                { id:'fabled',  label:'FABLED',  sub:`${FACTIONS.fabled.races.join(' + ')} • ${FACTIONS.fabled.motto}`,   color:'green', left:'🌳', right:'🧙' },
                { id:'legion',  label:'LEGION',  sub:`${FACTIONS.legion.races.join(' + ')} • ${FACTIONS.legion.motto}`,   color:'red',   left:'💀', right:'⚔️' },
              ].map(f => (
                <button key={f.id}
                  onClick={() => startGame('pve', f.id as Faction, mapSizeKey)}
                  className={`w-full bg-gradient-to-r from-${f.color}-900 via-${f.color}-800 to-${f.color}-900
                    border-2 border-${f.color}-600 rounded-lg p-3 hover:from-${f.color}-800 hover:via-${f.color}-700
                    hover:to-${f.color}-800 transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{f.left}</span>
                    <div className="text-center">
                      <div className={`text-lg font-black text-${f.color}-200`}>{f.label}</div>
                      <div className={`text-xs text-${f.color}-300/80`}>{f.sub}</div>
                    </div>
                    <span className="text-3xl">{f.right}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-amber-900/60 text-center text-amber-600 text-xs">
              SPACE pause • WASD/Edge scroll • Wheel zoom • F focus • Tab idle • Z same type • Ctrl+A all
            </div>
          </div>
        </div>
        <div ref={containerRef} className="hidden" />
      </div>
    );
  }

  const selectedUnitData = selectedUnits.length > 0 ? unitsRef.current.filter(u => selectedUnits.includes(u.id)) : [];
  const selectedBuildingData = selectedBuilding ? buildingsRef.current.find(b => b.id === selectedBuilding) : null;
  const firstSelectedUnit = selectedUnitData[0];
  const isPeasantSelected = selectedUnitData.some(u => isWorkerUnit(u.type));

  if (webglError) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-[#1a1a2e]">
        <div className="text-center p-8 bg-[#0d0d0d] border-2 border-amber-700 rounded-lg max-w-md">
          <h2 className="text-2xl font-bold text-amber-400 mb-4">WebGL Not Available</h2>
          <p className="text-amber-200 mb-4">
            This 3D game requires WebGL support which is not available in this browser environment.
          </p>
          <p className="text-amber-300 text-sm mb-4">
            Try opening the app in a new browser tab or on a device with WebGL support.
          </p>
          <Link href="/super-engine">
            <Button className="bg-amber-700 hover:bg-amber-600 text-white">
              Return to Game Engine
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── WC3 HUD helpers ──
  const NOW_UI = gameTotalTimeRef.current;
  const equipSlots: {slot: EquipSlot; label: string; pos: string}[] = [
    { slot:'weapon',  label:'WPN',  pos:'top-left'  },
    { slot:'offhand', label:'OFF',  pos:'top-right' },
    { slot:'armor',   label:'ARM',  pos:'mid-left'  },
    { slot:'helmet',  label:'HLM',  pos:'mid-right' },
    { slot:'boots',   label:'BTS',  pos:'btm-left'  },
    { slot:'ring',    label:'RNG',  pos:'btm-right' },
  ];

  // WC3 3×3 command card layout
  // Row 0: abilities Q/W/E (slots 0/1/2)
  // Row 1: abilities R/T + blank
  // Row 2: unit-specific bottom commands
  const firstUnit = selectedUnitData[0];
  const unitAbilities = firstUnit?.abilities ?? [];
  const bottomCmds = firstUnit ? (
    isWorkerUnit(firstUnit.type)
      ? ['gather','build','repair','move','stop','attackmove']
      : uStat(firstUnit.type).role === 'siege'
        ? ['move','stop','patrol','attack']
        : ['attack','attackmove','patrol','move','stop','hold']
  ) : [];

  const CMD_GRID_9 = [
    // Row 0: abilities
    unitAbilities[0] ? { type:'ability' as const, data: unitAbilities[0] } : null,
    unitAbilities[1] ? { type:'ability' as const, data: unitAbilities[1] } : null,
    unitAbilities[2] ? { type:'ability' as const, data: unitAbilities[2] } : null,
    // Row 1: abilities
    unitAbilities[3] ? { type:'ability' as const, data: unitAbilities[3] } : null,
    unitAbilities[4] ? { type:'ability' as const, data: unitAbilities[4] } : null,
    null,
    // Row 2: standard orders
    bottomCmds[0] ? { type:'order' as const, data: COMMAND_ICONS[bottomCmds[0]], cmd: bottomCmds[0] as OrderType } : null,
    bottomCmds[1] ? { type:'order' as const, data: COMMAND_ICONS[bottomCmds[1]], cmd: bottomCmds[1] as OrderType } : null,
    bottomCmds[2] ? { type:'order' as const, data: COMMAND_ICONS[bottomCmds[2]], cmd: bottomCmds[2] as OrderType } : null,
  ];
  const ABILITY_HOTKEYS = ['Q','W','E','R','T'];

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" style={{ bottom: '182px', cursor: cursorStyle }} data-testid="game-container" />
      
      {dragSelect && (
        <div
          className="fixed border-2 border-green-400 bg-green-400/10 pointer-events-none z-50"
          style={{
            left: Math.min(dragSelect.startX, dragSelect.endX),
            top: Math.min(dragSelect.startY, dragSelect.endY),
            width: Math.abs(dragSelect.endX - dragSelect.startX),
            height: Math.abs(dragSelect.endY - dragSelect.startY)
          }}
        />
      )}
      
      <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] border-b-2 border-amber-700 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setGameMode('menu')}
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 h-7 px-2"
            data-testid="button-menu"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsPaused(!isPaused)}
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 h-7 px-2"
            data-testid="button-pause"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMuted(!isMuted)}
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 h-7 px-2"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              isInitializedRef.current = false;
              startGame(gameMode, playerFaction);
            }}
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 h-7 px-2"
            data-testid="button-restart"
          >
            🔄 Restart
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 h-7 px-2"
            data-testid="button-help"
          >
            ❓ Help
          </Button>
        </div>
        
        <div className="flex items-center gap-6 text-lg font-bold">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">💰</span>
            <span className="text-yellow-300" data-testid="text-gold">{resources[playerFaction]?.gold || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">🪵</span>
            <span className="text-green-300" data-testid="text-lumber">{resources[playerFaction]?.lumber || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-400">🍖</span>
            <span className="text-blue-300" data-testid="text-food">
              {food[playerFaction]?.used || 0}/{food[playerFaction]?.max || 0}
            </span>
          </div>
        </div>
        
        <div className="text-amber-500 text-sm">
          {Math.floor(gameTime / 60)}:{(Math.floor(gameTime) % 60).toString().padStart(2, '0')}
        </div>
      </div>
      
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20" style={{ bottom: '140px' }}>
          <div className="text-5xl font-bold text-amber-400 border-4 border-amber-600 bg-black/80 px-8 py-4">
            ⏸️ PAUSED
          </div>
        </div>
      )}
      
      {showHelp && (
        <div className="absolute top-12 right-4 w-72 max-h-[70vh] overflow-y-auto bg-[#1a0a00]/95 border-2 border-amber-700 rounded-lg p-4 z-30 text-sm">
          <div className="flex justify-between items-center mb-3 border-b border-amber-800 pb-2">
            <h3 className="text-amber-400 font-bold">📜 Controls & Tips</h3>
            <button onClick={() => setShowHelp(false)} className="text-amber-500 hover:text-amber-300">✕</button>
          </div>
          <div className="space-y-2 text-amber-200">
            <div className="font-bold text-amber-400 mt-2">Camera:</div>
            <div>• WASD / Arrow Keys - Pan camera</div>
            <div>• Mouse Wheel - Zoom in/out</div>
            <div className="font-bold text-amber-400 mt-2">Selection:</div>
            <div>• Left Click - Select unit/building</div>
            <div>• Left Drag - Box select units</div>
            <div>• Shift+Click - Add to selection</div>
            <div>• Right Click - Move/Attack command</div>
            <div className="font-bold text-amber-400 mt-2">Commands:</div>
            <div>• M - Move</div>
            <div>• A - Attack / Attack-Move</div>
            <div>• P - Patrol</div>
            <div>• S - Stop</div>
            <div>• H - Hold Position</div>
            <div>• G - Gather (peasants)</div>
            <div>• B - Build menu (peasants)</div>
            <div>• R - Repair (peasants)</div>
            <div className="font-bold text-amber-400 mt-2">Groups:</div>
            <div>• Ctrl+1-9 - Assign group</div>
            <div>• 1-9 - Select group</div>
            <div className="font-bold text-amber-400 mt-2">Gameplay Tips:</div>
            <div>• Build farms for more food supply</div>
            <div>• Workers auto-repeat gathering</div>
            <div>• Gold mines and trees are resources</div>
            <div>• Click minimap to navigate</div>
            <div className="font-bold text-amber-400 mt-2">3D Assets (Map Objects):</div>
            <div className="text-xs space-y-0.5 mt-1">
              <div className="text-cyan-300">Units:</div>
              <div>• CapsuleGeometry - all units</div>
              <div>• Blue (#4169E1) = Human</div>
              <div>• Red (#DC143C) = Orc</div>
              <div>• Size: Knight/Paladin 0.6, Ballista 0.8, others 0.45</div>
              <div className="text-cyan-300 mt-1">Buildings:</div>
              <div>• BoxGeometry - all buildings</div>
              <div>• TownHall: 3x3.5x3</div>
              <div>• Barracks/Smith/Lumber/Stable/Church: 2.5xH</div>
              <div>• Farm: 2x2.5x2</div>
              <div>• Tower: 2.5x4 + ConeGeometry roof</div>
              <div className="text-cyan-300 mt-1">Resources:</div>
              <div>• Gold: DodecahedronGeometry r=1.2</div>
              <div>• Tree: CylinderGeometry trunk + ConeGeometry leaves</div>
              <div className="text-cyan-300 mt-1">Terrain:</div>
              <div>• Ground: PlaneGeometry 80x80 128-res heightmap</div>
              <div>• Border: Raised cliffs (h=3+) with rocks</div>
              <div>• Water: PlaneGeometry with wave offset</div>
              <div>• Fog: PlaneGeometry with vertex colors</div>
              <div className="text-cyan-300 mt-1">Map Size: {MAP_SIZE}x{MAP_SIZE}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* WC3-style HUD — 182px, craftpix fantasy theme, canonical CDN portraits + ObjectStore icons */}
      <div className="absolute bottom-0 left-0 right-0 h-[182px] flex z-10"
           style={{background:'linear-gradient(to top, #120800 0%, #1e0d04 55%, #2a1508 100%)',
                   borderTop:'3px solid #92400e', boxShadow:'0 -4px 24px rgba(0,0,0,0.7)'}}>

        {/* ─ MINIMAP ─ */}
        <div className="w-[168px] p-2 flex-shrink-0 border-r border-amber-900/60">
          <canvas ref={minimapRef} width={152} height={152}
            className="w-full h-full cursor-crosshair rounded"
            style={{border:'2px solid #92400e',boxShadow:'0 0 8px rgba(146,64,14,0.5)'}}
            onClick={handleMinimapClick}
            onContextMenu={e => { e.preventDefault(); handleMinimapClick(e); }}
            data-testid="minimap"
          />
        </div>

        {/* ─ PORTRAIT + UNIT INFO ─ */}
        <div className="w-[206px] flex-shrink-0 p-2 border-r border-amber-900/60 flex flex-col gap-1">
          {firstSelectedUnit ? (
            <>
              {/* Portrait: CDN race image with emoji fallback */}
              <div className="flex gap-2">
                <div className="relative w-[72px] h-[72px] flex-shrink-0 rounded overflow-hidden"
                     style={{border:'2px solid '+factionHex(firstSelectedUnit.faction),
                             boxShadow:'0 0 8px '+factionHex(firstSelectedUnit.faction)+'66'}}>
                  <img src={getUnitPortrait(firstSelectedUnit.type)} alt=""
                    className="w-full h-full object-cover object-top"
                    onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-4xl"
                       style={{pointerEvents:'none'}}>
                    {uStat(firstSelectedUnit.type).icon}
                  </div>
                  {/* Tier-color border overlay for equipped weapon */}
                  {firstSelectedUnit.equipment.weapon && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 rounded-tl text-[9px] flex items-center justify-center"
                         style={{background: firstSelectedUnit.equipment.weapon.tierColor}}>
                      T{firstSelectedUnit.equipment.weapon.tier}
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-amber-200 font-bold text-xs leading-none">{uStat(firstSelectedUnit.type).name}</div>
                    <div className="text-[10px] mt-0.5" style={{color:factionHex(firstSelectedUnit.faction)}}>
                      {FACTIONS[firstSelectedUnit.faction]?.name} • {uStat(firstSelectedUnit.type).role}
                    </div>
                  </div>
                  {/* HP bar */}
                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-red-400">❤️ HP</span>
                      <span className="text-green-300">{Math.ceil(firstSelectedUnit.health)}/{firstSelectedUnit.maxHealth}</span>
                    </div>
                    <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden" style={{border:'1px solid #333'}}>
                      <div className="h-full rounded-full transition-all" style={{
                        width:`${Math.max(0,(firstSelectedUnit.health/firstSelectedUnit.maxHealth)*100)}%`,
                        background: firstSelectedUnit.health/firstSelectedUnit.maxHealth > 0.5 ? '#22c55e'
                                  : firstSelectedUnit.health/firstSelectedUnit.maxHealth > 0.25 ? '#eab308' : '#ef4444',
                        boxShadow:'0 0 4px currentColor'
                      }}/>
                    </div>
                    {/* Mana bar */}
                    <div className="w-full bg-black/60 h-1.5 rounded-full mt-0.5 overflow-hidden" style={{border:'1px solid #333'}}>
                      <div className="h-full rounded-full bg-blue-500 transition-all"
                           style={{width:`${Math.max(0,(firstSelectedUnit.mana/firstSelectedUnit.maxMana)*100)}%`}}/>
                    </div>
                  </div>
                </div>
              </div>
              {/* Stat row using effective values */}
              <div className="grid grid-cols-4 gap-0.5 text-center text-[10px]">
                {[
                  ['⚔️', getEffectiveDmg(firstSelectedUnit), 'DMG'],
                  ['🛡️', getEffectiveArmor(firstSelectedUnit), 'ARM'],
                  ['💨', getEffectiveSpeed(firstSelectedUnit).toFixed(1), 'SPD'],
                  ['📏', getEffectiveRange(firstSelectedUnit).toFixed(1), 'RNG'],
                ].map(([ico, val, lbl]) => (
                  <div key={String(lbl)} className="bg-black/40 rounded px-1 py-0.5">
                    <div className="text-xs">{ico}</div>
                    <div className="text-amber-200 font-bold">{val}</div>
                    <div className="text-amber-600">{lbl}</div>
                  </div>
                ))}
              </div>
              {firstSelectedUnit.currentOrder && (
                <div className="text-cyan-400 text-[10px] text-center">
                  {COMMAND_ICONS[firstSelectedUnit.currentOrder]?.icon} {COMMAND_ICONS[firstSelectedUnit.currentOrder]?.name}
                </div>
              )}
            </>
          ) : selectedBuildingData ? (
            <>
              <div className="flex gap-2 items-start">
                <div className="text-5xl">{bStat(selectedBuildingData.type).icon}</div>
                <div className="flex-1">
                  <div className="text-amber-200 font-bold text-xs">{bStat(selectedBuildingData.type).name}</div>
                  <div className="text-[10px] text-amber-500">{selectedBuildingData.faction} • {bStat(selectedBuildingData.type).role}</div>
                  <div className="mt-1">
                    <div className="text-[10px] text-red-400">❤️ {Math.ceil(selectedBuildingData.health)}/{selectedBuildingData.maxHealth}</div>
                    <div className="w-full bg-black/60 h-2 rounded mt-0.5" style={{border:'1px solid #333'}}>
                      <div className="h-full rounded transition-all bg-green-500" style={{width:`${(selectedBuildingData.health/selectedBuildingData.maxHealth)*100}%`}}/>
                    </div>
                    {selectedBuildingData.isConstructing && (
                      <>
                        <div className="text-amber-500 text-[10px] mt-0.5">🚧 {Math.floor(selectedBuildingData.constructionProgress)}%</div>
                        <div className="w-full bg-black/60 h-1.5 rounded" style={{border:'1px solid #333'}}>
                          <div className="h-full bg-amber-500 rounded transition-all" style={{width:`${selectedBuildingData.constructionProgress}%`}}/>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : selectedUnitData.length > 1 ? (
            <div className="w-full h-full overflow-y-auto">
              <div className="text-amber-400 text-[10px] font-bold mb-1 text-center">{selectedUnitData.length} units</div>
              <div className="grid grid-cols-5 gap-0.5">
                {selectedUnitData.slice(0, 20).map(u => (
                  <button key={u.id}
                    onClick={() => { setSelectedUnits([u.id]); setSelectedBuilding(null); }}
                    className="flex flex-col items-center p-0.5 rounded hover:bg-amber-900/40 transition-all"
                    style={{border:`1px solid ${factionHex(u.faction)}44`}}
                  >
                    <span className="text-base leading-none">{uStat(u.type).icon}</span>
                    <div className="w-full bg-black/60 h-0.5 rounded mt-0.5" style={{border:'none'}}>
                      <div className="h-full rounded"
                           style={{width:`${(u.health/u.maxHealth)*100}%`,background:u.health/u.maxHealth>0.5?'#22c55e':'#ef4444'}}/>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-amber-700">
              <div className="text-3xl mb-1">🏙️</div>
              <div className="text-xs">{MAP_SIZE_CFG[mapSizeKey]?.label}</div>
              <div className="text-[10px] mt-0.5 text-amber-800">Click to select</div>
            </div>
          )}
        </div>

        {/* ─ EQUIPMENT SLOTS (6) — CDN icons from ObjectStore ─ */}
        {firstSelectedUnit && (
          <div className="w-[156px] flex-shrink-0 p-1.5 border-r border-amber-900/60">
            <div className="text-[9px] text-amber-600 font-bold tracking-widest uppercase mb-1 text-center">⛓️ Equipment</div>
            <div className="grid grid-cols-2 gap-1">
              {equipSlots.map(({ slot, label }) => {
                const item = firstSelectedUnit.equipment[slot];
                return (
                  <div key={slot}
                    className="relative flex flex-col items-center justify-center rounded cursor-pointer
                               transition-all hover:brightness-125 group"
                    style={{
                      width:68, height:58,
                      border: item ? `2px solid ${item.tierColor}` : '1px solid #44220f',
                      background: item ? `${item.tierColor}18` : 'rgba(0,0,0,0.4)',
                      boxShadow: item ? `0 0 6px ${item.tierColor}44` : 'none',
                    }}
                    title={item ? `${item.name}: ${item.description}` : label}
                  >
                    {item ? (
                      <>
                        <img src={item.iconUrl} alt={item.name}
                          className="w-8 h-8 object-contain"
                          onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
                        />
                        <div className="text-[8px] font-bold text-center leading-none mt-0.5"
                             style={{color:item.tierColor}}>{item.name.split(' ').slice(-1)[0]}</div>
                        <span className="absolute top-0.5 right-0.5 text-[7px] font-black"
                              style={{color:item.tierColor}}>T{item.tier}</span>
                      </>
                    ) : (
                      <>
                        <div className="text-amber-800 text-lg">
                          {slot==='weapon'?'⚔️':slot==='offhand'?'🛡️':slot==='armor'?'🥋':slot==='helmet'?'⛑️':slot==='boots'?'👟':'💍'}
                        </div>
                        <div className="text-[8px] text-amber-800">{label}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─ COMMAND CARD (3×3 WC3 style) — abilities + orders ─ */}
        <div className="flex-1 p-2">
          {showBuildMenu && isPeasantSelected ? (
            <div className="grid grid-cols-4 gap-1 h-full">
              {getBuildingsForFaction(playerFaction).filter(bd => bd.role !== 'economy').map(bd => {
                const stats = bStat(bd.id);
                const canAfford = resources[playerFaction].gold >= stats.cost.gold && resources[playerFaction].lumber >= stats.cost.lumber;
                return (
                  <button key={bd.id}
                    onClick={() => { setBuildingToBuild(bd.id); setShowBuildMenu(false); }}
                    disabled={!canAfford}
                    className={`flex flex-col items-center justify-center rounded text-xs transition-all
                      ${!canAfford ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-125'}`}
                    style={{border:`2px solid ${canAfford?'#92400e':'#333'}`, background:'rgba(0,0,0,0.5)'}}
                    data-testid={`button-build-${bd.id}`}
                  >
                    <span className="text-2xl">{stats.icon}</span>
                    <span className="text-amber-300 truncate w-full text-center text-[10px]">{stats.name}</span>
                    <span className="text-yellow-400 text-[9px]">{stats.cost.gold}💰{stats.cost.lumber>0?` ${stats.cost.lumber}🪯`:''}</span>
                  </button>
                );
              })}
            </div>
          ) : selectedBuildingData && bStat(selectedBuildingData.type).trains.length > 0 && !selectedBuildingData.isConstructing ? (
            <div className="h-full">
              <div className="grid grid-cols-4 gap-1 mb-1">
                {bStat(selectedBuildingData.type).trains.map(unitType => {
                  const stats = uStat(unitType);
                  const canAfford = resources[playerFaction].gold >= stats.cost.gold &&
                    resources[playerFaction].lumber >= stats.cost.lumber && food[playerFaction].used < food[playerFaction].max;
                  return (
                    <button key={unitType} onClick={() => trainUnit(unitType)} disabled={!canAfford}
                      className={`flex flex-col items-center justify-center p-1 rounded transition-all
                        ${canAfford ? 'hover:brightness-125' : 'opacity-40 cursor-not-allowed'}`}
                      style={{border:`2px solid ${canAfford?'#92400e':'#333'}`, background:'rgba(0,0,0,0.5)'}}
                      data-testid={`button-train-${unitType}`}
                    >
                      <img src={getUnitPortrait(unitType)} alt=""
                        className="w-8 h-8 object-cover rounded"
                        onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
                      />
                      <span className="text-lg leading-none -mt-8">{stats.icon}</span>
                      <span className="text-amber-300 text-[10px] mt-0.5">{stats.name}</span>
                      <span className="text-yellow-400 text-[9px]">{stats.cost.gold}💰</span>
                    </button>
                  );
                })}
              </div>
              {selectedBuildingData.productionQueue.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-amber-500 text-[10px]">Queue:</span>
                  {selectedBuildingData.productionQueue.slice(0,5).map((ut, i) => (
                    <span key={i} className="text-base">{uStat(ut).icon}</span>
                  ))}
                  <div className="flex-1 bg-black/60 h-1.5 rounded ml-1">
                    <div className="bg-amber-500 h-full rounded transition-all"
                         style={{width:`${selectedBuildingData.productionProgress}%`}}/>
                  </div>
                </div>
              )}
            </div>
          ) : selectedUnitData.length > 0 ? (
            /* ─ WC3 3×3 Command Grid ─ */
            <div className="grid grid-cols-3 gap-1 h-full" style={{maxHeight:158}}>
              {CMD_GRID_9.map((slot, idx) => {
                if (!slot) return <div key={idx} className="rounded" style={{background:'rgba(0,0,0,0.2)'}} />;
                const isCooldownActive = slot.type === 'ability'
                  ? NOW_UI - slot.data.lastUsed < slot.data.cooldown : false;
                const cdPct = slot.type === 'ability' && slot.data.cooldown > 0
                  ? Math.max(0, 1 - (NOW_UI - slot.data.lastUsed) / slot.data.cooldown) : 0;
                const hkey = slot.type === 'ability'
                  ? ABILITY_HOTKEYS[idx]    // Q W E R T
                  : slot.type === 'order' ? slot.cmd.toUpperCase()[0] : '';
                const isActive = slot.type === 'order' && currentCommand === slot.cmd;

                return (
                  <button key={idx}
                    onClick={() => {
                      if (slot.type === 'order') {
                        if (slot.cmd === 'stop') issueOrder('stop');
                        else if (slot.cmd === 'hold') issueOrder('hold');
                        else if (slot.cmd === 'build') setShowBuildMenu(true);
                        else setCurrentCommand(slot.cmd);
                      }
                      // ability fire TBD via game loop
                    }}
                    className="relative flex flex-col items-center justify-center rounded transition-all overflow-hidden"
                    style={{
                      border: isActive ? '2px solid #4ade80' : '2px solid #44220f',
                      background: isActive ? 'rgba(74,222,128,0.15)' : 'rgba(0,0,0,0.45)',
                    }}
                    data-testid={`button-cmd-${slot.type==='order'?slot.cmd:slot.data.id}`}
                  >
                    {/* Cooldown overlay sweep */}
                    {isCooldownActive && (
                      <div className="absolute inset-0 bg-black/60 z-10"
                           style={{clipPath:`inset(${(1-cdPct)*100}% 0 0 0)`}} />
                    )}
                    <img
                      src={slot.type==='ability' ? slot.data.iconUrl
                         : `${CDN}/icons/abilities/${slot.type==='order'?slot.cmd:'move'}.png`}
                      alt="" className="w-7 h-7 object-contain relative z-0"
                      onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
                    />
                    <span className="text-xl leading-none -mt-7 relative z-0">
                      {slot.type==='ability' ? slot.data.emoji : (COMMAND_ICONS[slot.cmd]?.icon ?? '')}
                    </span>
                    <span className="text-[9px] text-amber-300 mt-0.5 relative z-0">
                      {slot.type==='ability' ? slot.data.name : (COMMAND_ICONS[slot.cmd]?.name ?? '')}
                    </span>
                    {hkey && (
                      <span className="absolute top-0.5 left-0.5 text-[8px] font-black text-amber-400/80">[{hkey}]</span>
                    )}
                    {isCooldownActive && (
                      <span className="absolute bottom-0.5 right-0.5 text-[8px] text-amber-300 z-20">
                        {Math.ceil(slot.data.cooldown - (NOW_UI - slot.data.lastUsed))}s
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-amber-800 text-xs">
              Select units or buildings
            </div>
          )}
        </div>

        {/* ─ GROUPS + KEYS ─ */}
        <div className="w-[148px] flex-shrink-0 p-1.5 border-l border-amber-900/60 text-[10px] text-amber-500">
          <div className="font-bold text-amber-400 mb-1 text-[9px] tracking-widest uppercase border-b border-amber-900/60 pb-1">Groups</div>
          <div className="grid grid-cols-3 gap-0.5 mb-2">
            {[1,2,3,4,5,6,7,8,9].map(n => {
              const grp = unitGroupsRef.current[n];
              const cnt = grp ? grp.filter(id => unitsRef.current.some(u => u.id === id)).length : 0;
              return (
                <button key={n}
                  onClick={() => {
                    if (cnt > 0) {
                      const ids = grp!.filter(id => unitsRef.current.some(u => u.id === id));
                      setSelectedUnits(ids); setSelectedBuilding(null);
                    }
                  }}
                  className="text-center rounded py-0.5 transition-all"
                  style={{border:`1px solid ${cnt>0?'#92400e':'#222'}`,
                          background:cnt>0?'rgba(146,64,14,0.25)':'rgba(0,0,0,0.3)',
                          color:cnt>0?'#fcd34d':'#555'}}
                >
                  <div className="font-bold text-xs">{n}</div>
                  {cnt > 0 && <div className="text-[9px] text-amber-400">{cnt}u</div>}
                </button>
              );
            })}
          </div>
          <div className="font-bold text-amber-400 mb-0.5 text-[9px] tracking-widest uppercase border-b border-amber-900/60 pb-1">Hotkeys</div>
          <div className="space-y-0.5 text-[9px] text-amber-700">
            <div className="text-amber-500 font-bold">WASD • Edge • Wheel</div>
            <div>F • Focus selection</div>
            <div>Tab • Idle unit</div>
            <div>Z • Same type</div>
            <div>Ctrl+A • All units</div>
            <div>A • Attack  M • Move</div>
            <div>P • Patrol  H • Hold</div>
            <div>G • Gather  B • Build</div>
            <div>Ctrl+1-9 • Group</div>
            <div>␣ Pause  Esc • Cancel</div>
          </div>
        </div>
      </div>
      
      {currentCommand && (
        <div className="absolute bottom-[150px] left-1/2 -translate-x-1/2 bg-amber-900/90 border-2 border-amber-500 px-4 py-2 rounded text-amber-200 z-10">
          {COMMAND_ICONS[currentCommand]?.icon} {COMMAND_ICONS[currentCommand]?.name} - Click to target or ESC to cancel
        </div>
      )}
      
      {buildingToBuild && (
        <div className="absolute bottom-[150px] left-1/2 -translate-x-1/2 bg-amber-900/90 border-2 border-amber-500 px-4 py-2 rounded text-amber-200 z-10">
          🔨 Place {bStat(buildingToBuild).name} - Click to build or ESC to cancel
        </div>
      )}
    </div>
  );
}
