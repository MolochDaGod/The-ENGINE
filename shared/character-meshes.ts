/**
 * Toon-RTS character mesh visibility for Grudge6 prefabs.
 *
 * Each race GLB ships the full wardrobe baked into one skeleton. We compute
 * which meshes should be visible for a given prefab loadout.
 *
 * For mesh-level material labels (skin / cloth / leather / metal) see
 * `mesh-material-labels.ts`.
 */

import type { CharacterPrefab } from "./character-prefabs";

export {
  labelMesh,
  labelSceneMeshes,
  detectMeshSemantic,
  applyMaterialPresetsToRoot,
  summarizeLabels,
  MATERIAL_PRESETS,
  type MeshLabel,
  type MeshSemantic,
  type MaterialPreset,
} from "./mesh-material-labels";

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
  // Weapons before body parts (names like weapon_staff must not hit "head")
  if (/weapon.*staff|weapon_staff/.test(n)) return "weapon_staff";
  if (/weapon.*bow|weapon_bow|(^|_)bow($|_)/.test(n)) return "weapon_bow";
  if (/weapon.*sword|weapon_sword/.test(n)) return "weapon_sword";
  if (/weapon.*mace|weapon_mace/.test(n)) return "weapon_mace";
  if (/weapon.*hammer|weapon_hammer/.test(n)) return "weapon_hammer";
  if (/weapon.*axe|weapon_axe/.test(n)) return "weapon_axe";
  if (/weapon.*spear|weapon_spear/.test(n)) return "weapon_spear";
  if (/weapon.*dagger|weapon_dagger/.test(n)) return "weapon_dagger";
  if (/weapon.*pick|weapon_pick/.test(n)) return "weapon_pick";
  if (/shield/.test(n) && !/container/.test(n)) return "shield";
  if (/xtra.*quiver|xtra_quiver/.test(n)) return "quiver";
  if (/xtra.*bag|xtra_bag/.test(n)) return "bag";
  if (/xtra.*wood|xtra_wood/.test(n)) return "wood";
  if (/shoulderpads|shoulder_?pad/.test(n)) return "shoulder";
  // Race kits: BRB_head_A · WK_Units_head_F (always one visible)
  if (/(^|_)head(_|$)/.test(n) || /(^|_)helm(et)?(_|$)/.test(n)) return "head";
  if (/(^|_)body(_|$)/.test(n)) return "body";
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

/**
 * Head is mandatory on Toon RTS kits (BRB_head_A…J etc.).
 * Prefab `equipment.head === null` means **no helmet loadout**, NOT “hide head”.
 * Prefer explicit variant; else bare default letter A; else first sorted head.
 */
function pickHeadMesh(list: string[], variant: string | null | undefined): string | undefined {
  if (list.length === 0) return undefined;
  if (variant) {
    const hit = pickVariant(list, variant);
    if (hit) return hit;
  }
  // Bare / default face — letter A is SSOT for “unhelmeted” in fleet kits
  const bare =
    list.find((n) => /head[_]?a$/i.test(n.replace(/\s+/g, ""))) ||
    list.find((n) => /_head_a($|_|\.)/i.test(n)) ||
    list.find((n) => /head_a/i.test(n));
  return bare ?? list[0];
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
  // ALWAYS one head mesh (face or helm). null ≠ invisible.
  add(pickHeadMesh(b.head, e.head));
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

  // Fallback: if name matching failed (grudge6 vs toon mesh naming), show core armor
  // so the viewer never renders an empty / invisible character.
  if (visible.size === 0) {
    for (const list of [b.body, b.arms, b.legs, b.head]) {
      if (list[0]) visible.add(list[0]);
    }
  }
  if (visible.size === 0) {
    // Last resort: ONLY armor-like names — never bags/wood/xtra (that caused bag-blob bug)
    for (const name of allMeshNames) {
      const n = name.toLowerCase();
      if (WEAPON_MESH_RE.test(name)) continue;
      if (/bip|armature|root|skeleton|container|xtra_|bag|wood|quiver|shield/i.test(n)) continue;
      if (!/(body|arms|legs|head|helm)/i.test(n)) continue;
      visible.add(name);
      if (visible.size >= 6) break;
    }
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

  // Workers / unarmed: never show bag/wood/quiver until carry state turns them on.
  // Prefab utility may list them for class kits, but RTS workers spawn empty-handed.
  if (mode === "unarmed") {
    for (const name of [...visible]) {
      if (/xtra_bag|xtra_wood|xtra_quiver|bone_bag|bone_wood/i.test(name)) {
        visible.delete(name);
      }
    }
  }

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

/** RTS gather carry state — bag (gold) / wood (lumber) only while hauling. */
export type CarryVisual = "none" | "gold" | "lumber";

/** Props that must NEVER be default-visible on workers (only while carrying). */
const CARRY_OR_PROP_RE =
  /xtra_|bone_bag|bone_wood|quiver|shield|weapon_|units_(sword|axe|hammer|mace|dagger|bow|staff|pick|spear)|(^|_)bag($|_)|(^|_)wood($|_)/i;

const ARMOR_SLOT_RE = {
  body: /(^|_)(units_)?body(_|$)/i,
  arms: /(^|_)(units_)?arms(_|$)/i,
  legs: /(^|_)(units_)?legs(_|$)/i,
  head: /(^|_)(units_)?(head|helm)(_|$)/i,
};

/**
 * HARD RTS worker kit: hide entire wardrobe, then show exactly one body/arms/legs/head.
 * Bag / wood / weapons / shields stay OFF until setCarryVisuals.
 *
 * This is the fix for "only bags and wood showing" (inverted / fallback-prop bug).
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

  // 1) Hide everything mesh-like first
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
      // bones / containers stay "visible" for hierarchy (no geometry usually)
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
    // else: leave hidden (unknown accessories)
  }

  const pickOne = (list: MeshObj[]): MeshObj | undefined => {
    if (list.length === 0) return undefined;
    // Prefer letter A / bare variant
    const a =
      list.find((m) => /_a$/i.test(m.name.replace(/\s+/g, ""))) ||
      list.find((m) => /_a(_|\.|$)/i.test(m.name)) ||
      list[0];
    return a;
  };

  const shown: string[] = [];
  for (const slot of ["body", "arms", "legs", "head"] as const) {
    const one = pickOne(bySlot[slot]);
    if (one) {
      one.visible = true;
      shown.push(one.name);
    }
  }

  // Safety: if zero armor found, show largest skinned meshes that are not props
  if (shown.length === 0) {
    const candidates = meshes.filter((m) => {
      const n = m.name || "";
      if (!n) return false;
      if (CARRY_OR_PROP_RE.test(n)) return false;
      if (/^(Bip|mixamorig|Armature)/i.test(n)) return false;
      return true;
    });
    // Prefer SkinnedMesh (body) over rigid props
    candidates.sort((a, b) => {
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

/**
 * Toggle Xtra_bag / Xtra_wood ONLY. Never touches body/armor.
 * - lumber → wood prop on
 * - gold   → bag prop on
 * - none   → both off
 */
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
    // Strict: only Xtra_bag / Bone_bag style — not every mesh containing "bag"
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