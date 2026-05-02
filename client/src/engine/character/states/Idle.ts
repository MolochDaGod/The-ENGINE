import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Idle extends CharacterStateBase {
  public tags = ['canMove', 'grounded', 'idle'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
    this.playAnimation('idle', 0.1);
  }

  public update(dt: number): void {
    super.update(dt);
    this.fallInAir();
  }

  public onInputChange(): void {
    super.onInputChange();

    // Jump from standstill
    if (this.character.inputJustPressed?.('jump')) {
      const { JumpIdle } = require('./JumpIdle');
      this.character.setState(new JumpIdle(this.character));
      return;
    }

    // Enter combat stance
    if (this.character.inputJustPressed?.('attack') || this.character.inputJustPressed?.('block')) {
      const { CombatIdle } = require('./CombatIdle');
      this.character.setState(new CombatIdle(this.character));
      return;
    }

    if (this.anyDirection()) {
      const { Walk } = require('./Walk');
      this.character.setState(new Walk(this.character));
    }
  }
}
