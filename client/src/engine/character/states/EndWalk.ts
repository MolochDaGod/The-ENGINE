import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { Idle } from './Idle';
import { JumpIdle } from './JumpIdle';
import { Sprint } from './Sprint';
import { Walk } from './Walk';

export class EndWalk extends CharacterStateBase {
  public tags = ['canMove', 'grounded'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
    this.playAnimation('stop', 0.1);
  }

  public update(dt: number): void {
    super.update(dt);

    if (this.animationEnded(dt)) {
      this.character.setState(new Idle(this.character));
    }

    this.fallInAir();
  }

  public onInputChange(): void {
    super.onInputChange();

    if (this.character.inputJustPressed?.('jump')) {
      this.character.setState(new JumpIdle(this.character));
      return;
    }

    if (this.anyDirection()) {
      if (this.character.inputIsPressed?.('sprint')) {
        this.character.setState(new Sprint(this.character));
      } else {
        this.character.setState(new Walk(this.character));
      }
    }
  }
}
