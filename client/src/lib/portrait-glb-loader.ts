import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { portraitGlbUrl, toonRtsRaceGlbUrl } from "@shared/character-meshes";
import type { RaceId } from "@shared/character-prefabs";
import { assetUrl, ASSETS_ORIGIN } from "@/lib/api-config";

const glbCache = new Map<string, Promise<THREE.Group>>();

/** Arena / R2 grudge6 race kits (Bip001) — fallback when toon-rts pack fails. */
const GRUDGE6_RACE_GLB: Record<RaceId, string[]> = {
  human: [
    "https://grudge-arena.grudge-studio.com/cdn/assets/characters/human/WK_Characters.glb",
    `${ASSETS_ORIGIN}/models/grudge6/races/WK_Characters.glb`,
  ],
  barbarian: [
    "https://grudge-arena.grudge-studio.com/cdn/assets/characters/barbarian/BRB_Characters.glb",
    `${ASSETS_ORIGIN}/models/grudge6/races/BRB_Characters.glb`,
  ],
  elf: [
    "https://grudge-arena.grudge-studio.com/cdn/assets/characters/elf/ELF_Characters.glb",
    `${ASSETS_ORIGIN}/models/grudge6/races/ELF_Characters.glb`,
  ],
  dwarf: [
    "https://grudge-arena.grudge-studio.com/cdn/assets/characters/dwarf/DWF_Characters.glb",
    `${ASSETS_ORIGIN}/models/grudge6/races/DWF_Characters.glb`,
  ],
  orc: [
    "https://grudge-arena.grudge-studio.com/cdn/assets/characters/orc/ORC_Characters.glb",
    `${ASSETS_ORIGIN}/models/grudge6/races/ORC_Characters.glb`,
  ],
  undead: [
    "https://grudge-arena.grudge-studio.com/cdn/assets/characters/undead/UD_Characters.glb",
    `${ASSETS_ORIGIN}/models/grudge6/races/UD_Characters.glb`,
  ],
};

function loadGlbOnce(url: string): Promise<THREE.Group> {
  let p = glbCache.get(url);
  if (!p) {
    p = new Promise<THREE.Group>((resolve, reject) => {
      const loader = new GLTFLoader();
      if (!url.startsWith("/")) loader.setCrossOrigin("anonymous");
      loader.load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(err),
      );
    });
    glbCache.set(url, p);
  }
  // SkeletonUtils — plain clone breaks skinned body meshes
  return p.then((scene) => skeletonClone(scene) as THREE.Group);
}

/** Candidate URLs: toon-rts race GLB (CDN absolute) then grudge6 arena/R2. */
export function portraitGlbCandidates(race: RaceId): string[] {
  const primary = portraitGlbUrl(race);
  const toon = toonRtsRaceGlbUrl(race);
  const urls = [
    // Prefer absolute CDN (CORS *) over same-origin proxy
    assetUrl(primary),
    primary.startsWith("http") ? primary : `${ASSETS_ORIGIN}${primary.startsWith("/") ? primary : `/${primary}`}`,
    toon,
    ...(GRUDGE6_RACE_GLB[race] || []),
  ];
  return [...new Set(urls.filter(Boolean))];
}

export async function loadPortraitGlb(race: RaceId): Promise<THREE.Group> {
  const candidates = portraitGlbCandidates(race);
  let lastErr: unknown;
  for (const url of candidates) {
    try {
      return await loadGlbOnce(url);
    } catch (e) {
      lastErr = e;
      glbCache.delete(url);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Failed to load race model for ${race}`);
}

/**
 * Center + scale a portrait model to stand on the ground plane (Y-up, feet y=0).
 * Uses skinned body measure when available (avoids wide gear warping height).
 */
export function normalizePortraitModel(group: THREE.Object3D, targetHeight = 1.8): void {
  group.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  let n = 0;
  group.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      try {
        box.expandByObject(o);
        n++;
      } catch {
        /* incomplete skin */
      }
    }
  });
  if (n === 0) box.setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  let h = size.y || 1;
  // Decade unit fix (cm exports)
  if (h > 50 || h < 0.05) {
    const unit = Math.pow(10, Math.round(Math.log10(targetHeight / h)));
    group.scale.multiplyScalar(unit);
    group.updateWorldMatrix(true, true);
    box.makeEmpty();
    n = 0;
    group.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        box.expandByObject(o);
        n++;
      }
    });
    if (n === 0) box.setFromObject(group);
    box.getSize(size);
    box.getCenter(centre);
    h = size.y || targetHeight;
  }
  const scale = targetHeight / Math.max(h, 0.001);
  group.scale.multiplyScalar(scale);
  group.updateWorldMatrix(true, true);
  const box2 = new THREE.Box3().setFromObject(group);
  const c2 = box2.getCenter(new THREE.Vector3());
  group.position.x -= c2.x;
  group.position.z -= c2.z;
  group.position.y -= box2.min.y;
  // Soften chrome materials (yellow/grey without env)
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const m = mat as THREE.MeshStandardMaterial;
      if (m.map && "colorSpace" in m.map) {
        (m.map as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
        if (m.color) m.color.setHex(0xffffff);
      }
      if ("metalness" in m && typeof m.metalness === "number" && m.metalness > 0.25 && !m.envMap) {
        m.metalness = Math.min(m.metalness, 0.15);
        if ("roughness" in m && typeof m.roughness === "number" && m.roughness < 0.4) {
          m.roughness = 0.55;
        }
      }
      m.needsUpdate = true;
    }
  });
}