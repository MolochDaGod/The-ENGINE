/**
 * Grudge Engine — AbilitySystem
 *
 * Standardized skill/ability registration for all Grudge 3D characters.
 * Decouples ability logic from FSM state machines — abilities register their
 * cooldowns, costs, and effects here so they can be used by any character type.
 *
 * Integrates with:
 *   - CharacterStats  (mana / stamina cost gating)
 *   - CharacterFSM    (sends FSM events on cast, checks canDamage tag)
 *   - GrudgeBackend   (ability cast telemetry)
 *
 * Usage:
 *   const sys = AbilitySystem.getInstance();
 *   sys.register('maria', 'void_bolt', {
 *     cooldownMs: 300, manaCost: 8,
 *     cast: (caster, target) => { ... }
 *   });
 *   sys.cast('maria', 'void_bolt', casterStats, target);
 */

import { CharacterStats } from './CharacterStats';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AbilityDef {
  name:          string;
  cooldownMs:    number;   // milliseconds
  manaCost:      number;
  staminaCost?:  number;
  fsmEvent?:     string;   // event to send to FSM on cast (e.g. 'attack')
  requireTag?:   string;   // FSM tag required to cast (e.g. 'canMove')
  /** Executes when successfully cast */
  cast: (casterStats: CharacterStats, target?: CharacterStats) => void;
  /** Optional: extra condition check */
  canCast?: (casterStats: CharacterStats) => boolean;
}

export interface AbilityState {
  def:        AbilityDef;
  lastCastMs: number;
}

// ─── AbilitySystem ────────────────────────────────────────────────────────────

export class AbilitySystem {
  private static _inst: AbilitySystem | null = null;

  /** characterId → { abilityId → AbilityState } */
  private _registry: Map<string, Map<string, AbilityState>> = new Map();

  private constructor() {}

  static getInstance(): AbilitySystem {
    if (!AbilitySystem._inst) AbilitySystem._inst = new AbilitySystem();
    return AbilitySystem._inst;
  }

  // ── Registration ───────────────────────────────────────────────────────────

  register(characterId: string, abilityId: string, def: AbilityDef): void {
    if (!this._registry.has(characterId)) {
      this._registry.set(characterId, new Map());
    }
    this._registry.get(characterId)!.set(abilityId, { def, lastCastMs: 0 });
  }

  unregister(characterId: string, abilityId?: string): void {
    if (abilityId) {
      this._registry.get(characterId)?.delete(abilityId);
    } else {
      this._registry.delete(characterId);
    }
  }

  // ── Cast ───────────────────────────────────────────────────────────────────

  /**
   * Attempt to cast an ability.
   * Returns true if successfully cast, false if on cooldown / insufficient resources.
   */
  cast(
    characterId: string,
    abilityId:   string,
    casterStats: CharacterStats,
    targetStats?: CharacterStats,
  ): boolean {
    const state = this._registry.get(characterId)?.get(abilityId);
    if (!state) {
      console.warn(`[AbilitySystem] ability "${abilityId}" not registered for "${characterId}"`);
      return false;
    }

    const { def, lastCastMs } = state;
    const now = Date.now();

    // Cooldown check
    if (now - lastCastMs < def.cooldownMs) return false;

    // Mana check
    if (casterStats.mana < def.manaCost) return false;

    // Stamina check
    if (def.staminaCost && casterStats.stamina < def.staminaCost) return false;

    // Custom condition
    if (def.canCast && !def.canCast(casterStats)) return false;

    // Deduct resources
    casterStats.useMana(def.manaCost);
    if (def.staminaCost) casterStats.useStamina(def.staminaCost);

    // Execute
    state.lastCastMs = now;
    def.cast(casterStats, targetStats);

    return true;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  getCooldownMs(characterId: string, abilityId: string): number {
    const state = this._registry.get(characterId)?.get(abilityId);
    if (!state) return 0;
    const remaining = state.def.cooldownMs - (Date.now() - state.lastCastMs);
    return Math.max(0, remaining);
  }

  getCooldownPct(characterId: string, abilityId: string): number {
    const state = this._registry.get(characterId)?.get(abilityId);
    if (!state) return 0;
    const remaining = state.def.cooldownMs - (Date.now() - state.lastCastMs);
    return Math.max(0, remaining) / state.def.cooldownMs;
  }

  isReady(characterId: string, abilityId: string, stats: CharacterStats): boolean {
    const state = this._registry.get(characterId)?.get(abilityId);
    if (!state) return false;
    const cd = Date.now() - state.lastCastMs >= state.def.cooldownMs;
    const mp = stats.mana >= state.def.def?.manaCost ?? 0;
    return cd && mp;
  }

  listAbilities(characterId: string): string[] {
    return Array.from(this._registry.get(characterId)?.keys() ?? []);
  }

  destroy(): void {
    this._registry.clear();
    AbilitySystem._inst = null;
  }
}
