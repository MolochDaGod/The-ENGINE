/**
 * Toon-RTS character mesh visibility for Grudge6 prefabs.
 *
 * Each race GLB ships the full wardrobe baked into one skeleton. We compute
 * which meshes should be visible for a given prefab loadout.
 */

import type { CharacterPrefab } from "./character-prefabs";

export type RaceId = "human" | "elf" | "dwarf" | "orc" | "undead" | "barbarian";

const ROOT = "https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters";
const ICONS = "https://assets.grudge-studio.com/icons/pack";

/** Canonical URL for the race portrait / prefab GLB. */
export function portraitGlbUrl(race: RaceId): string {
  return `${ROOT}/${race}.glb`;
}

export function raceIconUrl(race: RaceId): string {
  return `${ICONS}/races/${race}.png`;
}

export function classIconUrl(classId: string): string {
  return `${ICONS}/classes/${classId}.png`;
}

type Role =
  | "body" | "head" | "arms" | "legs" | "shoulder"
  | "weapon_sword" | "weapon_bow" | "weapon_staff" | "weapon_axe"
  | "weapon_hammer" | "weapon_mace" | "weapon_spear" | "weapon_dagger" | "weapon_pick"
  | "shield" | "quiver" | "bag" | "wood";

function classify(name: string): Role | null {
  const n = name.toLowerCase();
  if (/weapon.*staff/.test(n)) return "weapon_staff";
  if (/weapon.*bow/.test(n)) return "weapon_bow";
  if (/weapon.*sword/.test(n)) return "weapon_sword";
  if (/weapon.*mace/.test(n)) return "weapon_mace";
  if (/weapon.*hammer/.test(n)) return "weapon_hammer";
  if (/weapon.*axe/.test(n)) return "weapon_axe";
  if (/weapon.*spear/.test(n)) return "weapon_spear";
  if (/weapon.*dagger/.test(n)) return "weapon_dagger";
  if (/weapon.*pick/.test(n)) return "weapon_pick";
  if (/shield/.test(n) && !/container/.test(n)) return "shield";
  if (/xtra.*quiver/.test(n)) return "quiver";
  if (/xtra.*bag/.test(n)) return "bag";
  if (/xtra.*wood/.test(n)) return "wood";
  if (/shoulderpads/.test(n)) return "shoulder";
  if (/(^|_)body(_|$)/.test(n)) return "body";
  if (/(^|_)head(_|$)/.test(n)) return "head";
  if (/(^|_)arms(_|$)/.test(n)) return "arms";
  if (/(^|_)legs(_|$)/.test(n)) return "legs";
  return null;
}

function bucket(meshNames: string[]): Record<Role, string[]> {
  const out = {
    body: [], head: [], arms: [], legs: [], shoulder: [],
    weapon_sword: [], weapon_bow: [], weapon_staff: [], weapon_axe: [],
    weapon_hammer: [], weapon_mace: [], weapon_spear: [], weapon_dagger: [], weapon_pick: [],
    shield: [], quiver: [], bag: [], wood: [],
  } as Record<Role, string[]>;
  for (const name of meshNames) {
    const role = classify(name);
    if (role) out[role].push(name);
  }
  for (const k of Object.keys(out) as Role[]) out[k].sort();
  return out;
}

function seedHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick(list: string[], seed: number, offset = 0): string | undefined {
  if (list.length === 0) return undefined;
  return list[(seed + offset) % list.length];
}

function pickVariant(list: string[], variant: string | null): string | undefined {
  if (list.length === 0) return undefined;
  if (!variant) return list[0];
  const v = variant.toUpperCase();
  const match = list.find((n) => {
    const lower = n.toLowerCase();
    return (
      lower.endsWith(`_${v.toLowerCase()}`) ||
      new RegExp(`(^|_)${v}($|_)`, "i").test(n)
    );
  });
  return match ?? list[0];
}

const WEAPON_TYPE_ROLE: Record<string, Role> = {
  sword: "weapon_sword",
  axe: "weapon_axe",
  hammer: "weapon_hammer",
  staff: "weapon_staff",
  bow: "weapon_bow",
  dagger: "weapon_dagger",
  mace: "weapon_mace",
  spear: "weapon_spear",
};

/**
 * Given every mesh name in the loaded toon-rts GLB and a character prefab,
 * return the set of meshes that should be visible.
 */
export function resolvePrefabVisibleMeshes(
  allMeshNames: string[],
  prefab: CharacterPrefab,
): Set<string> {
  const b = bucket(allMeshNames);
  const e = prefab.equipment;
  const visible = new Set<string>();
  const add = (name: string | undefined) => { if (name) visible.add(name); };

  add(pickVariant(b.body, e.body));
  add(pickVariant(b.arms, e.arms));
  add(pickVariant(b.legs, e.legs));
  if (e.head) add(pickVariant(b.head, e.head));
  if (e.shoulders) add(pickVariant(b.shoulder, e.shoulders));
  if (e.shield) add(pickVariant(b.shield, e.shield));

  if (e.rightHand && e.rightHandType) {
    const role = WEAPON_TYPE_ROLE[e.rightHandType];
    if (role) add(pickVariant(b[role], e.rightHand));
  }

  if (e.leftHand && e.leftHandType) {
    const role = WEAPON_TYPE_ROLE[e.leftHandType];
    if (role) add(pickVariant(b[role], e.leftHand));
  } else if (e.leftHandType === "bow") {
    add(pick(b.weapon_bow, seedHash(prefab.id), 5));
  }

  if (e.utility.includes("quiver") || e.leftHandType === "bow") {
    add(pick(b.quiver, seedHash(prefab.id), 7));
  }

  return visible;
}

const WEAPON_MESH_RE =
  /weapon_|shield|xtra_quiver|units_bow|units_sword|units_axe|units_staff|units_hammer|units_dagger|units_mace|units_spear|units_pick/i;

/** Armor-only visibility for unarmed player preview. */
export function resolveUnarmedVisibleMeshes(
  allMeshNames: string[],
  prefab: CharacterPrefab,
): Set<string> {
  const visible = resolvePrefabVisibleMeshes(allMeshNames, prefab);
  for (const name of [...visible]) {
    if (WEAPON_MESH_RE.test(name)) visible.delete(name);
  }
  return visible;
}