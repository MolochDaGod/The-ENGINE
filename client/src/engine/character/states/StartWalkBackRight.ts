import { StartWalkBase } from './StartWalkBase';
import type { BaseCharacter } from '../BaseCharacter';

export class StartWalkBackRight extends StartWalkBase {
  constructor(character: BaseCharacter) {
    super(character);
    this.playAnimation('start_back_right', 0.1);
  }
}
