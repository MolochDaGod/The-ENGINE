/**
 * Mesh-level detection + material labeling for Grudge Toon RTS / grudge6 kits.
 *
 * Detects each named mesh as: skin | cloth | leather | metal | armor_plate |
 * weapon | shield | utility | cape | wing | bone | unknown
 * and maps them to Three.js MeshStandardMaterial presets for edit tooling.
 *
 * API best practice: this is **definition data** (static labels) — keep it in
 * shared/ObjectStore; never write labels into Railway character rows.
 * Runtime player loadout stays on Railway; mesh labels are CDN/registry truth.
 */

// ── Semantic labels ──────────────────────────────────────────────────────────

export type MeshSemantic =
  | "skin"
  | "cloth"
  | "leather"
  | "metal"
  | "armor_plate"
  | "chainmail"
  | "weapon"
  | "shield"
  | "utility"
  | "cape"
  | "wing"
  | "bone"
  | "container"
  | "unknown";

export type EquipSlot =
  | "body"
  | "head"
  | "arms"
  | "legs"
  | "shoulders"
  | "weapon_r"
  | "weapon_l"
  | "shield"
  | "cape"
  | "wings"
  | "utility"
  | "skin"
  | "none";

export type EditGroup =
  | "skin"
  | "armor"
  | "cloth"
  | "leather"
  | "metal"
  | "weapon"
  | "cosmetic"
  | "utility"
  | "rig"
  | "other";

/** Three.js MeshStandardMaterial-compatible preset (no THREE import in shared). */
export interface MaterialPreset {
  /** Display name for UI */
  label: string;
  color: number;
  metalness: number;
  roughness: number;
  /** Prefer keeping atlas map when true */
  keepMap: boolean;
  /** Optional emissive for metal edges / magic cloth */
  emissive?: number;
  emissiveIntensity?: number;
  side?: "front" | "double";
  transparent?: boolean;
  opacity?: number;
  /** UI chip color (hex string) */
  chip: string;
}

export interface MeshLabel {
  /** Object3D / mesh name as in GLB/FBX */
  name: string;
  semantic: MeshSemantic;
  slot: EquipSlot;
  editGroup: EditGroup;
  /** Armor weight class when applicable */
  armorType: "cloth" | "leather" | "chainmail" | "plate" | "heavy_plate" | null;
  /** Three.js material family for rebinds / paint tools */
  materialPreset: MaterialPreset;
  /** Human label for inspector */
  displayLabel: string;
  /** Confidence 0–1 from name heuristics */
  confidence: number;
  /** Texture understanding flags */
  texture: {
    expectsAtlas: boolean;
    isSkinRegion: boolean;
    isHardSurface: boolean;
    /** Suggested paint layer for editors */
    paintLayer: "skin" | "cloth" | "leather" | "metal" | "emissive" | "none";
  };
  editable: boolean;
}

// ── Material presets (Three.js MeshStandardMaterial) ─────────────────────────

export const MATERIAL_PRESETS: Record<string, MaterialPreset> = {
  skin: {
    label: "Skin",
    color: 0xe8b896,
    metalness: 0.0,
    roughness: 0.72,
    keepMap: true,
    chip: "#e8b896",
  },
  cloth: {
    label: "Cloth",
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.88,
    keepMap: true,
    side: "double",
    chip: "#7dd3fc",
  },
  leather: {
    label: "Leather",
    color: 0xffffff,
    metalness: 0.05,
    roughness: 0.78,
    keepMap: true,
    chip: "#c4a574",
  },
  metal: {
    label: "Metal",
    color: 0xffffff,
    metalness: 0.75,
    roughness: 0.35,
    keepMap: true,
    chip: "#94a3b8",
  },
  armor_plate: {
    label: "Plate armor",
    color: 0xffffff,
    metalness: 0.82,
    roughness: 0.28,
    keepMap: true,
    chip: "#cbd5e1",
  },
  chainmail: {
    label: "Chainmail",
    color: 0xffffff,
    metalness: 0.65,
    roughness: 0.45,
    keepMap: true,
    chip: "#a8b5c4",
  },
  weapon: {
    label: "Weapon",
    color: 0xffffff,
    metalness: 0.7,
    roughness: 0.32,
    keepMap: true,
    chip: "#fbbf24",
  },
  shield: {
    label: "Shield",
    color: 0xffffff,
    metalness: 0.55,
    roughness: 0.4,
    keepMap: true,
    chip: "#60a5fa",
  },
  cape: {
    label: "Cape / cloth cosmetic",
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.9,
    keepMap: true,
    side: "double",
    chip: "#c084fc",
  },
  wing: {
    label: "Wings",
    color: 0xffffff,
    metalness: 0.15,
    roughness: 0.55,
    keepMap: true,
    side: "double",
    chip: "#f0abfc",
  },
  bone: {
    label: "Bone / undead",
    color: 0xf5f0e6,
    metalness: 0.05,
    roughness: 0.65,
    keepMap: true,
    chip: "#e7e5e4",
  },
  utility: {
    label: "Utility prop",
    color: 0xffffff,
    metalness: 0.2,
    roughness: 0.6,
    keepMap: true,
    chip: "#86efac",
  },
  unknown: {
    label: "Unknown",
    color: 0xcccccc,
    metalness: 0.1,
    roughness: 0.7,
    keepMap: true,
    chip: "#6b7280",
  },
};

