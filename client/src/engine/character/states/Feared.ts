import { Debuffed } from './Debuffed';
import type { BaseCharacter } from '../BaseCharacter';

export class Feared extends Debuffed {
  public tags = ['debuffed', 'feared', 'disabled'];
  private fleeAngle: number;

  constructor(character: BaseCharacter, duration = 3) {
    super(character, duration);
    this.character.speed = 0.14; // panicked sprint
    this.fleeAngle = Math.random() * Math.PI * 2;
    this.playAnimation('run_scared', 0.1);
  }

  public update(dt: number): void {
    super.update(dt);

    // Force movement in random direction, changing occasionally
    if (Math.random() < dt * 0.5) {
      this.fleeAngle += (Math.random() - 0.5) * Math.PI * 0.5;
    }

    this.character.direction.set(
      Math.cos(this.fleeAngle) * this.character.speed * dt * 60,
      Math.sin(this.fleeAngle) * this.character.speed * dt * 60,
    );
  }

  public onInputChange(): void {} // No control while feared
}
