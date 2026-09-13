/**
 * Grudge Engine — Projectile / ProjectileSystem
 *
 * A robust, engine-level ranged-attack projectile system used by the
 * RangedAttack state (and any FSM via BaseCharacter.fireProjectile()).
 *
 * Design goals:
 *   - NO tunnelling: each frame we sweep a raycast from the projectile's
 *     previous position to its new position (world.raycastClosest), so even
 *     very fast arrows / bullets reliably hit thin targets and walls.
 *   - Owner-aware hit detection: a role's projectile hits enemies + scene;
 *     an enemy's projectile hits the role + scene. Never hits its owner.
 *   - Optional gravity (arcing arrows) vs. flat hitscan-ish bolts.
 *   - Damage routing through CombatSystem when characters are registered,
 *     with a takeDamage()/hit() fallback for un-registered characters.
 *   - Pooled meshes + lightweight impact VFX, all ticked by the engine loop.
 *
 * Usage:
 *   const sys = ProjectileSystem.getInstance();
 *   sys.spawn({ owner, origin, direction, speed: 60, damage: 18 });
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GrudgeEngine, Updatable } from '../core/GrudgeEngine';
import {
  GROUP_SCENE,
  GROUP_ROLE,
  GROUP_ENEMY,
} from '../core/collisionGroups';
import { CombatSystem } from './CombatSystem';
import type { DamageType } from './CharacterStats';

// ─── Owner shape ──────────────────────────────────────────────────────────────
// Structural type — avoids a runtime import of BaseCharacter (no import cycle).
export interface ProjectileOwner {
  body: CANNON.Body;
  isEnemy?: boolean;
  isCharacter?: boolean;
  /** CombatSystem registry id (optional) */
  combatId?: string;
  health?: number;
  hit?: (event?: unknown) => void;
  takeDamage?: (amount: number) => void;
}

export interface ProjectileHitContext {
  owner: ProjectileOwner | null;
  /** The character that was hit, if any (else null for scene hits) */
  target: ProjectileOwner | null;
  point: THREE.Vector3;
  damage: number;
  damageType: DamageType;
}

export interface ProjectileSpawnOptions {
  owner: ProjectileOwner;
  /** Muzzle position in world space */
  origin: THREE.Vector3;
  /** Travel direction (need not be normalized) */
  direction: THREE.Vector3;
  /** units/sec (default 60) */
  speed?: number;
  /** damage applied on character hit (default 15) */
  damage?: number;
  damageType?: DamageType;
  /** downward accel in units/sec^2 — 0 = flat bolt, ~12 = arcing arrow (default 0) */
  gravity?: number;
  /** seconds before auto-despawn (default 3) */
  lifetime?: number;
  /** max travel distance before auto-despawn (default 120) */
  range?: number;
  /** visual radius (default 0.18) */
  radius?: number;
  /** visual colour (default warm amber) */
  color?: number;
  /** override the raycast collision mask (defaults derived from owner) */
  collisionMask?: number;
  /** extra callback fired on any hit (character or scene) */
  onHit?: (ctx: ProjectileHitContext) => void;
}

// ─── Projectile ─────────────────────────────────────────────────────────────

class Projectile {
  alive = false;
  mesh: THREE.Mesh;

  owner: ProjectileOwner | null = null;
  readonly pos = new THREE.Vector3();
  readonly prev = new THREE.Vector3();
  readonly vel = new THREE.Vector3();

  speed = 60;
  damage = 15;
  damageType: DamageType = 'physical';
  gravity = 0;
  lifetime = 3;
  range = 120;
  collisionMask = GROUP_SCENE | GROUP_ENEMY;
  onHit: ((ctx: ProjectileHitContext) => void) | null = null;

  age = 0;
  traveled = 0;

