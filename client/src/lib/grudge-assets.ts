/**
 * Grudge Asset Loader — shared across all games
 *
 * Loads GLB/GLTF models from the Grudge R2 CDN (assets.grudge-studio.com)
 * with in-memory caching, loading progress, and fallback geometry when
 * models are unavailable.
 *
 * Usage:
 *   import { GrudgeAssets } from '@/lib/grudge-assets';
 *   const assets = GrudgeAssets.getInstance();
 *   const model = await assets.loadModel('toon-shooter/guns/AK.glb');
 *   scene.add(model.scene.clone());
 */

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ═══════════════════════════════════════════════════════════════════
// CDN + Object Storage Config
// ═══════════════════════════════════════════════════════════════════

const CDN_BASE = 'https://assets.grudge-studio.com';
const OBJECTSTORE_API = 'https://objectstore.grudge-studio.com/v1';

// ═══════════════════════════════════════════════════════════════════
// Asset Manifest — maps game entities to real R2 CDN paths
// ═══════════════════════════════════════════════════════════════════

export interface AssetEntry {
  path: string;        // R2 path relative to CDN_BASE (e.g. "toon-shooter/guns/AK.glb")
  sizeKB?: number;
  tags?: string[];
}

/**
 * Known working GLB assets on the R2 CDN.
 * These are confirmed uploaded and accessible.
 *
 * Games reference assets by key — the loader resolves to CDN URL.
 */
