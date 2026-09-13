/**
 * RTS building GLB loader — structure meshes from CDN (not race kits).
 * SI footprint fit; no human 1.8 m scale; no skeleton equip.
 */

import * as THREE from "three";
import { GrudgeAssets, RTS_MODEL_MAP } from "@/lib/grudge-assets";
import { loadGltfInstance, CDN_ASSETS } from "@/lib/production-gltf-loader";
import { buildingColliderSize, type BuildingColliderSize } from "@/lib/rts-grudge6-units";

/** Prefer structure GLBs; role-based fallbacks when mapping incomplete. */
const ROLE_STRUCTURE_FALLBACK: Record<string, string> = {
  economy: "env_structure_1",
  melee_production: "env_structure_2",
  ranged_production: "env_structure_3",
  defense: "env_structure_4",
  population: "env_structure_2",
  upgrade: "env_structure_3",
  armor_upgrade: "env_structure_3",
  mage_production: "env_structure_1",
  cavalry_production: "env_structure_2",
  siege_production: "env_structure_2",
  resource: "env_structure_3",
  expansion: "env_structure_4",
  worg_production: "env_structure_2",
};

export type BuildingVisual = {
  root: THREE.Object3D;
  size: BuildingColliderSize;
  fromGlb: boolean;
};

/**
 * Fit rigid structure to target footprint (metres). Never use character height fit.
 */
export function fitBuildingFootprint(
  root: THREE.Object3D,
  targetW: number,
  targetH: number,
  targetD: number,
): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const sx = targetW / Math.max(size.x, 0.01);
  const sy = targetH / Math.max(size.y, 0.01);
  const sz = targetD / Math.max(size.z, 0.01);
  // Uniform scale from dominant axis so proportions hold
  const s = Math.min(sx, sy, sz);
  // Decade fix if cm export
  let scale = s;
  if (size.y > 50) scale *= 0.01;
  if (size.y < 0.05) scale *= 100;
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  // Center XZ
  const c = box2.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
}

/**
 * Load building visual: CDN structure GLB when available, else null (caller uses box).
 */
export async function loadBuildingStructureGlb(
  buildingType: string,
  buildingRole: string,
  factionColor: number,
  targetSize: BuildingColliderSize,
): Promise<BuildingVisual | null> {
  const mapKey = RTS_MODEL_MAP[buildingType] || ROLE_STRUCTURE_FALLBACK[buildingRole];
  if (!mapKey || !mapKey.startsWith("env_structure") && !mapKey.startsWith("env_")) {
    return null;
  }

  try {
    const assets = GrudgeAssets.getInstance();
    // Prefer manifest path through assets (has cache)
    let root: THREE.Object3D | null = await assets.loadRTSModel(buildingType, factionColor, 1);
    // loadRTSModel may return capsule fallback if missing — detect
    if (root && (root as THREE.Mesh).isMesh && (root as THREE.Mesh).geometry?.type === "CapsuleGeometry") {
      root = null;
    }
    if (!root) {
      // Direct CDN path
      const entryPath =
        mapKey === "env_structure_1"
          ? "toon-shooter/environment/Structure_1.glb"
          : mapKey === "env_structure_2"
            ? "toon-shooter/environment/Structure_2.glb"
            : mapKey === "env_structure_3"
              ? "toon-shooter/environment/Structure_3.glb"
              : mapKey === "env_structure_4"
                ? "toon-shooter/environment/Structure_4.glb"
                : null;
      if (!entryPath) return null;
      const inst = await loadGltfInstance(`${CDN_ASSETS}/${entryPath}`, { forceSkinned: false });
      root = inst.scene;
    }

    const group = new THREE.Group();
    group.name = `building-glb-${buildingType}`;
    group.add(root);
    fitBuildingFootprint(group, targetSize.w, targetSize.h, targetSize.d);

    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      // Soft faction tint on untextured mats only
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        if (std?.isMeshStandardMaterial && !std.map && std.color) {
          std.color.lerp(new THREE.Color(factionColor), 0.25);
        }
      }
    });

    return { root: group, size: targetSize, fromGlb: true };
  } catch (e) {
    console.warn("[rts-building-loader] GLB load failed", buildingType, e);
    return null;
  }
}

export function resolveBuildingSize(role: string): BuildingColliderSize {
  return buildingColliderSize(role);
}
