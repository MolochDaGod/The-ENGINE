/**
 * Load roster cosmetics (wings / capes) — try CDN GLB, else procedural fallback.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { RosterCosmetic } from "@shared/cosmetics-roster";

const gltfLoader = new GLTFLoader();
const glbCache = new Map<string, THREE.Object3D>();

async function tryLoadGlb(url: string): Promise<THREE.Object3D | null> {
  if (glbCache.has(url)) return glbCache.get(url)!.clone(true);
  try {
    const gltf = await gltfLoader.loadAsync(url);
    const root = gltf.scene;
    glbCache.set(url, root);
    return root.clone(true);
  } catch {
    return null;
  }
}

function makeWingPair(
  style: "poly_wings" | "angel_wings" | "feather_wings",
  color: number,
): THREE.Group {
  const g = new THREE.Group();
  g.name = "cosmetic_wings";

  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: style === "poly_wings" ? 0.25 : 0.08,
    roughness: style === "angel_wings" ? 0.55 : 0.7,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
  });

  const makeWing = (side: 1 | -1) => {
    const wing = new THREE.Group();
    wing.name = side > 0 ? "wing_R" : "wing_L";
    // Layered planes for feather/poly look
    for (let i = 0; i < 4; i++) {
      const w = 0.35 + i * 0.08;
      const h = 0.55 + i * 0.12;
      const geom = new THREE.PlaneGeometry(w, h, 1, 2);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(side * (0.22 + i * 0.05), 0.15 - i * 0.02, -0.12 - i * 0.02);
      mesh.rotation.y = side * (0.55 + i * 0.08);
      mesh.rotation.z = side * (0.35 + i * 0.05);
      mesh.rotation.x = -0.2;
      wing.add(mesh);
    }
    return wing;
  };

  g.add(makeWing(1));
  g.add(makeWing(-1));
  g.position.set(0, 1.25, -0.12);
  g.userData.cosmetic = true;
  return g;
}

function makeCape(
  style: "cloth_cape" | "dragon_cape",
  color: number,
): THREE.Group {
  const g = new THREE.Group();
  g.name = "cosmetic_cape";
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: style === "dragon_cape" ? 0.35 : 0.0,
    roughness: style === "dragon_cape" ? 0.45 : 0.9,
    side: THREE.DoubleSide,
  });
  const geom = new THREE.PlaneGeometry(0.55, 1.05, 4, 6);
  // slight drape
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    pos.setZ(i, -0.05 - Math.abs(x) * 0.05 - Math.max(0, -y) * 0.12);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, -0.35, -0.18);
  g.add(mesh);
  g.position.set(0, 1.4, -0.08);
  g.userData.cosmetic = true;
  return g;
}

const FALLBACK_COLORS: Record<string, number> = {
  poly_wings: 0xb8c0d0,
  angel_wings: 0xf5f0e6,
  feather_wings: 0xff6b2c,
  cloth_cape: 0x3b1f5c,
  dragon_cape: 0x5c1a1a,
};

/**
 * Build a cosmetic root (CDN GLB or procedural).
 * Parent should be character group or spine bone.
 */
export async function buildCosmeticMesh(
  cosmetic: RosterCosmetic,
): Promise<THREE.Object3D> {
  const loaded = await tryLoadGlb(cosmetic.glbUrl);
  if (loaded) {
    loaded.name = `cosmetic_${cosmetic.id}`;
    loaded.userData.cosmetic = true;
    loaded.userData.cosmeticId = cosmetic.id;
    // Normalize size relative to ~1.8 m human
    const box = new THREE.Box3().setFromObject(loaded);
    const size = box.getSize(new THREE.Vector3());
    const target = cosmetic.kind === "wings" ? 1.2 : 1.0;
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    if (maxDim > 0.01) loaded.scale.multiplyScalar(target / maxDim);
    loaded.position.set(0, cosmetic.kind === "wings" ? 1.25 : 1.35, -0.1);
    return loaded;
  }

  const color = FALLBACK_COLORS[cosmetic.fallback] ?? 0x888888;
  let node: THREE.Object3D;
  if (cosmetic.kind === "wings") {
    const style =
      cosmetic.fallback === "angel_wings"
        ? "angel_wings"
        : cosmetic.fallback === "feather_wings"
          ? "feather_wings"
          : "poly_wings";
    node = makeWingPair(style, color);
  } else {
    node = makeCape(
      cosmetic.fallback === "dragon_cape" ? "dragon_cape" : "cloth_cape",
      color,
    );
  }
  node.userData.cosmeticId = cosmetic.id;
  node.name = `cosmetic_${cosmetic.id}`;
  return node;
}

/** Attach cosmetic under character root (spine if found). */
export function attachCosmetic(
  characterRoot: THREE.Object3D,
  cosmeticNode: THREE.Object3D,
  attachBone = "Bip001 Spine2",
): void {
  const bones = [
    attachBone,
    "Bip001 Spine2",
    "Bip001 Spine1",
    "Bip001 Spine",
    "mixamorigSpine2",
    "Spine2",
  ];
  let parent: THREE.Object3D = characterRoot;
  for (const b of bones) {
    const found = characterRoot.getObjectByName(b);
    if (found) {
      parent = found;
      // Local offset when parented to bone
      cosmeticNode.position.set(0, 0.05, -0.08);
      break;
    }
  }
  parent.add(cosmeticNode);
}

export function removeCosmetics(characterRoot: THREE.Object3D): void {
  const toRemove: THREE.Object3D[] = [];
  characterRoot.traverse((o) => {
    if (o.userData?.cosmetic) toRemove.push(o);
  });
  for (const o of toRemove) {
    o.parent?.remove(o);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}
