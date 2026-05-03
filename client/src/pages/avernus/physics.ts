import * as THREE from 'three';
import {
  MeshBVH,
  StaticGeometryGenerator,
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from 'three-mesh-bvh';
import { Pathfinding } from 'three-pathfinding';

/* ═══════════════════════════════════════════════════════════════
   PATCH THREE.JS — accelerate all raycasts with BVH
═══════════════════════════════════════════════════════════════ */
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/* ═══════════════════════════════════════════════════════════════
   ARENA COLLIDER — merge all static environment into one BVH
═══════════════════════════════════════════════════════════════ */
export interface ArenaCollider {
  mesh: THREE.Mesh;
  bvh: MeshBVH;
}

/**
 * Build a single BVH collider from all static meshes in the arena.
 * Call after all environment models are placed in the scene.
 */
export function buildArenaCollider(environmentGroup: THREE.Group): ArenaCollider {
  const staticGen = new StaticGeometryGenerator(environmentGroup);
  staticGen.attributes = ['position']; // only need position for collision

  const mergedGeo = staticGen.generate();
  const bvh = new MeshBVH(mergedGeo);
  mergedGeo.boundsTree = bvh;

  const colliderMesh = new THREE.Mesh(
    mergedGeo,
    new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0, visible: false })
  );

  return { mesh: colliderMesh, bvh };
}

/* ═══════════════════════════════════════════════════════════════
   CAPSULE PLAYER CONTROLLER
   Gravity, ground detection, BVH collision response
═══════════════════════════════════════════════════════════════ */
export interface CapsuleController {
  radius: number;
  height: number;
  segment: THREE.Line3;
  velocity: THREE.Vector3;
  isOnGround: boolean;
  gravity: number;
  speed: number;
}

export function createCapsuleController(radius = 0.4, height = 1.6): CapsuleController {
  return {
    radius,
    height,
    segment: new THREE.Line3(
      new THREE.Vector3(),
      new THREE.Vector3(0, -(height - radius * 2), 0)
    ),
    velocity: new THREE.Vector3(),
    isOnGround: false,
    gravity: -30,
    speed: 10,
  };
}

const _tempVec = new THREE.Vector3();
const _tempVec2 = new THREE.Vector3();
const _tempBox = new THREE.Box3();
const _tempMat = new THREE.Matrix4();
const _tempSeg = new THREE.Line3();

/**
 * Step the capsule controller against the BVH collider.
 * Returns the resolved position.
 */
export function stepCapsule(
  ctrl: CapsuleController,
  position: THREE.Vector3,
  moveInput: THREE.Vector3,
  collider: ArenaCollider | null,
  delta: number,
): THREE.Vector3 {
  // 1. Apply gravity
  if (ctrl.isOnGround) {
    ctrl.velocity.y = delta * ctrl.gravity;
  } else {
    ctrl.velocity.y += delta * ctrl.gravity;
  }

  // 2. Apply movement input
  position.addScaledVector(moveInput, ctrl.speed * delta);
  position.addScaledVector(ctrl.velocity, delta);

  // 3. Skip BVH collision if no collider (fallback to flat ground)
  if (!collider) {
    if (position.y < 0) {
      position.y = 0;
      ctrl.velocity.y = 0;
      ctrl.isOnGround = true;
    }
    return position;
  }

  // 4. BVH capsule collision
  _tempBox.makeEmpty();
  _tempMat.copy(collider.mesh.matrixWorld).invert();
  _tempSeg.copy(ctrl.segment);

  // Transform capsule to collider local space
  _tempSeg.start.add(position).applyMatrix4(_tempMat);
  _tempSeg.end.add(position).applyMatrix4(_tempMat);

  _tempBox.expandByPoint(_tempSeg.start);
  _tempBox.expandByPoint(_tempSeg.end);
  _tempBox.min.addScalar(-ctrl.radius);
  _tempBox.max.addScalar(ctrl.radius);

  collider.bvh.shapecast({
    intersectsBounds: (box) => box.intersectsBox(_tempBox),
    intersectsTriangle: (tri) => {
      const triPoint = _tempVec;
      const capsulePoint = _tempVec2;
      const distance = tri.closestPointToSegment(_tempSeg, triPoint, capsulePoint);
      if (distance < ctrl.radius) {
        const depth = ctrl.radius - distance;
        const direction = capsulePoint.sub(triPoint).normalize();
        _tempSeg.start.addScaledVector(direction, depth);
        _tempSeg.end.addScaledVector(direction, depth);
      }
    },
  });

  // 5. Apply resolved position back to world space
  const newPos = _tempVec.copy(_tempSeg.start).applyMatrix4(collider.mesh.matrixWorld);
  const deltaVec = _tempVec2.subVectors(newPos, position);

  // Ground detection
  ctrl.isOnGround = deltaVec.y > Math.abs(delta * ctrl.velocity.y * 0.25);

  const offset = Math.max(0, deltaVec.length() - 1e-5);
  deltaVec.normalize().multiplyScalar(offset);
  position.add(deltaVec);

  if (!ctrl.isOnGround) {
    deltaVec.normalize();
    ctrl.velocity.addScaledVector(deltaVec, -deltaVec.dot(ctrl.velocity));
  } else {
    ctrl.velocity.set(0, 0, 0);
  }

  // Fall reset
  if (position.y < -25) {
    ctrl.velocity.set(0, 0, 0);
    position.set(0, 2, 0);
  }

  return position;
}

