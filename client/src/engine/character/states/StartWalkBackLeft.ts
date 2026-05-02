import { StartWalkBase } from './StartWalkBase';
import type { BaseCharacter } from '../BaseCharacter';

export class StartWalkBackLeft extends StartWalkBase {
  constructor(character: BaseCharacter) {
    super(character);
    this.playAnimation('start_back_left', 0.1);
  }
}
