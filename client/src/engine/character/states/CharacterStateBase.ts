/**
 * Grudge Engine — CharacterStateBase
 *
 * Abstract base for all class-based character states.
 * Ported from swift502/Sketchbook CharacterStateBase.ts and adapted
 * for the Grudge Engine BaseCharacter API (CANNON physics, fadeToAction).
 *
 * Subclasses override update() and onInputChange() to define behaviour.
 */

import * as THREE from 'three';
import type { ICharacterState } from './ICharacterState';
import type { BaseRaceCharacter } from '../BaseCharacter';

// States accept BaseRaceCharacter (aliased as BaseCharacter for compat)
type BaseCharacter = BaseRaceCharacter;

export abstract class CharacterStateBase implements ICharacterState {
  public character: BaseRaceCharacter;
  public timer = 0;
  public animationLength = 0;
  public tags: string[] = [];

  constructor(character: BaseCharacter) {
    this.character = character;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Called when the state is entered via character.setState() */
  public onEnter(): void {}

  /** Called when the state is exited via character.setState() */
  public onExit(): void {}

  /** Per-frame update — subclasses should call super.update(dt) */
  public update(dt: number): void {
    this.timer += dt;
  }

  /** Called when player input changes — subclasses should call super */
  public onInputChange(): void {}

  // ── Input helpers ─────────────────────────────────────────────────────────

  /** True if no directional input is held */
  public noDirection(): boolean {
    return this.character.direction.lengthSq() === 0;
  }

  /** True if any directional input is held */
  public anyDirection(): boolean {
    return this.character.direction.lengthSq() > 0;
  }

  // ── Transition helpers ────────────────────────────────────────────────────

  /** If character is in the air, transition to Falling */
  public fallInAir(): void {
    if (this.character.isAir) {
      // Lazy import to avoid circular deps
      const { Falling } = require('./Falling');
      this.character.setState(new Falling(this.character));
    }
  }

  /** True when the current animation has finished playing */
  public animationEnded(dt: number): boolean {
    if (this.animationLength <= 0) return true;
    return this.timer > this.animationLength - dt;
  }

  /**
   * Choose the right landing state based on vertical impact speed.
   * Hard landing → DropRolling, moving → DropRunning, standing → DropIdle
   */
  public setAppropriateDropState(): void {
    const vy = this.character.body.velocity.y;
    const { DropRolling } = require('./DropRolling');
    const { DropRunning } = require('./DropRunning');
    const { DropIdle }    = require('./DropIdle');
    const { Sprint }      = require('./Sprint');
    const { Walk }        = require('./Walk');

    if (vy < -6) {
      this.character.setState(new DropRolling(this.character));
    } else if (this.anyDirection()) {
      if (vy < -2) {
        this.character.setState(new DropRunning(this.character));
      } else {
        // TODO: detect sprint input
        this.character.setState(new Walk(this.character));
      }
    } else {
      this.character.setState(new DropIdle(this.character));
    }
  }

  /**
   * Choose a directional start-walk animation based on the angle
   * between current facing and movement direction.
   */
  public setAppropriateStartWalkState(): void {
    const moveDir = this.character.direction;
    if (moveDir.lengthSq() === 0) return;

    const facing = this.character.facing;
    const angle  = Math.atan2(
      facing.x * moveDir.y - facing.y * moveDir.x,
      facing.x * moveDir.x + facing.y * moveDir.y,
    );

    const range = Math.PI;
    const { StartWalkBackLeft }  = require('./StartWalkBackLeft');
    const { StartWalkBackRight } = require('./StartWalkBackRight');
    const { StartWalkLeft }      = require('./StartWalkLeft');
    const { StartWalkRight }     = require('./StartWalkRight');
    const { StartWalkForward }   = require('./StartWalkForward');

    if (angle > range * 0.8) {
      this.character.setState(new StartWalkBackLeft(this.character));
    } else if (angle < -range * 0.8) {
      this.character.setState(new StartWalkBackRight(this.character));
    } else if (angle > range * 0.3) {
      this.character.setState(new StartWalkLeft(this.character));
    } else if (angle < -range * 0.3) {
      this.character.setState(new StartWalkRight(this.character));
    } else {
      this.character.setState(new StartWalkForward(this.character));
    }
  }

  // ── Animation helper ──────────────────────────────────────────────────────

  /** Cross-fade to an animation and store its length */
  protected playAnimation(animName: string, fadeIn = 0.1): void {
    this.character.fadeToAction(animName, fadeIn);
    // Try to read clip duration from the action map
    const action = this.character.oaction[animName];
    this.animationLength = action?.getClip?.()?.duration ?? 0;
  }
}
