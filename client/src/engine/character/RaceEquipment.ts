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
    scene: cached.scene.clone(true) as THREE.Group,
    animations: cached.animations.map((c) => c.clone()),
  }));
}

/** Candidate URLs: CDN Toon-RTS first, then portal local pack. */
export function raceGlbCandidates(race: RaceId): string[] {
  return [portraitGlbUrl(race), `/models/grudge/${race}.glb`];
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
 * Ground + uniform scale a race model for gameplay (metres).
 */
export function normalizeRaceModel(root: THREE.Object3D, targetHeight = 1.75): void {
  const prev: Array<{ obj: THREE.Object3D; v: boolean }> = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) {
      prev.push({ obj: o, v: o.visible });
      o.visible = true;
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, 0.001);
  root.scale.setScalar(scale);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;

  for (const { obj, v } of prev) obj.visible = v;
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
  normalizeRaceModel(scene, opts.targetHeight ?? 1.75);
  prepareRaceMaterials(scene, {
    tint: opts.tint,
    emissive: opts.emissive,
    enemy: opts.enemy,
  });
  const meshStats = applyEquipmentVisibility(scene, opts.prefab, mode);

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
