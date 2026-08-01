/**
 * Avernus Arena — grudge6 / Toon RTS asset SSOT
 *
 * HARD RULE: race kits load via `@/engine` RaceEquipment (production GLB → FBX).
 * Do not point heroes at toon-shooter soldiers or capsule proxies.
 */

import { ASSETS_ORIGIN, assetUrl } from '@/lib/api-config';
import { GRUDGE_CDN, GRUDGE_CHARACTERS, type AnimPack } from '@/engine';

export const AVERNUS_CDN = ASSETS_ORIGIN || GRUDGE_CDN || 'https://assets.grudge-studio.com';

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

/** Opening / lobby art */
export const AVERNUS_ART = {
  card: assetUrl('/assets/games/game_avernus_arena.png'),
  emblem: assetUrl('/grudge-logo.png'),
};

/** Fleet roster entries (controller / API config). */
export const AVERNUS_ROSTER = GRUDGE_CHARACTERS;

export type { AnimPack };

/** SI human yardstick for Avernus spawns. */
export const HUMAN_HEIGHT_M = 1.8;
export const ARENA_RADIUS_M = 28;
export const PLAYER_CAPSULE = { radius: 0.35, halfHeight: 0.55 } as const;
