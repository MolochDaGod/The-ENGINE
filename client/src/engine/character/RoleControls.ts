/**
 * Grudge Engine — RoleControls
 *
 * Grudge-standard control scheme for selected grudge6 / Warlords heroes
 * (ported from gonnavis/annihilate, remapped to mouse + WASD + Space/Shift + 1–4).
 *
 * HOTKEYS_SSOT below is the single truth — keep annihilate-demo UI in sync.
 *
 * Movement uses Cannon-ES velocity so slopes/walls/gravity stay consistent.
 * Animation: CharacterFSM → BaseCharacter.mixer crossfades (not CSS).
 */

import { BaseCharacter } from './BaseCharacter';
import { GrudgeEngine, Updatable } from '../core/GrudgeEngine';

// Synthetic event codes used to unify mouse + keyboard in holdKey/tickKey/seqKey.
const CODE_LMB = 'Mouse0';
const CODE_RMB = 'Mouse2';

/** Single source of truth for annihilate / RoleControls hotkeys. */
export const ROLE_HOTKEYS: ReadonlyArray<{ keys: string; label: string; fsm?: string }> = [
  { keys: 'WASD / Arrows', label: 'Move (camera-relative)' },
  { keys: 'LMB', label: 'Light attack / combo', fsm: 'attack' },
  { keys: 'RMB', label: 'Heavy / bash / whirlwind', fsm: 'bash' },
  { keys: 'Space', label: 'Jump / double jump', fsm: 'jump' },
  { keys: 'Shift', label: 'Dash / dodge', fsm: 'dash' },
  { keys: 'Ctrl (hold)', label: 'Block (opens combo window)', fsm: 'block' },
  { keys: '1', label: 'Dash attack', fsm: 'dashAttack' },
  { keys: '2', label: 'Launch (uppercut)', fsm: 'launch' },
  { keys: '3', label: 'Bash (keyboard)', fsm: 'bash' },
  { keys: '4', label: 'Special / pop', fsm: 'pop' },
  { keys: 'Block + ↓→ LMB', label: 'Hadouken', fsm: 'hadouken' },
  { keys: 'Block + →↓→ LMB', label: 'Shoryuken', fsm: 'shoryuken' },
  { keys: 'Block + ↓← Space', label: 'Ajejebloken', fsm: 'ajejebloken' },
] as const;

export class RoleControls implements Updatable {
  role: BaseCharacter;

  holdKey: Record<string, boolean> = {};
  tickKey: Record<string, boolean> = {};
  seqKey:  string[] = [];

  /** When true, mouse listeners suppress the browser context menu on the canvas. */
  suppressContextMenu = true;

  private _seqKeyTimeout: ReturnType<typeof setTimeout> | null = null;
  private _prevTime = 0;
  private _engine: GrudgeEngine;
  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onKeyUp: (e: KeyboardEvent) => void;
  private _onMouseDown: (e: MouseEvent) => void;
  private _onMouseUp: (e: MouseEvent) => void;
  private _onContextMenu: (e: MouseEvent) => void;

  constructor(role: BaseCharacter) {
    this.role    = role;
    this._engine = GrudgeEngine.getInstance();

    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onContextMenu = (e) => { if (this.suppressContextMenu) e.preventDefault(); };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('contextmenu', this._onContextMenu);

    this._engine.addToUpdate(this);
  }

  setRole(role: BaseCharacter): void {
    this.role = role;
    // Reset held keys when switching characters
    this.holdKey = {};
    this.tickKey = {};
    this.seqKey  = [];
  }

  // ── Input handlers ─────────────────────────────────────────────────────────

  private _handleKeyDown(event: KeyboardEvent): void {
    // Prevent double-fire on held keys (mirrors annihilate guard)
    if (this.holdKey[event.code]) return;
    this.holdKey[event.code] = true;
    this.tickKey[event.code] = true;
    this._processCombo(event.code);
  }

  private _handleKeyUp(event: KeyboardEvent): void {
    this.holdKey[event.code] = false;

    switch (event.code) {
      case 'ControlLeft': case 'ControlRight':
        // block release
        this.role.service.send('keyLUp');
        this.seqKey.length = 0; break;
      case 'Digit2': case 'Numpad2':
        // launch release
        this.role.service.send('keyOUp');
        this.seqKey.length = 0; break;
      case 'Digit3': case 'Numpad3':
        // bash (kbd-only) release — mirrors RMB release
        this.role.service.send('keyUUp'); break;
    }
  }

