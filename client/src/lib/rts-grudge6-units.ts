/**
 * Wargus / Grudge RTS — grudge6 **character unit** loader only
 *
 * UNITS (this file):
 *  - Full race wardrobe GLB (mesh + atlas textures + Bip001 skeleton)
 *  - SkeletonUtils clone per instance (never plain scene.clone for skins)
 *  - Equip: armor-only workers; class gear for soldiers; bag/wood only while carrying
 *  - SI scale from visible skinned body + 100× decade fix
 *  - AnimationMixer + idle/walk/run/attack/gather clips
 *
 * NOT THIS FILE (different systems):
 *  - Buildings → wargus createBuilding: BoxGeometry + Rapier fixed cuboids, no skeleton
 *  - Siege vehicles → grudge-assets env_tank rigid GLB, no race equip / human SI fit
 *  - Resources → primitive trees/gold meshes
 *
 * SSOT: grudge6-modular-characters + character-correctness + world-scale
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  applyEquipmentVisibility,
  applyRtsWorkerKit,
  setCarryVisuals,
  type CarryVisual,
  type RaceId,
} from "@shared/character-meshes";
import type { CharacterPrefab } from "@shared/character-prefabs";
import { toUnarmedPrefab } from "@shared/game-roster";
import {
  loadRaceWardrobeGlb,
  prefabFromRaceClass,
  raceFbxCandidates,
  raceGlbCandidates,
  normalizeRaceModel,
  prepareRaceMaterials,
} from "@/engine/character/RaceEquipment";
import type { FactionId, UnitRole } from "@shared/grudge-rts-data";
import { FACTIONS, getUnit } from "@shared/grudge-rts-data";

const CDN = "https://assets.grudge-studio.com";
const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();

// ─── Race assignment per RTS unit ───────────────────────────────────

/** Faction primary race (workers + default) + secondary for variety. */
const FACTION_RACES: Record<FactionId, [RaceId, RaceId]> = {
  crusade: ["human", "barbarian"],
  fabled: ["elf", "dwarf"],
  legion: ["orc", "undead"],
};

/**
 * Map RTS unit id → race + class loadout mode.
 * Workers always unarmed (armor only, no bag/wood until gather).
 */
export function raceForRtsUnit(
  unitId: string,
  faction: FactionId,
): { race: RaceId; classId: "warrior" | "mage" | "ranger" | "worge"; unarmed: boolean } {
  const def = getUnit(unitId);
  const [primary, secondary] = FACTION_RACES[faction] ?? FACTIONS[faction]?.races ?? ["human", "human"];
  const role = def?.role ?? "melee";

  if (role === "worker") {
    return { race: primary as RaceId, classId: "warrior", unarmed: true };
  }
  if (role === "ranged" || role === "recon" || role === "air") {
    return { race: (role === "recon" ? secondary : primary) as RaceId, classId: "ranger", unarmed: false };
  }
  if (role === "support") {
    return { race: secondary as RaceId, classId: "mage", unarmed: false };
  }
  if (role === "cavalry") {
    return { race: secondary as RaceId, classId: "warrior", unarmed: false };
  }
  // melee / siege / default
  return { race: primary as RaceId, classId: "warrior", unarmed: false };
}

// ─── Animation clip catalogue (CDN Bip001 packs) ────────────────────

const ANIM_URLS: Record<string, string[]> = {
  idle: [
    `${CDN}/models/animations/grudge6_brb/base/Idle.glb`,
    `${CDN}/models/animations/grudge6_brb/base/Idle.fbx`,
  ],
  walk: [
    `${CDN}/models/animations/glocomotion/walk.glb`,
    `${CDN}/models/animations/glocomotion/Walking.glb`,
    `${CDN}/models/animations/glocomotion/walking.glb`,
    `${CDN}/models/animations/grudge6_brb/base/Walk.glb`,
    `${CDN}/models/animations/grudge6_brb/base/Walking.glb`,
  ],
  run: [
    `${CDN}/models/animations/glocomotion/run.glb`,
    `${CDN}/models/animations/glocomotion/Running.glb`,
    `${CDN}/models/animations/glocomotion/running.glb`,
    `${CDN}/models/animations/grudge6_brb/base/Run.glb`,
    `${CDN}/models/animations/grudge6_brb/base/Running.glb`,
  ],
  attack: [
    `${CDN}/models/animations/glocomotion/punching.glb`,
    `${CDN}/models/animations/grudge6_brb/base/Punching.glb`,
    `${CDN}/models/animations/grudge6_brb/base/Punch.glb`,
  ],
  hurt: [
    `${CDN}/models/animations/glocomotion/hit.glb`,
    `${CDN}/models/animations/grudge6_brb/base/Hit.glb`,
    `${CDN}/models/animations/grudge6_brb/base/HitReact.glb`,
  ],
  death: [
    `${CDN}/models/animations/glocomotion/death.glb`,
    `${CDN}/models/animations/grudge6_brb/base/Death.glb`,
  ],
  gather: [
    `${CDN}/models/animations/glocomotion/punching.glb`,
    `${CDN}/models/animations/grudge6_brb/base/Punching.glb`,
  ],
};