  // Reused CANNON scratch objects (no per-frame allocation)
  private _from = new CANNON.Vec3();
  private _to = new CANNON.Vec3();
  private _result = new CANNON.RaycastResult();
  private _up = new THREE.Vector3(0, 1, 0);

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false;
    this.mesh.castShadow = false;
  }

  /** Orient the (Y-axis) mesh so its long axis points along velocity. */
  private _orient(): void {
    if (this.vel.lengthSq() < 1e-8) return;
    const dir = this.vel.clone().normalize();
    this.mesh.quaternion.setFromUnitVectors(this._up, dir);
  }

  reset(opts: ProjectileSpawnOptions): void {
    this.owner = opts.owner;
    this.speed = opts.speed ?? 60;
    this.damage = opts.damage ?? 15;
    this.damageType = opts.damageType ?? 'physical';
    this.gravity = opts.gravity ?? 0;
    this.lifetime = opts.lifetime ?? 3;
    this.range = opts.range ?? 120;
    this.onHit = opts.onHit ?? null;

    // Derive who this can hit: never the owner's own group.
    const ownerIsEnemy = !!opts.owner.isEnemy;
    const targetCharGroup = ownerIsEnemy ? GROUP_ROLE : GROUP_ENEMY;
    this.collisionMask = opts.collisionMask ?? (GROUP_SCENE | targetCharGroup);

    this.pos.copy(opts.origin);
    this.prev.copy(opts.origin);
    this.vel.copy(opts.direction);
    if (this.vel.lengthSq() < 1e-8) this.vel.set(0, 0, 1);
    this.vel.normalize().multiplyScalar(this.speed);

    this.age = 0;
    this.traveled = 0;
    this.alive = true;
    this.mesh.position.copy(this.pos);
    this._orient();
    this.mesh.visible = true;
  }

  /** @returns the hit context if it hit something this frame, else null. */
  step(dt: number): ProjectileHitContext | null {
    this.prev.copy(this.pos);

    if (this.gravity) this.vel.y -= this.gravity * dt;

    const stepVec = this.vel.clone().multiplyScalar(dt);
    this.pos.add(stepVec);
    this.traveled += stepVec.length();
    this.age += dt;

    // Swept raycast prev → pos against the world (continuous collision).
    const world = GrudgeEngine.getInstance().world;
    this._from.set(this.prev.x, this.prev.y, this.prev.z);
    this._to.set(this.pos.x, this.pos.y, this.pos.z);
    this._result.reset();
    world.raycastClosest(
      this._from,
      this._to,
      { collisionFilterMask: this.collisionMask, skipBackfaces: false },
      this._result,
    );

    if (this._result.hasHit) {
      const body: any = this._result.body;
      const belong = body?.belongTo ?? null;
      // Ignore self-hits defensively (mask should already exclude owner group).
      if (belong && belong === this.owner) {
        // continue past owner
      } else {
        const hp = this._result.hitPointWorld;
        const point = new THREE.Vector3(hp.x, hp.y, hp.z);
        const target: ProjectileOwner | null =
          belong && belong.isCharacter ? belong : null;
        return {
          owner: this.owner,
          target,
          point,
          damage: this.damage,
          damageType: this.damageType,
        };
      }
    }

    this.mesh.position.copy(this.pos);
    this._orient();
    return null;
  }

  shouldExpire(): boolean {
    return this.age >= this.lifetime || this.traveled >= this.range;
  }

  retire(): void {
    this.alive = false;
    this.mesh.visible = false;
  }
}

// ─── Impact VFX ───────────────────────────────────────────────────────────────

interface Impact {
  mesh: THREE.Mesh;
  ttl: number;
  age: number;
}

// ─── ProjectileSystem ─────────────────────────────────────────────────────────

export class ProjectileSystem implements Updatable {
  private static _inst: ProjectileSystem | null = null;

  private _engine: GrudgeEngine;
  private _active: Projectile[] = [];
  private _pool: Projectile[] = [];
  private _impacts: Impact[] = [];

  // Shared resources
  private _geo: THREE.BufferGeometry;
  private _impactGeo: THREE.BufferGeometry;
  private _baseColor = 0xffcc55;

