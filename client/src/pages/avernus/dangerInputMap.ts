/**
 * Danger Room / Open combat input SSOT for Avernus.
 *
 * Source (do not invent):
 * - gameopen/artifacts/animator/src/hud/quickActions.ts
 * - gameopen/artifacts/animator/src/three/Studio.ts (handleKey / handleKeyUp)
 * - gameopen/artifacts/animator/src/components/DangerStartScreen.tsx DEFAULT_KEYS
 *
 * Canonical binds (combat):
 *   Hold Q     mode / state radial (combat↔harvest style); tap Q swaps weapon / mode
 *   Shift+Q    swap main ↔ side arm (arsenal)
 *   E          interact first (doors / props); forcefield guard if nothing to use
 *   F          class / weapon skill (useSkill / f-skill)
 *   R          ultimate / heavy weapon skill (doHeavyAttack)
 *   1–4        signature weapon skills
 *   LMB        attack / select
 *   RMB        hard focus toggle
 *   X          roll / dodge
 *   C          parry
 *   Space      jump
 *   Alt        combat slide
 *   V          kick utility
 *
 * Hold threshold for radials (Studio): ~0.18s quick-tap vs hold.
 */

export const DANGER_HOLD_TAP_SEC = 0.18;

export const DANGER_INPUT_LEGEND = [
  { keys: 'W A S D', label: 'Move · Shift sprint · Space jump' },
  { keys: 'LMB', label: 'Attack / select (FOCUS)' },
  { keys: 'RMB', label: 'Toggle hard FOCUS' },
  { keys: 'X · C', label: 'Roll · Parry' },
  { keys: 'E', label: 'Interact (else forcefield guard)' },
  { keys: 'F', label: 'Class / weapon skill' },
  { keys: 'R', label: 'Ultimate / heavy weapon skill' },
  { keys: '1–4', label: 'Signature skills' },
  { keys: 'Q · Hold Q', label: 'Tap: swap weapon · Hold: mode/state radial' },
  { keys: 'Shift+Q', label: 'Swap main ↔ side arm' },
] as const;

/** Short chips (matches COMBAT_KEY_CHIPS spirit). */
export const DANGER_KEY_CHIPS = [
  'Hold Q: Mode / swap radial',
  'Q: Swap weapon',
  'E: Interact',
  'F: Class skill',
  'R: Ultimate',
  '1–4: Signatures',
  'X: Roll',
  'C: Parry',
  'LMB: Attack',
  'RMB: Focus',
] as const;

export type DangerCombatAction =
  | 'swap_weapon'
  | 'open_mode_radial'
  | 'swap_arsenal'
  | 'interact'
  | 'forcefield'
  | 'class_skill'
  | 'ultimate'
  | 'signature'
  | 'parry'
  | 'dodge'
  | 'jump'
  | 'slide'
  | 'kick';

export interface DangerKeyEvent {
  action: DangerCombatAction;
  /** For signature 0–3 */
  index?: number;
}
