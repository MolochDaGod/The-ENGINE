import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class JumpRunning extends CharacterStateBase {
  public tags = ['airborne', 'moving'];
  private alreadyJumped = false;

  constructor(character: BaseCharacter) {
    super(character);
    this.playAnimation('jump_running', 0.03);
  }

  public update(dt: number): void {
    super.update(dt);

    // Air steering
    if (this.alreadyJumped && this.anyDirection()) {
      this.character.speed = 0.06;
    }

    // Delayed physical jump force
    if (this.timer > 0.13 && !this.alreadyJumped) {
      this.character.body.velocity.y = 7; // slightly lower than idle jump
      this.alreadyJumped = true;
    } else if (this.timer > 0.24 && !this.character.isAir) {
      this.setAppropriateDropState();
    } else if (this.animationEnded(dt)) {
      const { Falling } = require('./Falling');
      this.character.setState(new Falling(this.character));
    }
  }
}
