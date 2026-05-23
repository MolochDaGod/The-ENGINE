import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { CombatIdle } from './CombatIdle';

const IFRAMES_DURATION = 0.3; // seconds of invulnerability

export class Dodging extends CharacterStateBase {
  public tags = ['combat', 'dodging', 'grounded'];
  public invulnerable = true;

  constructor(character: BaseCharacter) {
    super(character);
    this.character.speed = 0.22; // fast dodge roll
    this.playAnimation('dodge_roll', 0.05);
    this.character.service.send('dash');
  }

  public update(dt: number): void {
    super.update(dt);

    // I-frames expire
    if (this.invulnerable && this.timer > IFRAMES_DURATION) {
      this.invulnerable = false;
    }

    // Decelerate through the roll
    if (this.timer > 0.15) {
      this.character.speed = Math.max(0, this.character.speed - dt * 0.8);
    }

    if (this.animationEnded(dt)) {
      this.character.setState(new CombatIdle(this.character));
    }

    this.fallInAir();
  }
}
