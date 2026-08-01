/**
 * Avernus weapon / skill catalog — maps fantasy loadouts → grudge6 packs.
 * Replaces legacy toon-shooter gun models.
 */

import { WEAPON_PACKS, type WeaponPackId } from './weaponPacks';

export type WeaponType = 'greatsword' | 'bow' | 'sabres' | 'scythe' | 'runeblade' | 'sword_shield';
/** Danger Room skill binds only (Q/E are mode/interact — not skill slots). */
export type AbilityKey = 'F' | 'R' | '1' | '2' | '3' | '4';
export type AttackType = 'melee' | 'ranged' | 'magic';

export interface Ability {
  key: AbilityKey;
  name: string;
  cooldown: number;
  maxCooldown: number;
  cost: number;
  costType: 'mana' | 'rage' | 'energy';
  description: string;
  unlocked: boolean;
  anim?: string;
  role?: 'class' | 'ultimate' | 'signature';
}

export interface WeaponData {
  type: WeaponType;
  name: string;
  icon: string;
  subclass: string;
  abilities: Ability[];
  resourceType: 'mana' | 'rage' | 'energy';
  color: string;
  /** grudge6 / annihilate pack id */
  packId: WeaponPackId;
  attackType: AttackType;
  meleeRangeM: number;
  /** @deprecated Legacy avernus-3d gun GLB key */
  gunModel?: string;
  gunModelAlt?: string;
}

function skillsFromPack(packId: WeaponPackId, resource: Ability['costType']): Ability[] {
  const pack = WEAPON_PACKS[packId];
  return pack.skills.map((s, i) => ({
    key: s.key as AbilityKey,
    name: s.name,
    cooldown: 0,
    maxCooldown: s.cooldown,
    cost: s.role === 'class' ? 0 : s.role === 'ultimate' ? 40 : 10 + i * 5,
    costType: resource,
    description: s.description,
    unlocked: true,
    anim: s.anim,
    role: s.role,
  }));
}

export const WEAPONS: WeaponData[] = [
  {
    type: 'sword_shield',
    name: 'Sword & Shield',
    icon: '🛡️',
    subclass: 'VANGUARD',
    color: '#d4af37',
    resourceType: 'rage',
    packId: 'sword-shield',
    attackType: 'melee',
    meleeRangeM: 2.4,
    gunModel: 'Shovel',
    abilities: skillsFromPack('sword-shield', 'rage'),
  },
  {
    type: 'greatsword',
    name: 'Greatsword',
    icon: '⚔️',
    subclass: 'IMMORTAL',
    color: '#00bfff',
    resourceType: 'rage',
    packId: 'great-sword',
    attackType: 'melee',
    meleeRangeM: 2.8,
    gunModel: 'Shovel',
    abilities: skillsFromPack('great-sword', 'rage'),
  },
  {
    type: 'bow',
    name: 'Longbow',
    icon: '🏹',
    subclass: 'VIPER',
    color: '#00ff00',
    resourceType: 'energy',
    packId: 'longbow',
    attackType: 'ranged',
    meleeRangeM: 18,
    gunModel: 'Sniper',
    abilities: skillsFromPack('longbow', 'energy'),
  },
  {
    type: 'sabres',
    name: 'Dual Sabres',
    icon: '🗡️',
    subclass: 'ASSASSIN',
    color: '#ff4444',
    resourceType: 'energy',
    packId: 'unarmed',
    attackType: 'melee',
    meleeRangeM: 2.2,
    gunModel: 'Knife_1',
    gunModelAlt: 'Knife_2',
    abilities: skillsFromPack('unarmed', 'energy'),
  },
  {
    type: 'scythe',
    name: 'Scythe',
    icon: '🦋',
    subclass: 'WEAVER',
    color: '#4169e1',
    resourceType: 'mana',
    packId: 'great-sword',
    attackType: 'magic',
    meleeRangeM: 2.6,
    gunModel: 'RocketLauncher',
    abilities: skillsFromPack('great-sword', 'mana'),
  },
  {
    type: 'runeblade',
    name: 'Runeblade',
    icon: '🔮',
    subclass: 'TEMPLAR',
    color: '#9400d3',
    resourceType: 'mana',
    packId: 'magic-caster',
    attackType: 'ranged',
    meleeRangeM: 14,
    gunModel: 'AK',
    abilities: skillsFromPack('magic-caster', 'mana'),
  },
];

