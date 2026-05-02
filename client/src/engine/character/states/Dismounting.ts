import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Dismounting extends CharacterStateBase {
  public tags = ['dismounting'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
    this.playAnimation('dismount', 0.1);
    this.character.service.send('dismount');
  }

  public update(dt: number): void {
    super.update(dt);
    if (this.animationEnded(dt)) {
      const { Idle } = require('./Idle');
      this.character.setState(new Idle(this.character));
    }
  }

  public onInputChange(): void {} // No input during dismount
}
