/**
 * Grudge Engine — Public API
 *
 * Import from '@/engine' to access all engine modules:
 *
 *   import {
 *     GrudgeEngine,
 *     BaseCharacter, CharacterFSM, createFSM,
 *     RoleControls, Attacker,
 *     BaseAi,
 *     GROUP_ROLE, GROUP_ENEMY, …
 *   } from '@/engine';
 */

// ─── Core ─────────────────────────────────────────────────────────────────────
export { GrudgeEngine }                  from './core/GrudgeEngine';
export type { Updatable, HasBodyAndMesh } from './core/GrudgeEngine';

export {
  GROUP_SCENE,
  GROUP_ROLE,
  GROUP_ENEMY,
  GROUP_ROLE_ATTACKER,
  GROUP_ENEMY_ATTACKER,
  GROUP_TRIGGER,
  GROUP_ENEMY_SHIELD,
  GROUP_NO_COLLIDE,
  MAX_DT,
} from './core/collisionGroups';

// ─── Character ────────────────────────────────────────────────────────────────
export { CharacterFSM, createFSM }       from './character/CharacterFSM';
export type { FSMEvent }                  from './character/CharacterFSM';

export { BaseCharacter, GLTFLoader }     from './character/BaseCharacter';
export type { CharacterOptions }          from './character/BaseCharacter';

export { Attacker }                      from './character/Attacker';
export { RoleControls }                  from './character/RoleControls';

// ─── AI ───────────────────────────────────────────────────────────────────────
export { BaseAi }                        from './ai/BaseAi';
