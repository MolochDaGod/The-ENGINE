import { HarvestingBase } from './HarvestingBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Mining extends HarvestingBase {
  protected profession = 'mining';
  protected gatherTime = 3.5;
  protected animName = 'mine';

  constructor(character: BaseCharacter) { super(character); }
}
