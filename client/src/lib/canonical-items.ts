/**
 * Canonical items library — ObjectStore master weapons/armor + Grudge6 prefabs.
 * Source of truth URLs used by grudge6.grudge-studio.com/game/weapons
 */

import {
  CHARACTER_PREFABS,
  getEquipmentMeshNames,
  type CharacterPrefab,
} from "@shared/character-prefabs";
import { portraitGlbUrl, raceIconUrl, classIconUrl } from "@shared/character-meshes";
import { resolveAssetUrl } from "@/lib/weapon-skills";

const OBJECTSTORE_BASE =
  (typeof window !== "undefined" &&
    (window as unknown as { GRUDGE_FLEET?: { objectstore?: string } }).GRUDGE_FLEET
      ?.objectstore) ||
  "https://objectstore.grudge-studio.com";

export const CANONICAL_SOURCES = {
  weapons: `${OBJECTSTORE_BASE.replace(/\/$/, "")}/api/v1/master-weapons.json`,
  armor: `${OBJECTSTORE_BASE.replace(/\/$/, "")}/api/v1/master-armor.json`,
  weaponSkills: `${OBJECTSTORE_BASE.replace(/\/$/, "")}/api/v1/master-weaponSkills.json`,
  materials: `${OBJECTSTORE_BASE.replace(/\/$/, "")}/api/v1/master-materials.json`,
  toonRtsGlb: (race: string) =>
    `https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/${race}.glb`,
} as const;

export type LibraryKind = "weapon" | "armor" | "prefab";

export interface CanonicalItem {
  id: string;
  uuid: string;
  name: string;
  kind: LibraryKind;
  category: string;
  tier: number;
  tierLabel: string;
  tierColor: string;
  iconUrl: string;
  description?: string;
  stats?: Record<string, number>;
  abilities?: string[];
  passives?: string[];
  signature?: string;
  modelUrl?: string;
  modelPath?: string;
  slotType?: string;
  material?: string;
  setName?: string;
  subCategory?: string;
  source?: string;
  /** Grudge6 race×class prefab (kind === prefab) */
  prefab?: CharacterPrefab;
  raceIconUrl?: string;
  classIconUrl?: string;
  /** Visible wardrobe mesh names for toon-rts GLB */
  meshNames?: string[];
  /** Portable JSON for engine ingest */
  prefabJson?: Record<string, unknown>;
}

export interface CanonicalLibrary {
  version: string;
  generated?: string;
  weapons: CanonicalItem[];
  armor: CanonicalItem[];
  prefabs: CanonicalItem[];
  loadedAt: number;
}

let cache: CanonicalLibrary | null = null;
let inflight: Promise<CanonicalLibrary> | null = null;

function normalizeWeapon(raw: Record<string, unknown>): CanonicalItem {
  const uuid = String(raw.uuid || raw.id || "");
  const icon = String(raw.iconUrl || raw.icon || "");
  return {
    id: uuid,
    uuid,
    name: String(raw.name || "Unknown weapon"),
    kind: "weapon",
    category: String(raw.category || "misc"),
    tier: typeof raw.tier === "number" ? raw.tier : 0,
    tierLabel: String(raw.tierLabel || `T${raw.tier ?? 0}`),
    tierColor: String(raw.tierColor || "#8b7355"),
    iconUrl: resolveAssetUrl(icon),
    description: raw.description as string | undefined,
    stats: (raw.stats as Record<string, number>) || undefined,
    abilities: Array.isArray(raw.abilities) ? (raw.abilities as string[]) : undefined,
    passives: Array.isArray(raw.passives) ? (raw.passives as string[]) : undefined,
    signature: raw.signature as string | undefined,
    modelUrl: raw.modelUrl as string | undefined,
    modelPath: raw.modelPath as string | undefined,
    subCategory: raw.subCategory as string | undefined,
    source: raw.source as string | undefined,
    prefabJson: {
      type: "weapon",
      uuid,
      name: raw.name,
      category: raw.category,
      tier: raw.tier,
      stats: raw.stats,
      modelPath: raw.modelPath,
      iconUrl: raw.iconUrl,
    },
  };
}

