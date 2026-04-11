/**
 * Grudge Engine — CombatSystem
 *
 * Singleton that manages all damage events across every registered character.
 * Handles:
 *   - Typed damage (physical / magic / fire / lightning / void / holy / earth / true)
 *   - Kill tracking, kill events → XP rewards
 *   - Death lifecycle (can hook respawn logic)
 *   - DPS / damage-dealt telemetry (sent to Grudge backend on match end)
 *
 * Characters register themselves on construction; CharacterStats events wire
 * automatically when stats are attached.
 *
 * Usage:
 *   const combat = CombatSystem.getInstance();
 *   combat.dealDamage(attacker, victim, 35, 'fire');
 *   combat.on('kill', ({ attacker, victim }) => { ... });
 */

import { CharacterStats, type DamageType } from './CharacterStats';

export interface KillEvent {
  attackerId: string;
  victimId:   string;
  damageType: DamageType;
}

export interface DamageEvent {
  attackerId: string;
  victimId:   string;
  amount:     number;
  type:       DamageType;
}

type CombatEventMap = {
  damage: DamageEvent;
  kill:   KillEvent;
  death:  { characterId: string };
};

type CombatCallback<K extends keyof CombatEventMap> = (event: CombatEventMap[K]) => void;

export class CombatSystem {
  private static _inst: CombatSystem | null = null;

  /** Map characterId → CharacterStats */
  private _registry: Map<string, CharacterStats> = new Map();
  /** Track total damage dealt per attacker this match */
  private _damageLedger: Map<string, number>     = new Map();
  /** Kill counts per character */
  private _killCounts:   Map<string, number>      = new Map();

  private _listeners: Partial<{ [K in keyof CombatEventMap]: Array<CombatCallback<K>> }> = {};

  private constructor() {}

  static getInstance(): CombatSystem {
    if (!CombatSystem._inst) CombatSystem._inst = new CombatSystem();
    return CombatSystem._inst;
  }

  // ── Character registration ─────────────────────────────────────────────────

  register(id: string, stats: CharacterStats): void {
    this._registry.set(id, stats);
    this._damageLedger.set(id, 0);
    this._killCounts.set(id, 0);

    stats.on('death', () => {
      this._emit('death', { characterId: id });
    });
  }

  unregister(id: string): void {
    this._registry.delete(id);
  }

  // ── Combat API ─────────────────────────────────────────────────────────────

  /**
   * Deal damage from attackerId to victimId.
   * Returns actual damage dealt after resistances.
   */
  dealDamage(
    attackerId: string,
    victimId:   string,
    rawAmount:  number,
    type:       DamageType = 'physical',
  ): number {
    const victimStats = this._registry.get(victimId);
    if (!victimStats || !victimStats.alive) return 0;

    const actual = victimStats.takeDamage(rawAmount, type);

    // Ledger
    const prev = this._damageLedger.get(attackerId) ?? 0;
    this._damageLedger.set(attackerId, prev + actual);

    this._emit('damage', { attackerId, victimId, amount: actual, type });

    if (!victimStats.alive) {
      const kills = (this._killCounts.get(attackerId) ?? 0) + 1;
      this._killCounts.set(attackerId, kills);

      // Award XP to attacker
      const attackerStats = this._registry.get(attackerId);
      if (attackerStats) {
        attackerStats.gainXp(50 + victimStats.level * 10);
      }

      this._emit('kill', { attackerId, victimId, damageType: type });
    }

    return actual;
  }

  /**
   * Instant heal for characterId
   */
  heal(characterId: string, amount: number): number {
    return this._registry.get(characterId)?.heal(amount) ?? 0;
  }

  // ── Stats queries ──────────────────────────────────────────────────────────

  getStats(id: string): CharacterStats | undefined { return this._registry.get(id); }
  getDamageDealt(id: string): number { return this._damageLedger.get(id) ?? 0; }
  getKills(id: string): number       { return this._killCounts.get(id) ?? 0; }

  /** Full match summary (attach to GrudgeBackend.saveMatchRecord) */
  getMatchSummary(): Record<string, { damage: number; kills: number; level: number }> {
    const out: Record<string, any> = {};
    for (const [id, stats] of this._registry) {
      out[id] = {
        damage: this._damageLedger.get(id) ?? 0,
        kills:  this._killCounts.get(id)   ?? 0,
        level:  stats.level,
      };
    }
    return out;
  }

  /** Reset per-match counters (call at match start) */
  resetMatch(): void {
    this._damageLedger.clear();
    this._killCounts.clear();
    this._registry.forEach((_, id) => {
      this._damageLedger.set(id, 0);
      this._killCounts.set(id, 0);
    });
  }

  // ── Event system ───────────────────────────────────────────────────────────

  on<K extends keyof CombatEventMap>(event: K, cb: CombatCallback<K>): void {
    if (!this._listeners[event]) (this._listeners as any)[event] = [];
    (this._listeners[event] as any[]).push(cb);
  }

  private _emit<K extends keyof CombatEventMap>(event: K, data: CombatEventMap[K]): void {
    (this._listeners[event] as Array<CombatCallback<K>> | undefined)?.forEach(cb => cb(data));
  }

  destroy(): void {
    this._registry.clear();
    this._damageLedger.clear();
    this._killCounts.clear();
    this._listeners = {};
    CombatSystem._inst = null;
  }
}
