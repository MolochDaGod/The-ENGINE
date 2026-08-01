/**
 * Avernus weapon animation packs + skill hotkeys.
 *
 * Hotkeys = Danger Room SSOT (NOT invent Q/E/R/F as four free abilities):
 *   F   = class / weapon skill (f-skill)
 *   R   = ultimate / heavy
 *   1–4 = signatures
 *   Q   = weapon swap · Hold Q = mode/state radial
 *   E   = interact
 *
 * Sources: gameopen hud/quickActions.ts + three/Studio.ts
 */

export type WeaponPackId = 'sword-shield' | 'great-sword' | 'longbow' | 'magic-caster' | 'unarmed';

/** Danger Room combat skill keys only */
export type SkillBindKey = 'F' | 'R' | '1' | '2' | '3' | '4';

export interface WeaponSkillBind {
  key: SkillBindKey;
  name: string;
  anim: string;
  cooldown: number;
  description: string;
  /** F = class skill · R = ultimate · 1–4 = signatures */
  role: 'class' | 'ultimate' | 'signature';
}

export interface WeaponAnimMap {
  id: WeaponPackId;
  animPack: 'sword_shield' | '2h_melee' | 'longbow' | 'magic' | 'unarmed';
  label: string;
  /** Local portal FBX fallback only — gameplay prefers baked JSON / GLB */
  basePath: string;
  bakedBase?: string;
  clips: Record<string, string>;
  skills: WeaponSkillBind[];
}

function kit(
  classSkill: Omit<WeaponSkillBind, 'key' | 'role'>,
  ultimate: Omit<WeaponSkillBind, 'key' | 'role'>,
  sigs: Omit<WeaponSkillBind, 'key' | 'role'>[],
): WeaponSkillBind[] {
  const out: WeaponSkillBind[] = [
    { ...classSkill, key: 'F', role: 'class' },
    { ...ultimate, key: 'R', role: 'ultimate' },
  ];
  sigs.slice(0, 4).forEach((s, i) => {
    out.push({ ...s, key: String(i + 1) as '1' | '2' | '3' | '4', role: 'signature' });
  });
  return out;
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
    skills: kit(
      { name: 'Shield Bash', anim: 'fist', cooldown: 6, description: 'Class skill — shield bash' },
      { name: 'Divine Wind', anim: 'strike', cooldown: 18, description: 'Ultimate / heavy' },
      [
        { name: 'Cleave', anim: 'strike', cooldown: 5, description: 'Signature 1' },
        { name: 'Guard Break', anim: 'dashAttack', cooldown: 10, description: 'Signature 2' },
        { name: 'Rally', anim: 'block', cooldown: 14, description: 'Signature 3' },
        { name: 'Slash', anim: 'punch', cooldown: 4, description: 'Signature 4' },
      ],
    ),
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
    skills: kit(
      { name: 'Colossus', anim: 'punch', cooldown: 7, description: 'Class skill' },
      { name: 'Whirlwind', anim: 'whirlwind', cooldown: 18, description: 'Ultimate / heavy' },
      [
        { name: 'Charge', anim: 'dashAttack', cooldown: 9, description: 'Signature 1' },
        { name: 'Power Up', anim: 'punchStart', cooldown: 16, description: 'Signature 2' },
        { name: 'Slash', anim: 'fist', cooldown: 5, description: 'Signature 3' },
        { name: 'Strike', anim: 'strike', cooldown: 6, description: 'Signature 4' },
      ],
    ),
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
    skills: kit(
      { name: 'Quick Shot', anim: 'punch', cooldown: 3, description: 'Class skill' },
      { name: 'Rain of Arrows', anim: 'strike', cooldown: 16, description: 'Ultimate / heavy' },
      [
        { name: 'Piercing', anim: 'strike', cooldown: 6, description: 'Signature 1' },
        { name: 'Retreat Shot', anim: 'fall', cooldown: 8, description: 'Signature 2' },
        { name: 'Mark', anim: 'punch', cooldown: 10, description: 'Signature 3' },
        { name: 'Focus', anim: 'idle', cooldown: 12, description: 'Signature 4' },
      ],
    ),
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
    skills: kit(
      { name: 'Arc Bolt', anim: 'punch', cooldown: 3, description: 'Class skill' },
      { name: 'Cataclysm', anim: 'strike', cooldown: 20, description: 'Ultimate / heavy' },
      [
        { name: 'Nova', anim: 'strike', cooldown: 10, description: 'Signature 1' },
        { name: 'Barrier', anim: 'idle', cooldown: 12, description: 'Signature 2' },
        { name: 'Bolt II', anim: 'punch', cooldown: 5, description: 'Signature 3' },
        { name: 'Ward', anim: 'idle', cooldown: 14, description: 'Signature 4' },
      ],
    ),
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
    skills: kit(
      { name: 'Jab', anim: 'punch', cooldown: 2, description: 'Class skill' },
      { name: 'Fury', anim: 'fist', cooldown: 15, description: 'Ultimate / heavy' },
      [
        { name: 'Hook', anim: 'fist', cooldown: 4, description: 'Signature 1' },
        { name: 'Kick', anim: 'dashAttack', cooldown: 7, description: 'Signature 2' },
        { name: 'Combo', anim: 'punch', cooldown: 5, description: 'Signature 3' },
        { name: 'Rush', anim: 'dashAttack', cooldown: 9, description: 'Signature 4' },
      ],
    ),
  },
};

export const WEAPON_PACK_LIST = Object.values(WEAPON_PACKS);
