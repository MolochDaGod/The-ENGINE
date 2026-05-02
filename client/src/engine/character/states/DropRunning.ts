import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class DropRunning extends CharacterStateBase {
  public tags = ['canMove', 'grounded', 'moving'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0.11;
    this.playAnimation('drop_running', 0.1);
  }

  public update(dt: number): void {
    super.update(dt);
    if (this.animationEnded(dt)) {
      const { Walk } = require('./Walk');
      this.character.setState(new Walk(this.character));
    }
  }

  public onInputChange(): void {
    super.onInputChange();
    if (this.noDirection()) {
      const { EndWalk } = require('./EndWalk');
      this.character.setState(new EndWalk(this.character));
      return;
    }
    if (this.character.inputJustPressed?.('jump')) {
      const { JumpRunning } = require('./JumpRunning');
      this.character.setState(new JumpRunning(this.character));
    }
  }
}
