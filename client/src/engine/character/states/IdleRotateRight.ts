import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { Idle } from './Idle';
import { Walk } from './Walk';

export class IdleRotateRight extends CharacterStateBase {
  public tags = ['canMove', 'grounded'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
    this.playAnimation('rotate_right', 0.1);
  }

  public update(dt: number): void {
    super.update(dt);
    if (this.animationEnded(dt)) {
      this.character.setState(new Idle(this.character));
    }
  }

  public onInputChange(): void {
    super.onInputChange();
    if (this.anyDirection()) {
      this.character.setState(new Walk(this.character));
    }
  }
}