// ── Name normalization ───────────────────────────────────────────────────────

export function meshKey(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/^wk_|^brb_|^orc_|^elf_|^ud_|^dwf_/, "")
    .replace(/units_/g, "")
    .replace(/xtra_/g, "")
    .replace(/weapon_/g, "weapon")
    .replace(/[^a-z0-9]/g, "");
}

function baseName(name: string): string {
  return String(name || "").toLowerCase();
}

// ── Detection ────────────────────────────────────────────────────────────────

/**
 * Detect semantic + slot from a Toon RTS / grudge6 mesh name.
 * Prefers explicit name tokens (body/head/sword/…) over generic defaults.
 */
export function detectMeshSemantic(name: string): {
  semantic: MeshSemantic;
  slot: EquipSlot;
  armorType: MeshLabel["armorType"];
  confidence: number;
  displayLabel: string;
} {
  const n = baseName(name);
  const k = meshKey(name);

  // Rig / containers
  if (/bip|mixamorig|armature|skeleton|root_?joint|^root$/i.test(n)) {
    return {
      semantic: "bone",
      slot: "none",
      armorType: null,
      confidence: 0.99,
      displayLabel: "Skeleton bone",
    };
  }
  if (/container|hand_container|shield_container|quiver_container|bone_bag|bone_wood/i.test(n)) {
    return {
      semantic: "container",
      slot: "none",
      armorType: null,
      confidence: 0.98,
      displayLabel: "Attach container",
    };
  }

  // Cosmetics (Unity wings / capes)
  if (/\bwing|wings|angel.?wing|phoenix.?wing|polygonal.?wing/i.test(n) || k.includes("wing")) {
    return {
      semantic: "wing",
      slot: "wings",
      armorType: null,
      confidence: 0.95,
      displayLabel: "Wings",
    };
  }
  if (/\bcape|cloak|mantle|capelet/i.test(n) || k.includes("cape") || k.includes("cloak")) {
    return {
      semantic: "cape",
      slot: "cape",
      armorType: "cloth",
      confidence: 0.94,
      displayLabel: "Cape / cloak",
    };
  }

  // Weapons
  if (/sword|axe|hammer|mace|dagger|spear|staff|bow|gun|pistol|rifle|pick/i.test(n)) {
    const isLeft =
      /bow|staff/.test(k) || /left|l_hand|weapon_l/.test(n);
    return {
      semantic: "weapon",
      slot: isLeft ? "weapon_l" : "weapon_r",
      armorType: null,
      confidence: 0.92,
      displayLabel: "Weapon",
    };
  }
  if (/shield/.test(n) && !/container/.test(n)) {
    return {
      semantic: "shield",
      slot: "shield",
      armorType: "plate",
      confidence: 0.93,
      displayLabel: "Shield",
    };
  }

  // Utility
  if (/quiver|bag|wood|pouch|scabbard/i.test(n)) {
    return {
      semantic: "utility",
      slot: "utility",
      armorType: "leather",
      confidence: 0.9,
      displayLabel: "Utility",
    };
  }

  // Armor slots + material class
  const isBody = /(^|_)body(_|$)/.test(n) || k.includes("body");
  const isHead = /(^|_)head(_|$)/.test(n) || /helm|helmet|hood|mask/.test(n);
  const isArms = /(^|_)arms(_|$)/.test(n) || /glove|gauntlet|bracer/.test(n);
  const isLegs = /(^|_)legs(_|$)/.test(n) || /boot|greave|pant/.test(n);
  const isShoulders = /shoulder|pad/.test(n);

  let slot: EquipSlot = "none";
  if (isBody) slot = "body";
  else if (isHead) slot = "head";
  else if (isArms) slot = "arms";
  else if (isLegs) slot = "legs";
  else if (isShoulders) slot = "shoulders";

  // Material from name / letter conventions + keywords
  if (/\bbare|skin|flesh|face|hand\b(?!_container)|torso_skin/i.test(n)) {
    return {
      semantic: "skin",
      slot: slot === "none" ? "skin" : slot,
      armorType: null,
      confidence: 0.88,
      displayLabel: "Skin",
    };
  }

  if (/robe|cloth|loincloth|tunic|fabric|silk|mage.?robe/i.test(n)) {
    return {
      semantic: "cloth",
      slot: slot === "none" ? "body" : slot,
      armorType: "cloth",
      confidence: 0.9,
      displayLabel: slot === "head" ? "Cloth head" : "Cloth armor",
    };
  }

  if (/leather|hide|rawhide|pelt|fur/i.test(n)) {
    return {
      semantic: "leather",
      slot: slot === "none" ? "body" : slot,
      armorType: "leather",
      confidence: 0.9,
      displayLabel: "Leather armor",
    };
  }

  if (/chainmail|chain.?mail|mail_armor|ringmail/i.test(n)) {
    return {
      semantic: "chainmail",
      slot: slot === "none" ? "body" : slot,
      armorType: "chainmail",
      confidence: 0.91,
      displayLabel: "Chainmail",
    };
  }

  if (/heavy.?plate|death.?knight|warlord|titan|warchief|plate/i.test(n)) {
    return {
      semantic: "armor_plate",
      slot: slot === "none" ? "body" : slot,
      armorType: /heavy|death|titan|warchief/.test(n) ? "heavy_plate" : "plate",
      confidence: 0.9,
      displayLabel: "Plate armor",
    };
  }

  if (/bone|ribcage|skull/i.test(n)) {
    return {
      semantic: "bone",
      slot: slot === "none" ? "body" : slot,
      armorType: "leather",
      confidence: 0.85,
      displayLabel: "Bone armor",
    };
  }

  // Toon RTS letter variants: A often plate, B leather, C cloth (fleet convention)
  if (slot !== "none") {
    const variant = n.match(/_([a-n])(?:_|\.|$)/i)?.[1]?.toUpperCase();
    if (variant === "A") {
      return {
        semantic: "armor_plate",
        slot,
        armorType: "plate",
        confidence: 0.7,
        displayLabel: `${slot} (plate variant A)`,
      };
    }
    if (variant === "B") {
      return {
        semantic: "leather",
        slot,
        armorType: "leather",
        confidence: 0.68,
        displayLabel: `${slot} (leather variant B)`,
      };
    }
    if (variant === "C" || variant === "D") {
      return {
        semantic: "cloth",
        slot,
        armorType: "cloth",
        confidence: 0.66,
        displayLabel: `${slot} (cloth variant ${variant})`,
      };
    }
    // Armor piece with unknown material
    return {
      semantic: "leather",
      slot,
      armorType: "leather",
      confidence: 0.55,
      displayLabel: `${slot} armor`,
    };
  }

  return {
    semantic: "unknown",
    slot: "none",
    armorType: null,
    confidence: 0.2,
    displayLabel: name || "unnamed",
  };
}

