/**
 * Avernus combat heroes — grudge6 kits + weapon packs + RoleControls FSM.
 * Canonical stack matches annihilate-demo / docs/ANNIHILATE_GRUDGE6_STACK.md
 * Camera for Avernus play is GameCamera FOLLOW (Danger Room TPS), not ISOMETRIC.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { EquipmentVisibilityMode } from '@shared/character-meshes';
import {
  BaseCharacter,
  CharacterFSM,
  createFSM,
  Attacker,
  CombatVfx,
  loadRaceWithEquipment,
  setRaceEquipmentMode,
  prefabFromRaceClass,
  GROUP_ROLE,
  GROUP_SCENE,
  GROUP_ENEMY,
  GROUP_ENEMY_ATTACKER,
  GROUP_ROLE_ATTACKER,
  GROUP_TRIGGER,
  RACE_CONFIGS,
  type CharacterOptions,
  type CharacterRace,
} from '@/engine';
import type { AvernusHeroPreset } from './characters';
import { WEAPON_PACKS, type WeaponPackId } from './weaponPacks';
import { HUMAN_HEIGHT_M } from './assets';

// ─── Melee hitbox ────────────────────────────────────────────────────────────

export class MeleeHitbox extends Attacker {
  private _vfx: CombatVfx | null = null;
  private _damage = 14;
  private _onHit?: (target: BaseCharacter, amount: number) => void;
  private _lastHitAt = 0;
  private _range = 1.15;

  constructor(
    opts: {
      isEnemy?: boolean;
      vfx?: CombatVfx;
      damage?: number;
      range?: number;
      onHit?: (t: BaseCharacter, n: number) => void;
    } = {},
  ) {
    super({
      num: 1,
      collisionGroup: opts.isEnemy ? GROUP_ENEMY_ATTACKER : GROUP_ROLE_ATTACKER,
      collisionMask: opts.isEnemy ? GROUP_ROLE | GROUP_ENEMY : GROUP_ENEMY | GROUP_ENEMY_ATTACKER,
      addToWorld: true,
    });
    this._vfx = opts.vfx ?? null;
    this._damage = opts.damage ?? 14;
    this._onHit = opts.onHit;
    this._range = opts.range ?? 1.15;
    this.body.addShape(new CANNON.Sphere(0.55));
  }

  update(_dt: number): void {
    if (!this.owner?.body) return;
    const o = this.owner;
    const y = o.body.position.y + 0.35;
    this.body.position.set(
      o.body.position.x + o.facing.x * this._range,
      y,
      o.body.position.z + o.facing.y * this._range,
    );
    this.body.velocity.set(0, 0, 0);
  }

  collide(event: { body?: { belongTo?: BaseCharacter } }, isBeginCollide: boolean): void {
    if (!isBeginCollide || !this.owner) return;
    if (!this.owner.service.hasTag('canDamage')) return;

    const target = event.body?.belongTo ?? null;
    if (!target || !target.isCharacter || target === this.owner) return;
    if (this.owner.isRole && !target.isEnemy) return;
    if (this.owner.isEnemy && !target.isRole) return;

    const now = performance.now();
    if (now - this._lastHitAt < 180) return;
    this._lastHitAt = now;

    const charged = (this.owner as { chargedLevel?: number }).chargedLevel ?? 0;
    const dmg = this._damage * (1 + charged * 0.35);
    target.takeDamage(dmg);
    this._onHit?.(target, dmg);

    const pos = {
      x: target.body.position.x,
      y: target.body.position.y,
      z: target.body.position.z,
    };
    this._vfx?.burst(pos, 'hit', 32, 5.5);
    this._vfx?.ring(pos, 'slash', 0.9);
  }
}

// ─── Player hero ─────────────────────────────────────────────────────────────

export class AvernusHero extends BaseCharacter {
  preset: AvernusHeroPreset;
  equipmentMode: EquipmentVisibilityMode = 'unarmed';
  isRole = true;
  isEnemy = false;
  attackSpeed = 1.4;
  chargedLevel = 0;
  whirlwindOneTurnDuration = 0.3;
  airLiftVelocity = 1.5;
  hitbox: MeleeHitbox | null = null;
  vfx: CombatVfx | null = null;
  meshSourceUrl = '';
  activePack: WeaponPackId = 'sword-shield';
  private _timeoutAirDash: ReturnType<typeof setTimeout> | null = null;
  private _tweenWhirlwind = 0;
  private tmpVec3 = new THREE.Vector3();

  constructor(preset: AvernusHeroPreset, opts: CharacterOptions = {}) {
    super({
      position: opts.position ?? new THREE.Vector3(-2, 2, 0),
      collisionGroup: GROUP_ROLE,
      collisionMask: GROUP_SCENE | GROUP_ENEMY | GROUP_ENEMY_ATTACKER | GROUP_TRIGGER,
      race: preset.race,
    });
    this.preset = preset;
    this.attackSpeed = preset.attackSpeed;
    this.speed = preset.speed;
    this.health = preset.health;
    this.maxHealth = preset.health;
    this.activePack = preset.weaponPack;
  }

  attachCombat(vfx: CombatVfx, onHit?: (t: BaseCharacter, n: number) => void) {
    this.vfx = vfx;
    this.hitbox?.destroy();
    this.hitbox = new MeleeHitbox({
      isEnemy: false,
      vfx,
      damage: 16,
      range: 1.2,
      onHit,
    });
    this.hitbox.owner = this;
  }

  setEquipmentMode(mode: EquipmentVisibilityMode) {
    if (!this.mesh) return;
    const prefab = prefabFromRaceClass(this.preset.race, this.preset.classId);
    setRaceEquipmentMode(this.mesh, prefab, mode);
    this.equipmentMode = mode;
  }

  buildFSM(): CharacterFSM {
    return createFSM(
      {
        id: `avernus-hero-${this.preset.id}`,
        initial: 'loading',
        states: {
          loading: { on: { loaded: 'idle' } },
          idle: {
            entry: 'playIdle',
            on: {
              run: 'run',
              attack: 'attack',
              bash: 'bash',
              dash: 'dash',
              jump: 'jump',
              block: 'block',
              dashAttack: 'dashAttack',
              launch: 'launch',
              pop: 'pop',
              hit: 'hit',
              air: 'airIdle',
            },
            tags: ['canFacing'],
          },
          run: {
            entry: 'playRun',
            on: {
              stop: 'idle',
              attack: 'attack',
              bash: 'bash',
              dash: 'dash',
              jump: 'jump',
              block: 'block',
              dashAttack: 'dashAttack',
              hit: 'hit',
              air: 'airIdle',
            },
            tags: ['canMove', 'canFacing'],
          },
          attack: {
            entry: 'playAttack',
            on: { finish: 'idle', hit: 'hit', attack: 'attack2' },
            tags: ['canDamage'],
          },
          attack2: {
            entry: 'playAttack2',
            on: { finish: 'idle', hit: 'hit', attack: 'attack3' },
            tags: ['canDamage'],
          },
          attack3: {
            entry: 'playAttack3',
            on: { finish: 'idle', hit: 'hit' },
            tags: ['canDamage'],
          },
          bash: {
            entry: 'playBash',
            on: { finish: 'idle', keyUUp: 'idle', hit: 'hit' },
            tags: ['canDamage'],
          },
          dash: { entry: 'playDash', on: { finish: 'idle', hit: 'hit' } },
          dashAttack: {
            entry: 'playDashAttack',
            on: { finish: 'idle', hit: 'hit' },
            tags: ['canDamage'],
          },
          launch: {
            entry: 'playLaunch',
            on: { finish: 'idle', keyOUp: 'idle', hit: 'hit' },
            tags: ['canDamage'],
          },
          pop: {
            entry: 'playPop',
            on: { finish: 'idle', hit: 'hit' },
            tags: ['canDamage'],
          },
          block: {
            entry: 'playBlock',
            on: {
              keyLUp: 'idle',
              hit: 'hit',
              hadouken: 'special',
              shoryuken: 'special',
              ajejebloken: 'special',
            },
            tags: ['blocking'],
          },
          special: {
            entry: 'playSpecial',
            on: { finish: 'idle', hit: 'hit' },
            tags: ['canDamage'],
          },
          jump: { entry: 'playJump', on: { air: 'airIdle', land: 'idle', hit: 'hit' } },
          airIdle: {
            entry: 'playFall',
            on: {
              land: 'idle',
              attack: 'airAttack',
              dash: 'airDash',
              hit: 'hit',
            },
            tags: ['canMove', 'canFacing'],
          },
          airAttack: {
            entry: 'playAirAttack',
            on: { finish: 'airIdle', land: 'idle', hit: 'hit' },
            tags: ['canDamage'],
          },
          airDash: { entry: 'playAirDash', on: { finish: 'airIdle', land: 'idle', hit: 'hit' } },
          hit: { entry: 'playHit', on: { finish: 'idle', hit: 'hit' } },
          whirlwind: {
            entry: 'playWhirlwind',
            exit: 'exitWhirlwind',
            on: { finish: 'idle', hit: 'hit' },
            tags: ['canDamage'],
          },
        },
      },
      {
        actions: {
          playIdle: () => this.fadeToAction('idle'),
          playRun: () => this.fadeToAction(this.oaction['running'] ? 'running' : 'walk'),
          playAttack: () => {
            if (this.oaction['punch']) this.oaction['punch'].timeScale = this.attackSpeed;
            this.fadeToAction(this.oaction['punch'] ? 'punch' : 'idle', 0);
            this._fxAttack();
          },
          playAttack2: () => {
            if (this.oaction['fist']) this.oaction['fist'].timeScale = this.attackSpeed;
            this.fadeToAction(this.oaction['fist'] ? 'fist' : 'punch', 0);
            this._fxAttack();
          },
          playAttack3: () => {
            if (this.oaction['strike']) this.oaction['strike'].timeScale = this.attackSpeed;
            this.fadeToAction(this.oaction['strike'] ? 'strike' : 'punch', 0);
            this._fxAttack('charge');
          },
          playBash: () => {
            this.fadeToAction(this.oaction['whirlwind'] ? 'whirlwind' : 'strike', 0);
            this._fxAttack('slash');
          },
          playDash: () => {
            this.fadeToAction(this.oaction['dashAttack'] ? 'dashAttack' : 'running', 0);
            this.tmpVec3.set(this.facing.x, 0, this.facing.y).normalize().multiplyScalar(14);
            this.body.velocity.x = this.tmpVec3.x;
            this.body.velocity.z = this.tmpVec3.z;
            this._fxDash();
            setTimeout(() => this.service.send('finish'), 280);
          },
          playDashAttack: () => {
            if (this.oaction['dashAttack']) this.fadeToAction('dashAttack', 0);
            else this.fadeToAction('punch', 0);
            this.tmpVec3.set(this.facing.x, 0, this.facing.y).normalize().multiplyScalar(12);
            this.body.velocity.x = this.tmpVec3.x;
            this.body.velocity.z = this.tmpVec3.z;
            this._fxAttack();
            setTimeout(() => this.service.send('finish'), 400);
          },
          playLaunch: () => {
            this.fadeToAction(this.oaction['strike'] ? 'strike' : 'punch', 0);
            this.body.velocity.y = 6;
            this._fxAttack();
            setTimeout(() => this.service.send('finish'), 450);
          },
          playPop: () => {
            this.fadeToAction(this.oaction['fist'] ? 'fist' : 'punch', 0);
            this._fxAttack('magic');
            setTimeout(() => this.service.send('finish'), 350);
          },
          playBlock: () => this.fadeToAction(this.oaction['block'] ? 'block' : 'idle'),
          playSpecial: () => {
            this.fadeToAction(this.oaction['strike'] ? 'strike' : 'punch', 0);
            this.vfx?.burst(
              { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z },
              'magic',
              36,
              6,
            );
            setTimeout(() => this.service.send('finish'), 500);
          },
          playJump: () => {
            this.fadeToAction(this.oaction['jump'] ? 'jump' : 'idle');
            this.body.velocity.y = 5.2;
          },
          playFall: () => this.fadeToAction(this.oaction['fall'] ? 'fall' : 'idle', 0.2),
          playAirAttack: () => {
            this.fadeToAction(this.oaction['punch'] ? 'punch' : 'idle', 0);
            this.body.velocity.y = this.airLiftVelocity;
            this._fxAttack();
            setTimeout(() => this.service.send('finish'), 400);
          },
          playAirDash: () => {
            this.fadeToAction(this.oaction['fall'] ? 'fall' : 'running', 0);
            this.tmpVec3.set(this.facing.x, 0, this.facing.y).normalize().multiplyScalar(11);
            this.body.velocity.x = this.tmpVec3.x;
            this.body.velocity.z = this.tmpVec3.z;
            this._fxDash();
            if (this._timeoutAirDash) clearTimeout(this._timeoutAirDash);
            this._timeoutAirDash = setTimeout(() => this.service.send('finish'), 500);
          },
          playHit: () => {
            if (this.oaction['hit']) {
              this.oaction['hit'].timeScale = 3;
              this.fadeToAction('hit');
            }
            this.vfx?.burst(
              { x: this.body.position.x, y: this.body.position.y + 0.8, z: this.body.position.z },
              'hit',
              16,
              3,
            );
            setTimeout(() => this.service.send('finish'), 350);
          },
          playWhirlwind: () => {
            this.fadeToAction(this.oaction['whirlwind'] ? 'whirlwind' : 'strike', 0);
            this.vfx?.ring(
              { x: this.body.position.x, y: this.body.position.y - 0.4, z: this.body.position.z },
              'slash',
              1.6,
            );
            const start = Date.now();
            const dur = this.whirlwindOneTurnDuration * 1000;
            const base = this.mesh.rotation.y;
            const step = () => {
              if (!this.service.matches('whirlwind')) return;
              const elapsed = (Date.now() - start) % dur;
              this.mesh.rotation.y = base + (elapsed / dur) * Math.PI * 2;
              this._tweenWhirlwind = requestAnimationFrame(step);
            };
            this._tweenWhirlwind = requestAnimationFrame(step);
            setTimeout(() => this.service.send('finish'), 900);
          },
          exitWhirlwind: () => {
            if (this._tweenWhirlwind) cancelAnimationFrame(this._tweenWhirlwind);
          },
        },
        guards: { notAir: () => !this.isAir },
      },
    );
  }

  private _fxAttack(kind: 'slash' | 'charge' | 'magic' = 'slash') {
    if (!this.vfx || !this.body) return;
    this.vfx.slashArc(
      { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z },
      this.facing.x,
      this.facing.y,
      kind === 'magic' ? 'magic' : 'slash',
    );
  }

  private _fxDash() {
    if (!this.vfx || !this.body) return;
    this.vfx.ring(
      { x: this.body.position.x, y: 0.1, z: this.body.position.z },
      'slash',
      0.8,
    );
  }

  async load(callback?: () => void): Promise<void> {
    const engine = this._engine;
    const prefab = prefabFromRaceClass(this.preset.race, this.preset.classId);
    try {
      const loaded = await loadRaceWithEquipment({
        race: this.preset.race,
        prefab,
        mode: 'unarmed',
        tint: this.preset.tint,
        emissive: this.preset.emissive,
        enemy: false,
        targetHeight: HUMAN_HEIGHT_M * (RACE_CONFIGS[this.preset.race]?.bodyScale ?? 1),
      });
      this.mesh = loaded.scene;
      this.meshSourceUrl = loaded.sourceUrl;
      this.equipmentMode = loaded.mode;
      this.gltf = { scene: loaded.scene, animations: loaded.animations };
      engine.scene.add(this.mesh);
      this.mixer = new THREE.AnimationMixer(this.mesh);
      loaded.animations.forEach((clip) => {
        this.oaction[clip.name] = this.mixer.clipAction(clip);
      });
    } catch (err) {
      console.warn('[AvernusHero] race load failed, placeholder capsule', err);
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 1.1, 4, 8),
        new THREE.MeshStandardMaterial({ color: this.preset.tint }),
      );
      body.position.y = 0.9;
      g.add(body);
      this.mesh = g;
      this.meshSourceUrl = 'placeholder://capsule';
      engine.scene.add(this.mesh);
      this.mixer = new THREE.AnimationMixer(this.mesh);
    }

    await this._ensureLocomotionFallback();
    this._onLoaded('idle');
    this.setFacing(0, -1);
    callback?.();
  }

  private async _ensureLocomotionFallback() {
    if (this.oaction['idle'] && (this.oaction['running'] || this.oaction['walk'])) return;
    try {
      const gltf = await this._loadGltf('/models/maria/all.gltf');
      gltf.animations?.forEach((clip: THREE.AnimationClip) => {
        if (!this.oaction[clip.name]) this.oaction[clip.name] = this.mixer.clipAction(clip);
      });
    } catch {
      /* optional */
    }
  }

  /** Load weapon skill animation pack (FBX) and equip mesh wardrobe. */
  async loadWeaponPack(packId: WeaponPackId): Promise<string[]> {
    const pack = WEAPON_PACKS[packId];
    if (!pack || !this.mixer) return [];
    this.activePack = packId;
    const fbxLoader = new FBXLoader();
    const loaded: string[] = [];
    for (const [actionName, fileName] of Object.entries(pack.clips)) {
      try {
        const fbx = await fbxLoader.loadAsync(pack.basePath + encodeURIComponent(fileName));
        if (fbx.animations.length > 0) {
          const clip = fbx.animations[0];
          clip.name = actionName;
          if (this.oaction[actionName]) this.oaction[actionName].stop();
          this.oaction[actionName] = this.mixer.clipAction(clip);
          if (
            [
              'punch',
              'fist',
              'strike',
              'dashAttack',
              'hit',
              'death',
              'jump',
              'whirlwind',
            ].includes(actionName)
          ) {
            this.oaction[actionName].loop = THREE.LoopOnce;
            this.oaction[actionName].clampWhenFinished = true;
          }
          loaded.push(actionName);
        }
      } catch {
        /* skip missing clip */
      }
    }
    this.setEquipmentMode('equipped');
    if (loaded.includes('idle') && this.oaction['idle']) this.fadeToAction('idle');
    return loaded;
  }

  /** Cast Q/E/R/F skill by anim name from pack. */
  castSkillAnim(animName: string): boolean {
    if (!this.oaction[animName]) return false;
    this.oaction[animName].reset();
    this.oaction[animName].timeScale = this.attackSpeed;
    this.fadeToAction(animName, 0.05);
    this._fxAttack(animName.includes('whirl') ? 'slash' : 'charge');
    return true;
  }

  destroy(): void {
    this.hitbox?.destroy();
    this.hitbox = null;
    if (this._timeoutAirDash) clearTimeout(this._timeoutAirDash);
    if (this._tweenWhirlwind) cancelAnimationFrame(this._tweenWhirlwind);
    super.destroy();
  }
}

