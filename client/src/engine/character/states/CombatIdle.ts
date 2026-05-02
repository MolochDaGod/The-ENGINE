import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

/**
 * Combat stance — player faces target, can attack/block/dodge/parry.
 * Exits to Idle after a timeout if no combat actions are taken.
 */
export class CombatIdle extends CharacterStateBase {
  public tags = ['canMove', 'grounded', 'combat'];
  private combatTimeout = 5; // seconds until returning to Idle

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0.08; // slower combat movement
    this.playAnimation('combat_idle', 0.15);
    this.character.service.send('combat');
  }

  public update(dt: number): void {
    super.update(dt);
    this.fallInAir();

    // Return to Idle if no combat input for a while
    if (this.timer > this.combatTimeout && this.noDirection()) {
      const { Idle } = require('./Idle');
      this.character.setState(new Idle(this.character));
    }
  }

  public onInputChange(): void {
    super.onInputChange();
    this.timer = 0; // reset timeout on any input

    if (this.character.inputJustPressed?.('attack')) {
      const { MeleeAttack } = require('./MeleeAttack');
      this.character.setState(new MeleeAttack(this.character, 0));
      return;
    }
    if (this.character.inputJustPressed?.('block')) {
      const { Blocking } = require('./Blocking');
      this.character.setState(new Blocking(this.character));
      return;
    }
    if (this.character.inputJustPressed?.('dash')) {
      const { Dodging } = require('./Dodging');
      this.character.setState(new Dodging(this.character));
      return;
    }
    if (this.character.inputJustPressed?.('jump')) {
      const { JumpIdle } = require('./JumpIdle');
      this.character.setState(new JumpIdle(this.character));
      return;
    }
    // Exit combat mode
    if (this.anyDirection() && this.character.inputIsPressed?.('sprint')) {
      const { Sprint } = require('./Sprint');
      this.character.setState(new Sprint(this.character));
    }
  }
}
