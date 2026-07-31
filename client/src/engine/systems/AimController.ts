/**
 * Grudge Engine — AimController
 *
 * Singleton that turns the player's mouse + camera into a world-space aim
 * direction for ranged attacks, and (optionally) renders a DOM crosshair
 * reticle over the canvas.
 *
 * It resolves where the reticle "points" by casting a THREE.Raycaster from the
 * camera through the cursor (or screen-centre), then doing a CANNON ray against
 * the physics world to find the first scene / target surface. Projectiles fired
 * from a muzzle are then aimed at that world point, so the bolt converges on
 * exactly what the reticle is over — even though the muzzle is offset from the
 * camera (third-person / over-the-shoulder).
 *
 * Usage (from a React page):
 *   const aim = AimController.getInstance();
 *   aim.attach(engine.camera, canvas);
 *   aim.showCrosshair(true);
 *   // … character.fireProjectile() now uses aim.getAimDirection() automatically
 *   // on cleanup:
 *   aim.detach();
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GrudgeEngine } from '../core/GrudgeEngine';
import {
  GROUP_SCENE,
  GROUP_ROLE,
  GROUP_ENEMY,
} from '../core/collisionGroups';

export type AimMode = 'cursor' | 'center';

export class AimController {
  private static _inst: AimController | null = null;

  camera: THREE.PerspectiveCamera | null = null;
  canvas: HTMLElement | null = null;

  /** 'cursor' = aim at the mouse; 'center' = always screen-centre crosshair */
  mode: AimMode = 'cursor';

  /** How far to cast when nothing is hit (fallback aim point distance) */
  maxDistance = 200;

  /** Which physics groups the aim ray can land on */
  aimMask = GROUP_SCENE | GROUP_ENEMY | GROUP_ROLE;

  /** Normalised device coords of the reticle (-1..1), default centre */
  private _ndc = new THREE.Vector2(0, 0);

  private _raycaster = new THREE.Raycaster();
  private _from = new CANNON.Vec3();
  private _to = new CANNON.Vec3();
  private _result = new CANNON.RaycastResult();

  // Reused scratch
  private _aimPoint = new THREE.Vector3();
  private _dir = new THREE.Vector3();

  // DOM crosshair
  private _crosshair: HTMLDivElement | null = null;

  // Bound listeners
  private _onMouseMove = (e: MouseEvent) => this._updateNdcFromMouse(e);

  private constructor() {}

  static getInstance(): AimController {
    if (!AimController._inst) AimController._inst = new AimController();
    return AimController._inst;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  attach(camera: THREE.PerspectiveCamera, canvas?: HTMLElement): void {
    this.camera = camera;
    this.canvas = canvas ?? null;
    window.addEventListener('mousemove', this._onMouseMove);
  }

  detach(): void {
    window.removeEventListener('mousemove', this._onMouseMove);
    this.showCrosshair(false);
    this.camera = null;
    this.canvas = null;
  }

  isReady(): boolean {
    return !!this.camera;
  }

  setMode(mode: AimMode): void {
    this.mode = mode;
    if (mode === 'center') this._ndc.set(0, 0);
  }

  // ── Input ────────────────────────────────────────────────────────────────

  private _updateNdcFromMouse(e: MouseEvent): void {
    if (this.mode === 'center') return;
    const rect = this.canvas?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    const w = rect?.width ?? window.innerWidth;
    const h = rect?.height ?? window.innerHeight;
    this._ndc.x = ((e.clientX - left) / w) * 2 - 1;
    this._ndc.y = -(((e.clientY - top) / h) * 2 - 1);
    if (this._crosshair) {
      this._crosshair.style.left = `${e.clientX - left}px`;
      this._crosshair.style.top = `${e.clientY - top}px`;
    }
  }

  // ── Aim resolution ─────────────────────────────────────────────────────────

  /**
   * World-space point the reticle is currently over. Falls back to a point far
   * along the camera ray when nothing is hit.
   */
  getAimPoint(): THREE.Vector3 {
    const cam = this.camera;
    if (!cam) return this._aimPoint.set(0, 0, 0);

    this._raycaster.setFromCamera(this._ndc, cam);
    const origin = this._raycaster.ray.origin;
    const dir = this._raycaster.ray.direction;

    this._from.set(origin.x, origin.y, origin.z);
    this._to.set(
      origin.x + dir.x * this.maxDistance,
      origin.y + dir.y * this.maxDistance,
      origin.z + dir.z * this.maxDistance,
    );
    this._result.reset();
    GrudgeEngine.getInstance().world.raycastClosest(
      this._from,
      this._to,
      { collisionFilterMask: this.aimMask, skipBackfaces: false },
      this._result,
    );

    if (this._result.hasHit) {
      const hp = this._result.hitPointWorld;
      this._aimPoint.set(hp.x, hp.y, hp.z);
    } else {
      this._aimPoint.set(this._to.x, this._to.y, this._to.z);
    }
    return this._aimPoint;
  }

  /**
   * Normalised direction from a muzzle `origin` toward the reticle's world
   * point. This is what BaseCharacter.fireProjectile() consumes.
   */
  getAimDirection(origin: THREE.Vector3): THREE.Vector3 {
    const point = this.getAimPoint();
    this._dir.copy(point).sub(origin);
    if (this._dir.lengthSq() < 1e-8) this._dir.set(0, 0, 1);
    return this._dir.normalize().clone();
  }

  // ── Crosshair DOM reticle ──────────────────────────────────────────────────

  showCrosshair(show: boolean): void {
    if (show) {
      if (this._crosshair) return;
      const el = document.createElement('div');
      el.style.cssText = [
        'position:absolute',
        'width:22px',
        'height:22px',
        'margin:-11px 0 0 -11px',
        'pointer-events:none',
        'z-index:25',
        'border:2px solid rgba(255,210,127,0.9)',
        'border-radius:50%',
        'box-shadow:0 0 6px rgba(0,0,0,0.6),inset 0 0 4px rgba(255,210,127,0.5)',
      ].join(';');
      // centre dot
      const dot = document.createElement('div');
      dot.style.cssText = [
        'position:absolute',
        'left:50%',
        'top:50%',
        'width:2px',
        'height:2px',
        'margin:-1px 0 0 -1px',
        'background:rgba(255,210,127,0.95)',
        'border-radius:50%',
      ].join(';');
      el.appendChild(dot);

      // Centre it initially
      if (this.mode === 'center') {
        el.style.left = '50%';
        el.style.top = '50%';
      }

      const host = (this.canvas?.parentElement ?? document.body) as HTMLElement;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.appendChild(el);
      this._crosshair = el;
    } else if (this._crosshair) {
      this._crosshair.remove();
      this._crosshair = null;
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(): void {
    this.detach();
    AimController._inst = null;
  }
}
