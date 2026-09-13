/**
 * Avernus Arena — grudge6 / Toon RTS asset SSOT
 *
 * HARD RULE: race kits load via `@/engine` RaceEquipment (production GLB → FBX).
 * Primary arena (`avernus-arena.tsx`) uses grudge6 only.
 *
 * `ASSET_URLS` is retained for legacy `/avernus-3d` (toon-shooter kit) so the
 * portal production build still compiles that route.
 */

import { ASSETS_ORIGIN } from '@/lib/api-config';
import { GRUDGE_CDN, GRUDGE_CHARACTERS, type AnimPack } from '@/engine';

export const AVERNUS_CDN = ASSETS_ORIGIN || GRUDGE_CDN || 'https://assets.grudge-studio.com';

/** @deprecated Legacy avernus-3d only — do not use for grudge6 heroes. */
const TOON_SHOOTER = 'https://assets.grudge-studio.com/toon-shooter';

/** @deprecated Used by `avernus-3d.tsx` only. */
export const ASSET_URLS = {
  characters: {
    soldier: `${TOON_SHOOTER}/characters/Character_Soldier.glb`,
    enemy: `${TOON_SHOOTER}/characters/Character_Enemy.glb`,
    hazmat: `${TOON_SHOOTER}/characters/Character_Hazmat.glb`,
  },
  guns: {
    AK: `${TOON_SHOOTER}/guns/AK.glb`,
    Pistol: `${TOON_SHOOTER}/guns/Pistol.glb`,
    Revolver: `${TOON_SHOOTER}/guns/Revolver.glb`,
    Revolver_Small: `${TOON_SHOOTER}/guns/Revolver_Small.glb`,
    SMG: `${TOON_SHOOTER}/guns/SMG.glb`,
    Shotgun: `${TOON_SHOOTER}/guns/Shotgun.glb`,
    Sniper: `${TOON_SHOOTER}/guns/Sniper.glb`,
    Sniper_2: `${TOON_SHOOTER}/guns/Sniper_2.glb`,
    RocketLauncher: `${TOON_SHOOTER}/guns/RocketLauncher.glb`,
    GrenadeLauncher: `${TOON_SHOOTER}/guns/GrenadeLauncher.glb`,
    ShortCannon: `${TOON_SHOOTER}/guns/ShortCannon.glb`,
    Knife_1: `${TOON_SHOOTER}/guns/Knife_1.glb`,
    Knife_2: `${TOON_SHOOTER}/guns/Knife_2.glb`,
    Shovel: `${TOON_SHOOTER}/guns/Shovel.glb`,
    Grenade: `${TOON_SHOOTER}/guns/Grenade.glb`,
    FireGrenade: `${TOON_SHOOTER}/guns/FireGrenade.glb`,
  },
  environment: {
    Barrier_Fixed: `${TOON_SHOOTER}/environment/Barrier_Fixed.glb`,
    Barrier_Large: `${TOON_SHOOTER}/environment/Barrier_Large.glb`,
    Barrier_Single: `${TOON_SHOOTER}/environment/Barrier_Single.glb`,
    Barrier_Trash: `${TOON_SHOOTER}/environment/Barrier_Trash.glb`,
    BearTrap_Open: `${TOON_SHOOTER}/environment/BearTrap_Open.glb`,
    BrickWall_1: `${TOON_SHOOTER}/environment/BrickWall_1.glb`,
    BrickWall_2: `${TOON_SHOOTER}/environment/BrickWall_2.glb`,
    CardboardBoxes_1: `${TOON_SHOOTER}/environment/CardboardBoxes_1.glb`,
    CardboardBoxes_2: `${TOON_SHOOTER}/environment/CardboardBoxes_2.glb`,
    Container_Long: `${TOON_SHOOTER}/environment/Container_Long.glb`,
    Container_Small: `${TOON_SHOOTER}/environment/Container_Small.glb`,
    Crate: `${TOON_SHOOTER}/environment/Crate.glb`,
    Debris_BrokenCar: `${TOON_SHOOTER}/environment/Debris_BrokenCar.glb`,
    Debris_Tires: `${TOON_SHOOTER}/environment/Debris_Tires.glb`,
    ExplodingBarrel: `${TOON_SHOOTER}/environment/ExplodingBarrel.glb`,
    Fence: `${TOON_SHOOTER}/environment/Fence.glb`,
    Fence_Long: `${TOON_SHOOTER}/environment/Fence_Long.glb`,
    GasCan: `${TOON_SHOOTER}/environment/GasCan.glb`,
    GasTank: `${TOON_SHOOTER}/environment/GasTank.glb`,
    Health: `${TOON_SHOOTER}/environment/Health.glb`,
    Landmine: `${TOON_SHOOTER}/environment/Landmine.glb`,
    MetalFence: `${TOON_SHOOTER}/environment/MetalFence.glb`,
    SackTrench: `${TOON_SHOOTER}/environment/SackTrench.glb`,
    SackTrench_Small: `${TOON_SHOOTER}/environment/SackTrench_Small.glb`,
    Sign: `${TOON_SHOOTER}/environment/Sign.glb`,
    StreetLight: `${TOON_SHOOTER}/environment/StreetLight.glb`,
    Structure_1: `${TOON_SHOOTER}/environment/Structure_1.glb`,
    Structure_2: `${TOON_SHOOTER}/environment/Structure_2.glb`,
    Structure_3: `${TOON_SHOOTER}/environment/Structure_3.glb`,
    Structure_4: `${TOON_SHOOTER}/environment/Structure_4.glb`,
    Tank: `${TOON_SHOOTER}/environment/Tank.glb`,
    TrafficCone: `${TOON_SHOOTER}/environment/TrafficCone.glb`,
    TrashContainer: `${TOON_SHOOTER}/environment/TrashContainer.glb`,
    Tree_1: `${TOON_SHOOTER}/environment/Tree_1.glb`,
    Tree_2: `${TOON_SHOOTER}/environment/Tree_2.glb`,
    Tree_3: `${TOON_SHOOTER}/environment/Tree_3.glb`,
    Tree_4: `${TOON_SHOOTER}/environment/Tree_4.glb`,
    WaterTank_Floor: `${TOON_SHOOTER}/environment/WaterTank_Floor.glb`,
    WoodPlanks: `${TOON_SHOOTER}/environment/WoodPlanks.glb`,
  },
} as const;

