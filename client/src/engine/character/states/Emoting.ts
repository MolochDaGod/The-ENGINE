import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { Idle } from './Idle';

export class Emoting extends CharacterStateBase {
  public tags = ['emoting', 'grounded'];
  private emoteName: string;

  constructor(character: BaseCharacter, emoteName = 'wave') {
    super(character);
    this.emoteName = emoteName;
    this.character.speed = 0;
    this.playAnimation(emoteName, 0.15);
    this.character.service.send('emote', { emote: emoteName });
  }

  public update(dt: number): void {
    super.update(dt);
    if (this.animationEnded(dt)) {
      this.character.setState(new Idle(this.character));
    }
  }

  public onInputChange(): void {
    // Any movement or combat input cancels emote
    if (this.anyDirection() || this.character.inputJustPressed?.('jump') ||
        this.character.inputJustPressed?.('attack')) {
      this.character.setState(new Idle(this.character));
    }
  }
}
