/**
 * Wargus / fleet Three.js loaders (production path)
 *
 * GLTFLoader + DRACO + Meshopt (when available) for CDN race kits.
 * FBXLoader only as grudge6 fallback when GLB fails.
 * SkeletonUtils.clone for independent skinned instances.
 *
 * SSOT: threejs-production-best-practices · grudge6-full-stack
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

export type LoadedScene = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  sourceUrl: string;
};

const gltfCache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>();
const fbxCache = new Map<string, Promise<THREE.Group>>();

let sharedGltf: GLTFLoader | null = null;
let sharedFbx: FBXLoader | null = null;
let dracoConfigured = false;

/** Singleton GLTFLoader with Draco (+ Meshopt if present on three build). */
export function getGltfLoader(): GLTFLoader {
  if (!sharedGltf) {
    sharedGltf = new GLTFLoader();
    sharedGltf.setCrossOrigin("anonymous");
    try {
      const draco = new DRACOLoader();
      // Google CDN decoder — standard for three.js examples
      draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
      draco.setDecoderConfig({ type: "js" });
      sharedGltf.setDRACOLoader(draco);
      dracoConfigured = true;
    } catch (e) {
      console.warn("[rts-three-loaders] DRACO not attached", e);
    }
    // MeshoptDecoder is optional — attach when three ships it as global or dynamic import
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const MeshoptDecoder = (THREE as any).MeshoptDecoder;
      if (MeshoptDecoder && typeof sharedGltf.setMeshoptDecoder === "function") {
        sharedGltf.setMeshoptDecoder(MeshoptDecoder);
      }
    } catch {
      /* meshopt optional */
    }
  }
  return sharedGltf;
}

export function getFbxLoader(): FBXLoader {
  if (!sharedFbx) {
    sharedFbx = new FBXLoader();
    sharedFbx.setCrossOrigin("anonymous");
  }
  return sharedFbx;
}

export function isDracoConfigured(): boolean {
  return dracoConfigured;
}

/**
 * Load GLB/GLTF once, return a **skeleton-safe clone** for each unit instance.
 */
export async function loadGltfScene(url: string): Promise<LoadedScene> {
  let p = gltfCache.get(url);
  if (!p) {
    const loader = getGltfLoader();
    p = new Promise((resolve, reject) => {
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
    gltfCache.set(url, p);
  }
  const cached = await p;
  // Critical: independent skeleton per unit (shared bones break multi-unit anim)
  const scene = skeletonClone(cached.scene) as THREE.Group;
  const animations = cached.animations.map((c) => c.clone());
  return { scene, animations, sourceUrl: url };
}

/**
 * Load FBX race kit (fallback). Returns skeleton-cloned group.
 */
export async function loadFbxScene(url: string): Promise<LoadedScene> {
  let p = fbxCache.get(url);
  if (!p) {
    const loader = getFbxLoader();
    p = loader.loadAsync(url);
    fbxCache.set(url, p);
  }
  const root = await p;
  const scene = skeletonClone(root) as THREE.Group;
  const animations = (root.animations ?? []).map((c) => c.clone());
  return { scene, animations, sourceUrl: url };
}

/**
 * Production renderer defaults for RTS (r181–r185).
 * Call once when creating WebGLRenderer.
 */
export function applyRtsRendererDefaults(renderer: THREE.WebGLRenderer): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (typeof window !== "undefined") {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  }
}

/**
 * Atlas / material fix for grudge6 kits after load.
 * - color maps → sRGB
 * - flipY false for FBX atlas path
 * - skinned frustumCulled = false (multi-unit kits)
 */
export function prepareGrudge6RuntimeMaterials(
  root: THREE.Object3D,
  opts: { fbxAtlas?: boolean } = {},
): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      mesh.frustumCulled = false;
    }
    if (!mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std.map) {
        std.map.colorSpace = THREE.SRGBColorSpace;
        if (opts.fbxAtlas) std.map.flipY = false;
        std.map.needsUpdate = true;
        if (std.color) std.color.setHex(0xffffff);
      }
      if ("metalness" in std && typeof std.metalness === "number" && std.metalness > 0.35 && !std.envMap) {
        std.metalness = Math.min(std.metalness, 0.2);
        if ("roughness" in std && typeof std.roughness === "number" && std.roughness < 0.4) {
          std.roughness = 0.55;
        }
      }
      std.needsUpdate = true;
    }
  });
}

/** Strip root/hip position tracks so grounded kits don't hip-float. */
export function stripPositionTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  const next = clip.clone();
  next.tracks = next.tracks.filter((t) => !/\.position$/i.test(t.name));
  return next;
}
