import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Mounting extends CharacterStateBase {
  public tags = ['mounting'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
    this.playAnimation('mount', 0.1);
    this.character.service.send('mount');
  }

  public update(dt: number): void {
    super.update(dt);
    if (this.animationEnded(dt)) {
      // Mounted state would be handled by the vehicle/mount system
      // For now, go back to idle (mount system overrides this)
      const { Idle } = require('./Idle');
      this.character.setState(new Idle(this.character));
    }
  }

  public onInputChange(): void {} // No input during mount animation
}
