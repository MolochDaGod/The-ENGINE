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

export type EquipmentVisibilityMode = "unarmed" | "equipped";

/**
 * Apply Toon-RTS multi-mesh wardrobe visibility on a loaded race GLB.
 *
 * RULE (never regress):
 * - Race GLBs ship the FULL wardrobe (body/arms/legs/head + every weapon/shield).
 * - Default player spawn = **unarmed** (armor only).
 * - Equipped loadouts come from CharacterPrefab.equipment (class gear or scene bag).
 * - Never show every mesh at once (looks like a spiked blob).
 * - Never ignore equipment slots and "tint the whole model" as a substitute.
 */
export function applyEquipmentVisibility(
  root: { traverse: (fn: (obj: { name: string; visible: boolean; isMesh?: boolean; isSkinnedMesh?: boolean }) => void) => void },
  prefab: CharacterPrefab,
  mode: EquipmentVisibilityMode = "unarmed",
): { meshCount: number; visibleCount: number; mode: EquipmentVisibilityMode } {
  const names: string[] = [];
  root.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh || (obj as { isSkinnedMesh?: boolean }).isSkinnedMesh) {
      if (obj.name) names.push(obj.name);
    }
  });

  const visible =
    mode === "unarmed"
      ? resolveUnarmedVisibleMeshes(names, prefab)
      : resolvePrefabVisibleMeshes(names, prefab);

  let visibleCount = 0;
  root.traverse((obj) => {
    const isMesh =
      (obj as { isMesh?: boolean }).isMesh ||
      (obj as { isSkinnedMesh?: boolean }).isSkinnedMesh;
    if (!isMesh) return;
    // Keep unnamed renderables visible (rare); named wardrobe meshes use the set.
    if (!obj.name) {
      obj.visible = true;
      visibleCount++;
      return;
    }
    const keep =
      visible.has(obj.name) ||
      /^(Bip|mixamorig|Armature|Root|Skeleton)/i.test(obj.name);
    obj.visible = keep;
    if (keep) visibleCount++;
  });

  return { meshCount: names.length, visibleCount, mode };
}

/** RTS gather carry — bag (gold) / wood (lumber) only while hauling. */
export type CarryVisual = "none" | "gold" | "lumber";

const CARRY_OR_PROP_RE =
  /xtra_|bone_bag|bone_wood|quiver|shield|weapon_|units_(sword|axe|hammer|mace|dagger|bow|staff|pick|spear)|(^|_)bag($|_)|(^|_)wood($|_)/i;

const ARMOR_SLOT_RE = {
  body: /(^|_)(units_)?body(_|$)/i,
  arms: /(^|_)(units_)?arms(_|$)/i,
  legs: /(^|_)(units_)?legs(_|$)/i,
  head: /(^|_)(units_)?(head|helm)(_|$)/i,
};

/**
 * HARD RTS worker kit: hide wardrobe → show one body/arms/legs/head.
 * Bag/wood/weapons stay OFF until setCarryVisuals.
 */
export function applyRtsWorkerKit(
  root: {
    traverse: (
      fn: (obj: {
        name: string;
        visible: boolean;
        isMesh?: boolean;
        isSkinnedMesh?: boolean;
      }) => void,
    ) => void;
  },
): { shown: string[]; hiddenProps: number; meshCount: number } {
  type MeshObj = {
    name: string;
    visible: boolean;
    isMesh?: boolean;
    isSkinnedMesh?: boolean;
  };
  const meshes: MeshObj[] = [];
  root.traverse((obj) => {
    if ((obj as MeshObj).isMesh || (obj as MeshObj).isSkinnedMesh) {
      meshes.push(obj as MeshObj);
    }
  });

  for (const m of meshes) m.visible = false;

  const bySlot: Record<string, MeshObj[]> = {
    body: [],
    arms: [],
    legs: [],
    head: [],
  };
  let hiddenProps = 0;

  for (const m of meshes) {
    const n = m.name || "";
    if (!n || /^(Bip|mixamorig|Armature|Root|Skeleton)/i.test(n)) {
      m.visible = true;
      continue;
    }
    if (CARRY_OR_PROP_RE.test(n)) {
      m.visible = false;
      hiddenProps++;
      continue;
    }
    if (ARMOR_SLOT_RE.body.test(n)) bySlot.body.push(m);
    else if (ARMOR_SLOT_RE.arms.test(n)) bySlot.arms.push(m);
    else if (ARMOR_SLOT_RE.legs.test(n)) bySlot.legs.push(m);
    else if (ARMOR_SLOT_RE.head.test(n)) bySlot.head.push(m);
  }

  const pickOne = (list: MeshObj[]): MeshObj | undefined => {
    if (!list.length) return undefined;
    return (
      list.find((m) => /_a$/i.test(m.name.replace(/\s+/g, ""))) ||
      list.find((m) => /_a(_|\.|$)/i.test(m.name)) ||
      list[0]
    );
  };

  const shown: string[] = [];
  for (const slot of ["body", "arms", "legs", "head"] as const) {
    const one = pickOne(bySlot[slot]);
    if (one) {
      one.visible = true;
      shown.push(one.name);
    }
  }

  if (shown.length === 0) {
    const candidates = meshes
      .filter((m) => {
        const n = m.name || "";
        return n && !CARRY_OR_PROP_RE.test(n) && !/^(Bip|mixamorig|Armature)/i.test(n);
      })
      .sort((a, b) => {
        const sa = (a as { isSkinnedMesh?: boolean }).isSkinnedMesh ? 0 : 1;
        const sb = (b as { isSkinnedMesh?: boolean }).isSkinnedMesh ? 0 : 1;
        return sa - sb;
      });
    for (const m of candidates.slice(0, 4)) {
      m.visible = true;
      shown.push(m.name);
    }
  }

  return { shown, hiddenProps, meshCount: meshes.length };
}

/** Toggle Xtra_bag / Xtra_wood only — never armor. */
export function setCarryVisuals(
  root: {
    traverse: (
      fn: (obj: {
        name: string;
        visible: boolean;
        isMesh?: boolean;
        isSkinnedMesh?: boolean;
      }) => void,
    ) => void;
  },
  carry: CarryVisual,
): { bag: number; wood: number } {
  let bag = 0;
  let wood = 0;
  root.traverse((obj) => {
    const isMesh =
      (obj as { isMesh?: boolean }).isMesh ||
      (obj as { isSkinnedMesh?: boolean }).isSkinnedMesh;
    if (!isMesh || !obj.name) return;
    const n = obj.name.toLowerCase();
    const isBag = /xtra[_\s]?bag|bone[_\s]?bag/.test(n);
    const isWood = /xtra[_\s]?wood|bone[_\s]?wood/.test(n);
    if (isBag) {
      obj.visible = carry === "gold";
      if (obj.visible) bag++;
    } else if (isWood) {
      obj.visible = carry === "lumber";
      if (obj.visible) wood++;
    }
  });
  return { bag, wood };
}

/** CDN Toon-RTS race pack (D1) — canonical textured multi-mesh characters. */
export const TOON_RTS_CHARACTERS_CDN =
  "https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters";

export function toonRtsRaceGlbUrl(race: RaceId): string {
  return `${TOON_RTS_CHARACTERS_CDN}/${race}.glb`;
}