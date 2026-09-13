/**
 * Unified Grudge player stack — grudge-control locomotion + GameCamera + roster.
 * Bridges artifact animator patterns into GrudgeEngine games (Warlords, super-engine, AI).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { playerController } from 'grudge-control';
import { GrudgeEngine, Updatable } from '../core/GrudgeEngine';
import { GameCamera } from '../systems/GameCamera';
import {
  GRUDGE_CHARACTERS,
  buildPlayerModelConfig,
  animPackForCharacter,
  ANIM_PACK_CLIPS,
  type GrudgeCharacterEntry,
} from './grudgeRoster';
import { loadControlSettings, saveControlSettings, type ControlSettings } from './controlsSettings';
import { GrudgeFighterAi } from './GrudgeFighterAi';

export interface GrudgePlayerControllerOptions {
  canvas: HTMLCanvasElement;
  character?: GrudgeCharacterEntry;
  initPosition?: THREE.Vector3;
  staticCollider?: THREE.Object3D;
  settings?: Partial<ControlSettings>;
  /** 0–5 third-person mouse mode (Fortnite-style = 1) */
  thirdMouseMode?: 0 | 1 | 2 | 3 | 4 | 5;
  enableMobile?: boolean;
}

/**
 * Fleet-standard third-person controller:
 * - grudge-control BVH capsule + grudge6 FBX/GLB from CDN
 * - GameCamera FOLLOW sync + impact shake hooks
 * - Locomotion sets per weapon pack (artifact animator anim packs)
 * - setInput() bridge for AI (GrudgeFighterAi)
 */
export class GrudgePlayerController implements Updatable {
  readonly locomotion: playerController;
  readonly engine: GrudgeEngine;
  readonly gameCamera: GameCamera;
  readonly settings: ControlSettings;

  private _controls: OrbitControls | null = null;
  private _initialized = false;
  private _character: GrudgeCharacterEntry;

  constructor() {
    this.locomotion = new playerController();
    this.engine = GrudgeEngine.getInstance();
    this.gameCamera = GameCamera.getInstance();
    this.settings = loadControlSettings();
    this._character = GRUDGE_CHARACTERS[0];
  }

  async init(opts: GrudgePlayerControllerOptions): Promise<void> {
    const character = opts.character ?? GRUDGE_CHARACTERS[0];
    this._character = character;
    Object.assign(this.settings, opts.settings ?? {});
    saveControlSettings(this.settings);

    if (!this.engine.renderer) {
      this.engine.init(opts.canvas);
    }

    const scene = this.engine.scene;
    const camera = this.engine.camera;
    this.gameCamera.setMode('FOLLOW');

    this._controls = new OrbitControls(camera, opts.canvas);
    this._controls.enableDamping = false;
    this._controls.enablePan = false;
    this._controls.enableZoom = false;

    const s = this.settings;
    const modelCfg = {
      ...buildPlayerModelConfig(character),
      speed: s.moveSpeed * 70,
      jumpHeight: s.jumpHeight * 280,
      gravity: -s.gravity * 100,
    };
    await this.locomotion.init({
      scene,
      camera,
      controls: this._controls,
      playerModelConfig: modelCfg,
      initPos: opts.initPosition ?? new THREE.Vector3(0, 0, 0),
      staticCollider: opts.staticCollider,
      thirdMouseMode: opts.thirdMouseMode ?? 1,
      enableOverShoulderView: s.enableOverShoulder,
      minCamDistance: s.cameraDistance * 18,
      maxCamDistance: s.cameraDistance * 22,
      mouseSensitivity: s.mouseSensitivity,
      isShowMobileControls: opts.enableMobile ?? true,
    });

    this._registerLocomotionSets(character);
    if (opts.staticCollider) {
      await this.locomotion.buildStaticCollider(opts.staticCollider);
    }

    const mesh = this.locomotion.getPlayerModel();
    if (mesh) {
      this.gameCamera.setTarget(mesh);
    }

    this.engine.addToUpdate(this);
    this._initialized = true;
  }

  private _registerLocomotionSets(character: GrudgeCharacterEntry): void {
    const pack = animPackForCharacter(character);
    const clips = ANIM_PACK_CLIPS[pack];
    this.locomotion.registerLocomotionSet(pack, {
      idle: clips.idle,
      walking: clips.walk,
      running: clips.run,
      jumping: 'jump',
    });
    this.locomotion.switchLocomotionSet(pack);
  }

  async switchCharacter(character: GrudgeCharacterEntry): Promise<void> {
    this._character = character;
    const cfg = buildPlayerModelConfig(character);
    await this.locomotion.switchPlayerModel(cfg);
    this._registerLocomotionSets(character);
    const mesh = this.locomotion.getPlayerModel();
    if (mesh) this.gameCamera.setTarget(mesh);
  }

  /** Screen-centre aim ray — artifact animator getCenterScreenRaycastHit pattern. */
  aimRay(): THREE.Intersection | undefined {
    return this.locomotion.getCenterScreenRaycastHit();
  }

  createAi(home?: THREE.Vector3): GrudgeFighterAi {
    return new GrudgeFighterAi({ locomotion: this.locomotion, homePosition: home });
  }

  update(dt: number): void {
    if (!this._initialized) return;
    // grudge-control owns orbit camera + capsule — do not double-drive via GameCamera
    this.locomotion.update(dt);
    const mesh = this.locomotion.getPlayerModel();
    if (mesh && this.engine.shadowLight) {
      const p = mesh.position;
      this.engine.shadowLight.position.x = p.x;
      this.engine.shadowLight.position.z = p.z;
      this.engine.shadowLight.target.position.set(p.x, p.y, p.z);
      this.engine.shadowLight.target.updateMatrixWorld();
    }
  }

  shake(magnitude = 0.35): void {
    this.gameCamera.shake(magnitude);
  }

  getPosition(): THREE.Vector3 {
    return this.locomotion.getPosition();
  }

  getCharacter(): GrudgeCharacterEntry {
    return this._character;
  }

  dispose(): void {
    this.locomotion.destroy();
    this._controls?.dispose();
    this._controls = null;
    this._initialized = false;
  }
}

export { GRUDGE_CHARACTERS };