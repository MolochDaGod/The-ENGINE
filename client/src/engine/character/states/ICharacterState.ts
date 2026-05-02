/**
 * Grudge Engine — ICharacterState
 *
 * Interface for class-based character states (Sketchbook pattern).
 * Each state manages its own animation, velocity, and transition logic.
 */

export interface ICharacterState {
  /** Tags that describe what the character can do in this state */
  tags: string[];

  /** Called every frame */
  update(dt: number): void;

  /** Called when player input changes (key down/up) */
  onInputChange(): void;

  /** Called when entering this state */
  onEnter(): void;

  /** Called when leaving this state */
  onExit(): void;
}
