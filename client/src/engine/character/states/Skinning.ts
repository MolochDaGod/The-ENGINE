import { HarvestingBase } from './HarvestingBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Skinning extends HarvestingBase {
  protected profession = 'skinning';
  protected gatherTime = 3;
  protected animName = 'skin_creature';

  constructor(character: BaseCharacter) { super(character); }
}