const clipCache = new Map<string, Promise<THREE.AnimationClip | null>>();

function stripPositionTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  const next = clip.clone();
  next.tracks = next.tracks.filter((t) => !/\.position$/.test(t.name));
  return next;
}

/** Rematch Mixamo / spaced bone names onto Bip001 tracks when possible. */
function rematchClipBones(clip: THREE.AnimationClip, root: THREE.Object3D): THREE.AnimationClip {
  const boneNames = new Set<string>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone || o.type === "Bone") boneNames.add(o.name);
  });
  if (boneNames.size === 0) return clip;

  const next = clip.clone();
  for (const track of next.tracks) {
    const [node, ...rest] = track.name.split(".");
    if (!node || boneNames.has(node)) continue;
    // try Bip001 space form / underscore form
    const candidates = [
      node.replace(/_/g, " "),
      node.replace(/\s+/g, "_"),
      node.replace(/^mixamorig:?/i, "Bip001 "),
      node.replace(/^mixamorig:?/i, "Bip001_"),
      `Bip001 ${node}`,
      `Bip001_${node}`,
    ];
    const hit = candidates.find((c) => boneNames.has(c));
    if (hit) track.name = [hit, ...rest].join(".");
  }
  return next;
}

async function loadClipFromUrl(url: string): Promise<THREE.AnimationClip | null> {
  if (clipCache.has(url)) return clipCache.get(url)!;
  const p = (async () => {
    try {
      if (url.endsWith(".fbx")) {
        const fbx = await fbxLoader.loadAsync(url);
        const clip = fbx.animations?.[0];
        return clip ? stripPositionTracks(clip) : null;
      }
      const gltf = await gltfLoader.loadAsync(url);
      const clip = gltf.animations?.[0];
      return clip ? stripPositionTracks(clip) : null;
    } catch {
      return null;
    }
  })();
  clipCache.set(url, p);
  return p;
}

async function loadNamedClip(
  logical: string,
  root: THREE.Object3D,
  embedded: THREE.AnimationClip[],
): Promise<THREE.AnimationClip | null> {
  // Prefer embedded clips with fuzzy name match
  const aliases: Record<string, RegExp> = {
    idle: /idle|stand/i,
    walk: /walk|swagger/i,
    run: /run|sprint/i,
    attack: /attack|punch|slash|strike|melee/i,
    hurt: /hit|hurt|react|damage/i,
    death: /death|die|dead/i,
    gather: /gather|chop|mine|work|punch|attack/i,
  };
  const re = aliases[logical];
  if (re) {
    const emb = embedded.find((c) => re.test(c.name));
    if (emb) return rematchClipBones(stripPositionTracks(emb), root);
  }

  for (const url of ANIM_URLS[logical] ?? []) {
    const clip = await loadClipFromUrl(url);
    if (clip) {
      clip.name = logical;
      return rematchClipBones(clip, root);
    }
  }
  return null;
}

// ─── RTS animated unit ──────────────────────────────────────────────

export type RtsAnimState =
  | "idle"
  | "run"
  | "walk"
  | "attack"
  | "attack2"
  | "hurt"
  | "death"
  | "gather";

const LOOP: Record<RtsAnimState, boolean> = {
  idle: true,
  run: true,
  walk: true,
  attack: false,
  attack2: false,
  hurt: false,
  death: false,
  gather: false,
};

const CROSSFADE = 0.12;

/**
 * Drop-in compatible with AnimatedUnit used by wargus.tsx
 * (play / update / setPosition / lookAt / dispose / state / isDead).
 */
