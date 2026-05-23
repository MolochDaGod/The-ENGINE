import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { Falling } from './Falling';

export class JumpIdle extends CharacterStateBase {
  public tags = ['airborne'];
  private alreadyJumped = false;

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
    this.playAnimation('jump_idle', 0.1);
  }

  public update(dt: number): void {
    super.update(dt);

    // Air steering after launch
    if (this.alreadyJumped && this.anyDirection()) {
      this.character.speed = 0.06; // reduced air control
    }

    // Delayed physical jump force
    if (this.timer > 0.2 && !this.alreadyJumped) {
      this.character.body.velocity.y = 8; // jump impulse
      this.alreadyJumped = true;
    } else if (this.timer > 0.3 && !this.character.isAir) {
      this.setAppropriateDropState();
    } else if (this.animationEnded(dt)) {
      this.character.setState(new Falling(this.character));
    }
  }
}
