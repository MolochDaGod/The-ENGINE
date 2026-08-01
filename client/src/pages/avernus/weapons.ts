/**
 * Avernus weapon / skill catalog — maps fantasy loadouts → grudge6 packs.
 * Replaces legacy toon-shooter gun models.
 */

import { WEAPON_PACKS, type WeaponPackId } from './weaponPacks';

export type WeaponType = 'greatsword' | 'bow' | 'sabres' | 'scythe' | 'runeblade' | 'sword_shield';
export type AbilityKey = 'Q' | 'E' | 'R' | 'F';
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
}

function skillsFromPack(packId: WeaponPackId, resource: Ability['costType']): Ability[] {
  const pack = WEAPON_PACKS[packId];
  return pack.skills
    .filter((s) => s.key === 'Q' || s.key === 'E' || s.key === 'R' || s.key === 'F')
    .map((s, i) => ({
      key: s.key as AbilityKey,
      name: s.name,
      cooldown: 0,
      maxCooldown: s.cooldown,
      cost: i === 0 ? 0 : 10 + i * 5,
      costType: resource,
      description: s.description,
      unlocked: true,
      anim: s.anim,
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
    abilities: skillsFromPack('magic-caster', 'mana'),
  },
];

export function weaponByType(type: WeaponType): WeaponData | undefined {
  return WEAPONS.find((w) => w.type === type);
}

export function packForWeapon(type: WeaponType): WeaponPackId {
  return weaponByType(type)?.packId ?? 'sword-shield';
}

/** Cover layout for arena props (simple geometric — no shooter kit). */
export type CoverType = 'solid' | 'breakable' | 'explosive' | 'hazard' | 'pickup';

export interface MapPlacement {
  kind: 'pillar' | 'crate' | 'wall' | 'pickup' | 'torch';
  pos: [number, number, number];
  rot?: number;
  scale?: number;
  coverType?: CoverType;
  health?: number;
  color?: number;
}

/** Dark-fantasy Avernus pit layout (metres, SI). */
export const ARENA_LAYOUT: MapPlacement[] = [
  { kind: 'pillar', pos: [-10, 0, -10], scale: 1, coverType: 'solid', health: 9999, color: 0x3a322c },
  { kind: 'pillar', pos: [10, 0, -10], scale: 1, coverType: 'solid', health: 9999, color: 0x3a322c },
  { kind: 'pillar', pos: [-10, 0, 10], scale: 1, coverType: 'solid', health: 9999, color: 0x3a322c },
  { kind: 'pillar', pos: [10, 0, 10], scale: 1, coverType: 'solid', health: 9999, color: 0x3a322c },
  { kind: 'crate', pos: [-4, 0, 0], scale: 1.2, coverType: 'breakable', health: 120, color: 0x5a4030 },
  { kind: 'crate', pos: [4, 0, 0], scale: 1.2, coverType: 'breakable', health: 120, color: 0x5a4030 },
  { kind: 'crate', pos: [0, 0, -6], scale: 1, coverType: 'breakable', health: 100, color: 0x4a3828 },
  { kind: 'crate', pos: [0, 0, 6], scale: 1, coverType: 'breakable', health: 100, color: 0x4a3828 },
  { kind: 'wall', pos: [-14, 0, 0], rot: Math.PI / 2, scale: 1, coverType: 'solid', health: 600, color: 0x2a2420 },
  { kind: 'wall', pos: [14, 0, 0], rot: Math.PI / 2, scale: 1, coverType: 'solid', health: 600, color: 0x2a2420 },
  { kind: 'pickup', pos: [0, 0.5, 12], coverType: 'pickup', health: 1, color: 0x44ff66 },
  { kind: 'pickup', pos: [0, 0.5, -12], coverType: 'pickup', health: 1, color: 0x44ff66 },
  { kind: 'torch', pos: [-8, 0, 8], color: 0xff6622 },
  { kind: 'torch', pos: [8, 0, -8], color: 0xff6622 },
  { kind: 'torch', pos: [8, 0, 8], color: 0x6644ff },
  { kind: 'torch', pos: [-8, 0, -8], color: 0x6644ff },
];
