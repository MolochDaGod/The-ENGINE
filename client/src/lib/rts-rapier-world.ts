/**
 * Wargus RTS — Rapier 3D world (fleet SSOT)
 * SI meters · fixed 1/60 · gravity −9.81
 */

import RAPIER from "@dimforge/rapier3d-compat";

export type RtsRapierBody = {
  handle: number;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
};

let rapierReady: Promise<typeof RAPIER> | null = null;

export function ensureRapier(): Promise<typeof RAPIER> {
  if (!rapierReady) {
    rapierReady = Promise.resolve(RAPIER.init({} as never))
      .then(() => RAPIER)
      .catch(() => (RAPIER.init as unknown as () => Promise<void>)().then(() => RAPIER));
  }
  return rapierReady;
}

export const RAPIER_RTS = {
  gravityY: -9.81,
  fixedDt: 1 / 60,
  unitCapsule: { radius: 0.32, halfHeight: 0.55 },
} as const;

export class RtsRapierWorld {
  readonly world: RAPIER.World;
  private _acc = 0;
  private _bodies = new Map<number, RAPIER.RigidBody>();
  private _nextId = 1;

  constructor(gravityY = RAPIER_RTS.gravityY) {
    this.world = new RAPIER.World({ x: 0, y: gravityY, z: 0 });
  }

  static async create(gravityY = RAPIER_RTS.gravityY): Promise<RtsRapierWorld> {
    await ensureRapier();
    return new RtsRapierWorld(gravityY);
  }

  addGroundPlane(): RtsRapierBody {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0));
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(256, 0.05, 256).setTranslation(0, -0.05, 0),
      body,
    );
    return this._track(body, collider);
  }

  addBuildingBox(
    x: number,
    y: number,
    z: number,
    halfW: number,
    halfH: number,
    halfD: number,
  ): RtsRapierBody {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD).setFriction(0.6).setRestitution(0.1),
      body,
    );
    return this._track(body, collider);
  }

  addProjectileSphere(
    x: number,
    y: number,
    z: number,
    radius: number,
    mass: number,
    vx: number,
    vy: number,
    vz: number,
  ): RtsRapierBody {
    const density = Math.max(0.1, mass / ((4 / 3) * Math.PI * radius ** 3));
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinvel(vx, vy, vz)
        .setCcdEnabled(true),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(radius).setDensity(density).setFriction(0.2).setRestitution(0.15),
      body,
    );
    return this._track(body, collider);
  }

  addDebrisBox(
    x: number,
    y: number,
    z: number,
    half: number,
    mass: number,
    vx: number,
    vy: number,
    vz: number,
    wx = 0,
    wy = 0,
    wz = 0,
  ): RtsRapierBody {
    const volume = 8 * half ** 3;
    const density = Math.max(0.1, mass / Math.max(volume, 1e-4));
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinvel(vx, vy, vz)
        .setAngvel({ x: wx, y: wy, z: wz }),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(half, half, half).setDensity(density).setFriction(0.7).setRestitution(0.2),
      body,
    );
    return this._track(body, collider);
  }

  removeBody(entry: RtsRapierBody | null | undefined): void {
    if (!entry) return;
    this._bodies.delete(entry.handle);
    try {
      this.world.removeRigidBody(entry.body);
    } catch {
      /* already removed */
    }
  }

  getTranslation(entry: RtsRapierBody): { x: number; y: number; z: number } {
    const t = entry.body.translation();
    return { x: t.x, y: t.y, z: t.z };
  }

  getRotation(entry: RtsRapierBody): { x: number; y: number; z: number; w: number } {
    const r = entry.body.rotation();
    return { x: r.x, y: r.y, z: r.z, w: r.w };
  }

  step(dt: number): void {
    const fixed = RAPIER_RTS.fixedDt;
    this._acc += Math.min(dt, 0.1);
    let guard = 0;
    while (this._acc >= fixed && guard < 5) {
      this.world.step();
      this._acc -= fixed;
      guard++;
    }
  }

  free(): void {
    this._bodies.clear();
    this.world.free();
  }

  private _track(body: RAPIER.RigidBody, collider: RAPIER.Collider): RtsRapierBody {
    const handle = this._nextId++;
    this._bodies.set(handle, body);
    return { handle, body, collider };
  }
}