  // ── Mouse handlers ─────────────────────────────────────────────────────────

  private _handleMouseDown(event: MouseEvent): void {
    const code = event.button === 0 ? CODE_LMB : event.button === 2 ? CODE_RMB : null;
    if (!code) return;
    if (this.holdKey[code]) return;
    this.holdKey[code] = true;
    this.tickKey[code] = true;
    this._processCombo(code);
  }

  private _handleMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      this.holdKey[CODE_LMB] = false;
      // LMB release maps to keyJUp (charge-attack release in Maria's FSM)
      this.role.service.send('keyJUp');
    } else if (event.button === 2) {
      this.holdKey[CODE_RMB] = false;
      // RMB release maps to keyUUp (whirlwind exit in Maria's FSM)
      this.role.service.send('keyUUp');
    }
  }

  // ── Block-state combo sequence (shared between keyboard & mouse) ───────────

  private _processCombo(code: string): void {
    if (this._seqKeyTimeout) clearTimeout(this._seqKeyTimeout);
    if (!this.role.service.matches('block')) return;

    this._prevTime = performance.now();

    if (code === CODE_LMB) {
      // ↓→LMB = hadouken
      if (
        this.seqKey.length === 2 &&
        (this.seqKey[0] === 'KeyS' || this.seqKey[0] === 'ArrowDown') &&
        (this.seqKey[1] === 'KeyD' || this.seqKey[1] === 'ArrowRight')
      ) {
        this.role.service.send('hadouken');
      }
      // →↓→LMB = shoryuken
      else if (
        this.seqKey.length === 3 &&
        (this.seqKey[0] === 'KeyD' || this.seqKey[0] === 'ArrowRight') &&
        (this.seqKey[1] === 'KeyS' || this.seqKey[1] === 'ArrowDown') &&
        (this.seqKey[2] === 'KeyD' || this.seqKey[2] === 'ArrowRight')
      ) {
        this.role.service.send('shoryuken');
      }
      this.seqKey.length = 0;
    } else if (code === 'Space') {
      // ↓←Space = ajejebloken
      if (
        this.seqKey.length === 2 &&
        (this.seqKey[0] === 'KeyS' || this.seqKey[0] === 'ArrowDown') &&
        (this.seqKey[1] === 'KeyA' || this.seqKey[1] === 'ArrowLeft')
      ) {
        this.role.service.send('ajejebloken');
      }
      this.seqKey.length = 0;
    } else {
      this.seqKey.push(code);
    }

    this._seqKeyTimeout = setTimeout(() => {
      this.seqKey.length = 0;
    }, 150);
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  update(dt: number): void {
    if (!this.role) return;

    // Action key processing (tickKey = pressed this frame) — Grudge keymap
    const lmb = this.tickKey[CODE_LMB];                                                          // attack
    const rmb = this.tickKey[CODE_RMB];                                                          // bash
    const jump = this.tickKey['Space'];                                                           // jump
    const dash = this.tickKey['ShiftLeft'] || this.tickKey['ShiftRight'];                        // dash / dodge (Shift)
    const dashAttack = this.tickKey['Digit1'] || this.tickKey['Numpad1'];                        // dash attack (1)
    const block = this.tickKey['ControlLeft'] || this.tickKey['ControlRight'];                   // block (Ctrl hold)
    const launch = this.tickKey['Digit2'] || this.tickKey['Numpad2'];                            // ability 2
    const bashK = this.tickKey['Digit3'] || this.tickKey['Numpad3'];                             // ability 3
    const pop = this.tickKey['Digit4'] || this.tickKey['Numpad4'];                               // ability 4

    // Ability 4 → pop / special (replaces the original JKL-simultaneous combo)
    if (pop) {
      (this.role as any).pop?.pop?.();
    } else {
      // Priority: first action in tickKey wins per frame
      if (lmb) this.role.service.send('attack');
      else if (rmb) this.role.service.send('bash');
      else if (jump) this.role.service.send('jump');
      else if (dash) this.role.service.send('dash');
      else if (dashAttack) this.role.service.send('dashAttack');
      else if (block) this.role.service.send('block');
      else if (launch) this.role.service.send('launch');
      else if (bashK) this.role.service.send('bash');
    }

    // Clear tick keys — they only fire once per press
    this.tickKey = {};

    // ── Movement: camera-relative WASD → Cannon velocity ────────────────────
    // Raw input direction (input-local: -y = forward, +x = right).
    let ix = 0, iy = 0;
    if (this.holdKey['KeyW'] || this.holdKey['ArrowUp']) iy -= 1;
    if (this.holdKey['KeyS'] || this.holdKey['ArrowDown']) iy += 1;
    if (this.holdKey['KeyA'] || this.holdKey['ArrowLeft']) ix -= 1;
    if (this.holdKey['KeyD'] || this.holdKey['ArrowRight']) ix += 1;

    const inputLenSq = ix * ix + iy * iy;
    if (inputLenSq > 0) {
      const inv = 1 / Math.sqrt(inputLenSq);
      ix *= inv;
      iy *= inv;
    }

    // ── Camera-relative basis ───────────────────────────────────────────────
    // forward = (camera → role) projected onto XZ = the "into the screen" dir.
    // Pressing W (iy = -1) MUST drive the character AWAY from the camera. The
    // previous formula was sign-inverted, which made forward input run the
    // character backwards (toward the camera).
    const cam = this._engine.camera;
    let fwdX = 0, fwdZ = -1;                  // default: −Z is "into the screen"
    if (cam && this.role.body) {
      const dx = this.role.body.position.x - cam.position.x;
      const dz = this.role.body.position.z - cam.position.z;
      const lenSq = dx * dx + dz * dz;
      if (lenSq > 1e-6) {
        const inv = 1 / Math.sqrt(lenSq);
        fwdX = dx * inv;
        fwdZ = dz * inv;
      }
    }
    // right = forward × up (Y-up) = (-fwdZ, fwdX) → screen-right for D.
    const rightX = -fwdZ;
    const rightZ = fwdX;

    // forward scalar = -iy  (W → +forward), right scalar = ix (D → +right)
    const fwdScalar = -iy;
    const moveX = fwdScalar * fwdX + ix * rightX;
    const moveZ = fwdScalar * fwdZ + ix * rightZ;

    // Expose the forward axis as a climb axis (W = climb up, S = climb down).
    this.role.climbInput = fwdScalar;

    // Keep legacy direction Vector2 = per-frame displacement (x=worldX, y=worldZ).
    const perFrame = this.role.speed * dt * 60;
    this.role.direction.set(moveX * perFrame, moveZ * perFrame);
    const hasInput = inputLenSq > 0;
    const canMove = this.role.service.hasTag('canMove');

    if (canMove) {
      if (hasInput) {
        // Face the direction of travel (Fortnite-style over-the-shoulder).
        this.role.facing.set(moveX, moveZ);
      }
      // Always update mesh yaw from facing (even when standing still).
      this.role.mesh?.rotation.set(
        0,
        -this.role.facing.angle() + Math.PI / 2,
        0
      );

      // Velocity-based movement: Cannon resolves slope/wall/terrain contacts.
      // role.speed is units/frame @ 60fps → units/sec = speed * 60.
      const v = this.role.speed * 60;
      if (hasInput) {
        let vx = moveX * v;
        let vz = moveZ * v;
        let vy = this.role.body.velocity.y;
        // Project velocity onto the ground slope so the character follows
        // ramps/terrain and pushes off accurately (no burrowing/launching).
        // Skip on the jump frame (vy spiked positive) so jumps aren't eaten.
        const gn = this.role.groundNormal;
        if (this.role.grounded && vy <= 0.1 && gn.y > 0.3 && gn.y < 0.999) {
          vy = -(vx * gn.x + vz * gn.z) / gn.y;
          if (vy > v) vy = v; else if (vy < -v) vy = -v;
        }
        this.role.body.velocity.x = vx;
        this.role.body.velocity.y = vy;
        this.role.body.velocity.z = vz;
      } else {
        // Snappy stop on input release — preserve gravity (velocity.y).
        this.role.body.velocity.x = 0;
        this.role.body.velocity.z = 0;
      }

      if (hasInput) {
        this.role.service.send('run');
      } else {
        this.role.service.send('stop');
      }
    } else {
      // Locked out of movement (mid-attack, hit-stun, etc.) — bleed horizontal
      // drift so the character doesn't slide through the action.
      this.role.body.velocity.x *= 0.5;
      this.role.body.velocity.z *= 0.5;
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(): void {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('contextmenu', this._onContextMenu);
    this._engine.removeFromUpdate(this);
    if (this._seqKeyTimeout) clearTimeout(this._seqKeyTimeout);
  }
}
