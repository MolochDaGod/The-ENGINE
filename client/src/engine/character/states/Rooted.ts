import { Debuffed } from './Debuffed';
import type { BaseCharacter } from '../BaseCharacter';
import { Blocking } from './Blocking';
import { MeleeAttack } from './MeleeAttack';

export class Rooted extends Debuffed {
  public tags = ['debuffed', 'rooted', 'combat'];

  constructor(character: BaseCharacter, duration = 3) {
    super(character, duration);
    this.speedMultiplier = 0;
    this.playAnimation('idle', 0.1); // stay in place
  }

  public onInputChange(): void {
    // Can attack/block but NOT move
    if (this.character.inputJustPressed?.('attack')) {
      this.character.setState(new MeleeAttack(this.character, 0));
    }
    if (this.character.inputJustPressed?.('block')) {
      this.character.setState(new Blocking(this.character));
    }
  }
}
