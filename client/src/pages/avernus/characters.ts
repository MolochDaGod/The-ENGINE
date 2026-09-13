/**
 * Avernus hero presets — 6 races × 4 classes from CHARACTER_PREFABS (grudge6).
 */

import {
  CHARACTER_PREFABS,
  getPrefab,
  type CharacterPrefab,
  type ClassId,
} from '@shared/character-prefabs';
import { RACE_CONFIGS, type CharacterRace } from '@/engine';
import type { WeaponPackId } from './weaponPacks';
import { WEAPON_PACKS } from './weaponPacks';
import type { WeaponType } from './weapons';

export interface AvernusHeroPreset {
  id: string;
  name: string;
  race: CharacterRace;
  classId: ClassId;
  weaponPack: WeaponPackId;
  /** Fantasy loadout type for REST / opening UI */
  weaponType: WeaponType;
  tint: number;
  emissive: number;
  description: string;
  attackSpeed: number;
  speed: number;
  health: number;
  classColor: string;
  lore: string;
  faction: string;
}

const CLASS_PACK: Record<ClassId, WeaponPackId> = {
  warrior: 'sword-shield',
  mage: 'magic-caster',
  ranger: 'longbow',
  worge: 'great-sword',
};

const CLASS_WEAPON_TYPE: Record<ClassId, WeaponType> = {
  warrior: 'sword_shield',
  mage: 'runeblade',
  ranger: 'bow',
  worge: 'greatsword',
};

const RACE_TINT: Record<CharacterRace, { tint: number; emissive: number }> = {
  human: { tint: 0xc4a35a, emissive: 0x221a08 },
  elf: { tint: 0x7ec881, emissive: 0x082208 },
  dwarf: { tint: 0xb07843, emissive: 0x1a0e06 },
  orc: { tint: 0x5a8a4a, emissive: 0x0a1a06 },
  barbarian: { tint: 0xd4845a, emissive: 0x1a0a04 },
  undead: { tint: 0x8a7ecf, emissive: 0x0c0a1e },
};

const CLASS_STATS: Record<ClassId, { attackSpeed: number; speed: number; health: number }> = {
  warrior: { attackSpeed: 1.35, speed: 0.11, health: 120 },
  mage: { attackSpeed: 1.25, speed: 0.1, health: 85 },
  ranger: { attackSpeed: 1.7, speed: 0.13, health: 90 },
  worge: { attackSpeed: 1.45, speed: 0.125, health: 110 },
};

export function prefabToAvernus(p: CharacterPrefab): AvernusHeroPreset {
  const race = p.race as CharacterRace;
  const tint = RACE_TINT[race] ?? RACE_TINT.human;
  const stats = CLASS_STATS[p.classId] ?? CLASS_STATS.warrior;
  const pack = CLASS_PACK[p.classId] ?? 'sword-shield';
  return {
    id: p.id.replace(/_/g, '-'),
    name: p.name,
    race,
    classId: p.classId,
    weaponPack: pack,
    weaponType: CLASS_WEAPON_TYPE[p.classId] ?? 'sword_shield',
    tint: tint.tint,
    emissive: tint.emissive,
    description: `${WEAPON_PACKS[pack]?.label ?? pack} • ${p.faction}`,
    attackSpeed: stats.attackSpeed,
    speed: stats.speed * (RACE_CONFIGS[race]?.speedMult ?? 1),
    health: stats.health + p.baseStats.VIT * 4 + p.baseStats.STR * 2,
    classColor: p.classColor,
    lore: p.lore,
    faction: p.faction,
  };
}

export const AVERNUS_HEROES: AvernusHeroPreset[] = CHARACTER_PREFABS.map(prefabToAvernus);

/** One default warrior per race for the opening race picker. */
export const RACE_DEFAULTS: AvernusHeroPreset[] = (
  ['human', 'barbarian', 'elf', 'dwarf', 'orc', 'undead'] as CharacterRace[]
)
  .map((race) => AVERNUS_HEROES.find((h) => h.race === race && h.classId === 'warrior'))
  .filter(Boolean) as AvernusHeroPreset[];

export function resolveHero(heroParam: string | null | undefined): AvernusHeroPreset {
  if (!heroParam) return AVERNUS_HEROES[0];
  const dashed = heroParam.replace(/_/g, '-');
  const underscored = heroParam.replace(/-/g, '_');
  const exact = AVERNUS_HEROES.find((p) => p.id === dashed || p.id === underscored);
  if (exact) return exact;

  const prefab = getPrefab(underscored) ?? getPrefab(dashed);
  if (prefab) {
    const mapped = AVERNUS_HEROES.find((p) => p.id === prefab.id.replace(/_/g, '-'));
    if (mapped) return mapped;
    const raceClass = AVERNUS_HEROES.find(
      (p) => p.race === prefab.race && p.classId === prefab.classId,
    );
    if (raceClass) return raceClass;
    const raceMatch = AVERNUS_HEROES.find((p) => p.race === prefab.race);
    if (raceMatch) return raceMatch;
  }

  const byRace = AVERNUS_HEROES.find((p) => p.race === heroParam || p.race === underscored);
  return byRace ?? AVERNUS_HEROES[0];
}

export function heroesForRace(race: CharacterRace): AvernusHeroPreset[] {
  return AVERNUS_HEROES.filter((h) => h.race === race);
}