function semanticToEditGroup(semantic: MeshSemantic): EditGroup {
  switch (semantic) {
    case "skin":
      return "skin";
    case "cloth":
      return "cloth";
    case "leather":
      return "leather";
    case "metal":
    case "armor_plate":
    case "chainmail":
      return "metal";
    case "weapon":
    case "shield":
      return "weapon";
    case "cape":
    case "wing":
      return "cosmetic";
    case "utility":
      return "utility";
    case "bone":
    case "container":
      return "rig";
    default:
      return "other";
  }
}

function presetForSemantic(semantic: MeshSemantic): MaterialPreset {
  switch (semantic) {
    case "skin":
      return MATERIAL_PRESETS.skin;
    case "cloth":
      return MATERIAL_PRESETS.cloth;
    case "leather":
      return MATERIAL_PRESETS.leather;
    case "metal":
      return MATERIAL_PRESETS.metal;
    case "armor_plate":
      return MATERIAL_PRESETS.armor_plate;
    case "chainmail":
      return MATERIAL_PRESETS.chainmail;
    case "weapon":
      return MATERIAL_PRESETS.weapon;
    case "shield":
      return MATERIAL_PRESETS.shield;
    case "cape":
      return MATERIAL_PRESETS.cape;
    case "wing":
      return MATERIAL_PRESETS.wing;
    case "bone":
      return MATERIAL_PRESETS.bone;
    case "utility":
      return MATERIAL_PRESETS.utility;
    default:
      return MATERIAL_PRESETS.unknown;
  }
}

