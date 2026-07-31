/**
 * Grudge6 / Toon-RTS D1 race equipment mesh system
 *
 * Race GLBs contain a full multi-mesh wardrobe on one skeleton.
 * This module loads the race model and applies prefab equipment visibility.
 *
 * Default for player characters: **unarmed** (armor only).
 * Equipped mode shows class weapons/shields from CharacterPrefab.equipment.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  applyEquipmentVisibility,
  portraitGlbUrl,
  type EquipmentVisibilityMode,
  type RaceId,
} from "@shared/character-meshes";
import {
  CHARACTER_PREFABS,
  getPrefab,
  type CharacterPrefab,
  type ClassId,
} from "@shared/character-prefabs";

const loader = new GLTFLoader();

type CachedGltf = { scene: THREE.Group; animations: THREE.AnimationClip[] };
const glbCache = new Map<string, Promise<CachedGltf>>();

export type RaceEquipmentLoadResult = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  prefab: CharacterPrefab;
  mode: EquipmentVisibilityMode;
  sourceUrl: string;
  meshStats: { meshCount: number; visibleCount: number; mode: EquipmentVisibilityMode };
};

/**
 * Clone with independent skeleton. Plain `scene.clone(true)` breaks SkinnedMesh
 * binding → bodies invisible while rigid bags/wood still draw (bag-blob bug).
 */
function cloneRaceScene(source: THREE.Group): THREE.Group {
  return skeletonClone(source) as THREE.Group;
}

function loadGlbCached(url: string): Promise<CachedGltf> {
  let p = glbCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      if (!url.startsWith("/")) loader.setCrossOrigin("anonymous");
      loader.load(
        url,
        (gltf) => {
          resolve({
            scene: gltf.scene as THREE.Group,
            animations: gltf.animations ?? [],
          });
        },
        undefined,
        reject,
      );
    });
    glbCache.set(url, p);
  }
  return p.then((cached) => ({
    scene: cloneRaceScene(cached.scene),
    animations: cached.animations.map((c) => c.clone()),
  }));
}

const ASSETS = "https://assets.grudge-studio.com";
const GRUDGE6_RACE_FILE: Record<RaceId, string> = {
  human: "WK_Characters",
  barbarian: "BRB_Characters",
  elf: "ELF_Characters",
  dwarf: "DWF_Characters",
  orc: "ORC_Characters",
  undead: "UD_Characters",
};

/**
 * Candidate URLs (full wardrobe kits):
 * 1. Toon-RTS multi-mesh race GLB (portrait pack)
 * 2. Production grudge6 race GLB on R2
 * 3. Arena secondary host
 * 4. Local portal pack fallback
 */
export function raceGlbCandidates(race: RaceId): string[] {
  const file = GRUDGE6_RACE_FILE[race] || "WK_Characters";
  return [
    portraitGlbUrl(race),
    `${ASSETS}/asset-packs/toon-rts-characters/glb/characters/${race}.glb`,
    `${ASSETS}/models/grudge6/races/${file}.glb`,
    `https://grudge-arena.grudge-studio.com/cdn/assets/characters/${race}/${file}.glb`,
    `/models/grudge/${race}.glb`,
  ];
}

/** FBX SSOT kit (full unarmed wardrobe + bone containers) when GLB path fails. */
export function raceFbxCandidates(race: RaceId): string[] {
  const file = GRUDGE6_RACE_FILE[race] || "WK_Characters";
  return [
    `${ASSETS}/models/grudge6/races/${file}.fbx`,
    `https://grudge-arena.grudge-studio.com/cdn/assets/characters/${race}/${file}.fbx`,
  ];
}

/**
 * Load a race wardrobe GLB (Toon-RTS D1 multi-mesh).
 * Prefers CDN textured pack; falls back to local /models/grudge.
 */
export async function loadRaceWardrobeGlb(
  race: RaceId,
): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[]; sourceUrl: string }> {
  const urls = raceGlbCandidates(race);
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const { scene, animations } = await loadGlbCached(url);
      return { scene, animations, sourceUrl: url };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error(`[RaceEquipment] No GLB for race ${race}`);
}

export function prefabFromRaceClass(race: RaceId, classId: ClassId = "warrior"): CharacterPrefab {
  return (
    getPrefab(`${race}_${classId}`) ??
    CHARACTER_PREFABS.find((p) => p.race === race) ??
    CHARACTER_PREFABS[0]
  );
}

/** Resolve CharacterPrefab from dashed or underscored id (human-warrior / human_warrior). */
export function resolveCharacterPrefab(idOrRace: string, classId?: ClassId): CharacterPrefab {
  const underscored = idOrRace.replace(/-/g, "_");
  const byId = getPrefab(underscored) ?? getPrefab(idOrRace.replace(/_/g, "-"));
  if (byId) return byId;

  if (classId) {
    const combo = getPrefab(`${underscored}_${classId}`);
    if (combo) return combo;
  }

  const raceOnly = getPrefab(`${underscored}_warrior`);
  if (raceOnly) return raceOnly;

  return (
    CHARACTER_PREFABS.find((p) => p.race === underscored || p.race === idOrRace) ??
    CHARACTER_PREFABS[0]
  );
}

