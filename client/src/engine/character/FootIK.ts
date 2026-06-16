/**
 * Grudge Engine — FootIK
 *
 * Lightweight, defensive foot-placement IK for skinned characters.
 *
 * Approach (delta-based two-bone IK + pelvis adjust):
 *   - Bind to a mixamo-style leg rig (UpLeg → Leg → Foot) by fuzzy bone-name
 *     matching, so it works across slightly different export naming.
 *   - Each frame (after the AnimationMixer samples the pose) raycast straight
 *     down under each foot against the physics scene. The foot is then moved
 *     by the *difference* between the ground under that foot and the ground
 *     under the body. On flat ground that delta is ~0, so the IK is a perfect
 *     no-op (safe to ship everywhere); on ramps / steps the feet plant.
 *   - The pelvis (hips) is lowered toward the lower foot so the planted leg
 *     isn't over-stretched, then each leg is solved with analytic two-bone IK.
 *
 * Everything is heavily guarded — if bones are missing or anything throws, the
 * IK simply does nothing. It must NEVER break the render loop.
 */

import * as THREE from 'three';
import type { BaseRaceCharacter } from './BaseCharacter';

// ── Module-scope scratch objects (avoid per-frame allocation) ────────────────
const _hipPos    = new THREE.Vector3();
const _kneePos   = new THREE.Vector3();
const _anklePos  = new THREE.Vector3();
const _kneePos2  = new THREE.Vector3();
const _anklePos2 = new THREE.Vector3();
const _target    = new THREE.Vector3();
const _toTarget  = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _curKnee   = new THREE.Vector3();
const _curAnkle  = new THREE.Vector3();
const _bendAxis  = new THREE.Vector3();
const _desKnee   = new THREE.Vector3();
const _hipToKnee = new THREE.Vector3();
const _from      = new THREE.Vector3();
const _to        = new THREE.Vector3();
const _up        = new THREE.Vector3(0, 1, 0);
const _localOff  = new THREE.Vector3();
const _qHip      = new THREE.Quaternion();
const _qWorld    = new THREE.Quaternion();
const _qBone     = new THREE.Quaternion();
const _qParent   = new THREE.Quaternion();
const _qNew      = new THREE.Quaternion();

interface Leg {
  upper: THREE.Object3D;  // thigh  (hip joint)
  lower: THREE.Object3D;  // calf   (knee joint)
  foot:  THREE.Object3D;  // ankle  (foot joint)
}

