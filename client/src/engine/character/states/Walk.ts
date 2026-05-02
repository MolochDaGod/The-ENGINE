import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Walk extends CharacterStateBase {
  public tags = ['canMove', 'grounded', 'moving'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0.11; // default walk speed
    this.playAnimation('run', 0.1);
  }

  public update(dt: number): void {
    super.update(dt);
    this.fallInAir();
  }

  public onInputChange(): void {
    super.onInputChange();

    if (this.noDirection()) {
      const { EndWalk } = require('./EndWalk');
      this.character.setState(new EndWalk(this.character));
      return;
    }

    if (this.character.inputIsPressed?.('sprint')) {
      const { Sprint } = require('./Sprint');
      this.character.setState(new Sprint(this.character));
      return;
    }

    if (this.character.inputJustPressed?.('jump')) {
      const { JumpRunning } = require('./JumpRunning');
      this.character.setState(new JumpRunning(this.character));
      return;
    }

    if (this.character.inputJustPressed?.('attack')) {
      const { CombatIdle } = require('./CombatIdle');
      this.character.setState(new CombatIdle(this.character));
    }
  }
}