export class Grudge6RtsUnit {
  readonly root: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  readonly isWorker: boolean;
  readonly race: RaceId;
  readonly prefab: CharacterPrefab;

  private _actions: Partial<Record<RtsAnimState, THREE.AnimationAction>> = {};
  private _currentState: RtsAnimState = "idle";
  private _currentAction: THREE.AnimationAction | null = null;
  private _dead = false;
  private _carry: CarryVisual = "none";
  private _model: THREE.Object3D;
  /** Art-forward offset so lookAt faces travel direction (grudge6 FBX often +X). */
  private _yawOffset = Math.PI / 2;
  private _attackCooldown = 0;
  private _gatherCooldown = 0;

  factionColor: number;

  constructor(
    model: THREE.Object3D,
    clips: Partial<Record<RtsAnimState, THREE.AnimationClip>>,
    opts: {
      factionColor: number;
      isWorker: boolean;
      race: RaceId;
      prefab: CharacterPrefab;
      yawOffset?: number;
    },
  ) {
    this.root = new THREE.Group();
    this.root.name = "rts-unit-root";
    this._model = model;
    this.root.add(model);
    this.factionColor = opts.factionColor;
    this.isWorker = opts.isWorker;
    this.race = opts.race;
    this.prefab = opts.prefab;
    if (opts.yawOffset != null) this._yawOffset = opts.yawOffset;

    this.mixer = new THREE.AnimationMixer(model);

    for (const [state, clip] of Object.entries(clips) as [RtsAnimState, THREE.AnimationClip | undefined][]) {
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      const loop = LOOP[state];
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      if (!loop) action.clampWhenFinished = true;
      this._actions[state] = action;
    }

    // Fallbacks: walk←run, run←walk, attack2←attack, gather←attack
    if (!this._actions.walk && this._actions.run) this._actions.walk = this._actions.run;
    if (!this._actions.run && this._actions.walk) this._actions.run = this._actions.walk;
    if (!this._actions.attack2 && this._actions.attack) this._actions.attack2 = this._actions.attack;
    if (!this._actions.gather && this._actions.attack) this._actions.gather = this._actions.attack;
    if (!this._actions.hurt && this._actions.idle) {
      // soft reuse idle for missing hurt
    }

    this.mixer.addEventListener("finished", (e: { action: THREE.AnimationAction }) => {
      if (e.action === this._actions.death) return;
      if (this._currentState !== "idle" && this._currentState !== "run" && this._currentState !== "walk") {
        this.play("idle");
      }
    });

    // Ensure bag/wood hidden at spawn
    setCarryVisuals(this._model, "none");
    this.play("idle");
  }

  get state(): RtsAnimState {
    return this._currentState;
  }
  get isDead(): boolean {
    return this._dead;
  }
  get carry(): CarryVisual {
    return this._carry;
  }

  play(state: RtsAnimState | string): void {
    const s = state as RtsAnimState;
    if (this._dead && s !== "death") return;
    if (s === this._currentState && this._currentAction?.isRunning()) return;
    // normalize legacy clip names from wargus
    const mapped: RtsAnimState =
      s === ("attack2" as RtsAnimState)
        ? "attack2"
        : (s as RtsAnimState);

    const state = mapped;
    // Rate-limit one-shots so RTS tick spam doesn't restart clips every frame
    if (state === "attack" || state === "attack2") {
      if (this._attackCooldown > 0 && this._currentState === state) return;
      this._attackCooldown = 0.55;
    }
    if (state === "gather") {
      if (this._gatherCooldown > 0 && this._currentState === state) return;
      this._gatherCooldown = 0.7;
    }

    let newAction = this._actions[state];
    if (!newAction && state === "run") newAction = this._actions.walk ?? this._actions.idle ?? null;
    if (!newAction && state === "walk") newAction = this._actions.run ?? this._actions.idle ?? null;
    if (!newAction && (state === "attack" || state === "attack2" || state === "gather")) {
      newAction = this._actions.attack ?? this._actions.idle ?? null;
    }
    if (!newAction) return;

    if (state === "death") this._dead = true;

    if (this._currentAction && this._currentAction !== newAction) {
      newAction.reset();
      newAction.setEffectiveWeight(1);
      // RTS gather/attack slightly faster for snappy response
      if (state === "gather" || state === "attack" || state === "attack2") {
        newAction.timeScale = 1.25;
      } else {
        newAction.timeScale = 1;
      }
      this._currentAction.crossFadeTo(newAction, CROSSFADE, true);
      newAction.play();
    } else {
      newAction.reset().play();
    }

    this._currentAction = newAction;
    this._currentState = state;
  }

