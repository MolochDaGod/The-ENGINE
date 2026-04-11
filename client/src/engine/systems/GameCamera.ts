/**
 * Grudge Engine — GameCamera
 *
 * Manages all camera modes for Grudge 3D games.
 * Replaces the static camera follow in GrudgeEngine.ts with a full system.
 *
 * Modes:
 *   FOLLOW     — over-the-shoulder (Fortnite style per Grudge rules)
 *                W always moves forward away from camera
 *   ISOMETRIC  — fixed 45° view, camera follows at fixed offset
 *   ORBIT      — free orbit around target with mouse drag
 *   FREE       — no target, fly camera with WASD+mouse
 *
 * Features:
 *   - Smooth lerp / slerp transitions between positions
 *   - Impact shake (trigger on damage events)
 *   - FOV zoom on sprint / dash
 *   - Camera can be overridden per-game and still falls back to engine defaults
 *
 * Usage:
 *   const cam = GameCamera.getInstance(engine.camera);
 *   cam.setMode('FOLLOW');
 *   cam.setTarget(maria.mesh);
 *   cam.update(dt);  // call from game loop
 */

import * as THREE from 'three';

export type CameraMode = 'FOLLOW' | 'ISOMETRIC' | 'ORBIT' | 'FREE';

export interface CameraConfig {
  distance:     number;   // follow distance (m)
  height:       number;   // camera height above target
  lerpAlpha:    number;   // position lerp speed (0–1 per frame)
  lookAhead:    number;   // look slightly ahead of character
  fov:          number;   // base FOV
  fovSprint:    number;   // FOV when sprinting
}

const DEFAULT_CONFIGS: Record<CameraMode, CameraConfig> = {
  FOLLOW:     { distance: 8,  height: 4,  lerpAlpha: 0.12, lookAhead: 2,  fov: 70, fovSprint: 80 },
  ISOMETRIC:  { distance: 20, height: 20, lerpAlpha: 0.10, lookAhead: 0,  fov: 45, fovSprint: 45 },
  ORBIT:      { distance: 12, height: 6,  lerpAlpha: 0.15, lookAhead: 0,  fov: 60, fovSprint: 60 },
  FREE:       { distance: 0,  height: 0,  lerpAlpha: 1.00, lookAhead: 0,  fov: 70, fovSprint: 80 },
};

export class GameCamera {
  private static _inst: GameCamera | null = null;

  camera:  THREE.PerspectiveCamera;
  mode:    CameraMode = 'FOLLOW';
  target:  THREE.Object3D | null = null;
  config:  CameraConfig;

  // Orbit state
  orbitTheta = 0;    // horizontal angle
  orbitPhi   = 0.4;  // vertical angle (radians)

  // Shake
  private _shakeMag:  number = 0;
  private _shakeDecay: number = 0.92;

  // Lerp targets
  private _desiredPos = new THREE.Vector3();
  private _currentPos = new THREE.Vector3();
  private _lookTarget = new THREE.Vector3();

  // Sprint FOV
  private _currentFov: number;
  isSprinting = false;

  private constructor(camera: THREE.PerspectiveCamera, mode: CameraMode = 'FOLLOW') {
    this.camera = camera;
    this.mode   = mode;
    this.config = { ...DEFAULT_CONFIGS[mode] };
    this._currentFov = this.config.fov;
    this._currentPos.copy(camera.position);
  }

  static getInstance(camera?: THREE.PerspectiveCamera): GameCamera {
    if (!GameCamera._inst) {
      if (!camera) throw new Error('[GameCamera] Pass camera on first call');
      GameCamera._inst = new GameCamera(camera);
    }
    return GameCamera._inst;
  }

  // ── Mode / target ──────────────────────────────────────────────────────────

  setMode(mode: CameraMode): void {
    this.mode   = mode;
    this.config = { ...DEFAULT_CONFIGS[mode] };
  }

  setTarget(target: THREE.Object3D | null): void {
    this.target = target;
  }

  configure(partial: Partial<CameraConfig>): void {
    Object.assign(this.config, partial);
  }

  // ── Shake ──────────────────────────────────────────────────────────────────

  shake(magnitude = 0.3): void {
    this._shakeMag = Math.max(this._shakeMag, magnitude);
  }

  // ── Per-frame update (call from game loop) ────────────────────────────────

  update(dt: number): void {
    if (!this.target) return;
    const targetPos = this.target.position;

    switch (this.mode) {
      case 'FOLLOW':    this._updateFollow(targetPos, dt);    break;
      case 'ISOMETRIC': this._updateIsometric(targetPos, dt); break;
      case 'ORBIT':     this._updateOrbit(targetPos, dt);     break;
      case 'FREE':      /* handled externally */               break;
    }

    // FOV lerp
    const targetFov = this.isSprinting ? this.config.fovSprint : this.config.fov;
    this._currentFov += (targetFov - this._currentFov) * 0.08;
    this.camera.fov = this._currentFov;
    this.camera.updateProjectionMatrix();

    // Shake
    if (this._shakeMag > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this._shakeMag;
      this.camera.position.y += (Math.random() - 0.5) * this._shakeMag;
      this._shakeMag *= this._shakeDecay;
    }
  }

  private _updateFollow(targetPos: THREE.Vector3, _dt: number): void {
    const { distance, height, lerpAlpha, lookAhead } = this.config;

    // Camera sits behind the character at a fixed world-space offset
    // (the character's rotation determines "behind")
    const targetRot = (this.target as any).rotation?.y ?? 0;
    const dx = Math.sin(targetRot) * distance;
    const dz = Math.cos(targetRot) * distance;

    this._desiredPos.set(targetPos.x + dx, targetPos.y + height, targetPos.z + dz);

    // Lerp camera to desired position
    this._currentPos.lerp(this._desiredPos, lerpAlpha);
    this.camera.position.copy(this._currentPos);

    // Look slightly ahead
    this._lookTarget.set(
      targetPos.x - dx * lookAhead * 0.1,
      targetPos.y + height * 0.3,
      targetPos.z - dz * lookAhead * 0.1,
    );
    this.camera.lookAt(this._lookTarget);
  }

  private _updateIsometric(targetPos: THREE.Vector3, _dt: number): void {
    const { distance, height, lerpAlpha } = this.config;
    this._desiredPos.set(
      targetPos.x + distance * 0.7,
      targetPos.y + height,
      targetPos.z + distance * 0.7,
    );
    this._currentPos.lerp(this._desiredPos, lerpAlpha);
    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(targetPos);
  }

  private _updateOrbit(targetPos: THREE.Vector3, _dt: number): void {
    const { distance, lerpAlpha } = this.config;
    const phi   = Math.max(0.1, Math.min(Math.PI / 2.2, this.orbitPhi));
    const x = targetPos.x + distance * Math.sin(this.orbitTheta) * Math.cos(phi);
    const y = targetPos.y + distance * Math.sin(phi);
    const z = targetPos.z + distance * Math.cos(this.orbitTheta) * Math.cos(phi);

    this._desiredPos.set(x, y, z);
    this._currentPos.lerp(this._desiredPos, lerpAlpha);
    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(targetPos);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(): void {
    GameCamera._inst = null;
  }
}
