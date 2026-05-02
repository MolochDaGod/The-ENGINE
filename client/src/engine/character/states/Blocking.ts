import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Blocking extends CharacterStateBase {
  public tags = ['combat', 'blocking', 'grounded'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0.04; // very slow while blocking
    this.playAnimation('block_idle', 0.1);
    this.character.service.send('block');
  }

  public update(dt: number): void {
    super.update(dt);
    this.fallInAir();

    // TODO: drain stamina over time via CharacterStats
  }

  public onInputChange(): void {
    super.onInputChange();

    // Release block
    if (!this.character.inputIsPressed?.('block')) {
      const { CombatIdle } = require('./CombatIdle');
      this.character.setState(new CombatIdle(this.character));
      return;
    }

    // Perfect parry attempt
    if (this.character.inputJustPressed?.('attack')) {
      const { Parrying } = require('./Parrying');
      this.character.setState(new Parrying(this.character));
      return;
    }

    if (this.character.inputJustPressed?.('dash')) {
      const { Dodging } = require('./Dodging');
      this.character.setState(new Dodging(this.character));
    }
  }
}
