/**
 * AI locomotion driver for grudge-control — injects movement via setInput().
 * Patterns from artifact animator FighterBrain + Grudge Engine BaseAi.
 */
import * as THREE from 'three';
import type { playerController } from 'grudge-control';
import { GrudgeEngine, Updatable } from '../core/GrudgeEngine';
import { buildOWR, strikeQuality, damageScaleForQuality, meleeStrike } from './combatResolver';

export interface AiTarget {
  getPosition(): THREE.Vector3;
  getCombatRange(): [number, number];
  isAlive(): boolean;
}

export interface GrudgeFighterAiOptions {
  locomotion: playerController;
  homePosition?: THREE.Vector3;
  engagePadding?: number;
  attackCooldownMs?: number;
  damageScale?: number;
  skillForce?: number;
}

/**
 * Lightweight fighter AI: chase target, respect OWR range, inject WASD via setInput.
 * Does not own animation — locomotion backend handles walk/run blend.
 */
export class GrudgeFighterAi implements Updatable {
  enabled = true;
  target: AiTarget | null = null;

  private readonly _loco: playerController;
  private readonly _engine: GrudgeEngine;
  private readonly _home: THREE.Vector3;
  private readonly _engagePad: number;
  private readonly _attackCd: number;
  private readonly _damageScale: number;
  private readonly _skillForce: number;
  private _lastAttack = 0;
  private _tmp = new THREE.Vector3();

  constructor(opts: GrudgeFighterAiOptions) {
    this._loco = opts.locomotion;
    this._engine = GrudgeEngine.getInstance();
    this._home = opts.homePosition?.clone() ?? new THREE.Vector3();
    this._engagePad = opts.engagePadding ?? 0.8;
    this._attackCd = opts.attackCooldownMs ?? 1400;
    this._damageScale = opts.damageScale ?? 0.85;
    this._skillForce = opts.skillForce ?? 14;
    this._engine.addToUpdate(this);
  }

  setTarget(t: AiTarget | null): void {
    this.target = t;
  }

  update(dt: number): void {
    if (!this.enabled) return;

    this._loco.offAllEvent();

    const pos = this._loco.getPosition();
    let moveX = 0;
    let moveY = 0;
    let shift = false;

    if (this.target?.isAlive()) {
      const tpos = this.target.getPosition();
      const dx = tpos.x - pos.x;
      const dz = tpos.z - pos.z;
      const dist = Math.hypot(dx, dz);
      const [rMin, rMax] = this.target.getCombatRange();
      const owr = buildOWR([rMin, rMax]);
      const engage = owr.outer + this._engagePad;

      if (dist > engage) {
        moveY = 1;
        shift = dist > engage * 1.8;
      } else if (dist < owr.inner) {
        moveY = -1;
      } else {
        const q = strikeQuality(dist, owr, buildOWR([0.5, 1.2]));
        if (q === 'clean' || q === 'punish') {
          this._tryAttack(dist, rMin, rMax, q);
        } else if (dist > owr.optimalMax) {
          moveY = 1;
        }
      }

      // Face movement direction via look deltas (camera-relative strafe)
      if (moveY !== 0 || moveX !== 0) {
        const angle = Math.atan2(dx, dz);
        const yaw = this._loco.getPosition(); // position only; facing handled by locomotion
        void yaw;
        void angle;
      }
    } else {
      const hdx = this._home.x - pos.x;
      const hdz = this._home.z - pos.z;
      if (Math.hypot(hdx, hdz) > 1.2) {
        moveY = 1;
      }
    }

    this._loco.setInput({
      moveX: moveX as -1 | 0 | 1,
      moveY: moveY as -1 | 0 | 1,
      lookDeltaX: 0,
      lookDeltaY: 0,
      jump: false,
      shift,
      toggleView: false,
      toggleFly: false,
      toggleVehicle: false,
    });
  }

  private _tryAttack(
    dist: number,
    rMin: number,
    rMax: number,
    quality: ReturnType<typeof strikeQuality>,
  ): void {
    const now = performance.now();
    if (now - this._lastAttack < this._attackCd) return;
    this._lastAttack = now;

    const strike = meleeStrike(
      { intensity: 55, range: [rMin, rMax] },
      { skillForce: this._skillForce, damageScale: this._damageScale * damageScaleForQuality(quality) },
    );
    void strike;
    void dist;
    // Host game wires onAttack callback to play combat anim + apply damage
    this.onAttack?.(strike);
  }

  /** Fired when AI commits a strike — wire to Character.playRole('attack') etc. */
  onAttack?: (strike: ReturnType<typeof meleeStrike>) => void;

  dispose(): void {
    this._loco.onAllEvent();
  }
}