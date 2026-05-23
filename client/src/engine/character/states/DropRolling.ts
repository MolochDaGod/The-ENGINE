import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { EndWalk } from './EndWalk';
import { Walk } from './Walk';

export class DropRolling extends CharacterStateBase {
  public tags = ['grounded'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0.11;
    this.playAnimation('drop_running_roll', 0.03);
  }

  public update(dt: number): void {
    super.update(dt);
    if (this.animationEnded(dt)) {
      if (this.anyDirection()) {
        this.character.setState(new Walk(this.character));
      } else {
        this.character.setState(new EndWalk(this.character));
      }
    }
  }
}
