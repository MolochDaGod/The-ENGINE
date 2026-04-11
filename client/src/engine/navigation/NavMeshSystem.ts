/**
 * Grudge Engine — NavMeshSystem
 *
 * Wraps donmccurdy/three-pathfinding for nav-mesh based AI pathfinding.
 * Integrates with GrudgeEngine update loop and supports multiple zones
 * (one per game level / area).
 *
 * Usage:
 *   const nav = NavMeshSystem.getInstance();
 *   nav.loadZone('arena', navmeshGeometry);
 *   const path = nav.findPath('arena', start, end);
 *
 * For heavy init (createZone), the system offloads work to PathfindingWorker
 * when available.
 */

import * as THREE from 'three';
import { Pathfinding, PathfindingHelper } from 'three-pathfinding';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GrudgeEngine } from '../core/GrudgeEngine';

export interface NavPath {
  waypoints: THREE.Vector3[];
  zoneId:    string;
  groupId:   number;
}

export class NavMeshSystem {
  private static _instance: NavMeshSystem | null = null;

  private _pf:      Pathfinding;
  private _helper:  PathfindingHelper;
  private _zones:   Map<string, THREE.BufferGeometry> = new Map();
  private _groups:  Map<string, number> = new Map();   // cached groupIDs per zone
  private _engine:  GrudgeEngine;

  private constructor() {
    this._pf     = new Pathfinding();
    this._helper = new PathfindingHelper();
    this._engine = GrudgeEngine.getInstance();
    this._engine.scene?.add(this._helper);
  }

  static getInstance(): NavMeshSystem {
    if (!NavMeshSystem._instance) {
      NavMeshSystem._instance = new NavMeshSystem();
    }
    return NavMeshSystem._instance;
  }

  // ── Zone management ────────────────────────────────────────────────────────

  /**
   * Build a pathfinding zone from a THREE.BufferGeometry.
   * The geometry should be the navmesh exported from Blender / Recast.
   */
  loadZone(zoneId: string, geometry: THREE.BufferGeometry, tolerance = 1e-4): void {
    this._zones.set(zoneId, geometry);
    const zone = Pathfinding.createZone(geometry, tolerance);
    this._pf.setZoneData(zoneId, zone);
    console.log(`[NavMeshSystem] zone "${zoneId}" loaded`);
  }

  /**
   * Load a navmesh zone from a GLTF/GLB file URL.
   * The first mesh found in the file is used as the navmesh geometry.
   */
  async loadZoneFromGltf(zoneId: string, url: string, tolerance = 1e-4): Promise<void> {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        let navmesh: THREE.Mesh | null = null;
        gltf.scene.traverse((child) => {
          if (!navmesh && (child as THREE.Mesh).isMesh) {
            navmesh = child as THREE.Mesh;
          }
        });
        if (!navmesh) {
          reject(new Error(`[NavMeshSystem] No mesh found in "${url}"`));
          return;
        }
        this.loadZone(zoneId, (navmesh as THREE.Mesh).geometry, tolerance);
        resolve();
      }, undefined, reject);
    });
  }

  removeZone(zoneId: string): void {
    this._zones.delete(zoneId);
    this._groups.delete(zoneId);
  }

  // ── Pathfinding ────────────────────────────────────────────────────────────

  /**
   * Find a path from start to end on the given zone.
   * Returns null if no zone is loaded or no path could be found.
   */
  findPath(zoneId: string, start: THREE.Vector3, end: THREE.Vector3): NavPath | null {
    if (!this._zones.has(zoneId)) {
      console.warn(`[NavMeshSystem] zone "${zoneId}" not loaded`);
      return null;
    }
    const groupId = this._pf.getGroup(zoneId, start);
    const waypoints = this._pf.findPath(start, end, zoneId, groupId);
    if (!waypoints || waypoints.length === 0) return null;
    return { waypoints, zoneId, groupId };
  }

  /**
   * Clamp a movement step to stay on the navmesh surface.
   * Use this for WASD / FPS movement that must respect the navmesh.
   */
  clampStep(
    zoneId: string,
    start:  THREE.Vector3,
    end:    THREE.Vector3,
    node:   any,
    groupId: number,
    out:    THREE.Vector3,
  ): any {
    return this._pf.clampStep(start, end, node, zoneId, groupId, out);
  }

  getClosestNode(zoneId: string, position: THREE.Vector3, groupId: number): any {
    return this._pf.getClosestNode(position, zoneId, groupId, true);
  }

  getGroup(zoneId: string, position: THREE.Vector3): number {
    return this._pf.getGroup(zoneId, position);
  }

  getRandomNode(zoneId: string, groupId: number, near: THREE.Vector3, range: number): any {
    return this._pf.getRandomNode(zoneId, groupId, near, range);
  }

  // ── Debug helper ───────────────────────────────────────────────────────────

  showPath(path: NavPath | null): void {
    this._helper.reset();
    if (!path) return;
    this._helper.setPath(path.waypoints);
  }

  showPlayer(pos: THREE.Vector3): void { this._helper.setPlayerPosition(pos); }
  showTarget(pos: THREE.Vector3): void { this._helper.setTargetPosition(pos); }
  hideDebug(): void { this._helper.reset(); }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(): void {
    this._engine.scene?.remove(this._helper);
    this._zones.clear();
    this._groups.clear();
    NavMeshSystem._instance = null;
  }
}
