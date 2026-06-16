/**
 * Grudge Engine — BaseRaceCharacter
 *
 * Abstract base class for all 3D characters with a 6-race system.
 * Ports the core patterns from gonnavis/annihilate/src/Maria.js:
 *
 *   - CANNON capsule body (2 spheres + cylinder, fixedRotation=true)
 *   - THREE.AnimationMixer with oaction name map
 *   - fadeToAction() crossFade logic (exact port)
 *   - setFacing() — facing Vector2 + mesh.rotation.y
 *   - getAltitude() — downward raycast through GROUP_SCENE
 *   - update(dt) — mesh sync + air/land detection + mixer.update
 *   - hit() / knockDown() — send FSM events
 *   - Race selection with stat bonuses and passive traits
 *
 * Subclasses implement:
 *   buildFSM()  — return a CharacterFSM (call createFSM())
 *   load()      — load GLTF, populate this.oaction, call _onLoaded()
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterFSM, createFSM } from './CharacterFSM';
import { FootIK } from './FootIK';
import type { ICharacterState } from './states/ICharacterState';
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

// ─── Race System ──────────────────────────────────────────────────────────────

export type CharacterRace = 'human' | 'elf' | 'dwarf' | 'orc' | 'barbarian' | 'undead';

export interface RaceConfig {
  id:          CharacterRace;
  name:        string;
  description: string;
  passive:     string;
  bonuses:     Partial<Record<string, number>>;
  /** Body scale multiplier (affects capsule height/radius) */
  bodyScale:   number;
  /** Base movement speed multiplier */
  speedMult:   number;
}

export const RACE_CONFIGS: Record<CharacterRace, RaceConfig> = {
  human: {
    id: 'human', name: 'Human', description: 'Adaptable and balanced.',
    passive: '+10% EXP gain',
    bonuses: { tactics: 2, wisdom: 1 },
    bodyScale: 1, speedMult: 1,
  },
  elf: {
    id: 'elf', name: 'Elf', description: 'Agile and attuned to magic.',
    passive: '+Mana regen',
    bonuses: { intellect: 2, agility: 1 },
    bodyScale: 0.95, speedMult: 1.05,
  },
  dwarf: {
    id: 'dwarf', name: 'Dwarf', description: 'Stout and resilient.',
    passive: '+Mining efficiency',
    bonuses: { endurance: 2, vitality: 1 },
    bodyScale: 0.85, speedMult: 0.92,
  },
  orc: {
    id: 'orc', name: 'Orc', description: 'Brutal warriors born for battle.',
    passive: '+Melee damage',
    bonuses: { strength: 2, vitality: 1 },
    bodyScale: 1.1, speedMult: 0.97,
  },
  barbarian: {
    id: 'barbarian', name: 'Barbarian', description: 'Wild and relentless.',
    passive: '+HP regen',
    bonuses: { agility: 2, dexterity: 1 },
    bodyScale: 1.05, speedMult: 1.03,
  },
  undead: {
    id: 'undead', name: 'Undead', description: 'Risen with dark resilience.',
    passive: '+Shadow resist',
    bonuses: { intellect: 1, endurance: 1, tactics: 1 },
    bodyScale: 1, speedMult: 0.98,
  },
};

export const DEFAULT_RACE: CharacterRace = 'human';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CharacterOptions {
  position?: THREE.Vector3;
  collisionGroup?: number;
  collisionMask?: number;
  /** Race selection — defaults to 'human' */
  race?: CharacterRace;
}

// ─── BaseRaceCharacter ────────────────────────────────────────────────────────

export abstract class BaseRaceCharacter implements Updatable {
  // ── Identity
  isCharacter = true;
  isRole      = false;
  isEnemy     = false;

  // ── Race
  race:       CharacterRace;
  raceConfig: RaceConfig;

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

  // ── Ground / terrain (cached each frame from the altitude raycast) ──────
  grounded     = false;
  groundNormal = new THREE.Vector3(0, 1, 0);
  groundY      = 0;

  // ── Climbing (wall / ledge grab) ────────────────────────────────────────
  /** Forward axis from the controller: +1 = climb up, -1 = climb down, 0 = hold */
  climbInput   = 0;
  /** Vertical climb speed (units/sec) */
  climbSpeed   = 2.6;
  /** Horizontal unit direction INTO the grabbed wall */
  climbDir     = new THREE.Vector3(0, 0, 1);

  // ── Foot IK (planted feet on uneven terrain) ────────────────────────────
  footIK:    FootIK | null = null;
  ikEnabled  = true;

