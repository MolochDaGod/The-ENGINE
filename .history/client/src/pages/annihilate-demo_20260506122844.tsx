/**
 * Annihilate Demo — Grudge Engine proof-of-concept
 *
 * Loads the Maria GLTF character with her FULL XState-style FSM from
 * gonnavis/annihilate (ported to CharacterFSM), capsule physics body,
 * AnimationMixer, and RoleControls.
 *
 * Controls:
 *   WASD          — move
 *   J             — attack (3-hit combo: attack → fist → strike)
 *   K             — jump / double jump
 *   I             — dash (300ms, can chain to dashAttack)
 *   U             — bash / whirlwind
 *   L             — block (hold for combos)
 *   Block + ↓→J   — hadouken
 *   Block + →↓→J  — shoryuken
 *   1/2/3/4/5     — number keys switch debug views
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import * as THREE from 'three';

import {
  GrudgeEngine,
  BaseCharacter,
  CharacterFSM,
  createFSM,
  RoleControls,
  GROUP_ROLE,
  GROUP_SCENE,
  GROUP_ENEMY,
  GROUP_ENEMY_ATTACKER,
  GROUP_TRIGGER,
  CharacterOptions,
} from '@/engine';

// ─── Maria Character ─────────────────────────────────────────────────────────

class Maria extends BaseCharacter {
  isRole   = true;
  isEnemy  = false;
  speed    = 0.11;
  mass     = 80;
  attackSpeed       = 1.4;
  chargeAttackCoe   = 2.0;
  chargedLevel      = 0;
  whirlwindOneTurnDuration = 0.3;
  liftDistance      = 3.7;
  airLiftVelocity   = 1.5;
  climbContactSign  = 1;
  detectorRadius    = 8;

  private _tweenWhirlwind: any = null;
  private _timeoutLaunch:  ReturnType<typeof setTimeout> | null = null;
  private _timeoutAirDash: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: CharacterOptions = {}) {
    super({
      position: opts.position ?? new THREE.Vector3(-2, 2, 0),
      collisionGroup: GROUP_ROLE,
      collisionMask:  GROUP_SCENE | GROUP_ROLE | GROUP_ENEMY | GROUP_ENEMY_ATTACKER | GROUP_TRIGGER,
    });
  }

  // ── FSM (full port from Maria.js) ─────────────────────────────────────────
  buildFSM(): CharacterFSM {
    return createFSM(
      {
        id: 'maria',
        initial: 'loading',
        states: {
          loading: { on: { loaded: 'idle' } },
          idle: {
            entry: 'playIdle',
            on: { run: 'run', attack: 'attackStartWithCharge', bash: 'bashStart',
                  launch: 'launchStart', jump: 'jump', hit: 'hit', dash: 'dash',
                  block: 'block', air: 'airIdle' },
          },
          block: {
            entry: 'playBlock',
            on: { keyLUp: 'idle', hadouken: 'hadouken', shoryuken: 'shoryuken',
                  ajejebloken: 'ajejebloken' },
          },
          hadouken: {
            entry: 'playHadouken',
            on: { finish: 'idle', hit: 'hit', dash: 'dash' },
            tags: ['canDamage'],
          },
          shoryuken: {
            entry: 'playShoryuken',
            on: { finish: 'fall', hit: 'hit', dash: 'dash' },
            tags: ['canDamage', 'canLaunch'],
          },
          ajejebloken: {
            entry: 'playAjejebloken', exit: 'exitAjejebloken',
            on: { hit: 'hit' },
            after: { 2000: 'idle' },
            tags: ['canDamage'],
          },
          run: {
            entry: 'playRun',
            on: { stop: 'idle', attack: 'attackStartWithCharge', bash: 'bashStart',
                  launch: 'launchStart', jump: 'jump', hit: 'hit', dash: 'dash',
                  air: 'airIdle', block: 'block' },
            tags: ['canMove'],
          },
          bashStart: {
            entry: 'playBashStart',
            on: { finish: 'whirlwind', hit: 'hit', dash: 'dash', keyUUp: 'bashStartNotWhirlwind' },
          },
          bashStartNotWhirlwind: {
            on: { finish: 'idle', hit: 'hit', dash: 'dash' },
          },
          attackStartWithCharge: {
            entry: 'playAttackStart',
            on: { finish: 'charging', hit: 'hit', dash: 'dash', keyJUp: 'attackStart' },
          },
          charging: {
            on: { keyJUp: 'attack', hit: 'hit', dash: 'dash' },
            after: { 500: 'charged1' },
          },
          charged1: {
            entry: 'playCharged1',
            on: { keyJUp: 'chargeAttack', hit: 'hit', dash: 'dash' },
            after: { 500: 'charged2' },
          },
          charged2: {
            entry: 'playCharged2',
            on: { keyJUp: 'chargeAttack', hit: 'hit', dash: 'dash' },
          },
          chargeAttack: {
            entry: 'playChargeAttack',
            on: { finish: 'idle', attack: 'chargeFistStart', hit: 'hit', dash: 'dash' },
            tags: ['canDamage'],
          },
          chargeFistStart: {
            entry: 'playChargeFistStart',
            on: { finish: 'chargeFist', hit: 'hit', dash: 'dash' },
          },
          chargeFist: {
            entry: 'playChargeFist',
            on: { finish: 'idle', attack: 'chargeStrikeStart', hit: 'hit', dash: 'dash' },
            tags: ['canDamage'],
          },
          chargeStrikeStart: {
            entry: 'playChargeStrikeStart',
            on: { finish: 'chargeStrike', hit: 'hit', dash: 'dash' },
          },
          chargeStrike: {
            entry: 'playChargeStrike',
            on: { finish: 'chargeStrikeEnd', hit: 'hit', dash: 'dash' },
            tags: ['canDamage', 'knockDown'],
          },
          chargeStrikeEnd: {
            entry: 'playChargeStrikeEnd',
            on: { finish: 'idle', hit: 'hit', dash: 'dash' },
          },
          attackStart: { on: { finish: 'attack', hit: 'hit', dash: 'dash' } },
          attack: {
            entry: 'playAttack',
            on: { finish: 'idle', attack: 'fistStart', hit: 'hit', dash: 'dash' },
            tags: ['canDamage'],
          },
          launchStart: {
            entry: 'playLaunchStart',
            on: { finish: 'launchWithJump', hit: 'hit', dash: 'dash', keyOUp: 'launch' },
            tags: ['canDamage', 'canLaunch'],
          },
          launchWithJump: {
            on: { finish: 'fall', hit: 'hit', dash: 'dash' },
            tags: ['canDamage', 'canLaunch'],
          },
          launch: {
            entry: 'playLaunch',
            on: { finish: 'idle', hit: 'hit', dash: 'dash' },
            tags: ['canDamage', 'canLaunch'],
          },
          fistStart: {
            entry: 'playFistStart',
            on: { finish: 'fist', hit: 'hit', dash: 'dash' },
          },
          fist: {
            entry: 'playFist',
            on: { finish: 'idle', attack: 'strikeStart', hit: 'hit', dash: 'dash' },
            tags: ['canDamage'],
          },
          strikeStart: {
            entry: 'playStrikeStart',
            on: { finish: 'strike', hit: 'hit', dash: 'dash' },
          },
          strike: {
            entry: 'playStrike',
            on: { finish: 'strikeEnd', hit: 'hit', dash: 'dash' },
            tags: ['canDamage', 'knockDown'],
          },
          strikeEnd: {
            entry: 'playStrikeEnd',
            on: { finish: 'idle', hit: 'hit', dash: 'dash' },
          },
          jump: {
            entry: ['playJump', 'jump'],
            on: { finish: 'fall', land: 'idle', attack: 'airAttack', bash: 'airBashStart',
                  jump: 'doubleJump', hit: 'hit', dash: 'airDash', climb: 'climb' },
            tags: ['canMove'],
          },
          airIdle: {
            entry: 'playAirIdle',
            on: { land: 'idle', attack: 'airAttack', bash: 'airBashStart',
                  jump: 'jump', hit: 'hit', dash: 'airDash', climb: 'climb' },
            tags: ['canMove'],
          },
          fall: {
            entry: 'playFall',
            on: { land: 'idle', attack: 'airAttack', bash: 'airBashStart',
                  jump: 'doubleJump', hit: 'hit', dash: 'airDash', climb: 'climb' },
            tags: ['canMove'],
          },
          doubleFall: {
            entry: 'playFall',
            on: { land: 'idle', attack: 'airAttack', bash: 'airBashStart',
                  hit: 'hit', dash: 'airDash', climb: 'climb' },
            tags: ['canMove'],
          },
          dashFall: {
            entry: 'playFall',
            on: { land: 'idle', bash: 'airBashStart', hit: 'hit', climb: 'climb' },
            tags: ['canMove'],
          },
          airBashStart: {
            entry: 'playAirBashStart',
            on: { finish: 'airBash', hit: 'hit' },
          },
          airBash: {
            entry: 'playAirBash',
            on: { finish: 'idle', hit: 'hit' },
            tags: ['canDamage', 'knockDown'],
          },
          climb: {
            entry: 'playClimb', exit: 'exitClimb',
            on: { jump: 'jump', land: 'idle' },
          },
          airAttack: {
            entry: 'playAirAttack',
            on: { finish: 'doubleFall', attack: 'airFist' },
            tags: ['canDamage'],
          },
          airFist: {
            entry: 'playAirFist',
            on: { finish: 'doubleFall', attack: 'airStrike' },
            tags: ['canDamage'],
          },
          airStrike: {
            entry: 'playAirStrike',
            on: { finish: 'doubleFall' },
            tags: ['canDamage'],
          },
          doubleJump: {
            entry: ['playJump', 'jump'],
            on: { finish: 'doubleFall', land: 'idle', attack: 'airAttack',
                  bash: 'airBashStart', hit: 'hit', dash: 'airDash', climb: 'climb' },
            tags: ['canMove'],
          },
          hit: {
            entry: 'playHit',
            on: { hit: 'hit', finish: { target: 'idle', cond: 'notAir' } },
          },
          dash: {
            entry: 'playDash',
            on: { attack: 'dashAttack' },
            after: { 300: 'idle' },
          },
          dashAttack: {
            entry: 'playDashAttack',
            on: { finish: 'idle', hit: 'hit' },
            tags: ['canDamage'],
          },
          airDash: {
            entry: ['playAirDash', 'setMassZero'], exit: ['exitAirDash', 'restoreMass'],
            on: { finish: 'dashFall', land: 'idle', hit: 'hit', climb: 'climb', bash: 'airBashStart' },
          },
          whirlwind: {
            entry: 'playWhirlwind', exit: 'exitWhirlwind',
            on: { keyUUp: 'attack', hit: 'hit', dash: 'dash' },
            tags: ['canDamage'],
          },
        },
      },
      {
        actions: {
          playIdle:             () => { this.fadeToAction('idle'); this.chargedLevel = 0; },
          playRun:              () => this.fadeToAction('running'),
          playFall:             () => this.fadeToAction('fall', 0.3),
          playAirIdle:          () => this.fadeToAction('fall', 0.3),
          playBlock:            () => this.fadeToAction('block'),
          playBashStart:        () => { this.oaction['punchStart'].timeScale = this.attackSpeed; this.fadeToAction('punchStart'); },
          playAttackStart:      () => { this.oaction['punchStart'].timeScale = this.attackSpeed; this.fadeToAction('punchStart'); },
          playAttack:           () => { this.oaction['punch'].timeScale = this.attackSpeed; this.fadeToAction('punch', 0); },
          playCharged1:         () => { this.chargedLevel = 1; if (this.oaction['punch']) this.oaction['punch'].timeScale = this.attackSpeed; },
          playCharged2:         () => { this.chargedLevel = 2; },
          playChargeAttack:     () => { this.oaction['punch'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('punch', 0); },
          playChargeFistStart:  () => { this.oaction['fistStart'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('fistStart'); },
          playChargeFist:       () => { this.oaction['fist'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('fist', 0); },
          playChargeStrikeStart:() => { this.oaction['strikeStart'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('strikeStart'); },
          playChargeStrike:     () => { this.oaction['strike'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('strike', 0); },
          playChargeStrikeEnd:  () => { this.oaction['strikeEnd'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('strikeEnd', 0); },
          playFistStart:        () => { this.oaction['fistStart'].timeScale = this.attackSpeed; this.fadeToAction('fistStart'); },
          playFist:             () => { this.oaction['fist'].timeScale = this.attackSpeed; this.fadeToAction('fist', 0); },
          playStrikeStart:      () => { this.oaction['strikeStart'].timeScale = this.attackSpeed; this.fadeToAction('strikeStart'); },
          playStrike:           () => { this.oaction['strike'].timeScale = this.attackSpeed; this.fadeToAction('strike', 0); },
          playStrikeEnd:        () => { this.oaction['strikeEnd'].timeScale = this.attackSpeed; this.fadeToAction('strikeEnd', 0); },
          playHadouken:         () => { this.oaction['punch'].timeScale = this.attackSpeed * this.chargeAttackCoe; this.fadeToAction('punch', 0); },
          playShoryuken:        () => {
            this.oaction['strike'].timeScale = this.attackSpeed;
            this.fadeToAction('strike', 0);
            setTimeout(() => {
              this.body.velocity.y = 5;
            }, 150);
          },
          playLaunchStart:      () => {
            this.oaction['strike'].timeScale = this.attackSpeed;
            this.fadeToAction('strike', 0);
            this._timeoutLaunch = setTimeout(() => {
              this.body.position.y += this.liftDistance;
              this.body.velocity.y = 0;
              this.service.send('finish');
            }, 150);
          },
          playLaunch:           () => { if (this._timeoutLaunch) clearTimeout(this._timeoutLaunch); },
          playDash:             () => {
            if (this.oaction['dash']) this.oaction['dash'].timeScale = 2;
            this.fadeToAction('dash');
            if (this.direction.lengthSq() > 0) this.facing.copy(this.direction);
            this.mesh.rotation.y = -this.facing.angle() + Math.PI / 2;
            this.tmpVec3.set(this.facing.x, 0, this.facing.y).normalize().multiplyScalar(15);
            this.body.velocity.x = this.tmpVec3.x;
            this.body.velocity.z = this.tmpVec3.z;
          },
          playDashAttack:       () => { if (this.oaction['dashAttack']) { this.oaction['dashAttack'].timeScale = this.attackSpeed; this.fadeToAction('dashAttack'); } },
          playAirDash:          () => {
            this.fadeToAction('fall', 0);
            this.tmpVec3.set(this.facing.x, 0, this.facing.y).normalize().multiplyScalar(11);
            this.body.velocity.x = this.tmpVec3.x;
            this.body.velocity.y = 0;
            this.body.velocity.z = this.tmpVec3.z;
            this._timeoutAirDash = setTimeout(() => this.service.send('finish'), 500);
          },
          exitAirDash:          () => { if (this._timeoutAirDash) clearTimeout(this._timeoutAirDash); this.body.velocity.set(0, 0, 0); },
          playJump:             () => { this.fadeToAction('jump'); this.body.velocity.set(0, 0, 0); },
          jump:                 () => { this.body.velocity.y = 5.2; },
          playAirAttack:        () => { this.oaction['punch'].timeScale = this.attackSpeed; this.fadeToAction('punch', 0); this.body.velocity.y = this.airLiftVelocity; },
          playAirFist:          () => { this.oaction['fist'].timeScale = this.attackSpeed; this.fadeToAction('fist', 0); this.body.velocity.y = this.airLiftVelocity; },
          playAirStrike:        () => { this.oaction['strike'].timeScale = this.attackSpeed; this.fadeToAction('strike', 0); this.body.velocity.y = this.airLiftVelocity; },
          playAirBashStart:     () => { if (this.oaction['jumpAttackStart']) { this.oaction['jumpAttackStart'].timeScale = this.attackSpeed; this.fadeToAction('jumpAttackStart'); } this.body.velocity.y = 20; },
          playAirBash:          () => { if (this.oaction['jumpAttack']) { this.oaction['jumpAttack'].timeScale = this.attackSpeed * 5; this.fadeToAction('jumpAttack'); } this.body.velocity.y = -this.body.position.y * 3.5; },
          playHit:              () => { if (this.oaction['hit']) { this.oaction['hit'].timeScale = 3; this.fadeToAction('hit'); } },
          playWhirlwind:        () => {
            this.fadeToAction('whirlwind', 0);
            let t = { v: 0 };
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
          },
          exitWhirlwind:        () => { if (this._tweenWhirlwind) cancelAnimationFrame(this._tweenWhirlwind); },
          playClimb:            () => { this.fadeToAction('idle'); this.body.mass = 0; this.body.velocity.set(0, 0, 0); },
          exitClimb:            () => { this.body.mass = this.mass; },
          playAjejebloken:      () => { this.fadeToAction('whirlwind', 0); },
          exitAjejebloken:      () => { this.setFacing(this.facing.x, this.facing.y); },
          setMassZero:          () => { this.body.mass = 0; },
          restoreMass:          () => { this.body.mass = this.mass; },
        },
        guards: {
          notAir: () => !this.isAir,
        },
      }
    );
  }

  // ── GLTF load ──────────────────────────────────────────────────────────────
  async load(callback?: () => void): Promise<void> {
    const engine = this._engine;
    const gltf   = await this._loadGltf('/models/maria/all.gltf');

    this.gltf = gltf;
    this.mesh = gltf.scene;

    this.mesh.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
        const mat = new THREE.MeshStandardMaterial();
        const loader = new THREE.TextureLoader();
        mat.map = loader.load('/models/maria/maria_diffuse.jpg');
        mat.map.flipY = false;
        mat.map.colorSpace = THREE.SRGBColorSpace;
        child.material = mat;
      }
    });

    engine.scene.add(this.mesh);

    this.mixer = new THREE.AnimationMixer(this.mesh);
    gltf.animations.forEach((clip: THREE.AnimationClip) => {
      this.oaction[clip.name] = this.mixer.clipAction(clip);
    });

    this._onLoaded('idle');
    this.setFacing(0, -1);
    callback?.();
  }
}

// ─── React Page ───────────────────────────────────────────────────────────────

export default function AnnihilateDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fsmState, setFsmState] = useState('loading');
  const [loaded,   setLoaded]   = useState(false);
  const [info,     setInfo]     = useState('Loading GLTF…');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size canvas to full container before init
    canvas.style.width  = '100%';
    canvas.style.height = '100%';
    canvas.width  = canvas.clientWidth  || window.innerWidth;
    canvas.height = canvas.clientHeight || window.innerHeight;

    const engine = GrudgeEngine.getInstance();
    engine.init(canvas);
    engine.addGround(0x1e1030, 60);

    const maria = new Maria({ position: new THREE.Vector3(-2, 2, 0) });
    maria.load(() => {
      const controls = new RoleControls(maria);
      engine.setRole(maria);
      engine.start();
      setLoaded(true);
      setInfo('Ready');

      maria.service.onTransition((state: string) => {
        setFsmState(state);
      });

      // Cleanup stored on maria for teardown
      (maria as any)._controls = controls;
    });

    return () => {
      ((maria as any)._controls as RoleControls | undefined)?.destroy?.();
      maria.destroy();
      engine.destroy();
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-950">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Back button */}
      <Link href="/super-engine">
        <Button
          variant="outline"
          className="absolute top-4 left-4 z-20 border-purple-500/50 text-purple-300 hover:bg-purple-900/30 bg-black/60"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </Link>

      {/* Loading overlay */}
      {!loaded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-950/90">
          <div className="text-center">
            <div className="text-4xl font-black text-purple-400 mb-3 animate-pulse">
              GRUDGE ENGINE
            </div>
            <div className="text-gray-400">Loading Maria GLTF…</div>
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="absolute top-4 right-4 z-20 space-y-2 text-right">
        <div className="bg-black/70 px-3 py-1.5 rounded text-xs font-mono text-green-400">
          State: <span className="text-white">{fsmState}</span>
        </div>
        <div className="bg-black/70 px-3 py-1.5 rounded text-xs text-gray-400">
          {info}
        </div>
      </div>

      {/* Controls legend */}
      <div className="absolute bottom-4 left-4 z-20 bg-black/70 rounded-lg px-4 py-3 text-xs text-gray-400 space-y-0.5">
        <div className="text-purple-300 font-bold mb-1">GRUDGE ENGINE — Annihilate Core</div>
        <div><span className="text-white">WASD</span> Move</div>
        <div><span className="text-white">J</span> Attack  <span className="text-white ml-2">K</span> Jump  <span className="text-white ml-2">I</span> Dash</div>
        <div><span className="text-white">U</span> Bash / Whirlwind  <span className="text-white ml-2">L</span> Block</div>
        <div><span className="text-white">Block + ↓→J</span> Hadouken</div>
        <div><span className="text-white">Block + →↓→J</span> Shoryuken</div>
      </div>

      {/* Feature badges */}
      {loaded && (
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 items-end">
          {['Three.js WebGL', 'Cannon-ES Physics', 'CharacterFSM', 'GLTF AnimationMixer', 'RoleControls', 'Capsule Body'].map(f => (
            <Badge key={f} className="bg-purple-900/80 text-purple-200 text-xs">{f}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
