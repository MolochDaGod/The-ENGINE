/**
 * Canonical weapon skills loader — ObjectStore master-weaponSkills v3.1+
 *
 * Use for portal UIs, character viewer hotbars, and engine skill icons.
 * Icons always resolve through assets.grudge-studio.com.
 */

const OBJECTSTORE_BASE =
  (typeof window !== "undefined" &&
    (window as unknown as { GRUDGE_FLEET?: { objectstore?: string } }).GRUDGE_FLEET
      ?.objectstore) ||
  "https://objectstore.grudge-studio.com";

const ASSETS_CDN =
  (typeof window !== "undefined" &&
    (window as unknown as { GRUDGE_FLEET?: { assets?: string } }).GRUDGE_FLEET
      ?.assets) ||
  "https://assets.grudge-studio.com";

const CATALOG_URL = `${OBJECTSTORE_BASE.replace(/\/$/, "")}/api/v1/master-weaponSkills.json`;

export type WeaponSlotType = "primary" | "secondary" | "ability" | "ultimate" | string;

export interface WeaponSkill {
  uuid?: string;
  id: string;
  name: string;
  description?: string;
  icon: string;
  iconUrl: string;
  tier?: number;
  damage?: number;
  cooldown?: number;
  castTime?: number | null;
  range?: number | null;
  damageType?: string;
  effects?: string[];
  slotType: WeaponSlotType;
}

export interface WeaponTypeDef {
  id: string;
  name: string;
  icon: string;
  iconUrl: string;
  totalSkills?: number;
  classes?: string[];
  skills: WeaponSkill[];
  slots: Array<{
    type: WeaponSlotType;
    label?: string;
    unlockTier?: number;
    skills: WeaponSkill[];
  }>;
}

export interface WeaponSkillsCatalog {
  version: string;
  totalWeaponTypes: number;
  totalSkills: number;
  classRestrictions?: Record<string, string[]>;
  weaponTypes: WeaponTypeDef[];
  byId: Record<string, WeaponTypeDef>;
  loadedAt: number;
}

let cache: WeaponSkillsCatalog | null = null;
let inflight: Promise<WeaponSkillsCatalog> | null = null;

/** Resolve any catalog icon path to a CDN absolute URL. */
export function resolveAssetUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  if (/^(https?:|data:|blob:)/i.test(pathOrUrl)) {
    // Prefer assets CDN over github.io ObjectStore mirrors
    try {
      const u = new URL(pathOrUrl);
      if (u.pathname.startsWith("/icons/") || u.pathname.includes("/ObjectStore/icons/")) {
        const idx = u.pathname.indexOf("/icons/");
        const iconPath = idx >= 0 ? u.pathname.slice(idx) : u.pathname;
        return `${ASSETS_CDN}${iconPath}`;
      }
    } catch {
      /* keep original */
    }
    return pathOrUrl;
  }
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  if (p.startsWith("/icons/")) return `${ASSETS_CDN}${p}`;
  return `${ASSETS_CDN}${p}`;
}

function normalizeSkill(
  raw: Record<string, unknown>,
  slotType: WeaponSlotType,
): WeaponSkill {
  const icon = String(raw.originalIcon || raw.icon || "");
  return {
    uuid: raw.uuid as string | undefined,
    id: String(raw.id || ""),
    name: String(raw.name || raw.id || "Skill"),
    description: raw.description as string | undefined,
    icon,
    iconUrl: resolveAssetUrl(icon),
    tier: typeof raw.tier === "number" ? raw.tier : undefined,
    damage: typeof raw.damage === "number" ? raw.damage : undefined,
    cooldown: typeof raw.cooldown === "number" ? raw.cooldown : undefined,
    castTime: (raw.castTime as number | null) ?? null,
    range: (raw.range as number | null) ?? null,
    damageType: raw.damageType as string | undefined,
    effects: Array.isArray(raw.effects) ? (raw.effects as string[]) : [],
    slotType,
  };
}

function normalizeType(raw: Record<string, unknown>): WeaponTypeDef {
  const icon = String(raw.icon || "");
  const slots = Array.isArray(raw.slots) ? (raw.slots as Record<string, unknown>[]) : [];
  const normSlots = slots.map((slot) => {
    const type = String(slot.type || "primary") as WeaponSlotType;
    const skills = Array.isArray(slot.skills)
      ? (slot.skills as Record<string, unknown>[]).map((s) => normalizeSkill(s, type))
      : [];
    return {
      type,
      label: slot.label as string | undefined,
      unlockTier: slot.unlockTier as number | undefined,
      skills,
    };
  });
  const flat = normSlots.flatMap((s) => s.skills);
  return {
    id: String(raw.id || ""),
    name: String(raw.name || raw.id || "Weapon"),
    icon,
    iconUrl: resolveAssetUrl(icon),
    totalSkills: typeof raw.totalSkills === "number" ? raw.totalSkills : flat.length,
    classes: Array.isArray(raw.classes) ? (raw.classes as string[]) : [],
    skills: flat,
    slots: normSlots,
  };
}

/** Load (and cache) the full master weapon-skills catalog. */
export async function loadWeaponSkillsCatalog(
  force = false,
): Promise<WeaponSkillsCatalog> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;

  inflight = (async () => {
    const res = await fetch(CATALOG_URL, { mode: "cors" });
    if (!res.ok) throw new Error(`weaponSkills catalog HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    const types = Array.isArray(data.weaponTypes)
      ? (data.weaponTypes as Record<string, unknown>[]).map(normalizeType)
      : [];
    const byId: Record<string, WeaponTypeDef> = {};
    for (const t of types) byId[t.id] = t;

    cache = {
      version: String(data.version || "unknown"),
      totalWeaponTypes: Number(data.totalWeaponTypes || types.length),
      totalSkills: Number(data.totalSkills || types.reduce((n, t) => n + t.skills.length, 0)),
      classRestrictions: (data.classRestrictions as Record<string, string[]>) || {},
      weaponTypes: types,
      byId,
      loadedAt: Date.now(),
    };
    return cache;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function getWeaponType(typeId: string): WeaponTypeDef | null {
  return cache?.byId[typeId.toUpperCase()] || null;
}

/** Flat list of skills for a weapon type (all slots). */
export function getSkillsForWeapon(typeId: string): WeaponSkill[] {
  return getWeaponType(typeId)?.skills || [];
}

/** Hotbar-friendly pick: first skill per slot up to max slots. */
export function getDefaultHotbar(
  typeId: string,
  maxSlots = 4,
): WeaponSkill[] {
  const type = getWeaponType(typeId);
  if (!type) return [];
  const order: WeaponSlotType[] = ["primary", "secondary", "ability", "ultimate"];
  const out: WeaponSkill[] = [];
  for (const slotType of order) {
    if (out.length >= maxSlots) break;
    const slot = type.slots.find((s) => s.type === slotType);
    const first = slot?.skills?.[0];
    if (first) out.push(first);
  }
  return out;
}

export function clearWeaponSkillsCache(): void {
  cache = null;
}