/** Race kit file stems (Bip001 modular packs on R2). */
export const GRUDGE6_RACE_FILE = {
  human: 'WK_Characters',
  barbarian: 'BRB_Characters',
  elf: 'ELF_Characters',
  dwarf: 'DWF_Characters',
  orc: 'ORC_Characters',
  undead: 'UD_Characters',
} as const;

export type Grudge6RaceId = keyof typeof GRUDGE6_RACE_FILE;

/** Production race GLB/FBX roots (secondary to RaceEquipment candidates). */
export const RACE_URLS: Record<Grudge6RaceId, { glb: string; fbx: string }> = {
  human: {
    glb: `${AVERNUS_CDN}/models/grudge6/races/WK_Characters.glb`,
    fbx: `${AVERNUS_CDN}/models/grudge6/races/WK_Characters.fbx`,
  },
  barbarian: {
    glb: `${AVERNUS_CDN}/models/grudge6/races/BRB_Characters.glb`,
    fbx: `${AVERNUS_CDN}/models/grudge6/races/BRB_Characters.fbx`,
  },
  elf: {
    glb: `${AVERNUS_CDN}/models/grudge6/races/ELF_Characters.glb`,
    fbx: `${AVERNUS_CDN}/models/grudge6/races/ELF_Characters.fbx`,
  },
  dwarf: {
    glb: `${AVERNUS_CDN}/models/grudge6/races/DWF_Characters.glb`,
    fbx: `${AVERNUS_CDN}/models/grudge6/races/DWF_Characters.fbx`,
  },
  orc: {
    glb: `${AVERNUS_CDN}/models/grudge6/races/ORC_Characters.glb`,
    fbx: `${AVERNUS_CDN}/models/grudge6/races/ORC_Characters.fbx`,
  },
  undead: {
    glb: `${AVERNUS_CDN}/models/grudge6/races/UD_Characters.glb`,
    fbx: `${AVERNUS_CDN}/models/grudge6/races/UD_Characters.fbx`,
  },
};

/** Baked Bip001 weapon packs (prefer portal /models then arena CDN). */
export const BAKED_ANIM_BASE = {
  portal: '/models/animations',
  arenaCdn: 'https://grudge-arena.grudge-studio.com/anims/baked',
  assetsCdn: `${AVERNUS_CDN}/models/animations`,
} as const;

/**
 * Opening / lobby art — **same-origin portal public files**.
 * Do NOT use assetUrl() here: that prefixes assets.grudge-studio.com and
 * these PNGs live in client/public (not the R2 game/GLB CDN).
 */
export const AVERNUS_ART = {
  card: '/assets/games/game_avernus_arena.png',
  emblem: '/grudge-logo.png',
  /** Fallback if primary card is missing in an old deploy */
  cardFallback: '/assets/games/game_avernus_3d.png',
};

/** Fleet roster entries (controller / API config). */
export const AVERNUS_ROSTER = GRUDGE_CHARACTERS;

export type { AnimPack };

/** SI human yardstick for Avernus spawns. */
export const HUMAN_HEIGHT_M = 1.8;
export const ARENA_RADIUS_M = 28;
export const PLAYER_CAPSULE = { radius: 0.35, halfHeight: 0.55 } as const;
