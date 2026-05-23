import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { CombatIdle } from './CombatIdle';
import { Dodging } from './Dodging';
import { Parrying } from './Parrying';

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
      this.character.setState(new CombatIdle(this.character));
      return;
    }

    // Perfect parry attempt
    if (this.character.inputJustPressed?.('attack')) {
      this.character.setState(new Parrying(this.character));
      return;
    }

    if (this.character.inputJustPressed?.('dash')) {
      this.character.setState(new Dodging(this.character));
    }
  }
}