function normalizeArmor(raw: Record<string, unknown>): CanonicalItem {
  const uuid = String(raw.uuid || raw.id || "");
  const icon = String(raw.iconUrl || raw.icon || "");
  return {
    id: uuid,
    uuid,
    name: String(raw.name || "Unknown armor"),
    kind: "armor",
    category: String(raw.material || raw.category || "armor"),
    tier: typeof raw.tier === "number" ? raw.tier : 0,
    tierLabel: String(raw.tierLabel || `T${raw.tier ?? 0}`),
    tierColor: String(raw.tierColor || "#8b7355"),
    iconUrl: resolveAssetUrl(icon),
    description: raw.description as string | undefined,
    stats: (raw.stats as Record<string, number>) || undefined,
    passives: raw.passive ? [String(raw.passive)] : undefined,
    slotType: raw.slotType as string | undefined,
    material: raw.material as string | undefined,
    setName: raw.setName as string | undefined,
    source: raw.source as string | undefined,
    prefabJson: {
      type: "armor",
      uuid,
      name: raw.name,
      slotType: raw.slotType,
      material: raw.material,
      tier: raw.tier,
      stats: raw.stats,
      setName: raw.setName,
      iconUrl: raw.iconUrl,
    },
  };
}

function prefabToItem(prefab: CharacterPrefab): CanonicalItem {
  const meshNames = getEquipmentMeshNames(prefab);
  const glbUrl = portraitGlbUrl(prefab.race);
  return {
    id: prefab.id,
    uuid: prefab.id,
    name: prefab.name,
    kind: "prefab",
    category: `${prefab.race}_${prefab.classId}`,
    tier: 1,
    tierLabel: prefab.classId,
    tierColor: prefab.classColor,
    iconUrl: prefab.raceIconUrl,
    raceIconUrl: prefab.raceIconUrl ?? raceIconUrl(prefab.race),
    classIconUrl: prefab.classIconUrl ?? classIconUrl(prefab.classId),
    description: prefab.lore,
    stats: prefab.baseStats as unknown as Record<string, number>,
    meshNames,
    modelUrl: glbUrl,
    modelPath: `asset-packs/toon-rts-characters/glb/characters/${prefab.race}.glb`,
    prefab,
    prefabJson: {
      type: "character_prefab",
      id: prefab.id,
      race: prefab.race,
      classId: prefab.classId,
      faction: prefab.faction,
      prefix: prefab.prefix,
      modelPath: prefab.modelPath,
      toonRtsGlb: glbUrl,
      cdnModelKey: prefab.cdnModelKey,
      equipment: prefab.equipment,
      meshNames,
      raceIconUrl: prefab.raceIconUrl,
      classIconUrl: prefab.classIconUrl,
      animationPack: prefab.animationPack,
      skills: prefab.skills,
    },
  };
}

export async function loadCanonicalLibrary(force = false): Promise<CanonicalLibrary> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;

  inflight = (async () => {
    const [wRes, aRes] = await Promise.all([
      fetch(CANONICAL_SOURCES.weapons, { mode: "cors" }),
      fetch(CANONICAL_SOURCES.armor, { mode: "cors" }),
    ]);

    if (!wRes.ok) throw new Error(`weapons catalog HTTP ${wRes.status}`);
    if (!aRes.ok) throw new Error(`armor catalog HTTP ${aRes.status}`);

    const wData = (await wRes.json()) as { version?: string; generated?: string; items?: unknown[] };
    const aData = (await aRes.json()) as { version?: string; generated?: string; items?: unknown[] };

    const weapons = (wData.items ?? []).map((it) =>
      normalizeWeapon(it as Record<string, unknown>),
    );
    const armor = (aData.items ?? []).map((it) =>
      normalizeArmor(it as Record<string, unknown>),
    );
    const prefabs = CHARACTER_PREFABS.map(prefabToItem);

    const lib: CanonicalLibrary = {
      version: wData.version || "3.0.0",
      generated: wData.generated || aData.generated,
      weapons,
      armor,
      prefabs,
      loadedAt: Date.now(),
    };
    cache = lib;
    inflight = null;
    return lib;
  })();

  return inflight;
}

export function allLibraryItems(lib: CanonicalLibrary): CanonicalItem[] {
  return [...lib.weapons, ...lib.armor, ...lib.prefabs];
}

export function filterLibraryItems(
  items: CanonicalItem[],
  opts: {
    kind?: LibraryKind | "all";
    query?: string;
    tier?: number | "all";
    category?: string;
  },
): CanonicalItem[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  return items.filter((item) => {
    if (opts.kind && opts.kind !== "all" && item.kind !== opts.kind) return false;
    if (opts.tier !== undefined && opts.tier !== "all" && item.tier !== opts.tier) return false;
    if (opts.category && opts.category !== "all" && item.category !== opts.category) return false;
    if (!q) return true;
    const hay = [
      item.name,
      item.category,
      item.uuid,
      item.slotType,
      item.setName,
      item.material,
      item.description,
      ...(item.meshNames ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function uniqueCategories(items: CanonicalItem[]): string[] {
  return [...new Set(items.map((i) => i.category))].sort();
}