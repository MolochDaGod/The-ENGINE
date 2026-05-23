import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { Idle } from './Idle';
import { JumpIdle } from './JumpIdle';
import { StartWalkForward } from './StartWalkForward';

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
      this.character.setState(new Idle(this.character));
    }
    this.fallInAir();
  }

  public onInputChange(): void {
    super.onInputChange();
    if (this.character.inputJustPressed?.('jump')) {
      this.character.setState(new JumpIdle(this.character));
      return;
    }
    if (this.anyDirection()) {
      this.character.setState(new StartWalkForward(this.character));
    }
  }
}