/**
 * SI fit: 1 unit = 1 m, human ~1.7–1.8 m.
 *
 * CRITICAL process (grudge-world-scale / character-correctness):
 * 1. Measure **currently visible** skinned body only (never full wardrobe AABB —
 *    that counted bags+all armor variants and broke height).
 * 2. **Unit decade fix first** (classic 100×): if height ≫ target, ×0.01; if ≪, ×100.
 * 3. Residual aesthetic fit to targetHeight (clamped).
 * 4. Ground feet from body box.min.y.
 *
 * Do NOT force all meshes visible before measure — that reintroduces bag-blob scale.
 */
export function normalizeRaceModel(root: THREE.Object3D, targetHeight = 1.75): void {
  root.updateMatrixWorld(true);

  const bodyBox = (r: THREE.Object3D): THREE.Box3 => {
    const box = new THREE.Box3();
    let any = false;
    r.traverse((o) => {
      const sk = o as THREE.SkinnedMesh;
      if (!sk.isSkinnedMesh || !o.visible) return;
      // Skip obvious prop names even if visible
      if (/xtra_|bag|wood|quiver|weapon_|shield/i.test(o.name || "")) return;
      try {
        if (!any) {
          box.setFromObject(o);
          any = true;
        } else box.expandByObject(o);
      } catch {
        /* incomplete skin */
      }
    });
    if (!any) {
      // Fall back: any visible mesh that is not a carry prop
      r.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !o.visible) return;
        if (/xtra_|bag|wood|quiver|weapon_|shield/i.test(o.name || "")) return;
        try {
          if (!any) {
            box.setFromObject(o);
            any = true;
          } else box.expandByObject(o);
        } catch {
          /* */
        }
      });
    }
    if (!any) box.setFromObject(r);
    return box;
  };

  let box = bodyBox(root);
  let size = box.getSize(new THREE.Vector3());
  let h = Math.max(size.y, 1e-6);

  // Decade unit correction (cm→m or 100× blow-up) — unclamped
  if (h > targetHeight * 8 || h < targetHeight * 0.08) {
    const decade = Math.pow(10, Math.round(Math.log10(targetHeight / h)));
    // decade typically 0.01 or 100
    root.scale.multiplyScalar(decade);
    root.updateMatrixWorld(true);
    box = bodyBox(root);
    size = box.getSize(new THREE.Vector3());
    h = Math.max(size.y, 1e-6);
  }

  // Residual fit (clamp aesthetic scale so we never re-blow 100×)
  let fit = targetHeight / h;
  if (fit > 12) fit = 12;
  if (fit < 1 / 12) fit = 1 / 12;
  root.scale.multiplyScalar(fit);
  root.updateMatrixWorld(true);

  box = bodyBox(root);
  root.position.y += 0 - box.min.y;
  root.updateMatrixWorld(true);
  // Second feet pass
  box = bodyBox(root);
  root.position.y += 0 - box.min.y;
}

/**
 * Prepare materials: preserve atlas textures; only tint untextured fallbacks.
 */
export function prepareRaceMaterials(
  root: THREE.Object3D,
  opts: { tint?: number; emissive?: number; enemy?: boolean } = {},
): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (!mesh.material) return;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((mat) => {
      const m = mat.clone();
      const std = m as THREE.MeshStandardMaterial;
      if (std.map) {
        std.map.colorSpace = THREE.SRGBColorSpace;
      } else if (std.color && opts.tint != null) {
        std.color.lerp(new THREE.Color(opts.tint), opts.enemy ? 0.2 : 0.12);
      }
      if (std.emissive && opts.emissive != null && !std.map) {
        std.emissive.set(opts.emissive);
      }
      if (opts.enemy && std.color) {
        std.color.lerp(new THREE.Color(0xff2200), 0.08);
      }
      return m;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}

/**
 * Full load: race wardrobe GLB + equipment visibility.
 * @param mode default **unarmed** for player; use "equipped" for AI / loadout
 */
export async function loadRaceWithEquipment(opts: {
  race: RaceId;
  prefab: CharacterPrefab;
  mode?: EquipmentVisibilityMode;
  tint?: number;
  emissive?: number;
  enemy?: boolean;
  targetHeight?: number;
}): Promise<RaceEquipmentLoadResult> {
  const mode = opts.mode ?? "unarmed";
  const { scene, animations, sourceUrl } = await loadRaceWardrobeGlb(opts.race);

  // Order: materials → visibility → SI scale (never scale full wardrobe first)
  const armorTint =
    opts.prefab.classId === "warrior"
      ? 0xb0b8c0
      : opts.prefab.classId === "mage"
        ? 0xc4b8e8
        : opts.prefab.classId === "ranger"
          ? 0x8b7355
          : 0x9a7b5a;
  prepareRaceMaterials(scene, {
    tint: opts.tint ?? armorTint,
    emissive: opts.emissive,
    enemy: opts.enemy,
  });
  const meshStats = applyEquipmentVisibility(scene, opts.prefab, mode);
  normalizeRaceModel(scene, opts.targetHeight ?? 1.75);

  return {
    scene,
    animations,
    prefab: opts.prefab,
    mode,
    sourceUrl,
    meshStats,
  };
}

/** Re-apply equipment on an already-loaded mesh (scene bag change, equip weapon, etc.). */
export function setRaceEquipmentMode(
  root: THREE.Object3D,
  prefab: CharacterPrefab,
  mode: EquipmentVisibilityMode,
): ReturnType<typeof applyEquipmentVisibility> {
  return applyEquipmentVisibility(root, prefab, mode);
}
