import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Stunned extends CharacterStateBase {
  public tags = ['disabled', 'stunned'];
  private duration: number;

  constructor(character: BaseCharacter, duration = 1.5) {
    super(character);
    this.duration = duration;
    this.character.speed = 0;
    this.playAnimation('stun', 0.1);
    this.character.service.send('stun');
  }

  public update(dt: number): void {
    super.update(dt);
    if (this.timer >= this.duration) {
      const { Idle } = require('./Idle');
      this.character.setState(new Idle(this.character));
    }
  }

  // No input allowed while stunned
  public onInputChange(): void {}
}
