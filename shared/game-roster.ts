/**
 * Game roster — lane heroes (24 prefabs) + player pregame loadout.
 * Lane units use CHARACTER_PREFABS exactly as defined (class equipment).
 * Player spawns unarmed and equips weapons chosen in pregame.
 */

import {
  CHARACTER_PREFABS,
  getPrefab,
  getEquipmentMeshNames,
  type CharacterPrefab,
} from "./character-prefabs";
import { applyEquipmentVisibility } from "./character-meshes";

/** All 24 heroes — use as-is for lane minions / AI marchers */
export const LANE_HEROES: CharacterPrefab[] = CHARACTER_PREFABS;

export interface PregameWeapon {
  id: string;
  label: string;
  icon: string;
  manifestKey: string;
  tags: string[];
}

/** CDN weapon picks for pregame (toon-shooter GLBs on R2) */
export const PREGAME_WEAPONS: PregameWeapon[] = [
  { id: "knife", label: "Combat Knife", icon: "🗡️", manifestKey: "weapon_knife_1", tags: ["melee"] },
  { id: "shovel", label: "Shovel", icon: "⛏️", manifestKey: "weapon_shovel", tags: ["melee"] },
  { id: "pistol", label: "Pistol", icon: "🔫", manifestKey: "weapon_pistol", tags: ["ranged"] },
  { id: "smg", label: "SMG", icon: "🔫", manifestKey: "weapon_smg", tags: ["ranged"] },
  { id: "shotgun", label: "Shotgun", icon: "💥", manifestKey: "weapon_shotgun", tags: ["ranged"] },
  { id: "ak", label: "Assault Rifle", icon: "🎯", manifestKey: "weapon_ak", tags: ["ranged"] },
  { id: "sniper", label: "Sniper", icon: "🎯", manifestKey: "weapon_sniper", tags: ["ranged"] },
  { id: "revolver", label: "Revolver", icon: "🤠", manifestKey: "weapon_revolver", tags: ["ranged"] },
  { id: "grenade", label: "Grenade", icon: "💣", manifestKey: "weapon_grenade", tags: ["throwable"] },
  { id: "launcher", label: "Grenade Launcher", icon: "🚀", manifestKey: "weapon_grenade_launcher", tags: ["ranged"] },
];

export interface PlayerLoadout {
  heroId: string;
  primaryWeapon: string;
  secondaryWeapon: string | null;
  /** Unity / roster cosmetics (optional) */
  wingsId?: string | null;
  capeId?: string | null;
}

export const LOADOUT_STORAGE_KEY = "grudge:pregame-loadout";

export function toUnarmedPrefab(prefab: CharacterPrefab): CharacterPrefab {
  return {
    ...prefab,
    equipment: {
      ...prefab.equipment,
      rightHand: null,
      rightHandType: null,
      leftHand: null,
      leftHandType: null,
      shield: null,
      utility: [],
    },
    animationPack: "unarmed",
  };
}

/** Armor-only mesh names for unarmed player preview */
export function getArmorMeshNames(prefab: CharacterPrefab): string[] {
  const p = prefab.prefix;
  const e = prefab.equipment;
  const names = [
    `${p}Units_Body_${e.body}`,
    `${p}Units_Arms_${e.arms}`,
    `${p}Units_Legs_${e.legs}`,
  ];
  // Always include a head (null helm loadout → bare head_A)
  names.push(`${p}Units_head_${e.head || "A"}`);
  if (e.shoulders) names.push(`${p}Units_shoulderpads_${e.shoulders}`);
  return names;
}

const WEAPON_MESH_RE = /Units_(sword|axe|hammer|mace|dagger|bow|staff|shield|gun|pistol|rifle)_|Units_Bow|Xtra_/i;

/** Hide class weapons on FBX — player starts unarmed */
export function applyUnarmedMeshVisibility(root: import("three").Object3D): void {
  const allow = new Set<string>();
  root.traverse((child) => {
    if (!(child as import("three").Mesh).isMesh) return;
    const name = child.name;
    if (WEAPON_MESH_RE.test(name)) {
      child.visible = false;
      return;
    }
    allow.add(name);
  });
}

/** Lane units show full class equipment from prefab definition (Toon-RTS multi-mesh). */
export function applyLaneMeshVisibility(root: import("three").Object3D, prefab: CharacterPrefab): void {
  applyEquipmentVisibility(root as never, prefab, "equipped");
}

export function savePlayerLoadout(loadout: PlayerLoadout): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(loadout));
}

export function readPlayerLoadout(): PlayerLoadout | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LOADOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerLoadout;
    if (!parsed.heroId || !parsed.primaryWeapon) return null;
    if (!getPrefab(parsed.heroId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseRosterSearch(search: string): Partial<PlayerLoadout> {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    heroId: params.get("hero") ?? undefined,
    primaryWeapon: params.get("primary") ?? undefined,
    secondaryWeapon: params.get("secondary"),
    wingsId: params.get("wings"),
    capeId: params.get("cape"),
  };
}

export function buildRosterSearch(loadout: PlayerLoadout): string {
  const params = new URLSearchParams();
  params.set("hero", loadout.heroId);
  params.set("primary", loadout.primaryWeapon);
  if (loadout.secondaryWeapon) params.set("secondary", loadout.secondaryWeapon);
  if (loadout.wingsId) params.set("wings", loadout.wingsId);
  if (loadout.capeId) params.set("cape", loadout.capeId);
  return `?${params.toString()}`;
}

export function getWeaponById(id: string): PregameWeapon | undefined {
  return PREGAME_WEAPONS.find((w) => w.id === id);
}

export function defaultPlayerLoadout(): PlayerLoadout {
  return {
    heroId: CHARACTER_PREFABS[0]?.id ?? "barbarian_warrior",
    primaryWeapon: "pistol",
    secondaryWeapon: "knife",
    wingsId: null,
    capeId: null,
  };
}

/** Map pregame weapon id → ObjectStore weapon-skills type id (best effort). */
export function weaponSkillsTypeForPregame(weaponId: string): string {
  const map: Record<string, string> = {
    knife: "dagger",
    shovel: "axe",
    pistol: "pistol",
    smg: "smg",
    shotgun: "shotgun",
    ak: "rifle",
    sniper: "rifle",
    revolver: "pistol",
    grenade: "throwable",
    launcher: "launcher",
  };
  return map[weaponId] ?? weaponId;
}