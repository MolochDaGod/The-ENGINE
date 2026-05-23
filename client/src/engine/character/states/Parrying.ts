import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { CombatIdle } from './CombatIdle';

const PARRY_WINDOW = 0.2; // seconds of active parry frames

export class Parrying extends CharacterStateBase {
  public tags = ['combat', 'parrying', 'grounded'];
  public parryActive = true;

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
    this.playAnimation('parry', 0.05);
    this.character.service.send('parry');
  }

  public update(dt: number): void {
    super.update(dt);

    // Parry window expires
    if (this.parryActive && this.timer > PARRY_WINDOW) {
      this.parryActive = false;
    }

    if (this.animationEnded(dt)) {
      this.character.setState(new CombatIdle(this.character));
    }
  }
}
