import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class StartWalkBase extends CharacterStateBase {
  public tags = ['canMove', 'grounded', 'moving'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0.11;
  }

  public update(dt: number): void {
    super.update(dt);
    if (this.animationEnded(dt)) {
      const { Walk } = require('./Walk');
      this.character.setState(new Walk(this.character));
    }
    this.fallInAir();
  }

  public onInputChange(): void {
    super.onInputChange();
    if (this.character.inputJustPressed?.('jump')) {
      const { JumpRunning } = require('./JumpRunning');
      this.character.setState(new JumpRunning(this.character));
      return;
    }
    if (this.noDirection()) {
      const { Idle } = require('./Idle');
      this.character.setState(new Idle(this.character));
      return;
    }
    if (this.character.inputIsPressed?.('sprint')) {
      const { Sprint } = require('./Sprint');
      this.character.setState(new Sprint(this.character));
    }
  }
}
