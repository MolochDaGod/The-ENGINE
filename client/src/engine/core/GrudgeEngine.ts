/**
 * Grudge Engine — Core Singleton
 *
 * Ports the Three.js + Cannon-ES setup from gonnavis/annihilate/src/index.js:
 *   init_three() → initRenderer()
 *   init_cannon() → initPhysics()
 *   animate()     → the internal RAF loop
 *
 * Usage:
 *   const engine = GrudgeEngine.getInstance();
 *   engine.init(canvasElement);
 *   engine.addToUpdate(myCharacter);
 *   engine.setRole(myCharacter);
 *   engine.start();
 *   // on cleanup:
 *   engine.stop();
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MAX_DT, GROUP_SCENE, GROUP_ROLE, GROUP_ENEMY, GROUP_ROLE_ATTACKER, GROUP_ENEMY_ATTACKER } from './collisionGroups';

// ─── Updatable interface ───────────────────────────────────────────────────────
export interface Updatable {
  update(dt: number, time?: number): void;
}

// ─── Role interface (any character the camera follows) ────────────────────────
export interface HasBodyAndMesh {
  body: CANNON.Body;
  mesh: THREE.Object3D;
}

// ─── GrudgeEngine ─────────────────────────────────────────────────────────────
export class GrudgeEngine {
  private static _instance: GrudgeEngine | null = null;

  // Three.js
  renderer!: THREE.WebGLRenderer;
  scene!:    THREE.Scene;
  camera!:   THREE.PerspectiveCamera;
  clock!:    THREE.Clock;

  // Lighting
  shadowLight!: THREE.DirectionalLight;
  gridHelper!:  THREE.GridHelper;

  // Cannon-ES
  world!: CANNON.World;

  // Engine state
  private _updates:  Updatable[] = [];
  private _rafId:    number = 0;
  private _running:  boolean = false;
  private _role:     HasBodyAndMesh | null = null;
  private _canvas:   HTMLCanvasElement | null = null;
  private _onWindowResize = () => {
    if (this._canvas) this._onResize(this._canvas);
  };

  private _onVisibility = () => {
    if (document.hidden) {
      if (this._running && this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = 0;
      }
    } else if (this._running && !this._rafId) {
      this._rafId = requestAnimationFrame(this._animate);
    }
  };

  // Camera config (mirrors annihilate's cameraDist = 15)
  cameraDist = 15;
  cameraOffsetX = 0;
  cameraOffsetY = 15;  // above the character
  cameraOffsetZ = 15;  // behind the character

  private constructor() {}

  static getInstance(): GrudgeEngine {
    if (!GrudgeEngine._instance) {
      GrudgeEngine._instance = new GrudgeEngine();
    }
    return GrudgeEngine._instance;
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  init(canvas: HTMLCanvasElement): void {
    this._initRenderer(canvas);
    this._initPhysics();
  }

  private _initRenderer(canvas: HTMLCanvasElement): void {
    // Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / canvas.clientHeight,
      1,
      370
    );
    this.camera.position.set(this.cameraOffsetX, this.cameraOffsetY, this.cameraOffsetZ);
    this.camera.lookAt(0, 0, 0);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 30, 200);

    // Clock
    this.clock = new THREE.Clock();

    // Ambient light
    const hemi = new THREE.HemisphereLight(0x888888, 0x333333);
    hemi.position.set(0, 7.41, 0);
    this.scene.add(hemi);

    // Shadow directional light (tracks active role like annihilate)
    this.shadowLight = new THREE.DirectionalLight(0xaaaaaa);
    this.shadowLight.position.set(0, 37, 0);
    this.shadowLight.castShadow = true;
    this.shadowLight.shadow.mapSize.width  = 2048;
    this.shadowLight.shadow.mapSize.height = 2048;
    this.shadowLight.shadow.camera.near    = 1;
    this.shadowLight.shadow.camera.far     = 185;
    this.shadowLight.shadow.camera.right   = 37;
    this.shadowLight.shadow.camera.left    = -37;
    this.shadowLight.shadow.camera.top     = 37;
    this.shadowLight.shadow.camera.bottom  = -37;
    this.shadowLight.shadow.radius         = 0;
    this.scene.add(this.shadowLight);
    this.scene.add(this.shadowLight.target);

    // Fill light
    const fill = new THREE.DirectionalLight(0x333333);
    fill.position.set(1, 1, 3);
    this.scene.add(fill);

    // Grid
    this.gridHelper = new THREE.GridHelper(100, 100, 0x333333, 0x333333);
    this.gridHelper.position.y = 0.037;
    (this.gridHelper.material as THREE.Material).opacity = 0.15;
    (this.gridHelper.material as THREE.Material).transparent = true;
    this.scene.add(this.gridHelper);

    // Renderer — high-performance GPU, capped DPR, no unused buffers
    const mobile =
      typeof navigator !== 'undefined' &&
      /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const maxDpr = mobile ? 1.5 : 2;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Soften GPU cost of large shadow maps on low-end devices
    if (mobile) {
      this.shadowLight.shadow.mapSize.set(1024, 1024);
    }

    this._canvas = canvas;
    window.addEventListener('resize', this._onWindowResize);
    // Pause RAF when tab is hidden (battery + GPU)
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  private _initPhysics(): void {
    // fixedTimeStep & maxSubSteps match annihilate exactly
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -10, 0),
    });
    this.world.defaultContactMaterial.friction = 0.05;
    (this.world.broadphase as any) = new CANNON.NaiveBroadphase();

    // Bubble beginContact / endContact to individual bodies
    this.world.addEventListener('beginContact', (event: any) => {
      event.bodyA?.dispatchEvent({ type: 'beginContact', body: event.bodyB });
      event.bodyB?.dispatchEvent({ type: 'beginContact', body: event.bodyA });
    });
    this.world.addEventListener('endContact', (event: any) => {
      event.bodyA?.dispatchEvent({ type: 'endContact', body: event.bodyB });
      event.bodyB?.dispatchEvent({ type: 'endContact', body: event.bodyA });
    });
  }

  // ── Update registration ────────────────────────────────────────────────────

  addToUpdate(entity: Updatable): void {
    if (!this._updates.includes(entity)) this._updates.push(entity);
  }

  removeFromUpdate(entity: Updatable): void {
    this._updates = this._updates.filter(u => u !== entity);
  }

  /** Set the active role that the camera + shadow light follow */
  setRole(role: HasBodyAndMesh): void {
    this._role = role;
  }

  // ── RAF loop ───────────────────────────────────────────────────────────────

  start(): void {
    if (this._running) return;
    this._running = true;
    this.clock.start();
    this._animate();
  }

  stop(): void {
    this._running = false;
    cancelAnimationFrame(this._rafId);
    this.clock.stop();
  }

  /** Full teardown — resets singleton so next init() works on a new canvas */
  destroy(): void {
    this.stop();
    window.removeEventListener('resize', this._onWindowResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this._canvas = null;
    this.renderer?.dispose();
    this.world?.bodies.forEach(b => this.world.removeBody(b));
    this._updates = [];
    this._role = null;
    GrudgeEngine._instance = null;
  }

  private _animate = (): void => {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._animate);

    const dt = Math.min(this.clock.getDelta(), MAX_DT);
    const time = this.clock.elapsedTime;

    // Tick all entities
    for (const entity of this._updates) {
      entity.update(dt, time);
    }

    // Camera + shadow follow active role
    if (this._role?.mesh) {
      const pos = this._role.mesh.position;
      this.camera.position.set(
        pos.x + this.cameraOffsetX,
        pos.y + this.cameraOffsetY,
        pos.z + this.cameraOffsetZ
      );
      // Keep camera looking slightly in front of the character
      this.camera.lookAt(pos.x, pos.y + 1, pos.z);
    }
    if (this._role?.body) {
      const bp = this._role.body.position;
      this.shadowLight.position.x         = bp.x;
      this.shadowLight.position.z         = bp.z;
      this.shadowLight.target.position.x  = bp.x;
      this.shadowLight.target.position.z  = bp.z;
      this.shadowLight.target.updateMatrixWorld();
      this.gridHelper.position.x = Math.round(bp.x);
      this.gridHelper.position.z = Math.round(bp.z);
    }

    // Step physics (fixedTimeStep=1/60, maxSubSteps=3 — matches annihilate)
    this.world.step(1 / 60, dt, 3);

    this.renderer.render(this.scene, this.camera);
  };

  private _onResize(canvas: HTMLCanvasElement): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 1 || h < 1) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const mobile =
      typeof navigator !== 'undefined' &&
      /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const maxDpr = mobile ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.setSize(w, h, false);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Add a static ground plane to the scene + physics world.
   * COLOR defaults to dark purple-grey to match Grudge aesthetic.
   */
  addGround(color = 0x2a1a3e, size = 100): void {
    // Visual
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Physics — MUST set collisionFilterGroup to GROUP_SCENE so character
    // capsule bodies (mask includes GROUP_SCENE) and raycasts detect it.
    const body = new CANNON.Body({
      mass: 0,
      collisionFilterGroup: GROUP_SCENE,
      collisionFilterMask: GROUP_ROLE | GROUP_ENEMY | GROUP_ROLE_ATTACKER | GROUP_ENEMY_ATTACKER,
    });
    body.addShape(new CANNON.Plane());
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    (body as any).belongTo = { isScene: true, isGround: true };
    this.world.addBody(body);
  }

  /**
   * Add a static box to the scene + physics world (GROUP_SCENE) so it acts as
   * walls, ramps, ledges or steps. `rotation` is XYZ Euler radians, which lets
   * you build slopes (rotate about X/Z) for foot-IK / slope-movement testing.
   */
  addBox(opts: {
    size: [number, number, number];
    position: [number, number, number];
    rotation?: [number, number, number];
    color?: number;
  }): void {
    const [sx, sy, sz] = opts.size;
    const [px, py, pz] = opts.position;
    const [rx, ry, rz] = opts.rotation ?? [0, 0, 0];
    const color = opts.color ?? 0x3a2a5e;

    // Visual
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(px, py, pz);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Physics (static) — GROUP_SCENE so capsules + raycasts detect it.
    const body = new CANNON.Body({
      mass: 0,
      collisionFilterGroup: GROUP_SCENE,
      collisionFilterMask: GROUP_ROLE | GROUP_ENEMY | GROUP_ROLE_ATTACKER | GROUP_ENEMY_ATTACKER,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)));
    body.position.set(px, py, pz);
    body.quaternion.setFromEuler(rx, ry, rz);
    (body as any).belongTo = { isScene: true };
    this.world.addBody(body);
  }
}
