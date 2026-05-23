import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { Idle } from './Idle';

export class KnockedDown extends CharacterStateBase {
  public tags = ['disabled', 'knockedDown'];
  private getupStarted = false;

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
    this.playAnimation('knockdown', 0.05);
    this.character.service.send('hit');
  }

  public update(dt: number): void {
    super.update(dt);

    // After knockdown anim, play getup
    if (!this.getupStarted && this.animationEnded(dt)) {
      this.getupStarted = true;
      this.timer = 0;
      this.playAnimation('getup', 0.1);
    }

    // After getup anim, return to idle
    if (this.getupStarted && this.animationEnded(dt)) {
      this.character.setState(new Idle(this.character));
    }
  }

  public onInputChange(): void {} // No input while knocked down
}
