import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { Idle } from './Idle';
import { JumpRunning } from './JumpRunning';
import { Sprint } from './Sprint';
import { Walk } from './Walk';

export class StartWalkBase extends CharacterStateBase {
  public tags = ['canMove', 'grounded', 'moving'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0.11;
  }

  public update(dt: number): void {
    super.update(dt);
    if (this.animationEnded(dt)) {
      this.character.setState(new Walk(this.character));
    }
    this.fallInAir();
  }

  public onInputChange(): void {
    super.onInputChange();
    if (this.character.inputJustPressed?.('jump')) {
      this.character.setState(new JumpRunning(this.character));
      return;
    }
    if (this.noDirection()) {
      this.character.setState(new Idle(this.character));
      return;
    }
    if (this.character.inputIsPressed?.('sprint')) {
      this.character.setState(new Sprint(this.character));
    }
  }
}