export const ASSET_MANIFEST: Record<string, AssetEntry> = {
  // ── Characters ───────────────────────────────────────────────────
  'char_enemy':   { path: 'toon-shooter/characters/Character_Enemy.glb', sizeKB: 1233, tags: ['character', 'enemy'] },
  'char_hazmat':  { path: 'toon-shooter/characters/Character_Hazmat.glb', sizeKB: 1273, tags: ['character'] },
  'char_soldier': { path: 'toon-shooter/characters/Character_Soldier.glb', sizeKB: 1283, tags: ['character', 'player'] },

  // ── Weapons ──────────────────────────────────────────────────────
  'weapon_ak':             { path: 'toon-shooter/guns/AK.glb', sizeKB: 57, tags: ['weapon', 'ranged'] },
  'weapon_pistol':         { path: 'toon-shooter/guns/Pistol.glb', sizeKB: 41, tags: ['weapon', 'ranged'] },
  'weapon_shotgun':        { path: 'toon-shooter/guns/Shotgun.glb', sizeKB: 47, tags: ['weapon', 'ranged'] },
  'weapon_smg':            { path: 'toon-shooter/guns/SMG.glb', sizeKB: 43, tags: ['weapon', 'ranged'] },
  'weapon_sniper':         { path: 'toon-shooter/guns/Sniper.glb', sizeKB: 83, tags: ['weapon', 'ranged'] },
  'weapon_revolver':       { path: 'toon-shooter/guns/Revolver.glb', sizeKB: 59, tags: ['weapon', 'ranged'] },
  'weapon_grenade':        { path: 'toon-shooter/guns/Grenade.glb', sizeKB: 24, tags: ['weapon', 'throwable'] },
  'weapon_fire_grenade':   { path: 'toon-shooter/guns/FireGrenade.glb', sizeKB: 29, tags: ['weapon', 'throwable'] },
  'weapon_grenade_launcher': { path: 'toon-shooter/guns/GrenadeLauncher.glb', sizeKB: 55, tags: ['weapon', 'ranged'] },
  'weapon_rocket_launcher': { path: 'toon-shooter/guns/RocketLauncher.glb', sizeKB: 50, tags: ['weapon', 'ranged'] },
  'weapon_knife_1':        { path: 'toon-shooter/guns/Knife_1.glb', sizeKB: 24, tags: ['weapon', 'melee'] },
  'weapon_knife_2':        { path: 'toon-shooter/guns/Knife_2.glb', sizeKB: 26, tags: ['weapon', 'melee'] },
  'weapon_shovel':         { path: 'toon-shooter/guns/Shovel.glb', sizeKB: 24, tags: ['weapon', 'melee'] },
  'weapon_short_cannon':   { path: 'toon-shooter/guns/ShortCannon.glb', sizeKB: 23, tags: ['weapon', 'siege'] },

  // ── Environment / Buildings ──────────────────────────────────────
  'env_tree_1':            { path: 'toon-shooter/environment/Tree_1.glb', sizeKB: 46, tags: ['environment', 'tree'] },
  'env_tree_2':            { path: 'toon-shooter/environment/Tree_2.glb', sizeKB: 31, tags: ['environment', 'tree'] },
  'env_tree_3':            { path: 'toon-shooter/environment/Tree_3.glb', sizeKB: 45, tags: ['environment', 'tree'] },
  'env_tree_4':            { path: 'toon-shooter/environment/Tree_4.glb', sizeKB: 20, tags: ['environment', 'tree'] },
  'env_structure_1':       { path: 'toon-shooter/environment/Structure_1.glb', sizeKB: 241, tags: ['environment', 'building'] },
  'env_structure_2':       { path: 'toon-shooter/environment/Structure_2.glb', sizeKB: 319, tags: ['environment', 'building'] },
  'env_structure_3':       { path: 'toon-shooter/environment/Structure_3.glb', sizeKB: 317, tags: ['environment', 'building'] },
  'env_structure_4':       { path: 'toon-shooter/environment/Structure_4.glb', sizeKB: 324, tags: ['environment', 'building'] },
  'env_crate':             { path: 'toon-shooter/environment/Crate.glb', sizeKB: 12, tags: ['environment', 'prop'] },
  'env_barrel':            { path: 'toon-shooter/environment/ExplodingBarrel.glb', sizeKB: 17, tags: ['environment', 'prop', 'destructible'] },
  'env_barrier':           { path: 'toon-shooter/environment/Barrier_Fixed.glb', sizeKB: 147, tags: ['environment', 'barrier'] },
  'env_sandbag':           { path: 'toon-shooter/environment/SackTrench.glb', sizeKB: 18, tags: ['environment', 'defense'] },
  'env_tank':              { path: 'toon-shooter/environment/Tank.glb', sizeKB: 106, tags: ['environment', 'vehicle'] },
  'env_fence':             { path: 'toon-shooter/environment/Fence.glb', sizeKB: 6, tags: ['environment', 'wall'] },
  'env_metal_fence':       { path: 'toon-shooter/environment/MetalFence.glb', sizeKB: 86, tags: ['environment', 'wall'] },
  'env_brick_wall':        { path: 'toon-shooter/environment/BrickWall_1.glb', sizeKB: 7, tags: ['environment', 'wall'] },
  'env_street_light':      { path: 'toon-shooter/environment/StreetLight.glb', sizeKB: 10, tags: ['environment', 'light'] },
  'env_bear_trap':         { path: 'toon-shooter/environment/BearTrap_Open.glb', sizeKB: 24, tags: ['environment', 'trap'] },
  'env_landmine':          { path: 'toon-shooter/environment/Landmine.glb', sizeKB: 12, tags: ['environment', 'trap'] },
  'env_health':            { path: 'toon-shooter/environment/Health.glb', sizeKB: 25, tags: ['pickup', 'health'] },
  'env_key':               { path: 'toon-shooter/environment/Key.glb', sizeKB: 12, tags: ['pickup', 'key'] },
};

// ═══════════════════════════════════════════════════════════════════
// RTS Asset Mapping — maps Grudge RTS data IDs to manifest keys
// ═══════════════════════════════════════════════════════════════════

/** Map RTS unit/building IDs to the best available 3D model */
export const RTS_MODEL_MAP: Record<string, string> = {
  // Crusade units
  'sky_serf':         'char_soldier',
  'valor_guard':      'char_soldier',
  'fate_lancer':      'char_soldier',
  'rune_marksman':    'char_soldier',
  'thunder_charger':  'char_soldier',
  'cosmic_ram':       'env_tank',
  'wisdom_seer':      'char_hazmat',
  'raven_scout':      'char_soldier',
  'eye_watcher':      'char_hazmat',
  // Fabled units
  'grove_tender':     'char_soldier',
  'root_warden':      'char_soldier',
  'stone_sentinel':   'char_soldier',
  'leaf_archer':      'char_soldier',
  'grove_rider':      'char_soldier',
  'treant_ram':       'env_tank',
  'nature_channeler': 'char_hazmat',
  'bark_scout':       'char_soldier',
  'sylph_watcher':    'char_hazmat',
  // Legion units
  'thrall_worker':    'char_enemy',
  'chaos_grunt':      'char_enemy',
  'doom_berserker':   'char_enemy',
  'shadow_hunter':    'char_enemy',
  'warg_rider':       'char_enemy',
  'doom_catapult':    'env_tank',
  'hex_shaman':       'char_enemy',
  'plague_bat':       'char_enemy',
  'void_wraith':      'char_enemy',
  // Buildings
  'odins_hall':       'env_structure_1',
  'valor_barracks':   'env_structure_2',
  'rune_archery':     'env_structure_3',
  'raven_tower':      'env_structure_4',
  'world_tree_hall':  'env_structure_1',
  'eternal_barracks': 'env_structure_2',
  'void_citadel':     'env_structure_1',
  'entropy_pit':      'env_structure_2',
  // Resources
  'gold':             'env_crate',
  'lumber':           'env_tree_1',
};

