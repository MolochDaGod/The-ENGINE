/**
 * Full RTS gear presets — 6 races × roles (worker / warrior / ranger / mage).
 * Aligns with CDN grudge6-gear-presets loadout letters + fleet mesh_ids style.
 * Source pattern: assets.grudge-studio.com/api/v1/grudge6-gear-presets.json
 */

import type { RaceId, ClassId, EquipmentSlots, CharacterPrefab } from "./character-prefabs";
import { getPrefab, CHARACTER_PREFABS } from "./character-prefabs";
import type { UnitRole } from "./grudge-rts-data";

export type RtsGearRole = "worker" | "warrior" | "ranger" | "mage";

export interface RtsGearPreset {
  id: string;
  raceId: RaceId;
  role: RtsGearRole;
  label: string;
  anim_pack: "unarmed" | "sword_shield" | "longbow" | "magic" | "2h_melee";
  /** Letter variants matching kit child meshes */
  loadout: {
    body: string;
    arms: string;
    legs: string;
    head: string | null;
    shoulders?: string | null;
    sword?: string | null;
    axe?: string | null;
    hammer?: string | null;
    spear?: string | null;
    bow?: string | null;
    staff?: string | null;
    shield?: string | null;
    quiver?: boolean;
    bag?: boolean;
    wood?: boolean;
  };
}

const RACES: RaceId[] = ["human", "barbarian", "elf", "dwarf", "orc", "undead"];

/** Class kits from CDN gear-presets (race-agnostic letters). */
const ROLE_LOADOUTS: Record<
  RtsGearRole,
  Omit<RtsGearPreset, "id" | "raceId" | "role" | "label">
> = {
  worker: {
    anim_pack: "unarmed",
    loadout: {
      body: "A",
      arms: "A",
      legs: "A",
      head: "A",
      shoulders: null,
    },
  },
  warrior: {
    anim_pack: "sword_shield",
    loadout: {
      body: "C",
      arms: "C",
      legs: "C",
      head: "D",
      shoulders: "B",
      sword: "A",
      shield: "A",
    },
  },
  ranger: {
    anim_pack: "longbow",
    loadout: {
      body: "A",
      arms: "A",
      legs: "A",
      head: "A",
      bow: "A",
      quiver: true,
    },
  },
  mage: {
    anim_pack: "magic",
    loadout: {
      body: "D",
      arms: "D",
      legs: "C",
      head: "E",
      staff: "A",
    },
  },
};

function buildAllPresets(): RtsGearPreset[] {
  const out: RtsGearPreset[] = [];
  for (const race of RACES) {
    for (const role of Object.keys(ROLE_LOADOUTS) as RtsGearRole[]) {
      const base = ROLE_LOADOUTS[role];
      out.push({
        id: `${race}_${role}`,
        raceId: race,
        role,
        label: `${race} ${role}`,
        anim_pack: base.anim_pack,
        loadout: { ...base.loadout },
      });
    }
  }
  return out;
}

/** All 24 presets: 6 races × 4 roles */
export const RTS_GEAR_PRESETS: RtsGearPreset[] = buildAllPresets();

/** Map RTS unit role → gear role */
export function unitRoleToGearRole(role: UnitRole | string): RtsGearRole {
  switch (role) {
    case "worker":
      return "worker";
    case "ranged":
    case "recon":
      return "ranger";
    case "support":
    case "air":
      return "mage";
    case "cavalry":
    case "melee":
    case "siege":
    default:
      return role === "siege" ? "warrior" : "warrior";
  }
}

export function getRtsGearPreset(raceId: RaceId, role: RtsGearRole): RtsGearPreset {
  return (
    RTS_GEAR_PRESETS.find((p) => p.raceId === raceId && p.role === role) ??
    RTS_GEAR_PRESETS.find((p) => p.role === role) ??
    RTS_GEAR_PRESETS[0]
  );
}

