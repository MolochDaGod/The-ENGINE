import type { CharacterRace } from '@/engine';
import type { WeaponPackId } from './weaponPacks';

/* ═══════════════════════════════════════════════════════════════
   AI BEHAVIOR — Avernus Arena NPC brain (grudge6 races)
   States: idle → patrol → chase → attack → flee → take-cover
═══════════════════════════════════════════════════════════════ */

export type AIState =
  | 'idle'
  | 'patrol'
  | 'chase'
  | 'attack'
  | 'flee'
  | 'take_cover'
  | 'ally_follow'
  | 'dead';

export type NPCRole =
  | 'grunt'
  | 'ranged'
  | 'tank'
  | 'flanker'
  | 'boss'
  | 'ally_soldier'
  | 'ally_medic'
  | 'ally_sniper';

export type Team = 'player' | 'enemy' | 'neutral';

export interface AIProfile {
  role: NPCRole;
  team: Team;
  /** grudge6 race kit */
  race: CharacterRace;
  /** weapon anim pack for loadWeaponPack */
  weaponPack: WeaponPackId;
  health: number;
  speed: number;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  sightRange: number;
  fleeThreshold: number;
  aggressionBias: number;
  canTakeCover: boolean;
  canFlank: boolean;
  patrolRadius: number;
}

export const NPC_PROFILES: Record<NPCRole, AIProfile> = {
  grunt: {
    role: 'grunt',
    team: 'enemy',
    race: 'orc',
    weaponPack: 'sword-shield',
    health: 150,
    speed: 3.5,
    attackRange: 2.5,
    attackDamage: 15,
    attackCooldown: 0.8,
    sightRange: 20,
    fleeThreshold: 0.15,
    aggressionBias: 0.7,
    canTakeCover: false,
    canFlank: false,
    patrolRadius: 10,
  },
  ranged: {
    role: 'ranged',
    team: 'enemy',
    race: 'elf',
    weaponPack: 'longbow',
    health: 100,
    speed: 2.5,
    attackRange: 18,
    attackDamage: 28,
    attackCooldown: 1.6,
    sightRange: 30,
    fleeThreshold: 0.3,
    aggressionBias: 0.3,
    canTakeCover: true,
    canFlank: false,
    patrolRadius: 8,
  },
  tank: {
    role: 'tank',
    team: 'enemy',
    race: 'dwarf',
    weaponPack: 'great-sword',
    health: 400,
    speed: 1.8,
    attackRange: 2.8,
    attackDamage: 40,
    attackCooldown: 1.5,
    sightRange: 15,
    fleeThreshold: 0.0,
    aggressionBias: 1.0,
    canTakeCover: false,
    canFlank: false,
    patrolRadius: 6,
  },
  flanker: {
    role: 'flanker',
    team: 'enemy',
    race: 'barbarian',
    weaponPack: 'unarmed',
    health: 120,
    speed: 5.0,
    attackRange: 2.2,
    attackDamage: 45,
    attackCooldown: 0.5,
    sightRange: 18,
    fleeThreshold: 0.2,
    aggressionBias: 0.8,
    canTakeCover: true,
    canFlank: true,
    patrolRadius: 15,
  },
  boss: {
    role: 'boss',
    team: 'enemy',
    race: 'undead',
    weaponPack: 'magic-caster',
    health: 900,
    speed: 2.2,
    attackRange: 3.2,
    attackDamage: 55,
    attackCooldown: 1.0,
    sightRange: 28,
    fleeThreshold: 0,
    aggressionBias: 1,
    canTakeCover: false,
    canFlank: true,
    patrolRadius: 12,
  },
  ally_soldier: {
    role: 'ally_soldier',
    team: 'player',
    race: 'human',
    weaponPack: 'sword-shield',
    health: 180,
    speed: 3.8,
    attackRange: 2.4,
    attackDamage: 18,
    attackCooldown: 0.7,
    sightRange: 22,
    fleeThreshold: 0.1,
    aggressionBias: 0.75,
    canTakeCover: true,
    canFlank: false,
    patrolRadius: 8,
  },
  ally_medic: {
    role: 'ally_medic',
    team: 'player',
    race: 'elf',
    weaponPack: 'magic-caster',
    health: 140,
    speed: 3.2,
    attackRange: 12,
    attackDamage: 12,
    attackCooldown: 1.2,
    sightRange: 20,
    fleeThreshold: 0.4,
    aggressionBias: 0.2,
    canTakeCover: true,
    canFlank: false,
    patrolRadius: 6,
  },
  ally_sniper: {
    role: 'ally_sniper',
    team: 'player',
    race: 'elf',
    weaponPack: 'longbow',
    health: 110,
    speed: 2.8,
    attackRange: 22,
    attackDamage: 35,
    attackCooldown: 1.8,
    sightRange: 32,
    fleeThreshold: 0.35,
    aggressionBias: 0.35,
    canTakeCover: true,
    canFlank: true,
    patrolRadius: 10,
  },
};
