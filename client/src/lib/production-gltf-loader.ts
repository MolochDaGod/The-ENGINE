/**
 * Production GLTF loader (fleet SSOT)
 *
 * GLTFLoader + DRACO (gstatic decoders) + optional Meshopt.
 * CDN: assets.grudge-studio.com (Cloudflare R2).
 *
 * Use for race kits, props, siege — never bare new GLTFLoader() for prod paths.
 */

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

export const CDN_ASSETS = "https://assets.grudge-studio.com";

/** Official Google-hosted Draco WASM/JS (Cloudflare-friendly CORS). */
export const DRACO_DECODER_PATH =
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

let sharedLoader: GLTFLoader | null = null;
let dracoReady = false;
let meshoptAttached = false;

/**
 * Singleton production GLTFLoader with Draco (+ Meshopt when available).
 */
export function getProductionGltfLoader(): GLTFLoader {
  if (sharedLoader) return sharedLoader;

  const loader = new GLTFLoader();
  loader.setCrossOrigin("anonymous");

  try {
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER_PATH);
    draco.setDecoderConfig({ type: "js" });
    loader.setDRACOLoader(draco);
    dracoReady = true;
  } catch (e) {
    console.warn("[production-gltf-loader] DRACO attach failed", e);
  }

  // MeshoptDecoder: three may expose via examples or dynamic import
  tryAttachMeshopt(loader);

  sharedLoader = loader;
  return loader;
}

function tryAttachMeshopt(loader: GLTFLoader): void {
  if (meshoptAttached) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyLoader = loader as any;
    if (typeof anyLoader.setMeshoptDecoder !== "function") return;
    // Dynamic path — optional; fail soft on three builds without meshopt decoder
    // @ts-expect-error optional path may not resolve in all three versions
    import("three/examples/jsm/libs/meshopt_decoder.module.js")
      .then((mod: { MeshoptDecoder?: unknown }) => {
        if (mod.MeshoptDecoder) {
          anyLoader.setMeshoptDecoder(mod.MeshoptDecoder);
          meshoptAttached = true;
        }
      })
      .catch(() => {
        /* meshopt optional */
      });
  } catch {
    /* optional */
  }
}

export function isDracoConfigured(): boolean {
  return dracoReady;
}

export function isMeshoptAttached(): boolean {
  return meshoptAttached;
}

const gltfCache = new Map<string, Promise<GLTF>>();

/** Load GLB once; returns cached GLTF (do not mutate scene — clone for instances). */
export function loadGltfCached(url: string): Promise<GLTF> {
  let p = gltfCache.get(url);
  if (!p) {
    const loader = getProductionGltfLoader();
    p = new Promise<GLTF>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
    gltfCache.set(url, p);
  }
  return p;
}

/**
 * Independent instance of a cached GLB.
 * Always SkeletonUtils when skinned meshes present (or forceSkinned).
 */
export async function loadGltfInstance(
  url: string,
  opts: { forceSkinned?: boolean } = {},
): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[]; sourceUrl: string }> {
  const gltf = await loadGltfCached(url);
  let skinned = !!opts.forceSkinned;
  if (!skinned) {
    gltf.scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
    });
  }
  const scene = (skinned ? skeletonClone(gltf.scene) : gltf.scene.clone(true)) as THREE.Group;
  if (skinned) {
    scene.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) {
        sm.frustumCulled = false;
        sm.castShadow = true;
        sm.receiveShadow = true;
      }
    });
  }
  return {
    scene,
    animations: (gltf.animations ?? []).map((c) => c.clone()),
    sourceUrl: url,
  };
}

// ─── grudge6 production race URLs (Cloudflare R2 via assets CDN) ───

export type RaceIdLite = "human" | "barbarian" | "elf" | "dwarf" | "orc" | "undead";

const RACE_FILE: Record<RaceIdLite, string> = {
  human: "WK_Characters",
  barbarian: "BRB_Characters",
  elf: "ELF_Characters",
  dwarf: "DWF_Characters",
  orc: "ORC_Characters",
  undead: "UD_Characters",
};

