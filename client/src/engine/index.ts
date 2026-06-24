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

export { BaseRaceCharacter, BaseCharacter, GLTFLoader } from './character/BaseCharacter';
export type { CharacterOptions, CharacterRace, RaceConfig } from './character/BaseCharacter';
export { RACE_CONFIGS, DEFAULT_RACE }    from './character/BaseCharacter';

export { Attacker }                      from './character/Attacker';
export { RoleControls }                  from './character/RoleControls';
export { FootIK }                        from './character/FootIK';

// ── Character States (Sketchbook-style class-based FSM) ─────────────────────
export type { ICharacterState }          from './character/states/ICharacterState';
export { CharacterStateBase }            from './character/states/CharacterStateBase';

// Locomotion
export { Idle, Walk, Sprint, EndWalk }   from './character/states/_stateLibrary';
export { Falling, JumpIdle, JumpRunning } from './character/states/_stateLibrary';
export { DropIdle, DropRunning, DropRolling } from './character/states/_stateLibrary';

// Combat
export { CombatIdle, MeleeAttack, RangedAttack } from './character/states/_stateLibrary';
export { Blocking, Parrying, Dodging }   from './character/states/_stateLibrary';
export { Stunned, KnockedDown, Dead }    from './character/states/_stateLibrary';

// Effects
export { Debuffed, Slowed, Feared, Rooted, Silenced } from './character/states/_stateLibrary';

// Harvesting
export { HarvestingBase, Mining, Herbalism, Woodcutting, Fishing, Skinning } from './character/states/_stateLibrary';

// Interaction
export { Mounting, Dismounting, Emoting } from './character/states/_stateLibrary';

// ── AI ─────────────────────────────────────────────────────────────────────────────
export { BaseAi }                        from './ai/BaseAi';

// ── Unified player controller (grudge-control + artifact animator) ─────────────
export {
  GrudgePlayerController,
  GrudgeFighterAi,
  GRUDGE_CHARACTERS,
  GRUDGE_CDN,
  meleeStrike,
  buildOWR,
  loadControlSettings,
  InputState,
  LocomotionBlend,
} from './controller';
export type {
  GrudgePlayerControllerOptions,
  GrudgeCharacterEntry,
  AiTarget,
  ControlSettings,
  LocoBlendInput,
} from './controller';
