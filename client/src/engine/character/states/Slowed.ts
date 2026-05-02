import { Debuffed } from './Debuffed';
import type { BaseCharacter } from '../BaseCharacter';

export class Slowed extends Debuffed {
  public tags = ['debuffed', 'slowed', 'canMove'];

  constructor(character: BaseCharacter, duration = 4) {
    super(character, duration);
    this.speedMultiplier = 0.4; // 60% speed reduction
    this.playAnimation('walk_injured', 0.2);
  }

  public onInputChange(): void {
    // Can still move, just slowly
    if (this.anyDirection()) {
      this.character.speed = this.originalSpeed * this.speedMultiplier;
    } else {
      this.character.speed = 0;
    }
  }
}
