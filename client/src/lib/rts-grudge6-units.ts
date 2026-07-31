/**
 * Wargus RTS — grudge6 **character unit** loader only.
 * Buildings use createBuilding (boxes + Rapier). Siege uses env_tank rigid GLB.
 *
 * Order: load wardrobe → SkeletonUtils clone (via loadRaceWardrobeGlb) → materials
 * → worker kit / equip → SI scale → anim clips.
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
  cloneRaceScene,
} from "@/engine/character/RaceEquipment";
import type { FactionId, UnitRole } from "@shared/grudge-rts-data";
import { FACTIONS, getUnit } from "@shared/grudge-rts-data";

const CDN = "https://assets.grudge-studio.com";
const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();

const FACTION_RACES: Record<FactionId, [RaceId, RaceId]> = {
  crusade: ["human", "barbarian"],
  fabled: ["elf", "dwarf"],
  legion: ["orc", "undead"],
};

export function raceForRtsUnit(
  unitId: string,
  faction: FactionId,
): { race: RaceId; classId: "warrior" | "mage" | "ranger" | "worge"; unarmed: boolean } {
  const def = getUnit(unitId);
  const [primary, secondary] = FACTION_RACES[faction] ?? (["human", "human"] as [RaceId, RaceId]);
  const role = def?.role ?? "melee";
  if (role === "worker") return { race: primary, classId: "warrior", unarmed: true };
  if (role === "ranged" || role === "recon" || role === "air") {
    return { race: role === "recon" ? secondary : primary, classId: "ranger", unarmed: false };
  }
  if (role === "support") return { race: secondary, classId: "mage", unarmed: false };
  if (role === "cavalry") return { race: secondary, classId: "warrior", unarmed: false };
  return { race: primary, classId: "warrior", unarmed: false };
}

const ANIM_URLS: Record<string, string[]> = {
  idle: [`${CDN}/models/animations/grudge6_brb/base/Idle.glb`, `${CDN}/models/animations/grudge6_brb/base/Idle.fbx`],
  walk: [`${CDN}/models/animations/glocomotion/walk.glb`, `${CDN}/models/animations/grudge6_brb/base/Walk.glb`],
  run: [`${CDN}/models/animations/glocomotion/run.glb`, `${CDN}/models/animations/grudge6_brb/base/Run.glb`],
  attack: [`${CDN}/models/animations/glocomotion/punching.glb`, `${CDN}/models/animations/grudge6_brb/base/Punching.glb`],
  hurt: [`${CDN}/models/animations/glocomotion/hit.glb`],
  death: [`${CDN}/models/animations/glocomotion/death.glb`],
  gather: [`${CDN}/models/animations/glocomotion/punching.glb`],
};

const clipCache = new Map<string, Promise<THREE.AnimationClip | null>>();

function stripPositionTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  const next = clip.clone();
  next.tracks = next.tracks.filter((t) => !/\.position$/i.test(t.name));
  return next;
}

async function loadClipFromUrl(url: string): Promise<THREE.AnimationClip | null> {
  if (clipCache.has(url)) return clipCache.get(url)!;
  const p = (async () => {
    try {
      if (url.endsWith(".fbx")) {
        const fbx = await fbxLoader.loadAsync(url);
        return fbx.animations?.[0] ? stripPositionTracks(fbx.animations[0]) : null;
      }
      const gltf = await gltfLoader.loadAsync(url);
      return gltf.animations?.[0] ? stripPositionTracks(gltf.animations[0]) : null;
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
    if (emb) return stripPositionTracks(emb);
  }
  for (const url of ANIM_URLS[logical] ?? []) {
    const clip = await loadClipFromUrl(url);
    if (clip) {
      clip.name = logical;
      return clip;
    }
  }
  void root;
  return null;
}

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
    if (!this._actions.walk && this._actions.run) this._actions.walk = this._actions.run;
    if (!this._actions.run && this._actions.walk) this._actions.run = this._actions.walk;
    if (!this._actions.attack2 && this._actions.attack) this._actions.attack2 = this._actions.attack;
    if (!this._actions.gather && this._actions.attack) this._actions.gather = this._actions.attack;

    this.mixer.addEventListener("finished", (e: { action: THREE.AnimationAction }) => {
      if (e.action === this._actions.death) return;
      if (this._currentState !== "idle" && this._currentState !== "run" && this._currentState !== "walk") {
        this.play("idle");
      }
    });

    setCarryVisuals(this._model, "none");
    this.play("idle");
  }

  get state(): RtsAnimState {
    return this._currentState;
  }
  get isDead(): boolean {
    return this._dead;
  }

  play(state: RtsAnimState | string): void {
    const s = state as RtsAnimState;
    if (this._dead && s !== "death") return;
    if (s === this._currentState && this._currentAction?.isRunning()) return;
    if (s === "attack" || s === "attack2") {
      if (this._attackCooldown > 0 && this._currentState === s) return;
      this._attackCooldown = 0.55;
    }
    if (s === "gather") {
      if (this._gatherCooldown > 0 && this._currentState === s) return;
      this._gatherCooldown = 0.7;
    }
    let newAction = this._actions[s];
    if (!newAction && s === "run") newAction = this._actions.walk ?? this._actions.idle ?? null;
    if (!newAction && (s === "attack" || s === "attack2" || s === "gather")) {
      newAction = this._actions.attack ?? this._actions.idle ?? null;
    }
    if (!newAction) return;
    if (s === "death") this._dead = true;
    if (this._currentAction && this._currentAction !== newAction) {
      newAction.reset();
      newAction.setEffectiveWeight(1);
      newAction.timeScale = s === "gather" || s === "attack" || s === "attack2" ? 1.25 : 1;
      this._currentAction.crossFadeTo(newAction, 0.12, true);
      newAction.play();
    } else {
      newAction.reset().play();
    }
    this._currentAction = newAction;
    this._currentState = s;
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
    this.root.rotation.y = Math.atan2(dx, dz) + this._yawOffset;
  }

  setCarrying(resource: "gold" | "lumber" | null): void {
    if (!this.isWorker) return;
    const next: CarryVisual =
      resource === "gold" ? "gold" : resource === "lumber" ? "lumber" : "none";
    if (next === this._carry) return;
    this._carry = next;
    setCarryVisuals(this._model, next);
  }

  dispose(): void {
    this.mixer.stopAllAction();
  }
}

export type CreateRtsUnitOpts = {
  unitId: string;
  faction: FactionId;
  factionColor: number;
  role?: UnitRole;
  targetHeight?: number;
};

export async function createGrudge6RtsUnit(opts: CreateRtsUnitOpts): Promise<Grudge6RtsUnit | null> {
  const { race, classId, unarmed } = raceForRtsUnit(opts.unitId, opts.faction);
  const basePrefab = prefabFromRaceClass(race, classId);
  const unarmedBase = toUnarmedPrefab(basePrefab);
  const prefab: CharacterPrefab = unarmed
    ? {
        ...unarmedBase,
        equipment: {
          ...unarmedBase.equipment,
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
    const loaded = await loadRaceWardrobeGlb(race);
    scene = loaded.scene;
    embedded = loaded.animations;
  } catch {
    try {
      let fbx: THREE.Group | null = null;
      for (const url of raceFbxCandidates(race)) {
        try {
          fbx = await fbxLoader.loadAsync(url);
          break;
        } catch {
          /* next */
        }
      }
      if (!fbx) return null;
      scene = cloneRaceScene(fbx);
      embedded = (fbx.animations ?? []).map((c) => c.clone());
      fromFbx = true;
    } catch {
      return null;
    }
  }

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

  if (unarmed || role === "worker") {
    applyRtsWorkerKit(scene);
  } else {
    applyEquipmentVisibility(scene, prefab, "equipped");
  }
  setCarryVisuals(scene, "none");
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
  if (!clipMap.idle) clipMap.idle = new THREE.AnimationClip("idle", 1, []);

  return new Grudge6RtsUnit(scene, clipMap, {
    factionColor: opts.factionColor,
    isWorker: unarmed || role === "worker",
    race,
    prefab,
    yawOffset: Math.PI / 2,
  });
}

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
  const list = [...races];
  let done = 0;
  await Promise.allSettled(
    list.map(async (race) => {
      for (const url of raceGlbCandidates(race)) {
        try {
          await gltfLoader.loadAsync(url);
          break;
        } catch {
          /* next */
        }
      }
      done++;
      onProgress?.(done, list.length);
    }),
  );
}

export type BuildingColliderSize = { w: number; h: number; d: number };

export function buildingColliderSize(role: string): BuildingColliderSize {
  switch (role) {
    case "economy":
      return { w: 3.2, h: 3.5, d: 3.2 };
    case "population":
      return { w: 2.0, h: 2.2, d: 2.0 };
    case "defense":
      return { w: 2.2, h: 4.0, d: 2.2 };
    default:
      return { w: 2.4, h: 2.5, d: 2.4 };
  }
}

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
    if (Math.abs(x - o.x) < hw + ow && Math.abs(z - o.z) < hd + od) return true;
  }
  return false;
}