  update(dt: number): void {
    if (this._attackCooldown > 0) this._attackCooldown -= dt;
    if (this._gatherCooldown > 0) this._gatherCooldown -= dt;
    this.mixer.update(dt);
  }

  setPosition(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z);
  }

  lookAt(targetX: number, targetZ: number): void {
    const dx = targetX - this.root.position.x;
    const dz = targetZ - this.root.position.z;
    if (dx === 0 && dz === 0) return;
    // Controller faces +Z travel; art-forward offset for grudge6 kits
    this.root.rotation.y = Math.atan2(dx, dz) + this._yawOffset;
  }

  /**
   * Workers: show lumber stick only when hauling wood; bag only for gold.
   * Non-workers: no-op (class gear stays as equipped).
   */
  setCarrying(resource: "gold" | "lumber" | null): void {
    if (!this.isWorker) return;
    const next: CarryVisual =
      resource === "gold" ? "gold" : resource === "lumber" ? "lumber" : "none";
    if (next === this._carry) return;
    this._carry = next;
    setCarryVisuals(this._model, next);
  }

  setFactionColor(_color: number): void {
    /* atlas materials preserved; faction color is selection UI only */
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      }
    });
  }
}

// ─── Public factory ─────────────────────────────────────────────────

export type CreateRtsUnitOpts = {
  unitId: string;
  faction: FactionId;
  factionColor: number;
  role?: UnitRole;
  /** SI height metres — workers ~1.65–1.75 (never scale weapons to 1.8) */
  targetHeight?: number;
};

/**
 * Correct order (do not invert):
 *  1. Load full race wardrobe
 *  2. Materials (atlas)
 *  3. Visibility: worker = armor only (applyRtsWorkerKit); combat = class equip
 *  4. SI scale from **visible body** + 100× decade fix
 *  5. Carry props forced off until gather
 */
export async function createGrudge6RtsUnit(
  opts: CreateRtsUnitOpts,
): Promise<Grudge6RtsUnit | null> {
  const { race, classId, unarmed } = raceForRtsUnit(opts.unitId, opts.faction);
  const basePrefab = prefabFromRaceClass(race, classId);
  const prefab: CharacterPrefab = unarmed
    ? {
        ...toUnarmedPrefab(basePrefab),
        equipment: {
          ...toUnarmedPrefab(basePrefab).equipment,
          body: "A",
          arms: "A",
          legs: "A",
          head: "A",
          shoulders: null,
          rightHand: null,
          rightHandType: null,
          leftHand: null,
          leftHandType: null,
          shield: null,
          utility: [],
        },
        animationPack: "unarmed",
      }
    : basePrefab;

  const role = opts.role ?? getUnit(opts.unitId)?.role ?? "melee";
  const targetH =
    opts.targetHeight ??
    (role === "siege" ? 2.2 : role === "cavalry" ? 1.9 : role === "worker" ? 1.7 : 1.8);

  let scene: THREE.Object3D;
  let embedded: THREE.AnimationClip[] = [];
  let fromFbx = false;

  try {
    // Raw wardrobe — do NOT equip/scale inside loadRaceWithEquipment (wrong order caused bag-blob)
    const loaded = await loadRaceWardrobeGlb(race);
    scene = loaded.scene;
    embedded = loaded.animations;
  } catch {
    try {
      const fbxUrls = raceFbxCandidates(race);
      let fbx: THREE.Group | null = null;
      for (const url of fbxUrls) {
        try {
          fbx = await fbxLoader.loadAsync(url);
          break;
        } catch {
          /* next */
        }
      }
      if (!fbx) return null;
      // Independent skeleton per unit (same bag-blob root cause as GLB clone)
      const { clone: skClone } = await import("three/examples/jsm/utils/SkeletonUtils.js");
      scene = skClone(fbx) as THREE.Group;
      embedded = (fbx.animations ?? []).map((c) => c.clone());
      fromFbx = true;
    } catch {
      return null;
    }
  }

  // Materials first (textures), then visibility, then scale
  prepareRaceMaterials(scene, {
    tint: opts.factionColor,
    enemy: opts.faction === "legion",
  });
  if (fromFbx) {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        if (std.map) {
          std.map.colorSpace = THREE.SRGBColorSpace;
          std.map.flipY = false;
        }
      }
    });
  }

  // ── Visibility (workers: NEVER bags/wood first) ──
  if (unarmed || role === "worker") {
    const kit = applyRtsWorkerKit(scene);
    if (typeof console !== "undefined" && kit.shown.length === 0) {
      console.warn("[createGrudge6RtsUnit] worker kit showed 0 armor meshes", race, kit);
    }
  } else {
    applyEquipmentVisibility(scene, prefab, "equipped");
    // Still strip utility bag/wood until gameplay needs them
    setCarryVisuals(scene, "none");
  }

  // Force carry props off (even if equip left them on)
  setCarryVisuals(scene, "none");

  // ── SI scale AFTER visibility (body only, decade fix) ──
  normalizeRaceModel(scene, targetH);
  scene.rotation.y = 0;

  const clipMap: Partial<Record<RtsAnimState, THREE.AnimationClip>> = {};
  const need: RtsAnimState[] = unarmed
    ? ["idle", "walk", "run", "attack", "gather", "hurt", "death"]
    : ["idle", "walk", "run", "attack", "attack2", "hurt", "death"];

  await Promise.all(
    need.map(async (name) => {
      const clip = await loadNamedClip(name, scene, embedded);
      if (clip) clipMap[name] = clip;
    }),
  );

  if (!clipMap.idle) {
    clipMap.idle = new THREE.AnimationClip("idle", 1, []);
  }

  const unit = new Grudge6RtsUnit(scene, clipMap, {
    factionColor: opts.factionColor,
    isWorker: unarmed || role === "worker",
    race,
    prefab,
    yawOffset: Math.PI / 2,
  });

  // Constructor also calls setCarryVisuals(none) — belt and suspenders
  return unit;
}