  private constructor() {
    this._engine = GrudgeEngine.getInstance();
    // Thin elongated bolt (long axis = Y so we can orient via setFromUnitVectors).
    this._geo = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6);
    this._impactGeo = new THREE.SphereGeometry(1, 10, 10);
    this._engine.addToUpdate(this);
  }

  static getInstance(): ProjectileSystem {
    if (!ProjectileSystem._inst) ProjectileSystem._inst = new ProjectileSystem();
    return ProjectileSystem._inst;
  }

  // ── Spawn ────────────────────────────────────────────────────────────────

  spawn(opts: ProjectileSpawnOptions): void {
    const p = this._pool.pop() ?? this._createProjectile(opts.color);
    // Re-tint pooled mesh if a custom colour was requested.
    if (opts.color !== undefined) {
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(opts.color);
    }
    p.reset(opts);
    if (!p.mesh.parent) this._engine.scene.add(p.mesh);
    this._active.push(p);
  }

  private _createProjectile(color?: number): Projectile {
    const mat = new THREE.MeshBasicMaterial({ color: color ?? this._baseColor });
    return new Projectile(this._geo, mat);
  }

  // ── Update (engine loop) ───────────────────────────────────────────────────

  update(dt: number): void {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      const hit = p.step(dt);

      if (hit) {
        this._handleHit(hit);
        this._spawnImpact(hit.point);
        p.onHit?.(hit);
        this._recycle(i);
        continue;
      }
      if (p.shouldExpire()) {
        this._recycle(i);
      }
    }

    this._updateImpacts(dt);
  }

  private _recycle(activeIndex: number): void {
    const p = this._active[activeIndex];
    p.retire();
    this._active.splice(activeIndex, 1);
    this._pool.push(p);
  }

  // ── Hit resolution ─────────────────────────────────────────────────────────

  private _handleHit(ctx: ProjectileHitContext): void {
    const { owner, target, damage, damageType } = ctx;
    if (target && target !== owner) {
      const combat = CombatSystem.getInstance();
      const ownerId = owner?.combatId;
      const targetId = target.combatId;
      const routed =
        ownerId && targetId &&
        combat.getStats(ownerId) && combat.getStats(targetId);

      if (routed) {
        combat.dealDamage(ownerId!, targetId!, damage, damageType);
        // CombatSystem only mutates stats — trigger the flinch animation.
        if ((target.health ?? 1) > 0) target.hit?.();
      } else if (typeof target.takeDamage === 'function') {
        // takeDamage() already sends the 'hit'/'dead' FSM events.
        target.takeDamage(damage);
      } else {
        target.hit?.();
      }
    }
  }

  // ── Impact VFX ───────────────────────────────────────────────────────────

  private _spawnImpact(point: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd27f,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this._impactGeo, mat);
    mesh.position.copy(point);
    mesh.scale.setScalar(0.15);
    this._engine.scene.add(mesh);
    this._impacts.push({ mesh, ttl: 0.22, age: 0 });
  }

  private _updateImpacts(dt: number): void {
    for (let i = this._impacts.length - 1; i >= 0; i--) {
      const imp = this._impacts[i];
      imp.age += dt;
      const t = imp.age / imp.ttl;
      const s = 0.15 + t * 0.8;
      imp.mesh.scale.setScalar(s);
      (imp.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
      if (imp.age >= imp.ttl) {
        this._engine.scene.remove(imp.mesh);
        (imp.mesh.material as THREE.Material).dispose();
        this._impacts.splice(i, 1);
      }
    }
  }

  // ── Queries / cleanup ──────────────────────────────────────────────────────

  get activeCount(): number { return this._active.length; }

  /** Remove all in-flight projectiles (e.g. on match reset). */
  clear(): void {
    for (const p of this._active) p.retire();
    this._pool.push(...this._active);
    this._active.length = 0;
    for (const imp of this._impacts) {
      this._engine.scene.remove(imp.mesh);
      (imp.mesh.material as THREE.Material).dispose();
    }
    this._impacts.length = 0;
  }

  destroy(): void {
    this.clear();
    for (const p of this._pool) {
      if (p.mesh.parent) this._engine.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    this._pool.length = 0;
    this._geo.dispose();
    this._impactGeo.dispose();
    this._engine.removeFromUpdate(this);
    ProjectileSystem._inst = null;
  }
}
