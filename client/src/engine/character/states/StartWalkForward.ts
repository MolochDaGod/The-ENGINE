import { StartWalkBase } from './StartWalkBase';
import type { BaseCharacter } from '../BaseCharacter';

export class StartWalkForward extends StartWalkBase {
  constructor(character: BaseCharacter) {
    super(character);
    this.playAnimation('start_forward', 0.1);
  }
}