  // ── Rendering
  mesh!:   THREE.Object3D;
  gltf!:   any;
  mixer!:  THREE.AnimationMixer;
  oaction: Record<string, THREE.AnimationAction> = {};
  action_act!: THREE.AnimationAction;

  // ── FSM
  service!: CharacterFSM;

  // ── Class-based state (Sketchbook pattern) ──────────────────────────────
  currentState: ICharacterState | null = null;

  // ── Input query helpers (set by RoleControls or AI) ─────────────────────
  inputJustPressed?: (action: string) => boolean;
  inputIsPressed?:   (action: string) => boolean;

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

    // ── Race init ──────────────────────────────────────────────────────────
    this.race       = options.race ?? DEFAULT_RACE;
    this.raceConfig = RACE_CONFIGS[this.race];
    this._applyRacials();

    this.service = this.buildFSM();
    this._initPhysics(options);
    this._engine.addToUpdate(this);
  }

  // ── Race helpers ──────────────────────────────────────────────────────────

  /** Apply racial body scaling and speed */
  private _applyRacials(): void {
    const rc = this.raceConfig;
    this.bodyHeight  *= rc.bodyScale;
    this.bodyRadius  *= rc.bodyScale;
    this.bodyHeightHalf = this.bodyHeight / 2;
    this.speed       *= rc.speedMult;
  }

  /** Change race at runtime (e.g. character creation screen) */
  setRace(race: CharacterRace): void {
    // Revert previous racials
    const oldRc = this.raceConfig;
    this.bodyHeight  /= oldRc.bodyScale;
    this.bodyRadius  /= oldRc.bodyScale;
    this.speed       /= oldRc.speedMult;

    // Apply new
    this.race       = race;
    this.raceConfig = RACE_CONFIGS[race];
    this._applyRacials();
  }

  /** Get the attribute bonuses from this character's race */
  getRaceBonuses(): Partial<Record<string, number>> {
    return { ...this.raceConfig.bonuses };
  }

  /** Get the passive trait description */
  getRacePassive(): string {
    return this.raceConfig.passive;
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

    // ── Wall / ledge grab detection ──────────────────────────────────────
    // Grab any sufficiently-vertical scene surface while airborne. The old
    // version only matched perfectly X-axis-aligned walls (ni.x === ±1),
    // so most walls never triggered a climb.
    this.body.addEventListener('collide', (event: any) => {
      if (!event.body?.belongTo?.isScene) return;
      const contact = event.contact;
      const ni = contact?.ni;
      if (!ni) return;

      // A wall has a mostly-horizontal contact normal (small vertical part).
      const horizLen = Math.hypot(ni.x, ni.z);
      if (horizLen < 0.5 || Math.abs(ni.y) > 0.6) return;

      // Only grab while in the air (jumping/falling into the wall) so walking
      // into a wall on the ground never starts a climb.
      if (!this.isAir) return;

      // Direction INTO the wall: prefer current horizontal motion, else facing.
      let dx = this.body.velocity.x;
      let dz = this.body.velocity.z;
      if (dx * dx + dz * dz < 0.04) { dx = this.facing.x; dz = this.facing.y; }
      const dl = Math.hypot(dx, dz) || 1;
      this.climbDir.set(dx / dl, 0, dz / dl);
      (this as any).climbContactSign = Math.sign(ni.x) || 1;

      this.service.send('climb', { contact });
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

    // Foot IK binds lazily on first solve; safe no-op if the rig is unsupported.
    if (this.ikEnabled && !this.footIK) {
      this.footIK = new FootIK(this);
    }

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
      console.warn(`[BaseRaceCharacter] unknown animation: "${name}"`);
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

  // ── Class-based state machine ───────────────────────────────────────────

  /**
   * Transition to a new class-based state.
   * Calls onExit() on old state, swaps, calls onEnter() on new state.
   */
  setState(state: ICharacterState): void {
    if (this.currentState) {
      this.currentState.onExit();
    }
    this.currentState = state;
    this.currentState.onEnter();
  }

  /** Check if current state has a given tag */
  stateHasTag(tag: string): boolean {
    return this.currentState?.tags?.includes(tag) ?? false;
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

    // ── Climb: input-driven vertical movement + ledge mantle (own path) ──
    if (this.service.matches('climb')) {
      this._updateClimb(dt);
      this.mesh.position.set(
        this.body.position.x,
        this.body.position.y - this.bodyHeightHalf,
        this.body.position.z
      );
      this.mixer?.update(dt);
      return;
    }

    // ── Air / land detection + ground-normal cache (slopes & foot IK) ──
    const altResult = this.getAltitude(100);
    let altitude: number;
    if (altResult.body) {
      altitude = this.body.position.y - this.bodyHeightHalf - altResult.hitPointWorld.y;
      this.groundY = altResult.hitPointWorld.y;
      const n = altResult.hitNormalWorld;
      if (n) {
        this.groundNormal.set(n.x, n.y, n.z);
        if (this.groundNormal.y < 0) this.groundNormal.multiplyScalar(-1);
        if (this.groundNormal.lengthSq() < 1e-6) this.groundNormal.set(0, 1, 0);
      }
    } else {
      altitude = Infinity;
      this.groundNormal.set(0, 1, 0);
    }

    if (altitude > 0.37) {
      this.grounded = false;
      this.setAir(true);
      this.service.send('air');
    } else {
      this.grounded = true;
      if (this.isAir || altitude < 0.0037) this.service.send('land');
      this.setAir(false);
      this.body.mass = this.mass;
    }

    // Update class-based state (runs alongside FSM)
    if (this.currentState) {
      this.currentState.update(dt);
    }

    // Sync mesh to physics body
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y - this.bodyHeightHalf,
      this.body.position.z
    );

    // Update animation mixer (samples the animated pose for this frame)
    this.mixer?.update(dt);

    // Foot IK — after the pose is sampled, only while planted. Guarded so a
    // rig/math edge-case can never break the RAF loop. No-op on flat ground.
    if (this.ikEnabled && this.footIK && this.grounded && !this.isAir) {
      try { this.footIK.update(dt); } catch { /* never break rendering */ }
    }
  }

  setAir(bool: boolean): void {
    this.isAir = bool;
  }

  // ── Climbing helpers ───────────────────────────────────────────────

  /** Input-driven wall climb + ledge mantle (used while in the 'climb' state). */
  private _updateClimb(dt: number): void {
    // Pin to the wall; climb vertically by the controller's forward axis.
    this.body.velocity.set(0, 0, 0);
    const climb = this.climbInput;
    if (climb !== 0) this.body.position.y += climb * this.climbSpeed * dt;

    // Face into the wall while hanging.
    this.setFacing(this.climbDir.x, this.climbDir.z);

    // Mantle: when pushing up, look for a top surface just past the wall.
    if (climb > 0) {
      const topY = this._probeLedge();
      if (topY !== null) {
        this.body.position.y = topY + this.bodyHeightHalf + 0.04;
        this.body.position.x += this.climbDir.x * (this.bodyRadius + 0.3);
        this.body.position.z += this.climbDir.z * (this.bodyRadius + 0.3);
        this.body.velocity.set(0, 0, 0);
        this.service.send('land');     // climb → idle (exitClimb restores mass)
        return;
      }
    }

    // Release at the bottom — once the feet reach the floor, let go.
    const alt = this.getAltitude(100);
    if (alt.body) {
      const footGap = this.body.position.y - this.bodyHeightHalf - alt.hitPointWorld.y;
      if (footGap < 0.05) this.service.send('land');
    }
  }

  /**
   * Probe for a ledge top just past the wall and slightly above the head.
   * Returns the world Y of the top surface if it's within mantle reach.
   */
  private _probeLedge(): number | null {
    const headY = this.body.position.y + this.bodyHeightHalf;
    const px = this.body.position.x + this.climbDir.x * (this.bodyRadius + 0.25);
    const pz = this.body.position.z + this.climbDir.z * (this.bodyRadius + 0.25);
    const res = this.raycastDown(px, headY + 0.6, pz, 1.1);
    if (!res.body) return null;
    const topY = res.hitPointWorld.y;
    const feetY = this.body.position.y - this.bodyHeightHalf;
    if (topY > feetY + 0.2 && topY <= headY + 0.5) return topY;
    return null;
  }

  /** Downward raycast against scene geometry from an arbitrary point. */
  raycastDown(x: number, y: number, z: number, distance: number): CANNON.RaycastResult {
    const result = new CANNON.RaycastResult();
    const from = new CANNON.Vec3(x, y, z);
    const to   = new CANNON.Vec3(x, y - distance, z);
    this._engine.world.raycastClosest(from, to, { collisionFilterMask: GROUP_SCENE }, result);
    return result;
  }

  /** Enable foot-placement IK (call after the mesh is loaded). */
  enableFootIK(): void {
    this.ikEnabled = true;
    if (!this.footIK && this.mesh) this.footIK = new FootIK(this);
  }

  /** Disable foot-placement IK. */
  disableFootIK(): void {
    this.ikEnabled = false;
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

// ─── Backward-compatible alias ──────────────────────────────────────────────
/** @deprecated Use BaseRaceCharacter instead */
export { BaseRaceCharacter as BaseCharacter };