// ─── Enemy ───────────────────────────────────────────────────────────────────

export class AvernusEnemy extends BaseCharacter {
  race: CharacterRace;
  weaponPack: WeaponPackId;
  equipmentMode: EquipmentVisibilityMode = 'equipped';
  isRole = false;
  isEnemy = true;
  attackSpeed = 1.3;
  hitbox: MeleeHitbox | null = null;
  vfx: CombatVfx | null = null;

  constructor(
    opts: CharacterOptions & {
      race: CharacterRace;
      weaponPack?: WeaponPackId;
      health?: number;
      speed?: number;
      attackSpeed?: number;
      tint?: number;
    },
  ) {
    super({
      position: opts.position ?? new THREE.Vector3(4, 2, 0),
      collisionGroup: GROUP_ENEMY,
      collisionMask: GROUP_SCENE | GROUP_ROLE | GROUP_ENEMY | GROUP_TRIGGER,
      race: opts.race,
    });
    this.race = opts.race;
    this.weaponPack = opts.weaponPack ?? 'sword-shield';
    this.health = opts.health ?? 120;
    this.maxHealth = this.health;
    this.speed = opts.speed ?? 0.08;
    this.attackSpeed = opts.attackSpeed ?? 1.3;
  }

  attachCombat(vfx: CombatVfx, onHit?: (t: BaseCharacter, n: number) => void) {
    this.vfx = vfx;
    this.hitbox?.destroy();
    this.hitbox = new MeleeHitbox({ isEnemy: true, vfx, damage: 12, onHit });
    this.hitbox.owner = this;
  }

