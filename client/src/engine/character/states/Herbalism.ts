import { HarvestingBase } from './HarvestingBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Herbalism extends HarvestingBase {
  protected profession = 'herbalism';
  protected gatherTime = 2.5;
  protected animName = 'gather_herb';

  constructor(character: BaseCharacter) { super(character); }
}
