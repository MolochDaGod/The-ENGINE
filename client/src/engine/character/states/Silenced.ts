import { Debuffed } from './Debuffed';
import type { BaseCharacter } from '../BaseCharacter';
import { Walk } from './Walk';

export class Silenced extends Debuffed {
  public tags = ['debuffed', 'silenced', 'canMove'];

  constructor(character: BaseCharacter, duration = 4) {
    super(character, duration);
    this.speedMultiplier = 1; // full speed
    this.playAnimation('idle', 0.1);
  }

  public onInputChange(): void {
    // Can move but cannot use abilities/spells
    if (this.anyDirection()) {
      this.character.setState(new Walk(this.character));
    }
    // Attack/block/dash are blocked — silence prevents all abilities
  }
}