  buildFSM(): CharacterFSM {
    return createFSM(
      {
        id: `avernus-enemy-${this.race}`,
        initial: 'loading',
        states: {
          loading: { on: { loaded: 'idle' } },
          idle: {
            entry: 'playIdle',
            on: { run: 'run', attack: 'attack', hit: 'hit', air: 'airIdle' },
            tags: ['canFacing'],
          },
          run: {
            entry: 'playRun',
            on: { stop: 'idle', attack: 'attack', hit: 'hit', air: 'airIdle' },
            tags: ['canMove', 'canFacing'],
          },
          attack: {
            entry: 'playAttack',
            on: { finish: 'idle', hit: 'hit' },
            tags: ['canDamage'],
          },
          hit: { entry: 'playHit', on: { finish: 'idle', hit: 'hit' } },
          airIdle: {
            entry: 'playFall',
            on: { land: 'idle', hit: 'hit' },
            tags: ['canMove', 'canFacing'],
          },
        },
      },
      {
        actions: {
          playIdle: () => this.fadeToAction('idle'),
          playRun: () => this.fadeToAction(this.oaction['running'] ? 'running' : 'walk'),
          playAttack: () => {
            if (this.oaction['punch']) {
              this.oaction['punch'].timeScale = this.attackSpeed;
              this.fadeToAction('punch', 0);
            }
            this.vfx?.slashArc(
              { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z },
              this.facing.x,
              this.facing.y,
              'slash',
            );
            setTimeout(() => this.service.send('finish'), 450);
          },
          playHit: () => {
            if (this.oaction['hit']) {
              this.oaction['hit'].timeScale = 3;
              this.fadeToAction('hit');
            }
            this.vfx?.burst(
              { x: this.body.position.x, y: this.body.position.y + 0.6, z: this.body.position.z },
              'hit',
              14,
              3,
            );
            setTimeout(() => this.service.send('finish'), 300);
          },
          playFall: () => this.fadeToAction(this.oaction['fall'] ? 'fall' : 'idle', 0.3),
        },
        guards: {},
      },
    );
  }

