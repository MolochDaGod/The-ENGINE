import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { CombatIdle } from './CombatIdle';
import { EndWalk } from './EndWalk';
import { JumpRunning } from './JumpRunning';
import { Sprint } from './Sprint';

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
      this.character.setState(new EndWalk(this.character));
      return;
    }

    if (this.character.inputIsPressed?.('sprint')) {
      this.character.setState(new Sprint(this.character));
      return;
    }

    if (this.character.inputJustPressed?.('jump')) {
      this.character.setState(new JumpRunning(this.character));
      return;
    }

    if (this.character.inputJustPressed?.('attack')) {
      this.character.setState(new CombatIdle(this.character));
    }
  }
}
