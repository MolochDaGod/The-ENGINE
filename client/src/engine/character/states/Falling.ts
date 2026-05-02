import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Falling extends CharacterStateBase {
  public tags = ['airborne'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0.06; // air control
    this.playAnimation('falling', 0.3);
  }

  public update(dt: number): void {
    super.update(dt);

    if (!this.character.isAir) {
      this.setAppropriateDropState();
    }
  }
}