// ═══════════════════════════════════════════════════════════════════
// Singleton Loader
// ═══════════════════════════════════════════════════════════════════

export class GrudgeAssets {
  private static _instance: GrudgeAssets | null = null;
  private _loader: GLTFLoader;
  private _cache = new Map<string, GLTF>();
  private _loading = new Map<string, Promise<GLTF>>();
  private _failedPaths = new Set<string>();

  private constructor() {
    this._loader = new GLTFLoader();
  }

  static getInstance(): GrudgeAssets {
    if (!GrudgeAssets._instance) {
      GrudgeAssets._instance = new GrudgeAssets();
    }
    return GrudgeAssets._instance;
  }

  /** Resolve a manifest key or raw path to a full CDN URL */
  resolveURL(keyOrPath: string): string {
    const entry = ASSET_MANIFEST[keyOrPath];
    if (entry) return `${CDN_BASE}/${entry.path}`;
    // If it starts with http, use as-is
    if (keyOrPath.startsWith('http')) return keyOrPath;
    // Otherwise treat as relative R2 path
    return `${CDN_BASE}/${keyOrPath}`;
  }

  /** Load a GLB/GLTF by manifest key or CDN-relative path. Returns cached if available. */
  async loadModel(keyOrPath: string): Promise<GLTF | null> {
    const url = this.resolveURL(keyOrPath);

    // Return cached
    if (this._cache.has(url)) return this._cache.get(url)!;

    // Return in-flight promise
    if (this._loading.has(url)) return this._loading.get(url)!;

    // Skip known failures
    if (this._failedPaths.has(url)) return null;

    const promise = new Promise<GLTF>((resolve, reject) => {
      this._loader.load(
        url,
        (gltf) => {
          this._cache.set(url, gltf);
          this._loading.delete(url);
          resolve(gltf);
        },
        undefined, // progress
        (error) => {
          console.warn(`[GrudgeAssets] Failed to load ${url}:`, error);
          this._failedPaths.add(url);
          this._loading.delete(url);
          reject(error);
        },
      );
    });

    this._loading.set(url, promise);

    try {
      return await promise;
    } catch {
      return null;
    }
  }

  /** Clone a loaded model's scene graph. Returns null if not yet loaded. */
  cloneModel(keyOrPath: string): THREE.Group | null {
    const url = this.resolveURL(keyOrPath);
    const gltf = this._cache.get(url);
    if (!gltf) return null;
    const clone = gltf.scene.clone();
    return clone;
  }