/** Convert preset loadout → CharacterPrefab.equipment slots */
export function loadoutToEquipment(loadout: RtsGearPreset["loadout"]): EquipmentSlots {
  let rightHand: string | null = null;
  let rightHandType: string | null = null;
  let leftHand: string | null = null;
  let leftHandType: string | null = null;
  const utility: string[] = [];

  if (loadout.sword) {
    rightHand = loadout.sword;
    rightHandType = "sword";
  } else if (loadout.axe) {
    rightHand = loadout.axe;
    rightHandType = "axe";
  } else if (loadout.hammer) {
    rightHand = loadout.hammer;
    rightHandType = "hammer";
  } else if (loadout.spear) {
    rightHand = loadout.spear;
    rightHandType = "spear";
  }

  if (loadout.bow) {
    leftHand = loadout.bow === "_default" ? "A" : loadout.bow;
    leftHandType = "bow";
  } else if (loadout.staff) {
    leftHand = loadout.staff;
    leftHandType = "staff";
  }

  if (loadout.quiver) utility.push("quiver");
  if (loadout.bag) utility.push("bag");
  if (loadout.wood) utility.push("wood");

  return {
    body: loadout.body,
    arms: loadout.arms,
    legs: loadout.legs,
    head: loadout.head,
    shoulders: loadout.shoulders ?? null,
    rightHand,
    rightHandType,
    leftHand,
    leftHandType,
    shield: loadout.shield ?? null,
    utility,
  };
}

/**
 * Build a CharacterPrefab for RTS unit from race + unit role.
 * Uses fleet prefab base stats when available.
 */
export function prefabFromRtsGear(
  raceId: RaceId,
  unitRole: UnitRole | string,
): CharacterPrefab {
  const gearRole = unitRoleToGearRole(unitRole);
  const preset = getRtsGearPreset(raceId, gearRole);
  const classId: ClassId =
    gearRole === "mage" ? "mage" : gearRole === "ranger" ? "ranger" : "warrior";

  const base =
    getPrefab(`${raceId}_${classId}`) ??
    CHARACTER_PREFABS.find((p) => p.race === raceId) ??
    CHARACTER_PREFABS[0];

  const equipment = loadoutToEquipment(preset.loadout);
  if (gearRole === "worker") {
    equipment.rightHand = null;
    equipment.rightHandType = null;
    equipment.leftHand = null;
    equipment.leftHandType = null;
    equipment.shield = null;
    equipment.utility = [];
  }

  return {
    ...base,
    id: `${raceId}_${gearRole}_rts`,
    classId,
    equipment,
    animationPack: preset.anim_pack,
  };
}

/** CDN URL for official JSON (class templates — race applied above). */
export const GEAR_PRESETS_CDN =
  "https://assets.grudge-studio.com/api/v1/grudge6-gear-presets.json";

/** D1 / ObjectStore export shape for tooling */
export function exportPresetsAsD1Rows(): Array<{
  id: string;
  race_id: string;
  class_id: string;
  label: string;
  anim_pack: string;
  mesh_ids: string[];
}> {
  return RTS_GEAR_PRESETS.map((p) => {
    const prefix =
      p.raceId === "human"
        ? "WK_"
        : p.raceId === "barbarian"
          ? "BRB_"
          : p.raceId === "elf"
            ? "ELF_"
            : p.raceId === "dwarf"
              ? "DWF_"
              : p.raceId === "orc"
                ? "ORC_"
                : "UD_";
    const L = p.loadout;
    const mesh_ids: string[] = [
      `${prefix}Units_Body_${L.body}`,
      `${prefix}Units_Arms_${L.arms}`,
      `${prefix}Units_Legs_${L.legs}`,
    ];
    if (L.head) mesh_ids.push(`${prefix}Units_head_${L.head}`);
    if (L.shoulders) mesh_ids.push(`${prefix}Units_shoulderpads_${L.shoulders}`);
    if (L.sword) mesh_ids.push(`${prefix}Units_sword_${L.sword}`);
    if (L.axe) mesh_ids.push(`${prefix}Units_axe_${L.axe}`);
    if (L.hammer) mesh_ids.push(`${prefix}Units_hammer_${L.hammer}`);
    if (L.shield) mesh_ids.push(`${prefix}Shield_${L.shield}`);
    if (L.staff) mesh_ids.push(`${prefix}Units_staff_${L.staff}`);
    if (L.bow) mesh_ids.push(`${prefix}Units_bow_${L.bow === "_default" ? "A" : L.bow}`);
    if (L.quiver) mesh_ids.push(`${prefix}Xtra_quiver`);
    return {
      id: p.id,
      race_id: p.raceId,
      class_id: p.role,
      label: p.label,
      anim_pack: p.anim_pack,
      mesh_ids,
    };
  });
}
