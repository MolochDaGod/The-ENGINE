import { CharacterStateBase } from './CharacterStateBase';
import type { BaseCharacter } from '../BaseCharacter';
import { CombatIdle } from './CombatIdle';
import { Dodging } from './Dodging';

const COMBO_ANIMS = ['attack_1', 'attack_2', 'attack_3'];
const COMBO_WINDOW = 0.35; // seconds after anim ends to chain next hit

export class MeleeAttack extends CharacterStateBase {
  public tags = ['combat', 'canDamage', 'attacking'];
  private comboIndex: number;
  private canChain = false;
  private chainQueued = false;

  constructor(character: BaseCharacter, comboIndex = 0) {
    super(character);
    this.comboIndex = Math.min(comboIndex, COMBO_ANIMS.length - 1);
    this.character.speed = 0.03; // slight forward lunge
    this.playAnimation(COMBO_ANIMS[this.comboIndex], 0.05);
    this.character.service.send('attack');
  }

  public update(dt: number): void {
    super.update(dt);

    // Enable combo chaining near end of animation
    if (!this.canChain && this.animationLength > 0 && this.timer > this.animationLength * 0.6) {
      this.canChain = true;
    }

    // Animation ended — chain or return to combat idle
    if (this.animationEnded(dt)) {
      if (this.chainQueued && this.comboIndex < COMBO_ANIMS.length - 1) {
        this.character.setState(new MeleeAttack(this.character, this.comboIndex + 1));
      } else if (this.timer < this.animationLength + COMBO_WINDOW) {
        // Brief window to queue next attack
        return;
      } else {
        this.character.setState(new CombatIdle(this.character));
      }
    }
  }

  public onInputChange(): void {
    super.onInputChange();
    if (this.canChain && this.character.inputJustPressed?.('attack')) {
      this.chainQueued = true;
    }
    // Dodge cancel
    if (this.character.inputJustPressed?.('dash')) {
      this.character.setState(new Dodging(this.character));
    }
  }
}