  /**
   * Load a model for an RTS entity. Uses RTS_MODEL_MAP to find the best match.
   * Returns a colored fallback geometry if the model isn't available yet.
   */
  async loadRTSModel(entityId: string, fallbackColor: number = 0x888888, fallbackScale: number = 1): Promise<THREE.Object3D> {
    const manifestKey = RTS_MODEL_MAP[entityId];
    if (manifestKey) {
      const gltf = await this.loadModel(manifestKey);
      if (gltf) {
        const clone = gltf.scene.clone();
        clone.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).castShadow = true;
            (child as THREE.Mesh).receiveShadow = true;
          }
        });
        return clone;
      }
    }
    // Fallback: colored capsule
    return this.createFallbackMesh(fallbackColor, fallbackScale);
  }

  /** Create a simple colored capsule as fallback when model isn't loaded */
  createFallbackMesh(color: number, scale: number = 1): THREE.Mesh {
    const geometry = new THREE.CapsuleGeometry(0.3 * scale, 0.6 * scale, 8, 16);
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.7,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Preload a batch of assets (e.g. all assets for a faction) */
  async preload(keys: string[], onProgress?: (loaded: number, total: number) => void): Promise<void> {
    let loaded = 0;
    const total = keys.length;
    await Promise.allSettled(
      keys.map(async (key) => {
        await this.loadModel(key);
        loaded++;
        onProgress?.(loaded, total);
      }),
    );
  }

  /** Get all manifest entries matching a tag */
  getByTag(tag: string): Array<{ key: string; entry: AssetEntry }> {
    return Object.entries(ASSET_MANIFEST)
      .filter(([, entry]) => entry.tags?.includes(tag))
      .map(([key, entry]) => ({ key, entry }));
  }

  /** Check how many assets are cached */
  get cacheSize(): number {
    return this._cache.size;
  }

  /** Clear the entire cache (useful for memory cleanup) */
  clearCache(): void {
    this._cache.clear();
    this._failedPaths.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════
// AnimatedUnit — wraps a GLTF character with state-driven animations
// ═══════════════════════════════════════════════════════════════════

/**
 * Animation states for RTS/game units.
 * Maps to the toon-shooter character animation clips:
 *   Idle, Run, Punch (attack), HitReact (hurt), Death, Idle_Shoot (attack2)
 */
export type UnitAnimState = 'idle' | 'run' | 'attack' | 'hurt' | 'death' | 'attack2';

/** Maps our state names to the actual clip names in the GLB files */
const ANIM_CLIP_MAP: Record<UnitAnimState, string> = {
  idle:    'Idle',
  run:     'Run',
  attack:  'Punch',
  hurt:    'HitReact',
  death:   'Death',
  attack2: 'Idle_Shoot',
};

/** Which states loop vs play once */
const ANIM_LOOP_MAP: Record<UnitAnimState, boolean> = {
  idle:    true,
  run:     true,
  attack:  false,
  hurt:    false,
  death:   false,
  attack2: false,
};

/** Default crossfade duration in seconds */
const CROSSFADE_DURATION = 0.15;

export class AnimatedUnit {
  readonly root: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  private _actions: Partial<Record<UnitAnimState, THREE.AnimationAction>> = {};
  private _currentState: UnitAnimState = 'idle';
  private _currentAction: THREE.AnimationAction | null = null;
  private _dead = false;

  /** Faction tint color applied to all mesh materials */
  factionColor: number;

  constructor(gltfScene: THREE.Group, clips: THREE.AnimationClip[], factionColor: number = 0xffffff, scale: number = 0.5) {
    this.root = gltfScene;
    this.root.scale.setScalar(scale);
    this.factionColor = factionColor;
    this.mixer = new THREE.AnimationMixer(this.root);

    // Build action map from available clips
    for (const [state, clipName] of Object.entries(ANIM_CLIP_MAP)) {
      const clip = clips.find(c => c.name === clipName);
      if (clip) {
        const action = this.mixer.clipAction(clip);
        const loops = ANIM_LOOP_MAP[state as UnitAnimState];
        action.setLoop(loops ? THREE.LoopRepeat : THREE.LoopOnce, loops ? Infinity : 1);
        if (!loops) action.clampWhenFinished = true;
        this._actions[state as UnitAnimState] = action;
      }
    }

    // Apply faction color tint to all meshes
    this._applyFactionColor(factionColor);

    // Enable shadows
    this.root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).castShadow = true;
        (child as THREE.Mesh).receiveShadow = true;
      }
    });

    // Start in idle
    this.play('idle');

    // Listen for one-shot animations finishing → return to idle
    this.mixer.addEventListener('finished', (e: any) => {
      const finishedAction = e.action as THREE.AnimationAction;
      // If death finished, stay dead
      if (finishedAction === this._actions.death) return;
      // Otherwise go back to idle (or run if we were moving)
      if (this._currentState !== 'idle' && this._currentState !== 'run') {
        this.play('idle');
      }
    });
  }

  /** Get current animation state */
  get state(): UnitAnimState { return this._currentState; }

  /** Is the unit dead (death animation played) */
  get isDead(): boolean { return this._dead; }

  /** Transition to a new animation state with crossfade */
  play(state: UnitAnimState): void {
    if (this._dead && state !== 'death') return; // Can't animate a dead unit
    if (state === this._currentState && this._currentAction?.isRunning()) return;

    const newAction = this._actions[state];
    if (!newAction) return;

    if (state === 'death') this._dead = true;

    // Crossfade from current to new
    if (this._currentAction && this._currentAction !== newAction) {
      newAction.reset();
      newAction.setEffectiveWeight(1);
      this._currentAction.crossFadeTo(newAction, CROSSFADE_DURATION, true);
      newAction.play();
    } else {
      newAction.reset().play();
    }

    this._currentAction = newAction;
    this._currentState = state;
  }

  /** Update the mixer — call every frame with delta time in seconds */
  update(dt: number): void {
    this.mixer.update(dt);
  }

  /** Set world position */
  setPosition(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z);
  }

  /** Face a target direction (y-axis rotation) */
  lookAt(targetX: number, targetZ: number): void {
    const dx = targetX - this.root.position.x;
    const dz = targetZ - this.root.position.z;
    if (dx !== 0 || dz !== 0) {
      this.root.rotation.y = Math.atan2(dx, dz);
    }
  }

  /** Apply faction color as emissive tint to all materials */
  private _applyFactionColor(color: number): void {
    const tint = new THREE.Color(color);
    this.root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach(m => {
            if ((m as THREE.MeshStandardMaterial).emissive) {
              (m as THREE.MeshStandardMaterial).emissive.copy(tint);
              (m as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
            }
          });
        } else if ((mat as THREE.MeshStandardMaterial).emissive) {
          (mat as THREE.MeshStandardMaterial).emissive.copy(tint);
          (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
        }
      }
    });
  }

  /** Change faction color at runtime */
  setFactionColor(color: number): void {
    this.factionColor = color;
    this._applyFactionColor(color);
  }

  /** Dispose of all resources */
  dispose(): void {
    this.mixer.stopAllAction();
    this.root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).geometry?.dispose();
        const mat = (child as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      }
    });
  }
}

