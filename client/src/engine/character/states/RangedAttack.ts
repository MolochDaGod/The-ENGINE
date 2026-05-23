import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { CombatIdle } from './CombatIdle';
import { Dodging } from './Dodging';

export class RangedAttack extends CharacterStateBase {
  public tags = ['combat', 'canDamage', 'attacking', 'ranged'];
  private fired = false;

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
    this.playAnimation('ranged_attack', 0.1);
    this.character.service.send('attack');
  }

  public update(dt: number): void {
    super.update(dt);

    // Fire projectile at the midpoint of the animation
    if (!this.fired && this.animationLength > 0 && this.timer > this.animationLength * 0.5) {
      this.fired = true;
      this.character.service.send('projectile');
    }

    if (this.animationEnded(dt)) {
      this.character.setState(new CombatIdle(this.character));
    }
  }

  public onInputChange(): void {
    super.onInputChange();
    if (this.character.inputJustPressed?.('dash')) {
      this.character.setState(new Dodging(this.character));
    }
  }
}
