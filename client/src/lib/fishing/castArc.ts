/**
 * Cast trajectory arc — parabolic path from pole tip toward aim point on water.
 */
import * as THREE from "three";

export function sampleCastArc(
  origin: THREE.Vector3,
  aimPoint: THREE.Vector3,
  power: number,
  segments = 24,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const mid = origin.clone().lerp(aimPoint, 0.5);
  // Apex height scales with power and horizontal distance
  const horiz = new THREE.Vector2(aimPoint.x - origin.x, aimPoint.z - origin.z).length();
  const apexY = Math.max(origin.y, aimPoint.y) + Math.min(12, 2 + horiz * 0.25) * power;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Quadratic bezier origin → high mid → aim
    const p0 = origin;
    const p1 = new THREE.Vector3(mid.x, apexY, mid.z);
    const p2 = aimPoint;
    const a = p0.clone().multiplyScalar((1 - t) * (1 - t));
    const b = p1.clone().multiplyScalar(2 * (1 - t) * t);
    const c = p2.clone().multiplyScalar(t * t);
    pts.push(a.add(b).add(c));
  }
  return pts;
}

export function updateArcLine(
  line: THREE.Line,
  origin: THREE.Vector3,
  aimPoint: THREE.Vector3,
  power: number,
): void {
  const pts = sampleCastArc(origin, aimPoint, power);
  const pos = new Float32Array(pts.length * 3);
  for (let i = 0; i < pts.length; i++) {
    pos[i * 3] = pts[i].x;
    pos[i * 3 + 1] = pts[i].y;
    pos[i * 3 + 2] = pts[i].z;
  }
  line.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

export function createArcLine(): THREE.Line {
  const geo = new THREE.BufferGeometry();
  const mat = new THREE.LineBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
  });
  const line = new THREE.Line(geo, mat);
  line.name = "CastArc";
  line.frustumCulled = false;
  return line;
}

export function createBobber(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.25 }),
  );
  mesh.castShadow = true;
  mesh.name = "Bobber";
  mesh.visible = false;
  return mesh;
}

export function createFishingLine(): THREE.Line {
  const geo = new THREE.BufferGeometry();
  const mat = new THREE.LineBasicMaterial({ color: 0xd4d4d8, transparent: true, opacity: 0.7 });
  const line = new THREE.Line(geo, mat);
  line.name = "FishingLine";
  line.frustumCulled = false;
  return line;
}

export function setLinePoints(line: THREE.Line, a: THREE.Vector3, b: THREE.Vector3): void {
  const pos = new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z]);
  line.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}
