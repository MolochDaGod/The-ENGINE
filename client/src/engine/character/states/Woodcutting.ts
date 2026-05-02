import { HarvestingBase } from './HarvestingBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Woodcutting extends HarvestingBase {
  protected profession = 'woodcutting';
  protected gatherTime = 4;
  protected animName = 'chop_wood';

  constructor(character: BaseCharacter) { super(character); }
}
