import { HarvestingBase } from './HarvestingBase';
import type { BaseCharacter } from '../BaseCharacter';

export class Fishing extends HarvestingBase {
  protected profession = 'fishing';
  protected gatherTime = 5;
  protected animName = 'fishing_cast';

  constructor(character: BaseCharacter) { super(character); }
}
