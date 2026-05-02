import { Debuffed } from './Debuffed';
import type { BaseCharacter } from '../BaseCharacter';

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
      const { MeleeAttack } = require('./MeleeAttack');
      this.character.setState(new MeleeAttack(this.character, 0));
    }
    if (this.character.inputJustPressed?.('block')) {
      const { Blocking } = require('./Blocking');
      this.character.setState(new Blocking(this.character));
    }
  }
}
