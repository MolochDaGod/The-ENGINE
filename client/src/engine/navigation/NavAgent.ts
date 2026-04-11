/**
 * Grudge Engine — NavAgent
 *
 * Extends BaseAi with navmesh-based pathfinding.
 * Instead of walking directly toward the target (which hits walls),
 * NavAgent uses NavMeshSystem.findPath() to get a waypoint list,
 * then walks along the waypoints — clamping each step to the navmesh surface.
 *
 * Integration:
 *   const ai = new NavAgent(paladin, 'arena', 1);
 *   ai.setTarget(maria);
 */

import * as THREE from 'three';
import { BaseAi } from '../ai/BaseAi';
import { BaseCharacter } from '../character/BaseCharacter';
import { NavMeshSystem, type NavPath } from './NavMeshSystem';

const _targetPos  = new THREE.Vector3();
const _clampedEnd = new THREE.Vector3();
const _waypoint   = new THREE.Vector3();

export class NavAgent extends BaseAi {
  zoneId:          string;
  pathRecheckMs:   number = 500;    // how often to recalculate path (ms)
  waypointTolerance = 0.4;          // distance to consider waypoint "reached"

  private _nav:        NavMeshSystem;
  private _path:       NavPath | null = null;
  private _lastPathMs: number         = 0;
  private _currentNode: any           = null;

  constructor(
    character: BaseCharacter,
    zoneId:    string,
    distance   = 1.5,
  ) {
    super(character, distance);
    this.zoneId = zoneId;
    this._nav   = NavMeshSystem.getInstance();
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  override update(dt: number): void {
    if (!this.enabled) return;

    const now = Date.now();
    const char = this.character;

    // Move detector sphere with character (from BaseAi)
    (this as any)._detector.position.copy(char.body.position);

    if (!this.target) {
      // Return to spawn
      super.update(dt);
      return;
    }

    // Periodic path recalculation
    if (now - this._lastPathMs > this.pathRecheckMs) {
      this._lastPathMs = now;
      const from = new THREE.Vector3(char.body.position.x, char.body.position.y, char.body.position.z);
      _targetPos.set(this.target.body.position.x, this.target.body.position.y, this.target.body.position.z);
      this._path = this._nav.findPath(this.zoneId, from, _targetPos);
      this._currentNode = this._path
        ? this._nav.getClosestNode(this.zoneId, from, this._path.groupId)
        : null;
    }

    if (!this._path || this._path.waypoints.length === 0) {
      // No navmesh path — fall back to straight-line BaseAi behaviour
      super.update(dt);
      return;
    }

    // Walk toward next waypoint
    const wp = this._path.waypoints[0];
    _waypoint.set(wp.x, char.body.position.y, wp.z);

    const dx = _waypoint.x - char.body.position.x;
    const dz = _waypoint.z - char.body.position.z;
    const dist2d = Math.sqrt(dx * dx + dz * dz);

    if (dist2d < this.waypointTolerance) {
      this._path.waypoints.shift();           // advance to next waypoint
      if (this._path.waypoints.length === 0) {
        // Reached end of path — within attack range?
        if (this.isAttack) this.attack();
        else char.service.send('stop');
      }
      return;
    }

    // Move character along direction toward waypoint, clamped to navmesh
    const normDx = dx / dist2d;
    const normDz = dz / dist2d;
    const stepSize = char.speed * dt * 60;

    const from = new THREE.Vector3(char.body.position.x, char.body.position.y, char.body.position.z);
    const desired = new THREE.Vector3(
      from.x + normDx * stepSize,
      from.y,
      from.z + normDz * stepSize,
    );

    if (this._currentNode) {
      this._currentNode = this._nav.clampStep(
        this.zoneId, from, desired, this._currentNode,
        this._path.groupId, _clampedEnd,
      );
      char.body.position.x = _clampedEnd.x;
      char.body.position.z = _clampedEnd.z;
    } else {
      char.body.position.x = desired.x;
      char.body.position.z = desired.z;
    }

    // Update facing & FSM
    char.direction.set(normDx, normDz);
    if (char.service.hasTag('canFacing')) {
      char.facing.copy(char.direction);
      char.mesh?.rotation.set(0, -char.facing.angle() + Math.PI / 2, 0);
    }
    if (char.service.hasTag('canMove')) {
      char.service.send('run');
    }
  }
}
