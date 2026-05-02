import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class DropIdle extends CharacterStateBase {
  public tags = ['grounded'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
    this.playAnimation('drop_idle', 0.1);
  }

  public update(dt: number): void {
    super.update(dt);
    if (this.animationEnded(dt)) {
      const { Idle } = require('./Idle');
      this.character.setState(new Idle(this.character));
    }
    this.fallInAir();
  }

  public onInputChange(): void {
    super.onInputChange();
    if (this.character.inputJustPressed?.('jump')) {
      const { JumpIdle } = require('./JumpIdle');
      this.character.setState(new JumpIdle(this.character));
      return;
    }
    if (this.anyDirection()) {
      const { StartWalkForward } = require('./StartWalkForward');
      this.character.setState(new StartWalkForward(this.character));
    }
  }
}
