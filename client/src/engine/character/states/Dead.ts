import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Dead extends CharacterStateBase {
  public tags = ['dead'];

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
    this.playAnimation('death', 0.1);
    this.character.service.send('dead');
  }

  public update(dt: number): void {
    super.update(dt);
    // Death is a terminal state — no transitions out.
    // Respawn logic should create a new state externally.
  }

  public onInputChange(): void {} // No input when dead
}
