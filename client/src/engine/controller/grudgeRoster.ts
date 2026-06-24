/**
 * Grudge Studio character roster + CDN animation packs for the unified player controller.
 * Sources: grudgecontrol showcase + artifact animator grudge/anims.ts
 */

export const GRUDGE_CDN = 'https://assets.grudge-studio.com';
export const GRUDGE_API = 'https://api.grudge-studio.com';
export const GRUDGE_ID = 'https://id.grudge-studio.com';

const RACES = `${GRUDGE_CDN}/models/grudge6/races`;
const ANIM_BASE = `${GRUDGE_CDN}/models/animations/grudge6_brb/base`;
const GLOCO = `${GRUDGE_CDN}/models/animations/glocomotion`;

export type AnimPack = 'magic' | 'sword_shield' | 'longbow' | 'unarmed';

export interface GrudgeCharacterEntry {
  id: string;
  name: string;
  faction: string;
  race: string;
  url: string;
  color: string;
  scale?: number;
  isGlb?: boolean;
  animPack?: AnimPack;
}

/** Shared Bip001 locomotion clips (grudge6_brb base pack on R2). */
export const GRUDGE6_LOCOMOTION = {
  idle: `${ANIM_BASE}/Idle.glb`,
  walk: `${ANIM_BASE}/Swagger Walk.glb`,
  run: `${ANIM_BASE}/Swagger Walk.glb`,
  jump: `${GLOCO}/jump.glb`,
};

export const GRUDGE6_ANIM_CONFIG = {
  idleAnim: 'idle',
  walkAnim: 'walk',
  runAnim: 'run',
  jumpAnim: 'jump',
  headBoneName: 'Bip001 Head',
  rotateY: Math.PI,
  scale: 1,
  animationUrls: {
    idle: GRUDGE6_LOCOMOTION.idle,
    walk: GRUDGE6_LOCOMOTION.walk,
    run: GRUDGE6_LOCOMOTION.run,
    jump: GRUDGE6_LOCOMOTION.jump,
  },
};

/** Weapon stance packs — maps to registerLocomotionSet() on grudge-control. */
export const ANIM_PACK_CLIPS: Record<AnimPack, { idle: string; walk: string; run: string; attack: string }> = {
  unarmed: {
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    attack: 'punching',
  },
  magic: {
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    attack: 'cast',
  },
  sword_shield: {
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    attack: 'attack',
  },
  longbow: {
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    attack: 'aim',
  },
};

export const GRUDGE_CHARACTERS: GrudgeCharacterEntry[] = [
  { id: 'human', name: 'Human (WK)', faction: 'Crusade', race: 'human', url: `${RACES}/WK_Characters.fbx`, color: '#c9a227', animPack: 'sword_shield' },
  { id: 'barbarian', name: 'Barbarian (BRB)', faction: 'Crusade', race: 'barbarian', url: `${RACES}/BRB_Characters.fbx`, color: '#8b4513', animPack: 'unarmed' },
  { id: 'elf', name: 'Elf (ELF)', faction: 'Fabled', race: 'elf', url: `${RACES}/ELF_Characters.fbx`, color: '#2ecc71', animPack: 'longbow' },
  { id: 'dwarf', name: 'Dwarf (DWF)', faction: 'Fabled', race: 'dwarf', url: `${RACES}/DWF_Characters.fbx`, color: '#3498db', animPack: 'sword_shield' },
  { id: 'orc', name: 'Orc (ORC)', faction: 'Legion', race: 'orc', url: `${RACES}/ORC_Characters.fbx`, color: '#27ae60', animPack: 'unarmed' },
  { id: 'undead', name: 'Undead (UD)', faction: 'Legion', race: 'undead', url: `${RACES}/UD_Characters.fbx`, color: '#9b59b6', animPack: 'magic' },
];

export function buildPlayerModelConfig(character: GrudgeCharacterEntry) {
  const base = { ...GRUDGE6_ANIM_CONFIG, url: character.url };
  if (character.isGlb) {
    return {
      ...base,
      scale: character.scale ?? 0.001,
      idleAnim: 'idle1',
      walkAnim: 'walk',
      runAnim: 'run',
      jumpAnim: 'jump',
      headBoneName: 'mixamorigHead',
      animationUrls: undefined,
    };
  }
  return { ...base, scale: character.scale ?? 1 };
}

export function animPackForCharacter(character: GrudgeCharacterEntry): AnimPack {
  return character.animPack ?? 'sword_shield';
}