function paintLayerFor(semantic: MeshSemantic): MeshLabel["texture"]["paintLayer"] {
  switch (semantic) {
    case "skin":
      return "skin";
    case "cloth":
    case "cape":
      return "cloth";
    case "leather":
      return "leather";
    case "metal":
    case "armor_plate":
    case "chainmail":
    case "weapon":
    case "shield":
      return "metal";
    case "wing":
      return "cloth";
    default:
      return "none";
  }
}

/** Build full label record for one mesh name. */
export function labelMesh(name: string): MeshLabel {
  const det = detectMeshSemantic(name);
  const semantic = det.semantic;
  const editable =
    semantic !== "bone" &&
    semantic !== "container" &&
    semantic !== "unknown";

  return {
    name,
    semantic,
    slot: det.slot,
    editGroup: semanticToEditGroup(semantic),
    armorType: det.armorType,
    materialPreset: presetForSemantic(semantic),
    displayLabel: det.displayLabel,
    confidence: det.confidence,
    texture: {
      expectsAtlas: semantic !== "container" && semantic !== "bone",
      isSkinRegion: semantic === "skin",
      isHardSurface:
        semantic === "metal" ||
        semantic === "armor_plate" ||
        semantic === "chainmail" ||
        semantic === "weapon" ||
        semantic === "shield",
      paintLayer: paintLayerFor(semantic),
    },
    editable,
  };
}

/** Label every named mesh/skinned mesh under a scene graph. */
export function labelSceneMeshes(
  root: {
    traverse: (
      fn: (obj: {
        name: string;
        isMesh?: boolean;
        isSkinnedMesh?: boolean;
        visible?: boolean;
      }) => void,
    ) => void;
  },
  opts?: { onlyVisible?: boolean },
): MeshLabel[] {
  const labels: MeshLabel[] = [];
  const seen = new Set<string>();
  root.traverse((obj) => {
    const isMesh = obj.isMesh || obj.isSkinnedMesh;
    if (!isMesh || !obj.name) return;
    if (opts?.onlyVisible && obj.visible === false) return;
    if (seen.has(obj.name)) return;
    seen.add(obj.name);
    labels.push(labelMesh(obj.name));
  });
  return labels.sort((a, b) => a.name.localeCompare(b.name));
}

/** Group labels for inspector panels. */
export function groupLabelsByEditGroup(
  labels: MeshLabel[],
): Record<EditGroup, MeshLabel[]> {
  const groups: Record<EditGroup, MeshLabel[]> = {
    skin: [],
    armor: [],
    cloth: [],
    leather: [],
    metal: [],
    weapon: [],
    cosmetic: [],
    utility: [],
    rig: [],
    other: [],
  };
  for (const l of labels) {
    // Map plate/chain into armor group for UI when editGroup is metal but armor
    if (
      l.slot === "body" ||
      l.slot === "head" ||
      l.slot === "arms" ||
      l.slot === "legs" ||
      l.slot === "shoulders"
    ) {
      if (l.editGroup === "metal" || l.editGroup === "leather" || l.editGroup === "cloth") {
        groups.armor.push(l);
      }
    }
    groups[l.editGroup].push(l);
  }
  return groups;
}

