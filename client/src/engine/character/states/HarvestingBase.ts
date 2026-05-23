import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { Idle } from './Idle';

/**
 * Base for all 5 harvesting professions.
 * Subclasses set animName, gatherTime, and profession name.
 */
export class HarvestingBase extends CharacterStateBase {
  public tags = ['harvesting', 'grounded'];
  protected profession = 'generic';
  protected gatherTime = 3; // seconds to complete
  protected animName = 'gather';
  public progress = 0; // 0..1

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0;
  }

  public onEnter(): void {
    this.playAnimation(this.animName, 0.2);
    this.character.service.send('harvest', { profession: this.profession });
  }

  public update(dt: number): void {
    super.update(dt);
    this.progress = Math.min(1, this.timer / this.gatherTime);

    if (this.progress >= 1) {
      // Yield resources — external system listens via FSM event
      this.character.service.send('harvestComplete', { profession: this.profession });
      this.character.setState(new Idle(this.character));
    }
  }

  public onInputChange(): void {
    // Any movement cancels harvesting
    if (this.anyDirection() || this.character.inputJustPressed?.('jump')) {
      this.character.service.send('harvestCancel', { profession: this.profession });
      this.character.setState(new Idle(this.character));
    }
  }
}