export function weaponByType(type: WeaponType): WeaponData | undefined {
  return WEAPONS.find((w) => w.type === type);
}

export function packForWeapon(type: WeaponType): WeaponPackId {
  return weaponByType(type)?.packId ?? 'sword-shield';
}

/** Cover layout for arena props. */
export type CoverType = 'solid' | 'breakable' | 'explosive' | 'hazard' | 'pickup';

export interface MapPlacement {
  /** Legacy avernus-3d env asset key */
  asset: string;
  pos: [number, number, number];
  rot?: number;
  scale?: number;
  coverType?: CoverType;
  health?: number;
}

/**
 * Arena cover layout for legacy `/avernus-3d`.
 * Canonical grudge6 pit uses `buildAvernusArena()` in combat.ts instead.
 */
export const ARENA_LAYOUT: MapPlacement[] = [
  { asset: 'Structure_1', pos: [-22, 0, -22], scale: 2, coverType: 'solid', health: 9999 },
  { asset: 'Structure_2', pos: [22, 0, -22], rot: Math.PI / 2, scale: 2, coverType: 'solid', health: 9999 },
  { asset: 'Structure_3', pos: [-22, 0, 22], rot: -Math.PI / 2, scale: 2, coverType: 'solid', health: 9999 },
  { asset: 'Structure_4', pos: [22, 0, 22], rot: Math.PI, scale: 2, coverType: 'solid', health: 9999 },
  { asset: 'Container_Small', pos: [-3, 0, 0], scale: 1.5, coverType: 'solid', health: 500 },
  { asset: 'Container_Small', pos: [3, 0, 0], rot: Math.PI, scale: 1.5, coverType: 'solid', health: 500 },
  { asset: 'SackTrench', pos: [0, 0, 4], scale: 2, coverType: 'solid', health: 300 },
  { asset: 'SackTrench', pos: [0, 0, -4], rot: Math.PI, scale: 2, coverType: 'solid', health: 300 },
  { asset: 'Barrier_Large', pos: [-12, 0, 0], rot: Math.PI / 4, scale: 2, coverType: 'solid', health: 400 },
  { asset: 'Barrier_Large', pos: [12, 0, 0], rot: -Math.PI / 4, scale: 2, coverType: 'solid', health: 400 },
  { asset: 'BrickWall_1', pos: [0, 0, -12], scale: 2, coverType: 'solid', health: 600 },
  { asset: 'BrickWall_2', pos: [0, 0, 12], scale: 2, coverType: 'solid', health: 600 },
  { asset: 'Crate', pos: [-8, 0, -8], scale: 2, coverType: 'breakable', health: 100 },
  { asset: 'Crate', pos: [8, 0, 8], scale: 2, coverType: 'breakable', health: 100 },
  { asset: 'Crate', pos: [-8, 0, 8], scale: 2, coverType: 'breakable', health: 100 },
  { asset: 'Crate', pos: [8, 0, -8], scale: 2, coverType: 'breakable', health: 100 },
  { asset: 'ExplodingBarrel', pos: [-6, 0, -10], scale: 2, coverType: 'explosive', health: 30 },
  { asset: 'ExplodingBarrel', pos: [6, 0, 10], scale: 2, coverType: 'explosive', health: 30 },
  { asset: 'Health', pos: [0, 0.5, 18], scale: 2, coverType: 'pickup', health: 1 },
  { asset: 'Health', pos: [0, 0.5, -18], scale: 2, coverType: 'pickup', health: 1 },
  { asset: 'StreetLight', pos: [-16, 0, 0], scale: 2 },
  { asset: 'StreetLight', pos: [16, 0, 0], scale: 2 },
];
