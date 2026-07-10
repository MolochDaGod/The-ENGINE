/**
 * Resolve missing weapon GLB textures via CDN sibling discovery.
 * Ported from grudge-character-creator TextureResolver (simplified).
 */

import * as THREE from "three";

const TEXTURE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

const CHANNEL_SUFFIXES: Record<string, string[]> = {
  map: ["_diffuse", "_basecolor", "_albedo", "_color", ""],
  normalMap: ["_normal", "_norm", "_nrm"],
  roughnessMap: ["_roughness", "_rough", "_rgh"],
  metalnessMap: ["_metallic", "_metalness", "_metal", "_mtl"],
  aoMap: ["_ao", "_occlusion"],
  emissiveMap: ["_emissive", "_emission", "_glow"],
};

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");

function hasDiffuseMap(mat: THREE.Material): boolean {
  const m = mat as THREE.MeshStandardMaterial;
  return !!(m.map?.image);
}

async function tryLoadTexture(url: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        tex.anisotropy = 4;
        resolve(tex);
      },
      undefined,
      () => resolve(null),
    );
  });
}

async function discoverChannel(
  baseDir: string,
  modelBase: string,
  suffixes: string[],
): Promise<THREE.Texture | null> {
  for (const suffix of suffixes) {
    for (const ext of TEXTURE_EXTS) {
      const candidate = `${baseDir}${modelBase}${suffix}${ext}`;
      const tex = await tryLoadTexture(candidate);
      if (tex) return tex;
    }
  }
  return null;
}

/**
 * Attach CDN sibling textures when the GLB material has no loaded diffuse map.
 */
export async function resolveWeaponTextures(
  root: THREE.Object3D,
  modelUrl: string,
): Promise<{ discovered: number }> {
  if (!modelUrl) return { discovered: 0 };

  const baseDir = modelUrl.substring(0, modelUrl.lastIndexOf("/") + 1);
  const modelBase = modelUrl.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
  let discovered = 0;

  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
  });

  for (const mesh of meshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (let i = 0; i < mats.length; i++) {
      const mat = mats[i];
      if (!mat) continue;

      const std = mat as THREE.MeshStandardMaterial;
      if (hasDiffuseMap(std)) {
        if (std.map) {
          std.map.colorSpace = THREE.SRGBColorSpace;
          std.map.needsUpdate = true;
        }
        continue;
      }

      for (const [channel, suffixes] of Object.entries(CHANNEL_SUFFIXES)) {
        if ((std as Record<string, unknown>)[channel]) continue;
        const tex = await discoverChannel(baseDir, modelBase, suffixes);
        if (tex) {
          (std as Record<string, THREE.Texture>)[channel] = tex;
          std.needsUpdate = true;
          if (channel === "map") discovered++;
        }
      }
    }
  }

  return { discovered };
}

/** Ensure all embedded GLB texture maps use correct color space. */
export function normalizeWeaponMaterials(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const m = mat as THREE.MeshStandardMaterial;
      for (const key of ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap"] as const) {
        const tex = m[key];
        if (tex) {
          tex.colorSpace = key === "map" || key === "emissiveMap" ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
          tex.needsUpdate = true;
        }
      }
      m.needsUpdate = true;
    }
  });
}