  async load(callback?: () => void): Promise<void> {
    const engine = this._engine;
    const prefab = prefabFromRaceClass(this.race, 'warrior');
    try {
      const loaded = await loadRaceWithEquipment({
        race: this.race,
        prefab,
        mode: 'equipped',
        enemy: true,
        targetHeight: 1.7 * (RACE_CONFIGS[this.race]?.bodyScale ?? 1),
      });
      this.mesh = loaded.scene;
      this.equipmentMode = loaded.mode;
      this.gltf = { scene: loaded.scene, animations: loaded.animations };
      engine.scene.add(this.mesh);
      this.mixer = new THREE.AnimationMixer(this.mesh);
      loaded.animations.forEach((clip) => {
        this.oaction[clip.name] = this.mixer.clipAction(clip);
      });
    } catch {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.4, 1.0, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x663333 }),
      );
      body.position.y = 0.9;
      g.add(body);
      this.mesh = g;
      engine.scene.add(this.mesh);
      this.mixer = new THREE.AnimationMixer(this.mesh);
    }

    // Best-effort weapon clips
    try {
      const pack = WEAPON_PACKS[this.weaponPack];
      const fbxLoader = new FBXLoader();
      for (const key of ['idle', 'running', 'punch', 'hit'] as const) {
        const file = pack.clips[key];
        if (!file) continue;
        try {
          const fbx = await fbxLoader.loadAsync(pack.basePath + encodeURIComponent(file));
          if (fbx.animations[0]) {
            const clip = fbx.animations[0];
            clip.name = key;
            this.oaction[key] = this.mixer.clipAction(clip);
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* skip */
    }

    this._onLoaded('idle');
    this.setFacing(0, 1);
    callback?.();
  }

  destroy(): void {
    this.hitbox?.destroy();
    this.hitbox = null;
    if (this.health <= 0 && this.vfx && this.body) {
      this.vfx.burst(
        { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z },
        'death',
        40,
        6,
      );
    }
    super.destroy();
  }
}

// ─── Arena scenery (procedural dark fantasy — no shooter kits) ───────────────

export function buildAvernusArena(scene: THREE.Scene, radius = 28): THREE.Group {
  const root = new THREE.Group();
  root.name = 'avernus-arena';

  // Ground disk
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.92, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // Inner ritual ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.55, radius * 0.58, 64),
    new THREE.MeshStandardMaterial({
      color: 0x8b1a1a,
      emissive: 0x4a0a0a,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  root.add(ring);

  // Perimeter wall
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.4, radius + 0.4, 7, 48, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x1a1614,
      roughness: 0.9,
      side: THREE.BackSide,
    }),
  );
  wall.position.y = 3.5;
  wall.castShadow = true;
  wall.receiveShadow = true;
  root.add(wall);

  // Pillars
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 8, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a322c, roughness: 0.85 }),
    );
    pillar.position.set(Math.cos(a) * (radius - 4), 4, Math.sin(a) * (radius - 4));
    pillar.castShadow = true;
    root.add(pillar);

    const torch = new THREE.PointLight(i % 2 === 0 ? 0xff6622 : 0x6644ff, 1.1, 22);
    torch.position.set(pillar.position.x, 6.5, pillar.position.z);
    root.add(torch);
  }

  // Cover crates
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.9 });
  for (const [x, z] of [
    [-5, 0],
    [5, 0],
    [0, -7],
    [0, 7],
    [-8, 5],
    [8, -5],
  ] as [number, number][]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.2), crateMat);
    crate.position.set(x, 0.7, z);
    crate.castShadow = true;
    crate.receiveShadow = true;
    root.add(crate);
  }

  scene.add(root);
  return root;
}
