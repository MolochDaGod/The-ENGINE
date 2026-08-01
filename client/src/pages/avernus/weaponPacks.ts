/**
 * Avernus weapon animation packs + skill hotkeys.
 * Aligns with annihilate WEAPON_PACKS + fleet Danger Room Q/E/R/F skills.
 */

import type { AbilityKey } from './weapons';

export type WeaponPackId = 'sword-shield' | 'great-sword' | 'longbow' | 'magic-caster' | 'unarmed';

export interface WeaponAnimMap {
  id: WeaponPackId;
  /** grudge6 anim pack alias */
  animPack: 'sword_shield' | '2h_melee' | 'longbow' | 'magic' | 'unarmed';
  label: string;
  /** Local portal base (public/models/animations/…) — FBX fallback only */
  basePath: string;
  /**
   * Baked Bip001 JSON root (preferred).
   * Live: grudge-arena.grudge-studio.com/anims/baked — see bakedAnimSystem.ts
   */
  bakedBase?: string;
  clips: Record<string, string>;
  /** Skill bar 1–4 / Q E R F */
  skills: {
    key: AbilityKey | '1' | '2' | '3' | '4';
    name: string;
    anim: string;
    cooldown: number;
    description: string;
  }[];
}

export const WEAPON_PACKS: Record<WeaponPackId, WeaponAnimMap> = {
  'sword-shield': {
    id: 'sword-shield',
    animPack: 'sword_shield',
    label: '1H Sword & Shield',
    basePath: '/models/animations/sword-shield/',
    bakedBase: 'https://grudge-arena.grudge-studio.com/anims/baked/sword_shield/',
    clips: {
      idle: 'sword and shield idle.fbx',
      running: 'sword and shield run.fbx',
      walk: 'sword and shield walk.fbx',
      punch: 'sword and shield attack.fbx',
      fist: 'sword and shield attack (2).fbx',
      strike: 'sword and shield slash.fbx',
      strikeEnd: 'sword and shield slash (2).fbx',
      block: 'sword and shield block idle.fbx',
      hit: 'sword and shield impact.fbx',
      jump: 'sword and shield jump.fbx',
      dashAttack: 'sword and shield kick.fbx',
      death: 'sword and shield death.fbx',
    },
    skills: [
      { key: 'Q', name: 'Shield Bash', anim: 'fist', cooldown: 6, description: 'Stun bash with shield' },
      { key: 'E', name: 'Cleave', anim: 'strike', cooldown: 5, description: 'Wide slash arc' },
      { key: 'R', name: 'Guard Break', anim: 'dashAttack', cooldown: 10, description: 'Dash attack through guard' },
      { key: 'F', name: 'Rally', anim: 'block', cooldown: 14, description: 'Brief damage reduction' },
    ],
  },
  'great-sword': {
    id: 'great-sword',
    animPack: '2h_melee',
    label: '2H Great Sword',
    basePath: '/models/animations/great-sword/',
    clips: {
      idle: 'great sword idle.fbx',
      running: 'great sword run.fbx',
      walk: 'great sword walk.fbx',
      punch: 'great sword attack.fbx',
      fist: 'great sword slash.fbx',
      strike: 'great sword slash (2).fbx',
      whirlwind: 'great sword high spin attack.fbx',
      block: 'great sword blocking.fbx',
      hit: 'great sword impact.fbx',
      jump: 'great sword jump.fbx',
      dashAttack: 'great sword kick.fbx',
      punchStart: 'great sword power up.fbx',
      death: 'two handed sword death.fbx',
    },
    skills: [
      { key: 'Q', name: 'Colossus', anim: 'punch', cooldown: 7, description: 'Heavy overhead' },
      { key: 'E', name: 'Whirlwind', anim: 'whirlwind', cooldown: 12, description: 'Spinning AoE' },
      { key: 'R', name: 'Charge', anim: 'dashAttack', cooldown: 9, description: 'Forward lunge' },
      { key: 'F', name: 'Power Up', anim: 'punchStart', cooldown: 16, description: 'Charge next hit' },
    ],
  },
  longbow: {
    id: 'longbow',
    animPack: 'longbow',
    label: 'Longbow',
    basePath: '/models/animations/longbow/',
    bakedBase: 'https://grudge-arena.grudge-studio.com/anims/baked/longbow/',
    clips: {
      idle: 'standing idle 01.fbx',
      running: 'standing run forward.fbx',
      walk: 'standing walk forward.fbx',
      fall: 'standing run back.fbx',
      punch: 'standing draw arrow.fbx',
      strike: 'standing aim idle.fbx',
    },
    skills: [
      { key: 'Q', name: 'Quick Shot', anim: 'punch', cooldown: 2, description: 'Fast arrow' },
      { key: 'E', name: 'Piercing', anim: 'strike', cooldown: 6, description: 'Pierce line' },
      { key: 'R', name: 'Rain', anim: 'strike', cooldown: 14, description: 'Arrow rain' },
      { key: 'F', name: 'Retreat Shot', anim: 'fall', cooldown: 8, description: 'Backstep fire' },
    ],
  },
  'magic-caster': {
    id: 'magic-caster',
    animPack: 'magic',
    label: 'Magic Caster',
    basePath: '/models/animations/magic-caster/',
    bakedBase: 'https://grudge-arena.grudge-studio.com/anims/baked/magic/',
    clips: {
      idle: 'standing idle.fbx',
      running: 'Standing Run Forward.fbx',
      walk: 'Standing Walk Forward.fbx',
      punch: 'Standing 1H Magic Attack 01.fbx',
      strike: 'Standing 2H Magic Area Attack 02.fbx',
      jump: 'Standing Jump.fbx',
      death: 'Standing React Death Backward.fbx',
      hit: 'Standing React Large From Front.fbx',
    },
    skills: [
      { key: 'Q', name: 'Arc Bolt', anim: 'punch', cooldown: 3, description: 'Ranged magic bolt' },
      { key: 'E', name: 'Nova', anim: 'strike', cooldown: 10, description: 'AoE blast' },
      { key: 'R', name: 'Barrier', anim: 'idle', cooldown: 12, description: 'Shield bubble' },
      { key: 'F', name: 'Cataclysm', anim: 'strike', cooldown: 20, description: 'Ultimate AoE' },
    ],
  },
  unarmed: {
    id: 'unarmed',
    animPack: 'unarmed',
    label: 'Unarmed / Brawler',
    basePath: '/models/animations/sword-shield/',
    clips: {
      idle: 'sword and shield idle.fbx',
      running: 'sword and shield run.fbx',
      walk: 'sword and shield walk.fbx',
      punch: 'sword and shield attack.fbx',
      fist: 'sword and shield attack (2).fbx',
      dashAttack: 'sword and shield kick.fbx',
      hit: 'sword and shield impact.fbx',
      jump: 'sword and shield jump.fbx',
    },
    skills: [
      { key: 'Q', name: 'Jab', anim: 'punch', cooldown: 2, description: 'Quick punch' },
      { key: 'E', name: 'Hook', anim: 'fist', cooldown: 4, description: 'Heavy hook' },
      { key: 'R', name: 'Kick', anim: 'dashAttack', cooldown: 7, description: 'Forward kick' },
      { key: 'F', name: 'Fury', anim: 'fist', cooldown: 15, description: 'Combo rush' },
    ],
  },
};

export const WEAPON_PACK_LIST = Object.values(WEAPON_PACKS);
