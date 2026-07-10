import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { portraitGlbUrl } from "@shared/character-meshes";
import type { RaceId } from "@shared/character-prefabs";
import { assetUrl } from "@/lib/api-config";

const glbCache = new Map<string, Promise<THREE.Group>>();

export function loadPortraitGlb(race: RaceId): Promise<THREE.Group> {
  const url = assetUrl(portraitGlbUrl(race));
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
  return p.then((scene) => scene.clone(true));
}

/** Center + scale a portrait model to stand on the ground plane. */
export function normalizePortraitModel(group: THREE.Object3D, targetHeight = 2.0): void {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, 0.001);
  group.scale.setScalar(scale);
  group.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
}