function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class FootIK {
  private character: BaseRaceCharacter;
  private hips: THREE.Object3D | null = null;
  private legs: Leg[] = [];
  private _bound = false;
  private _failed = false;

  // Tuning
  rayUp        = 0.6;   // start the foot ray this far above the ankle
  rayDown      = 1.2;   // and probe this far below it
  maxLift      = 0.5;   // clamp how far a foot may be raised
  maxDrop      = 0.6;   // clamp how far a foot may be lowered
  maxPelvisDrop = 0.45; // clamp pelvis lowering
  footOffset   = 0.0;   // extra clearance between ankle and ground

  constructor(character: BaseRaceCharacter) {
    this.character = character;
  }

  /** Locate the leg bones once. Returns false if the rig is unsupported. */
  private bind(): boolean {
    if (this._bound) return true;
    if (this._failed) return false;
    const mesh = this.character.mesh;
    if (!mesh) return false;

    let hips: THREE.Object3D | null = null;
    const lUp: Record<string, THREE.Object3D> = {};
    const lLow: Record<string, THREE.Object3D> = {};
    const lFoot: Record<string, THREE.Object3D> = {};

    mesh.traverse((o: THREE.Object3D) => {
      const n = norm(o.name);
      if (!n) return;
      if (!hips && n.includes('hips')) hips = o;
      const side = n.includes('left') ? 'L' : n.includes('right') ? 'R' : '';
      if (!side) return;
      if (n.includes('upleg') || n.includes('upperleg') || n.includes('thigh')) {
        lUp[side] = o;
      } else if (n.includes('foot') && !n.includes('toe')) {
        lFoot[side] = o;
      } else if ((n.includes('leg') || n.includes('calf') || n.includes('shin')) &&
                 !n.includes('upleg') && !n.includes('upperleg')) {
        lLow[side] = o;
      }
    });

    const legs: Leg[] = [];
    for (const side of ['L', 'R']) {
      if (lUp[side] && lLow[side] && lFoot[side]) {
        legs.push({ upper: lUp[side], lower: lLow[side], foot: lFoot[side] });
      }
    }

    if (!hips || legs.length === 0) {
      this._failed = true;     // unsupported rig — never try again
      return false;
    }
    this.hips = hips;
    this.legs = legs;
    this._bound = true;
    return true;
  }

  /** Run one IK solve. Call AFTER mixer.update() and only while grounded. */
  update(_dt: number): void {
    if (!this.bind() || !this.hips) return;
    const mesh = this.character.mesh;
    if (!mesh) return;

    // Refresh world matrices for the freshly-sampled animation pose.
    mesh.updateMatrixWorld(true);

    const bodyGroundY = this.character.groundY;

    // ── Pass 1: probe ground under each foot, compute per-foot deltas ──
    const deltas: number[] = [];
    const targets: (THREE.Vector3 | null)[] = [];
    let minDelta = 0;

    for (let i = 0; i < this.legs.length; i++) {
      const ankle = this.legs[i].foot;
      ankle.getWorldPosition(_anklePos);
      const res = this.character.raycastDown(
        _anklePos.x, _anklePos.y + this.rayUp, _anklePos.z,
        this.rayUp + this.rayDown,
      );
      if (!res.body) { deltas.push(0); targets.push(null); continue; }

      const groundUnderFoot = res.hitPointWorld.y;
      let delta = (groundUnderFoot - bodyGroundY) + this.footOffset;
      if (delta > this.maxLift) delta = this.maxLift;
      else if (delta < -this.maxDrop) delta = -this.maxDrop;
      deltas.push(delta);
      if (delta < minDelta) minDelta = delta;

      targets.push(new THREE.Vector3(_anklePos.x, _anklePos.y + delta, _anklePos.z));
    }

    // ── Pelvis: drop hips toward the lower foot (clamped). No-op on flat. ──
    let pelvisDrop = minDelta;
    if (pelvisDrop < -this.maxPelvisDrop) pelvisDrop = -this.maxPelvisDrop;
    if (pelvisDrop < 0) {
      const parent = this.hips.parent;
      _localOff.set(0, pelvisDrop, 0);
      if (parent) {
        parent.getWorldQuaternion(_qParent).invert();
        _localOff.applyQuaternion(_qParent);
      }
      this.hips.position.add(_localOff);
      mesh.updateMatrixWorld(true);
    }

    // ── Pass 2: solve each leg so the ankle reaches its world target ──
    for (let i = 0; i < this.legs.length; i++) {
      const tgt = targets[i];
      if (!tgt) continue;
      this.solveLeg(this.legs[i], tgt);
    }
  }

  /** Analytic two-bone IK: rotate upper & lower bones so foot reaches target. */
  private solveLeg(leg: Leg, targetWorld: THREE.Vector3): void {
    const { upper, lower, foot } = leg;

    upper.getWorldPosition(_hipPos);
    lower.getWorldPosition(_kneePos);
    foot.getWorldPosition(_anklePos);

    // Skip if the foot is already essentially at the target (flat ground).
    if (_anklePos.distanceToSquared(targetWorld) < 1e-6) return;

    const L1 = _hipPos.distanceTo(_kneePos);
    const L2 = _kneePos.distanceTo(_anklePos);
    if (L1 < 1e-4 || L2 < 1e-4) return;

    _target.copy(targetWorld);
    _toTarget.subVectors(_target, _hipPos);
    let dist = _toTarget.length();
    const minReach = Math.abs(L1 - L2) + 1e-3;
    const maxReach = (L1 + L2) * 0.999;
    if (dist < minReach) dist = minReach;
    else if (dist > maxReach) dist = maxReach;
    if (dist < 1e-4) return;
    _targetDir.copy(_toTarget).normalize();

    // Bend axis = normal of the current limb plane (preserves knee direction).
    _curKnee.subVectors(_kneePos, _hipPos);
    _curAnkle.subVectors(_anklePos, _hipPos);
    _bendAxis.crossVectors(_curAnkle, _curKnee);
    if (_bendAxis.lengthSq() < 1e-8) {
      _bendAxis.crossVectors(_toTarget, _up);
      if (_bendAxis.lengthSq() < 1e-8) _bendAxis.set(1, 0, 0);
    }
    _bendAxis.normalize();

    // Interior angle at the hip via law of cosines.
    let cosHip = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist);
    if (cosHip < -1) cosHip = -1; else if (cosHip > 1) cosHip = 1;
    const hipAngle = Math.acos(cosHip);

    // Desired world position of the knee.
    _qHip.setFromAxisAngle(_bendAxis, hipAngle);
    _hipToKnee.copy(_targetDir).applyQuaternion(_qHip).multiplyScalar(L1);
    _desKnee.copy(_hipPos).add(_hipToKnee);

    // 1) Aim the upper bone so the knee moves to its desired position.
    this.aimBone(upper, _hipPos, _kneePos, _desKnee);

    // 2) Re-read and aim the lower bone so the ankle reaches the target.
    lower.updateWorldMatrix(true, false);
    lower.getWorldPosition(_kneePos2);
    foot.getWorldPosition(_anklePos2);
    this.aimBone(lower, _kneePos2, _anklePos2, _target);
  }

  /**
   * Rotate `bone` about its own origin so that the world direction
   * (childWorld - originWorld) is rotated onto (desiredWorld - originWorld).
   */
  private aimBone(
    bone: THREE.Object3D,
    originWorld: THREE.Vector3,
    childWorld: THREE.Vector3,
    desiredWorld: THREE.Vector3,
  ): void {
    _from.subVectors(childWorld, originWorld);
    _to.subVectors(desiredWorld, originWorld);
    if (_from.lengthSq() < 1e-10 || _to.lengthSq() < 1e-10) return;
    _from.normalize();
    _to.normalize();
    _qWorld.setFromUnitVectors(_from, _to);

    bone.getWorldQuaternion(_qBone);
    _qNew.copy(_qWorld).multiply(_qBone);            // new desired world rotation

    const parent = bone.parent;
    if (parent) {
      parent.getWorldQuaternion(_qParent).invert();
      _qNew.premultiply(_qParent);                   // convert to bone-local
    }
    bone.quaternion.copy(_qNew);
    bone.updateMatrix();
    bone.updateWorldMatrix(false, true);
  }
}
