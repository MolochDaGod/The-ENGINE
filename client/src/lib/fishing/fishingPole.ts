/**
 * Fishing pole mesh + right-hand bone attach (axe-style grip offset).
 */
import * as THREE from "three";

const HAND_NAME_HINTS = [
  "bip001 r hand",
  "bip001 rhand",
  "r_hand_container",
  "mixamorig_righthand",
  "mixamorigrighthand",
  "righthand",
  "hand_r",
  "r hand",
  "hand.r",
];

export function findRightHandBone(root: THREE.Object3D): THREE.Object3D | null {
  let best: THREE.Object3D | null = null;
  let bestScore = 0;
  root.traverse((obj) => {
    const n = obj.name.toLowerCase().replace(/[.\-_]/g, " ");
    if (!n.includes("hand") && !n.includes("wrist")) return;
    if (n.includes("l hand") || n.includes("lefthand") || n.includes("left hand") || n.includes("hand l")) return;
    let score = 0;
    for (const h of HAND_NAME_HINTS) {
      if (n.includes(h.replace(/[.\-_]/g, " "))) score += 10;
    }
    if (n.includes("r hand") || n.includes("right")) score += 5;
    if (n.includes("bip001")) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = obj;
    }
  });
  return best;
}

/** Procedural fishing rod — long shaft + handle + tip eyelet (axe grip orientation). */
export function createFishingPoleMesh(): THREE.Group {
  const pole = new THREE.Group();
  pole.name = "FishingPole";

  // Handle (grip) — short, darker wood
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 0.16, 10),
    new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.75, metalness: 0.1 }),
  );
  handle.position.y = 0.08;
  handle.castShadow = true;
  pole.add(handle);

  // Reel seat
  const seat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.04, 10),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.35 }),
  );
  seat.position.y = 0.17;
  pole.add(seat);

  // Rod blank — long taper
  const blank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.016, 1.35, 10),
    new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.45, metalness: 0.15 }),
  );
  blank.position.y = 0.17 + 0.675;
  blank.castShadow = true;
  pole.add(blank);

  // Tip eyelet
  const tip = new THREE.Mesh(
    new THREE.TorusGeometry(0.018, 0.004, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.3 }),
  );
  tip.position.y = 0.17 + 1.35;
  tip.rotation.x = Math.PI / 2;
  pole.add(tip);

  // Simple spinning reel body
  const reel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12),
    new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.7, roughness: 0.35 }),
  );
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.04, 0.2, 0);
  pole.add(reel);

  // Tip marker for line attach
  const tipAnchor = new THREE.Object3D();
  tipAnchor.name = "PoleTip";
  tipAnchor.position.y = 0.17 + 1.35;
  pole.add(tipAnchor);

  // Axe-style grip: pole extends along bone local Y, rotated so shaft points up/out
  pole.rotation.set(-Math.PI / 2.4, 0, Math.PI / 8);
  pole.position.set(0.02, 0.04, 0.02);
  pole.scale.setScalar(1);

  return pole;
}

export function attachPoleToHand(model: THREE.Object3D, pole: THREE.Object3D): boolean {
  const hand = findRightHandBone(model);
  if (!hand) {
    // Fallback: parent to model with offset
    model.add(pole);
    pole.position.set(0.35, 1.1, 0.15);
    pole.rotation.set(-0.6, 0.3, 0.2);
    return false;
  }
  // Detach from previous parent
  if (pole.parent) pole.parent.remove(pole);
  hand.add(pole);
  // Re-apply axe-like local transform relative to hand
  pole.position.set(0.02, 0.05, 0.02);
  pole.rotation.set(-Math.PI / 2.35, 0.15, Math.PI / 10);
  pole.scale.setScalar(1);
  return true;
}

export function getPoleTipWorld(pole: THREE.Object3D, out = new THREE.Vector3()): THREE.Vector3 {
  const tip = pole.getObjectByName("PoleTip");
  if (tip) {
    tip.getWorldPosition(out);
    return out;
  }
  pole.getWorldPosition(out);
  out.y += 1.4;
  return out;
}
