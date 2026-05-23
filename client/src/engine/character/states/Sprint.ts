import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { EndWalk } from './EndWalk';
import { JumpRunning } from './JumpRunning';
import { Walk } from './Walk';

export class Sprint extends CharacterStateBase {
  public tags = ['canMove', 'grounded', 'moving', 'sprinting'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0.18; // ~1.6x walk
    this.playAnimation('sprint', 0.1);
  }

  public update(dt: number): void {
    super.update(dt);
    this.fallInAir();
  }

  public onInputChange(): void {
    super.onInputChange();

    if (!this.character.inputIsPressed?.('sprint')) {
      this.character.setState(new Walk(this.character));
      return;
    }

    if (this.character.inputJustPressed?.('jump')) {
      this.character.setState(new JumpRunning(this.character));
      return;
    }

    if (this.noDirection()) {
      this.character.setState(new EndWalk(this.character));
    }
  }
}