/**
 * Apply material presets onto Three.js meshes **without** destroying atlas maps.
 * Caller passes THREE module to avoid shared→three coupling.
 *
 * @param force — if true, rewrites metalness/roughness even when map exists
 */
export function applyMaterialPresetsToRoot(
  THREE: {
    MeshStandardMaterial: new (p: Record<string, unknown>) => {
      map: unknown;
      color: { setHex: (n: number) => void };
      metalness: number;
      roughness: number;
      side: number;
      transparent: boolean;
      opacity: number;
      needsUpdate: boolean;
      dispose: () => void;
    };
    DoubleSide: number;
    FrontSide: number;
    SRGBColorSpace?: string;
  },
  root: {
    traverse: (fn: (obj: Record<string, unknown>) => void) => void;
  },
  opts?: {
    force?: boolean;
    /** Only apply to these mesh names */
    onlyNames?: Set<string>;
    /** Only these semantics */
    onlySemantics?: Set<MeshSemantic>;
  },
): { applied: number; skipped: number } {
  let applied = 0;
  let skipped = 0;
  root.traverse((obj) => {
    const isMesh = obj.isMesh || obj.isSkinnedMesh;
    if (!isMesh) return;
    const name = String(obj.name || "");
    if (!name) {
      skipped++;
      return;
    }
    if (opts?.onlyNames && !opts.onlyNames.has(name)) {
      skipped++;
      return;
    }
    const label = labelMesh(name);
    if (opts?.onlySemantics && !opts.onlySemantics.has(label.semantic)) {
      skipped++;
      return;
    }
    if (!label.editable && label.semantic !== "skin") {
      skipped++;
      return;
    }

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      const m = mat as {
        map?: unknown;
        color?: { setHex: (n: number) => void };
        metalness?: number;
        roughness?: number;
        side?: number;
        transparent?: boolean;
        opacity?: number;
        needsUpdate?: boolean;
        isMeshStandardMaterial?: boolean;
        isMeshPhysicalMaterial?: boolean;
      };
      // Prefer tuning PBR params; keep maps (atlas rebind path)
      if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
        const p = label.materialPreset;
        if (!p.keepMap || opts?.force) {
          m.color?.setHex(p.color);
        }
        if (m.metalness !== undefined) m.metalness = p.metalness;
        if (m.roughness !== undefined) m.roughness = p.roughness;
        if (p.side === "double" && m.side !== undefined) m.side = THREE.DoubleSide;
        if (p.transparent) {
          m.transparent = true;
          if (p.opacity !== undefined) m.opacity = p.opacity;
        }
        m.needsUpdate = true;
        applied++;
      } else {
        skipped++;
      }
    }
  });
  return { applied, skipped };
}

/** Summary for roster / inspector UI. */
export function summarizeLabels(labels: MeshLabel[]): {
  total: number;
  bySemantic: Record<string, number>;
  editable: number;
  skin: number;
  armor: number;
  metal: number;
  cloth: number;
  leather: number;
  cosmetics: number;
} {
  const bySemantic: Record<string, number> = {};
  let editable = 0;
  let skin = 0;
  let armor = 0;
  let metal = 0;
  let cloth = 0;
  let leather = 0;
  let cosmetics = 0;
  for (const l of labels) {
    bySemantic[l.semantic] = (bySemantic[l.semantic] ?? 0) + 1;
    if (l.editable) editable++;
    if (l.semantic === "skin") skin++;
    if (
      l.slot === "body" ||
      l.slot === "head" ||
      l.slot === "arms" ||
      l.slot === "legs" ||
      l.slot === "shoulders"
    )
      armor++;
    if (l.editGroup === "metal") metal++;
    if (l.editGroup === "cloth") cloth++;
    if (l.editGroup === "leather") leather++;
    if (l.editGroup === "cosmetic") cosmetics++;
  }
  return {
    total: labels.length,
    bySemantic,
    editable,
    skin,
    armor,
    metal,
    cloth,
    leather,
    cosmetics,
  };
}
