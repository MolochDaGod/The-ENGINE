/**
 * Grudge Engine — RoleControls
 *
 * Direct TypeScript port of gonnavis/annihilate/src/RoleControls.js
 *
 * Controls:
 *   WASD / Arrow keys  — movement direction
 *   J / Numpad4        — attack
 *   K / Numpad5        — jump
 *   I / Numpad8        — dash
 *   U / Numpad7        — bash (heavy attack)
 *   L / Numpad6        — block
 *   O / Numpad9        — launch
 *
 * Combo detection (while in 'block' state, 150ms window):
 *   ↓→J  → hadouken
 *   →↓→J → shoryuken
 *   ↓←K  → ajejebloken
 *
 * Movement uses position-based approach (body.position += direction)
 * which avoids the issues with velocity-based movement noted in Annihilate.
 */

import * as THREE from 'three';
import { BaseCharacter } from './BaseCharacter';
import { GrudgeEngine, Updatable } from '../core/GrudgeEngine';

export class RoleControls implements Updatable {
  role: BaseCharacter;

  holdKey: Record<string, boolean> = {};
  tickKey: Record<string, boolean> = {};
  seqKey:  string[] = [];

  private _seqKeyTimeout: ReturnType<typeof setTimeout> | null = null;
  private _prevTime = 0;
  private _engine: GrudgeEngine;
  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onKeyUp:   (e: KeyboardEvent) => void;

  constructor(role: BaseCharacter) {
    this.role    = role;
    this._engine = GrudgeEngine.getInstance();

    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp   = this._handleKeyUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);

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

    // Sequential combo detection (only in 'block' state)
    if (this._seqKeyTimeout) clearTimeout(this._seqKeyTimeout);

    if (this.role.service.matches('block')) {
      this._prevTime = performance.now();
      const c = event.code;

      if (c === 'KeyJ' || c === 'Numpad4') {
        // ↓→J = hadouken
        if (
          this.seqKey.length === 2 &&
          (this.seqKey[0] === 'KeyS' || this.seqKey[0] === 'ArrowDown') &&
          (this.seqKey[1] === 'KeyD' || this.seqKey[1] === 'ArrowRight')
        ) {
          this.role.service.send('hadouken');
        }
        // →↓→J = shoryuken
        else if (
          this.seqKey.length === 3 &&
          (this.seqKey[0] === 'KeyD' || this.seqKey[0] === 'ArrowRight') &&
          (this.seqKey[1] === 'KeyS' || this.seqKey[1] === 'ArrowDown') &&
          (this.seqKey[2] === 'KeyD' || this.seqKey[2] === 'ArrowRight')
        ) {
          this.role.service.send('shoryuken');
        }
        this.seqKey.length = 0;
      } else if (c === 'KeyK' || c === 'Numpad5') {
        // ↓←K = ajejebloken
        if (
          this.seqKey.length === 2 &&
          (this.seqKey[0] === 'KeyS' || this.seqKey[0] === 'ArrowDown') &&
          (this.seqKey[1] === 'KeyA' || this.seqKey[1] === 'ArrowLeft')
        ) {
          this.role.service.send('ajejebloken');
        }
        this.seqKey.length = 0;
      } else {
        this.seqKey.push(event.code);
      }

      this._seqKeyTimeout = setTimeout(() => {
        this.seqKey.length = 0;
      }, 150);
    }
  }

  private _handleKeyUp(event: KeyboardEvent): void {
    this.holdKey[event.code] = false;

    switch (event.code) {
      case 'KeyJ': case 'Numpad4':
        this.role.service.send('keyJUp'); break;
      case 'KeyU': case 'Numpad7':
        this.role.service.send('keyUUp'); break;
      case 'KeyL': case 'Numpad6':
        this.role.service.send('keyLUp');
        this.seqKey.length = 0; break;
      case 'KeyO': case 'Numpad9':
        this.role.service.send('keyOUp');
        this.seqKey.length = 0; break;
    }
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  update(dt: number): void {
    if (!this.role) return;

    // Action key processing (tickKey = pressed this frame)
    const jk = this.tickKey['KeyJ']     || this.tickKey['Numpad4'];
    const kk = this.tickKey['KeyK']     || this.tickKey['Numpad5'];
    const uk = this.tickKey['KeyU']     || this.tickKey['Numpad7'];
    const ik = this.tickKey['KeyI']     || this.tickKey['Numpad8'];
    const lk = this.tickKey['KeyL']     || this.tickKey['Numpad6'];
    const ok = this.tickKey['KeyO']     || this.tickKey['Numpad9'];

    // JKL / JKL simultaneously → pop special
    if (jk && kk && lk) {
      (this.role as any).pop?.pop?.();
    } else {
      // Priority: first key in tickKey wins
      if (jk) this.role.service.send('attack');
      else if (kk) this.role.service.send('jump');
      else if (ik) this.role.service.send('dash');
      else if (uk) this.role.service.send('bash');
      else if (lk) this.role.service.send('block');
      else if (ok) this.role.service.send('launch');
    }

    // Clear tick keys — they only fire once per press
    this.tickKey = {};

    // ── Movement direction from WASD (mirrors annihilate exactly) ──────────
    this.role.direction.set(0, 0);
    if (this.holdKey['KeyW'] || this.holdKey['ArrowUp'])
      this.role.direction.add(new THREE.Vector2(0, -1));
    if (this.holdKey['KeyS'] || this.holdKey['ArrowDown'])
      this.role.direction.add(new THREE.Vector2(0, 1));
    if (this.holdKey['KeyA'] || this.holdKey['ArrowLeft'])
      this.role.direction.add(new THREE.Vector2(-1, 0));
    if (this.holdKey['KeyD'] || this.holdKey['ArrowRight'])
      this.role.direction.add(new THREE.Vector2(1, 0));

    this.role.direction.normalize().multiplyScalar(this.role.speed * dt * 60);
    const dirLenSq = this.role.direction.lengthSq();

    if (this.role.service.hasTag('canMove')) {
      if (dirLenSq > 0) {
        // Update facing from movement direction
        this.role.facing.copy(this.role.direction);
      }
      // Always update mesh rotation from facing (even when standing still)
      this.role.mesh?.rotation.set(
        0,
        -this.role.facing.angle() + Math.PI / 2,
        0
      );

      // Position-based movement (annihilate move strategy 1)
      this.role.body.position.x += this.role.direction.x;
      this.role.body.position.z += this.role.direction.y;

      // Send run/stop to FSM
      if (dirLenSq > 0) {
        this.role.service.send('run');
      } else {
        this.role.service.send('stop');
      }
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(): void {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
    this._engine.removeFromUpdate(this);
    if (this._seqKeyTimeout) clearTimeout(this._seqKeyTimeout);
  }
}
