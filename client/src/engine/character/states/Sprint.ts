import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

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
      const { Walk } = require('./Walk');
      this.character.setState(new Walk(this.character));
      return;
    }

    if (this.character.inputJustPressed?.('jump')) {
      const { JumpRunning } = require('./JumpRunning');
      this.character.setState(new JumpRunning(this.character));
      return;
    }

    if (this.noDirection()) {
      const { EndWalk } = require('./EndWalk');
      this.character.setState(new EndWalk(this.character));
    }
  }
}