/* ═══════════════════════════════════════════════════════════════
   SPHERE COLLISION — for projectiles hitting cover
═══════════════════════════════════════════════════════════════ */
export function sphereCollidesWithBVH(
  center: THREE.Vector3,
  radius: number,
  collider: ArenaCollider,
): boolean {
  const tempSphere = new THREE.Sphere(center, radius);
  let hit = false;
  collider.bvh.shapecast({
    intersectsBounds: (box) => box.intersectsSphere(tempSphere),
    intersectsTriangle: (tri) => {
      tri.closestPointToPoint(tempSphere.center, _tempVec);
      if (_tempVec.distanceTo(tempSphere.center) < tempSphere.radius) {
        hit = true;
        return true; // early exit
      }
      return false;
    },
  });
  return hit;
}

/* ═══════════════════════════════════════════════════════════════
   NAVMESH — Procedural generation for flat arena
   Creates a walkable navmesh from the arena floor,
   carving out holes where cover objects are placed.
═══════════════════════════════════════════════════════════════ */
export interface NavSystem {
  pathfinding: Pathfinding;
  zone: string;
  groupID: number;
  navmeshHelper?: THREE.Mesh;
}

/**
 * Generate a navmesh from the arena floor geometry.
 * Subdivides a flat plane and marks cells blocked by cover bounds.
 */
export function buildNavmesh(
  arenaSize: number,
  coverBounds: THREE.Box3[],
  debug = false,
): NavSystem {
  const pathfinding = new Pathfinding();
  const ZONE = 'arena';

  // Create subdivided plane for the navmesh
  const resolution = 2; // 2-unit cells
  const halfSize = arenaSize / 2;
  const cells = Math.floor(arenaSize / resolution);

  // Build vertices and faces (triangulated grid)
  const vertices: number[] = [];
  const indices: number[] = [];
  const blocked = new Set<string>();

  // Mark blocked cells
  for (let x = 0; x < cells; x++) {
    for (let z = 0; z < cells; z++) {
      const wx = -halfSize + x * resolution + resolution / 2;
      const wz = -halfSize + z * resolution + resolution / 2;
      const cellCenter = new THREE.Vector3(wx, 0, wz);

      for (const bounds of coverBounds) {
        // Expand bounds slightly for clearance
        const expanded = bounds.clone().expandByScalar(0.5);
        if (expanded.containsPoint(cellCenter)) {
          blocked.add(`${x},${z}`);
          break;
        }
      }
    }
  }

  // Build mesh from unblocked cells
  let vertIndex = 0;
  const vertMap = new Map<string, number>();

  function getVert(x: number, z: number): number {
    const key = `${x},${z}`;
    if (vertMap.has(key)) return vertMap.get(key)!;
    const wx = -halfSize + x * resolution;
    const wz = -halfSize + z * resolution;
    vertices.push(wx, 0, wz);
    const idx = vertIndex++;
    vertMap.set(key, idx);
    return idx;
  }

  for (let x = 0; x < cells; x++) {
    for (let z = 0; z < cells; z++) {
      if (blocked.has(`${x},${z}`)) continue;

      const v0 = getVert(x, z);
      const v1 = getVert(x + 1, z);
      const v2 = getVert(x + 1, z + 1);
      const v3 = getVert(x, z + 1);

      indices.push(v0, v1, v2);
      indices.push(v0, v2, v3);
    }
  }

  // Build geometry
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Initialize pathfinding
  const zoneData = Pathfinding.createZone(geo);
  pathfinding.setZoneData(ZONE, zoneData);
  const groupID = pathfinding.getGroup(ZONE, new THREE.Vector3(0, 0, 0));

  // Debug visualization
  let navmeshHelper: THREE.Mesh | undefined;
  if (debug) {
    navmeshHelper = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0x44ff44,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      })
    );
    navmeshHelper.position.y = 0.05;
  }

  return { pathfinding, zone: ZONE, groupID, navmeshHelper };
}

/**
 * Find a path between two points on the navmesh.
 */
export function findNavPath(
  nav: NavSystem,
  from: THREE.Vector3,
  to: THREE.Vector3,
): THREE.Vector3[] | null {
  try {
    const groupID = nav.pathfinding.getGroup(nav.zone, from);
    const path = nav.pathfinding.findPath(from, to, nav.zone, groupID);
    return path || null;
  } catch {
    return null;
  }
}

/**
 * Get a random walkable point on the navmesh near a center position.
 */
export function randomNavPoint(nav: NavSystem, center: THREE.Vector3, radius: number): THREE.Vector3 | null {
  try {
    const groupID = nav.pathfinding.getGroup(nav.zone, center);
    const node = nav.pathfinding.getRandomNode(nav.zone, groupID, center, radius);
    return node?.centroid?.clone() || null;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ACCELERATED RAYCASTER — for click-to-target, line-of-sight
═══════════════════════════════════════════════════════════════ */
export function createFastRaycaster(): THREE.Raycaster {
  const rc = new THREE.Raycaster();
  rc.firstHitOnly = true; // BVH accelerated — only closest hit
  return rc;
}

/**
 * Check line-of-sight between two points against the arena collider.
 */
export function hasLineOfSight(
  from: THREE.Vector3,
  to: THREE.Vector3,
  collider: ArenaCollider,
): boolean {
  const dir = new THREE.Vector3().subVectors(to, from);
  const dist = dir.length();
  dir.normalize();

  const rc = new THREE.Raycaster(from, dir, 0, dist);
  rc.firstHitOnly = true;
  const hits = rc.intersectObject(collider.mesh);
  return hits.length === 0;
}
