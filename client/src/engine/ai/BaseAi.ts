/**
 * Grudge Engine — BaseAi
 *
 * Direct TypeScript port of gonnavis/annihilate/src/Ai.js
 *
 * Behaviour:
 *   1. A CANNON trigger sphere (GROUP_TRIGGER) detects when a role enters range
 *   2. beginContact  → setTarget(role)
 *   3. endContact    → setTarget(null)
 *   4. update(dt):
 *        - If target: face target, run toward it, attack when in range
 *        - If no target: walk back toward initialPosition
 *        - detector sphere always follows character body position
 *
 * Override attack() in subclasses for custom attack logic.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseCharacter } from '../character/BaseCharacter';
import { GrudgeEngine, Updatable } from '../core/GrudgeEngine';
import { GROUP_TRIGGER, GROUP_ROLE } from '../core/collisionGroups';

export class BaseAi implements Updatable {
  character:    BaseCharacter;
  target:       BaseCharacter | null = null;
  distance:     number;
  enabled:      boolean = true;
  isAttack:     boolean = true;
  isMove:       boolean = true;

  protected _engine:          GrudgeEngine;
  protected _detector:        CANNON.Body;
  protected _initialPos:      THREE.Vector3;
  protected _tmpVec2:         THREE.Vector2 = new THREE.Vector2();
  private   _posToleranceSq:  number;

  constructor(
    character:          BaseCharacter,
    distance            = 1,
    initialPosTolerance = 1,
  ) {
    this.character        = character;
    this.distance         = distance;
    this._posToleranceSq  = initialPosTolerance ** 2;
    this._engine          = GrudgeEngine.getInstance();

    // Store the spawn position as the "home" position
    this._initialPos = new THREE.Vector3(
      character.body.position.x,
      character.body.position.y,
      character.body.position.z
    );

    // Build detector sphere
    this._detector = new CANNON.Body({
      mass: 0,
      collisionFilterGroup: GROUP_TRIGGER,
      collisionFilterMask:  GROUP_ROLE,
    });
    (this._detector as any).collisionResponse = false;
    (this._detector as any).belongTo = this;

    const detectorRadius = (character as any).detectorRadius ?? 8;
    this._detector.addShape(new CANNON.Sphere(detectorRadius));
    this._engine.world.addBody(this._detector);

    // beginContact / endContact arrive via world-level bubbling in GrudgeEngine
    this._detector.addEventListener('beginContact', (event: any) => {
      const contacted: BaseCharacter | null = event.body?.belongTo ?? null;
      if (contacted?.isCharacter) this.setTarget(contacted);
    });
    this._detector.addEventListener('endContact', (event: any) => {
      const contacted: BaseCharacter | null = event.body?.belongTo ?? null;
      if (contacted === this.target) this.setTarget(null);
    });

    this._engine.addToUpdate(this);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setTarget(target: BaseCharacter | null): void { this.target = target; }
  setDistance(d: number): void { this.distance = d; }

  // ── Per-frame update (exact port from Ai.js) ───────────────────────────────

  update(dt: number): void {
    if (!this.enabled) return;

    if (this.target) {
      // Face and move toward target
      this.character.direction.x = this.target.body.position.x - this.character.body.position.x;
      this.character.direction.y = this.target.body.position.z - this.character.body.position.z;

      if (this.character.service.hasTag('canFacing')) {
        this.character.facing.copy(this.character.direction);
        if (this.character.mesh) {
          this.character.mesh.rotation.y = -this.character.facing.angle() + Math.PI / 2;
        }
      }

      if (this.isMove && this.character.direction.length() > this.distance) {
        this.character.service.send('run');
        this.character.direction.normalize().multiplyScalar(this.character.speed * dt * 60);
        if (this.character.service.hasTag('canMove')) {
          this.character.body.position.x += this.character.direction.x;
          this.character.body.position.z += this.character.direction.y;
        }
      } else {
        if (this.isAttack) {
          this.attack();
        } else {
          this.character.service.send('stop');
        }
      }
    } else if (
      this.isMove &&
      this._tmpVec2
        .set(
          this.character.body.position.x - this._initialPos.x,
          this.character.body.position.z - this._initialPos.z
        )
        .lengthSq() > this._posToleranceSq
    ) {
      // Return to spawn position
      this.character.direction.x = this._initialPos.x - this.character.body.position.x;
      this.character.direction.y = this._initialPos.z - this.character.body.position.z;

      this.character.service.send('run');
      this.character.facing.copy(this.character.direction);

      if (this.character.service.hasTag('canMove')) {
        this.character.mesh.rotation.y = -this.character.facing.angle() + Math.PI / 2;
      }

      this.character.direction.normalize().multiplyScalar(this.character.speed * dt * 60);
      if (this.isMove && this.character.service.hasTag('canMove')) {
        this.character.body.position.x += this.character.direction.x;
        this.character.body.position.z += this.character.direction.y;
      }
    } else {
      this.character.service.send('stop');
    }

    // Detector always follows character
    this._detector.position.copy(this.character.body.position);
  }

  /** Override in subclasses for custom attack behaviour */
  attack(): void {
    this.character.service.send('attack');
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(): void {
    this._engine.removeFromUpdate(this);
    this._engine.world.removeBody(this._detector);
  }
}
