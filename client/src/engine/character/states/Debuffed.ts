import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { Idle } from './Idle';

/**
 * Base class for debuff/effect states.
 * Stores original speed, applies a modifier, and restores on exit.
 * Subclasses override for specific debuff behaviour.
 */
export class Debuffed extends CharacterStateBase {
  public tags = ['debuffed'];
  protected duration: number;
  protected originalSpeed: number;
  protected speedMultiplier = 1;

  constructor(character: BaseCharacter, duration = 3) {
    super(character);
    this.duration = duration;
    this.originalSpeed = character.speed;
  }

  public onEnter(): void {
    this.character.speed *= this.speedMultiplier;
  }

  public onExit(): void {
    this.character.speed = this.originalSpeed;
  }

  public update(dt: number): void {
    super.update(dt);
    if (this.timer >= this.duration) {
      this.character.setState(new Idle(this.character));
    }
  }
}
