/**
 * Unity cosmetics (wings + capes) for Grudge Studio roster.
 *
 * Source lineage: ObjectStore entities-manifest mounts packs
 *   - polygonal-wings (Wings 01–08 + idle/flap anims)
 *   - angel-wings / phoenix-wings textures
 *   - cape/cloak items (bosses/items-database)
 *
 * CDN target (production bake via grudge-asset-convert):
 *   assets.grudge-studio.com/models/cosmetics/{wings|capes}/…
 *
 * Until GLBs are on CDN, the roster uses **procedural fallbacks** so
 * selection + loadout still work end-to-end.
 */

export type CosmeticKind = "wings" | "cape";

export interface RosterCosmetic {
  id: string;
  kind: CosmeticKind;
  label: string;
  icon: string;
  /** ObjectStore / Unity source path (FBX) for convert pipeline */
  sourcePath: string;
  /** Preferred production GLB on R2 (may 404 until baked) */
  glbUrl: string;
  /** Optional diffuse texture */
  textureUrl?: string;
  /** Procedural fallback style when GLB missing */
  fallback: "feather_wings" | "poly_wings" | "angel_wings" | "cloth_cape" | "dragon_cape";
  tags: string[];
  /** Spine attach bone preference */
  attachBone: string;
}

const CDN = "https://assets.grudge-studio.com";
const OS = "https://objectstore.grudge-studio.com";

/** Wings from Unity polygonal / angel / phoenix packs */
export const ROSTER_WINGS: RosterCosmetic[] = [
  {
    id: "wings_poly_01",
    kind: "wings",
    label: "Polygonal Wings 01",
    icon: "🪽",
    sourcePath: "mounts/models/polygonal-wings_Wings 01.FBX",
    glbUrl: `${CDN}/models/cosmetics/wings/polygonal-wings-01.glb`,
    fallback: "poly_wings",
    tags: ["wings", "polygonal", "unity"],
    attachBone: "Bip001 Spine2",
  },
  {
    id: "wings_poly_02",
    kind: "wings",
    label: "Polygonal Wings 02",
    icon: "🪽",
    sourcePath: "mounts/models/polygonal-wings_Wings 02.FBX",
    glbUrl: `${CDN}/models/cosmetics/wings/polygonal-wings-02.glb`,
    fallback: "poly_wings",
    tags: ["wings", "polygonal", "unity"],
    attachBone: "Bip001 Spine2",
  },
  {
    id: "wings_poly_03",
    kind: "wings",
    label: "Polygonal Wings 03",
    icon: "🪽",
    sourcePath: "mounts/models/polygonal-wings_Wings 03.FBX",
    glbUrl: `${CDN}/models/cosmetics/wings/polygonal-wings-03.glb`,
    fallback: "poly_wings",
    tags: ["wings", "polygonal", "unity"],
    attachBone: "Bip001 Spine2",
  },
  {
    id: "wings_angel",
    kind: "wings",
    label: "Angel Wings",
    icon: "😇",
    sourcePath: "mounts/textures/angel-wings_FeatherTexture.png",
    glbUrl: `${CDN}/models/cosmetics/wings/angel-wings.glb`,
    textureUrl: `${CDN}/mounts/textures/angel-wings_FeatherTexture.png`,
    fallback: "angel_wings",
    tags: ["wings", "angel", "feather", "unity"],
    attachBone: "Bip001 Spine2",
  },
  {
    id: "wings_phoenix",
    kind: "wings",
    label: "Phoenix Wings",
    icon: "🔥",
    sourcePath: "mounts/models/phoenix-wings_Phoenix_Wings_Anims.fbx",
    glbUrl: `${CDN}/models/cosmetics/wings/phoenix-wings.glb`,
    textureUrl: `${CDN}/mounts/textures/phoenix-wings_Phoenix%20WIng_TEX_1.png`,
    fallback: "feather_wings",
    tags: ["wings", "phoenix", "fire", "unity"],
    attachBone: "Bip001 Spine2",
  },
];

/** Capes / cloaks (Unity + item catalog lineage) */
export const ROSTER_CAPES: RosterCosmetic[] = [
  {
    id: "cape_cloth_basic",
    kind: "cape",
    label: "Cloth Cape",
    icon: "🧥",
    sourcePath: "api/v1/items — cape cloth",
    glbUrl: `${CDN}/models/cosmetics/capes/cloth-cape.glb`,
    fallback: "cloth_cape",
    tags: ["cape", "cloth"],
    attachBone: "Bip001 Spine2",
  },
  {
    id: "cape_dragon_wing",
    kind: "cape",
    label: "Dragon Wing Cape",
    icon: "🐉",
    sourcePath: "api/v1/bosses.json — dragon-wing-cape",
    glbUrl: `${CDN}/models/cosmetics/capes/dragon-wing-cape.glb`,
    fallback: "dragon_cape",
    tags: ["cape", "dragon", "boss-drop"],
    attachBone: "Bip001 Spine2",
  },
  {
    id: "cape_stalker",
    kind: "cape",
    label: "Stalker's Cloak",
    icon: "🌑",
    sourcePath: "api/v1/bosses.json — stalker-cloak",
    glbUrl: `${CDN}/models/cosmetics/capes/stalker-cloak.glb`,
    fallback: "cloth_cape",
    tags: ["cloak", "stealth"],
    attachBone: "Bip001 Spine2",
  },
  {
    id: "cape_web_weaver",
    kind: "cape",
    label: "Web Weaver's Cloak",
    icon: "🕸️",
    sourcePath: "api/v1/bosses.json — web-weaver-cloak",
    glbUrl: `${CDN}/models/cosmetics/capes/web-weaver-cloak.glb`,
    fallback: "cloth_cape",
    tags: ["cloak", "spider"],
    attachBone: "Bip001 Spine2",
  },
];

export const ALL_ROSTER_COSMETICS: RosterCosmetic[] = [
  ...ROSTER_WINGS,
  ...ROSTER_CAPES,
];

export function getCosmeticById(id: string | null | undefined): RosterCosmetic | undefined {
  if (!id) return undefined;
  return ALL_ROSTER_COSMETICS.find((c) => c.id === id);
}

export function listCosmetics(kind?: CosmeticKind): RosterCosmetic[] {
  if (!kind) return ALL_ROSTER_COSMETICS;
  return ALL_ROSTER_COSMETICS.filter((c) => c.kind === kind);
}

/**
 * Convert pipeline note for agents (ObjectStore → R2).
 * Run grudge-asset-convert on sourcePath FBX, upload to glbUrl path.
 */
export function cosmeticConvertJobs(): Array<{
  id: string;
  source: string;
  dest: string;
}> {
  return ALL_ROSTER_COSMETICS.filter((c) => c.sourcePath.endsWith(".FBX") || c.sourcePath.endsWith(".fbx")).map(
    (c) => ({
      id: c.id,
      source: c.sourcePath,
      dest: c.glbUrl.replace(`${CDN}/`, ""),
    }),
  );
}

/** ObjectStore search URL for cape definitions (when API adds capes.json). */
export const CAPES_DEFS_CANDIDATES = [
  `${OS}/api/v1/capes.json`,
  `${OS}/api/v1/master-capes.json`,
  `${CDN}/api/v1/capes.json`,
];
