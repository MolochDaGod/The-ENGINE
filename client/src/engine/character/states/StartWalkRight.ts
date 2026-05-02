import { StartWalkBase } from './StartWalkBase';
import type { BaseCharacter } from '../BaseCharacter';

export class StartWalkRight extends StartWalkBase {
  constructor(character: BaseCharacter) {
    super(character);
    this.playAnimation('start_right', 0.1);
  }
}
