import { StartWalkBase } from './StartWalkBase';
import type { BaseCharacter } from '../BaseCharacter';

export class StartWalkLeft extends StartWalkBase {
  constructor(character: BaseCharacter) {
    super(character);
    this.playAnimation('start_left', 0.1);
  }
}