/** Preload race kits + idle/walk for a match (non-blocking progress). */
export async function preloadGrudge6Rts(
  factions: FactionId[] = ["crusade", "fabled", "legion"],
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const races = new Set<RaceId>();
  for (const f of factions) {
    const pair = FACTION_RACES[f];
    if (pair) {
      races.add(pair[0]);
      races.add(pair[1]);
    }
  }
  const raceList = [...races];
  let done = 0;
  const total = raceList.length + 2;
  await Promise.allSettled(
    raceList.map(async (race) => {
      for (const url of raceGlbCandidates(race)) {
        try {
          await gltfLoader.loadAsync(url);
          break;
        } catch {
          /* next */
        }
      }
      done++;
      onProgress?.(done, total);
    }),
  );
  // Warm idle + walk
  for (const logical of ["idle", "walk"] as const) {
    for (const url of ANIM_URLS[logical]) {
      const c = await loadClipFromUrl(url);
      if (c) break;
    }
    done++;
    onProgress?.(done, total);
  }
}

// ─── Building colliders (Cannon-es) ─────────────────────────────────

export type BuildingColliderSize = { w: number; h: number; d: number };

/** Footprint + height by building role for static box colliders. */
export function buildingColliderSize(role: string): BuildingColliderSize {
  switch (role) {
    case "economy":
      return { w: 3.2, h: 3.5, d: 3.2 };
    case "population":
      return { w: 2.0, h: 2.2, d: 2.0 };
    case "defense":
      return { w: 2.2, h: 4.0, d: 2.2 };
    case "melee_production":
    case "ranged_production":
    case "cavalry_production":
    case "siege_production":
    case "mage_production":
    case "worg_production":
      return { w: 2.6, h: 2.8, d: 2.6 };
    case "upgrade":
    case "armor_upgrade":
      return { w: 2.4, h: 2.6, d: 2.4 };
    default:
      return { w: 2.4, h: 2.5, d: 2.4 };
  }
}

/** Axis-aligned overlap test for placement (XZ footprint). */
export function buildingFootprintBlocks(
  x: number,
  z: number,
  size: BuildingColliderSize,
  others: Array<{ x: number; z: number; size: BuildingColliderSize }>,
  margin = 0.4,
): boolean {
  const hw = size.w / 2 + margin;
  const hd = size.d / 2 + margin;
  for (const o of others) {
    const ow = o.size.w / 2 + margin;
    const od = o.size.d / 2 + margin;
    if (
      Math.abs(x - o.x) < hw + ow &&
      Math.abs(z - o.z) < hd + od
    ) {
      return true;
    }
  }
  return false;
}