/**
 * Create an AnimatedUnit from a manifest key.
 * Loads the GLB, clones the scene, and wraps it with the animation state machine.
 */
export async function createAnimatedUnit(
  manifestKey: string,
  factionColor: number = 0xffffff,
  scale: number = 0.5,
): Promise<AnimatedUnit | null> {
  const assets = GrudgeAssets.getInstance();
  const gltf = await assets.loadModel(manifestKey);
  if (!gltf) return null;

  // Clone scene and animations
  const clone = gltf.scene.clone();
  // Deep clone skeleton for independent animation
  const clips = gltf.animations;

  return new AnimatedUnit(clone, clips, factionColor, scale);
}

/**
 * Create an animated unit for a specific RTS entity.
 * Maps entity ID → character model, applies faction color.
 */
export async function createRTSAnimatedUnit(
  entityId: string,
  factionColor: number,
  scale: number = 0.5,
): Promise<AnimatedUnit | null> {
  const manifestKey = RTS_MODEL_MAP[entityId];
  if (!manifestKey) return null;
  return createAnimatedUnit(manifestKey, factionColor, scale);
}

// ═══════════════════════════════════════════════════════════════════
// Convenience exports
// ═══════════════════════════════════════════════════════════════════

/** Quick access to the singleton */
export function getAssets(): GrudgeAssets {
  return GrudgeAssets.getInstance();
}

/** Preload all trees (useful for RTS/TD map setup) */
export async function preloadTrees(): Promise<void> {
  const assets = getAssets();
  await assets.preload(['env_tree_1', 'env_tree_2', 'env_tree_3', 'env_tree_4']);
}

/** Preload all characters (useful for unit spawning) */
export async function preloadCharacters(): Promise<void> {
  const assets = getAssets();
  await assets.preload(['char_enemy', 'char_hazmat', 'char_soldier']);
}

/** Preload all weapons */
export async function preloadWeapons(): Promise<void> {
  const assets = getAssets();
  await assets.preload(Object.keys(ASSET_MANIFEST).filter(k => k.startsWith('weapon_')));
}

/** Preload everything needed for a Wargus/RTS match */
export async function preloadRTS(onProgress?: (loaded: number, total: number) => void): Promise<void> {
  const assets = getAssets();
  const keys = [
    ...Object.keys(ASSET_MANIFEST).filter(k => k.startsWith('char_')),
    ...Object.keys(ASSET_MANIFEST).filter(k => k.startsWith('env_tree')),
    ...Object.keys(ASSET_MANIFEST).filter(k => k.startsWith('env_structure')),
    'env_crate', 'env_barrel', 'env_sandbag', 'env_tank',
    'weapon_knife_1', 'weapon_short_cannon',
  ];
  await assets.preload(keys, onProgress);
}
