/**
 * Grudge Engine — BaseCharacter
 *
 * Abstract base class for all 3D characters.
 * Ports the core patterns from gonnavis/annihilate/src/Maria.js:
 *
 *   - CANNON capsule body (2 spheres + cylinder, fixedRotation=true)
 *   - THREE.AnimationMixer with oaction name map
 *   - fadeToAction() crossFade logic (exact port)
 *   - setFacing() — facing Vector2 + mesh.rotation.y
 *   - getAltitude() — downward raycast through GROUP_SCENE
 *   - update(dt) — mesh sync + air/land detection + mixer.update
 *   - hit() / knockDown() — send FSM events
 *
 * Subclasses implement:
 *   buildFSM()  — return a CharacterFSM (call createFSM())
 *   load()      — load GLTF, populate this.oaction, call _onLoaded()
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterFSM, createFSM } from './CharacterFSM';
import { GrudgeEngine, Updatable } from '../core/GrudgeEngine';
import {
  GROUP_SCENE,
  GROUP_ROLE,
  GROUP_ENEMY,
  GROUP_ENEMY_ATTACKER,
  GROUP_TRIGGER,
  MAX_DT,
} from '../core/collisionGroups';

export { GLTFLoader, createFSM };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CharacterOptions {
  position?: THREE.Vector3;
  collisionGroup?: number;
  collisionMask?: number;
}

// ─── BaseCharacter ────────────────────────────────────────────────────────────

export abstract class BaseCharacter implements Updatable {
  // ── Identity
  isCharacter = true;
  isRole      = false;
  isEnemy     = false;

  // ── Health
  health    = 100;
  maxHealth = 100;

  // ── Movement (mirrors annihilate)
  speed    = 0.11;                            // units/frame at 60fps
  direction = new THREE.Vector2();            // may be zero-length
  facing    = new THREE.Vector2(0, 1);        // NEVER zero-length
  tmpVec3   = new THREE.Vector3();

  // ── Physics
  body!:          CANNON.Body;
  bodyRadius      = 0.5;
  bodyHeight      = 1.65;
  bodyHeightHalf  = 1.65 / 2;
  mass            = 80;
  isAir           = false;

  // ── Rendering
  mesh!:   THREE.Object3D;
  gltf!:   any;
  mixer!:  THREE.AnimationMixer;
  oaction: Record<string, THREE.AnimationAction> = {};
  action_act!: THREE.AnimationAction;

  // ── FSM
  service!: CharacterFSM;

  // ── Internal
  protected _engine: GrudgeEngine;
  protected _loaded = false;

  // One-shot animations — subclasses append to this list
  protected oneShotAnims: string[] = [
    'punch', 'punchStart', 'fist', 'fistStart',
    'jumpAttack', 'jumpAttackStart', 'jumpAttackEnd',
    'strike', 'strikeStart', 'strikeEnd',
    'hit', 'impact', 'jump', 'dashAttack', 'dash', 'whirlwind',
  ];

  constructor(options: CharacterOptions = {}) {
    this._engine = GrudgeEngine.getInstance();
    this.service = this.buildFSM();
    this._initPhysics(options);
    this._engine.addToUpdate(this);
  }

  // ── Abstract interface ─────────────────────────────────────────────────────

  /** Return a configured CharacterFSM for this character type */
  abstract buildFSM(): CharacterFSM;

  /** Load GLTF, populate this.oaction[], call this._onLoaded() when done */
  abstract load(callback?: () => void): Promise<void>;

  // ── Physics setup ──────────────────────────────────────────────────────────

  private _initPhysics(opts: CharacterOptions): void {
    const cg = opts.collisionGroup ?? GROUP_ROLE;
    const cm = opts.collisionMask  ?? (GROUP_SCENE | GROUP_ROLE | GROUP_ENEMY | GROUP_ENEMY_ATTACKER | GROUP_TRIGGER);

    this.body = new CANNON.Body({
      mass: this.mass,
      collisionFilterGroup: cg,
      collisionFilterMask:  cm,
    });
    this.body.fixedRotation = true;
    (this.body as any).belongTo = this;

    // Capsule: 2 spheres + cylinder (exact annihilate pattern)
    const cyH = this.bodyHeight - this.bodyRadius * 2;
    this.bodyHeightHalf = this.bodyHeight / 2;
    this.body.addShape(new CANNON.Sphere(this.bodyRadius), new CANNON.Vec3(0,  cyH / 2, 0));
    this.body.addShape(new CANNON.Sphere(this.bodyRadius), new CANNON.Vec3(0, -cyH / 2, 0));
    this.body.addShape(new CANNON.Cylinder(this.bodyRadius, this.bodyRadius, cyH, 8));

    const pos = opts.position ?? new THREE.Vector3(0, 2, 0);
    this.body.position.set(pos.x, pos.y, pos.z);
    this._engine.world.addBody(this.body);

    // Climb detection — wall collision normals
    this.body.addEventListener('collide', (event: any) => {
      if (event.body?.belongTo?.isScene) {
        const ni = event.contact?.ni;
        if (ni && Math.abs(ni.x) === 1 && ni.y === 0 && ni.z === 0) {
          (this as any).climbContactSign = ni.x;
          this.service.send('climb', { contact: event.contact });
        }
      }
    });
  }

  // ── GLTF helper ───────────────────────────────────────────────────────────

  /** Shared GLTF loading utility — subclasses call this from load() */
  protected _loadGltf(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(url, resolve, undefined, reject);
    });
  }

  /**
   * Called by subclass after GLTF is loaded and oaction is populated.
   * Wires mixer, one-shot flags, and starts the FSM.
   */
  protected _onLoaded(startAnim = 'idle'): void {
    this._loaded = true;

    // Mark one-shot animations
    for (const name of this.oneShotAnims) {
      if (this.oaction[name]) {
        this.oaction[name].loop = THREE.LoopOnce;
        this.oaction[name].clampWhenFinished = true;
      }
    }

    // Start with idle
    this.action_act = this.oaction[startAnim];
    if (this.action_act) this.action_act.play();

    // Wire mixer 'finished' → FSM 'finish'
    this.mixer.addEventListener('finished', () => {
      this.service.send('finish');
    });

    this.service.start();
    this.service.send('loaded');
  }

  // ── Core animation API (exact port from Maria.js) ─────────────────────────

  /**
   * fadeToAction — crossFade to new animation.
   * duration > 0 → crossFade; duration === 0 → hard cut.
   */
  fadeToAction(name: string, duration = 0.1): void {
    const nextAction = this.oaction[name];
    if (!nextAction) {
      console.warn(`[BaseCharacter] unknown animation: "${name}"`);
      return;
    }
    if (duration > 0) {
      nextAction.reset().play();
      this.action_act?.crossFadeTo(nextAction, duration, false);
      this.action_act = nextAction;
    } else {
      this.action_act?.stop();
      nextAction.reset().play();
      this.action_act = nextAction;
    }
  }

  /**
   * setFacing — set the facing vector and rotate mesh accordingly.
   * mesh.rotation.y = -facing.angle() + PI/2  (exact annihilate formula)
   */
  setFacing(x: number, z: number): void {
    this.facing.set(x, z);
    if (this.mesh) {
      this.mesh.rotation.set(0, -this.facing.angle() + Math.PI / 2, 0);
    }
  }

  // ── Altitude raycast (exact port from Maria.js getAltitude) ───────────────

  getAltitude(maxDistance = 100): CANNON.RaycastResult {
    const result  = new CANNON.RaycastResult();
    const from    = this.body.position;
    const to      = new CANNON.Vec3(from.x, from.y - maxDistance, from.z);
    this._engine.world.raycastClosest(from, to, { collisionFilterMask: GROUP_SCENE }, result);
    return result;
  }

  // ── Per-frame update (exact port from Maria.js update) ────────────────────

  update(dt: number): void {
    if (!this._loaded || !this.mesh) return;
    dt = Math.min(dt, MAX_DT);

    // Climb state: slowly lower body to stay on wall
    if (this.service.matches('climb')) {
      this.body.position.y -= dt;
    }

    // Air / land detection via raycast
    const altResult = this.getAltitude(100);
    let altitude: number;
    if (altResult.body) {
      altitude = this.body.position.y - this.bodyHeightHalf - altResult.hitPointWorld.y;
    } else {
      altitude = Infinity;
    }

    if (altitude > 0.37) {
      this.setAir(true);
      this.service.send('air');
    } else {
      if (this.isAir || altitude < 0.0037) this.service.send('land');
      this.setAir(false);
      this.body.mass = this.mass;
    }

    // Sync mesh to physics body
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y - this.bodyHeightHalf,
      this.body.position.z
    );

    // Update animation mixer
    this.mixer?.update(dt);
  }

  setAir(bool: boolean): void {
    this.isAir = bool;
  }

  // ── Combat ────────────────────────────────────────────────────────────────

  hit(collideEvent?: any): void {
    this.service.send('hit', { collideEvent });
  }

  knockDown(collideEvent?: any): void {
    this.hit(collideEvent);
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.service.send('dead');
    } else {
      this.service.send('hit');
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy(): void {
    this.service.stop();
    this._engine.removeFromUpdate(this);
    this._engine.world.removeBody(this.body);
    if (this.mesh) this._engine.scene.remove(this.mesh);
    this.mixer?.stopAllAction();
  }
}
