/**
 * Grudge Engine — Attacker
 *
 * Direct TypeScript port of gonnavis/annihilate/src/Attacker.js
 *
 * Creates one or more CANNON.Body physics bodies that:
 *   - Pass through other bodies (collisionResponse = false)
 *   - Have no mass, but are DYNAMIC so they fire `collide` events
 *   - Only damage targets when owner's FSM has tag 'canDamage'
 *   - Track collidings[] to distinguish begin vs continuing contact
 *
 * Usage:
 *   class GreatSword extends Attacker {
 *     collide(event, isBegin) {
 *       if (!isBegin) return;
 *       super.collide(event, isBegin);
 *     }
 *   }
 *   sword.owner = maria;
 *   sword.bodies.forEach(b => engine.world.addBody(b));
 */

import * as CANNON from 'cannon-es';
import { BaseCharacter } from './BaseCharacter';
import {
  GROUP_ROLE_ATTACKER,
  GROUP_ENEMY,
  GROUP_ENEMY_ATTACKER,
  GROUP_ENEMY_SHIELD,
} from '../core/collisionGroups';
import { GrudgeEngine, Updatable } from '../core/GrudgeEngine';

export class Attacker implements Updatable {
  isAttacker = true;

  owner: BaseCharacter | null = null;
  bodies: CANNON.Body[] = [];
  body:   CANNON.Body;         // convenience alias for bodies[0]

  protected _engine: GrudgeEngine;

  constructor({
    num               = 1,
    collisionGroup    = GROUP_ROLE_ATTACKER,
    collisionMask     = GROUP_ENEMY | GROUP_ENEMY_ATTACKER | GROUP_ENEMY_SHIELD,
    addToWorld        = true,
  } = {}) {
    this._engine = GrudgeEngine.getInstance();

    for (let i = 0; i < num; i++) {
      const body = new CANNON.Body({
        mass:  0,
        type:  CANNON.BODY_TYPES.DYNAMIC,
        collisionFilterGroup: collisionGroup,
        collisionFilterMask:  collisionMask,
      });
      // pass-through — we only want the contact information, not physics response
      (body as any).collisionResponse = false;
      (body as any).belongTo = this;

      // Track which bodies are currently in contact (to detect begin vs continue)
      (body as any).collidings = [] as CANNON.Body[];

      body.addEventListener('collide', (event: any) => {
        const collidings: CANNON.Body[] = (body as any).collidings;
        const isBeginCollide = !collidings.includes(event.body);
        if (isBeginCollide) collidings.push(event.body);
        this.collide(event, isBeginCollide);
      });

      body.addEventListener('endContact', (event: any) => {
        const collidings: CANNON.Body[] = (body as any).collidings;
        const idx = collidings.indexOf(event.body);
        if (idx !== -1) collidings.splice(idx, 1);
        this.endContact(event);
      });

      this.bodies.push(body);
      if (addToWorld) this._engine.world.addBody(body);
    }

    this.body = this.bodies[0];
    this._engine.addToUpdate(this);
  }

  // ── Updatable ──────────────────────────────────────────────────────────────

  update(_dt: number): void {
    // Subclasses track weapon bone position each frame here
  }

  // ── Collision callbacks — override in subclasses ───────────────────────────

  /**
   * Called on every collision event.
   * isBeginCollide = true on first contact frame.
   *
   * Default: when canDamage tag is set on owner, call target.hit()
   */
  collide(event: any, isBeginCollide: boolean): void {
    if (!isBeginCollide) return;
    if (!this.owner) return;
    if (!this.owner.service.hasTag('canDamage')) return;

    const target: BaseCharacter | null = event.body?.belongTo ?? null;
    if (!target || !target.isCharacter) return;
    if (target === this.owner) return;

    target.hit(event);
  }

  endContact(_event: any): void {}

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(): void {
    this._engine.removeFromUpdate(this);
    this.bodies.forEach(b => this._engine.world.removeBody(b));
    this.bodies = [];
  }
}