export const RACE_ATLAS_CDN: Record<RaceIdLite, string> = {
  human: `${CDN_ASSETS}/textures/grudge6/western-kingdoms/textures/WK_Standard_Units.webp`,
  barbarian: `${CDN_ASSETS}/textures/grudge6/barbarians/textures/BRB_StandardUnits_texture.webp`,
  elf: `${CDN_ASSETS}/textures/grudge6/elves/textures/ELF_HighElves_Texture.webp`,
  dwarf: `${CDN_ASSETS}/textures/grudge6/dwarves/textures/DWF_Standard_Units.webp`,
  orc: `${CDN_ASSETS}/textures/grudge6/orcs/textures/ORC_StandardUnits.webp`,
  undead: `${CDN_ASSETS}/textures/grudge6/undead/textures/UD_Standard_Units.webp`,
};

/**
 * Production-first candidate list (fleet SSOT order):
 * 1. models/grudge6/races/{PREFIX}_Characters.glb  (production bake)
 * 2. asset-packs/toon-rts-characters/.../{race}.glb (pack mirror)
 * 3. local /models/grudge fallback
 * FBX is NOT in this list — authoring only; convert via grudge-convert.
 */
export function productionRaceGlbCandidates(race: RaceIdLite): string[] {
  const file = RACE_FILE[race] || "WK_Characters";
  return [
    `${CDN_ASSETS}/models/grudge6/races/${file}.glb`,
    `${CDN_ASSETS}/asset-packs/toon-rts-characters/glb/characters/${race}.glb`,
    `/models/grudge/${race}.glb`,
  ];
}

export function productionRaceFbxFallback(race: RaceIdLite): string {
  const file = RACE_FILE[race] || "WK_Characters";
  return `${CDN_ASSETS}/models/grudge6/races/${file}.fbx`;
}

/**
 * Baked anim pack URLs (prefer same CDN). Order: try until first 200.
 * Unarmed pack is default for workers; others for class kits.
 */
export type AnimPackId = "unarmed" | "sword_shield" | "longbow" | "magic" | "2h_melee";

export function animPackClipCandidates(
  pack: AnimPackId,
  clip: "idle" | "walk" | "run" | "attack" | "hurt" | "death" | "gather",
): string[] {
  const base = `${CDN_ASSETS}/models/animations`;
  const names: Record<string, string[]> = {
    idle: ["Idle", "idle", "Standing Idle"],
    walk: ["Walk", "walk", "Walking", "Swagger Walk"],
    run: ["Run", "run", "Running"],
    attack: ["Punching", "Punch", "Attack", "attack"],
    gather: ["Punching", "Punch", "Work"],
    hurt: ["Hit", "HitReact", "hit"],
    death: ["Death", "death"],
  };
  const list = names[clip] ?? [clip];
  const out: string[] = [];
  // Prefer pack folder when present
  for (const n of list) {
    out.push(`${base}/grudge6/${pack}/${n}.glb`);
    out.push(`${base}/baked/${pack}/${n}.glb`);
  }
  // Shared grudge6_brb base (known-good Idle)
  for (const n of list) {
    out.push(`${base}/grudge6_brb/base/${n}.glb`);
    out.push(`${base}/grudge6_brb/base/${n}.fbx`);
  }
  // glocomotion
  for (const n of list) {
    out.push(`${base}/glocomotion/${n.toLowerCase()}.glb`);
    out.push(`${base}/glocomotion/${n}.glb`);
  }
  return out;
}

/** Apply race atlas (sRGB, flipY=false) to all meshes — fleet texture SSOT. */
export async function applyProductionRaceAtlas(
  root: THREE.Object3D,
  race: RaceIdLite,
): Promise<void> {
  const url = RACE_ATLAS_CDN[race];
  if (!url) return;
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        root.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh || !mesh.material) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const std = m as THREE.MeshStandardMaterial;
            if (!std.isMeshStandardMaterial) continue;
            std.map = texture;
            std.color.set(0xffffff);
            std.metalness = 0;
            std.roughness = 0.75;
            std.side = THREE.DoubleSide;
            std.vertexColors = false;
            std.needsUpdate = true;
          }
        });
        resolve();
      },
      undefined,
      () => resolve(),
    );
  });
}

/** Purge list — do not use as production character SSOT */
export const PURGE_HEAVY_OR_WRONG = [
  "toon-shooter/characters/* as final grudge6 hero",
  "grudge-arena…/cdn/assets/characters/* secondary host",
  "plain scene.clone() on SkinnedMesh",
  "Meshy / capsule stand-ins for race kits",
  "raw FBX as only production delivery (convert first)",
  "fitting weapons/props to HUMAN_HEIGHT 1.8",
] as const;
