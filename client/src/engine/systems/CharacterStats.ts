/**
 * Grudge Engine — CharacterStats
 *
 * Standardized RPG stat block for every Grudge 3D character.
 * Attach one to a BaseCharacter to get full health/mana/stamina/level/xp/
 * attribute tracking with typed event callbacks.
 *
 * Usage:
 *   maria.stats = new CharacterStats({ maxHealth: 100, maxMana: 150 });
 *   maria.stats.on('death',  (s) => console.log('died'));
 *   maria.stats.on('levelUp', (s) => console.log('level', s.level));
 *   maria.stats.takeDamage(30, 'physical');
 */

// ─── Attribute model ──────────────────────────────────────────────────────────

export type DamageType =
  | 'physical' | 'magic' | 'fire' | 'lightning' | 'void' | 'holy' | 'earth' | 'true';

export interface StatBlock {
  maxHealth:   number;
  maxMana:     number;
  maxStamina:  number;

  // Resistances 0–1 (1 = immune)
  resistances: Partial<Record<DamageType, number>>;

  // Primary attributes
  strength:    number;  // melee damage multiplier
  intelligence:number;  // magic damage multiplier
  agility:     number;  // speed / dodge
  endurance:   number;  // stamina regen rate
  vitality:    number;  // max health bonus
  spirit:      number;  // mana regen rate
}

export type StatsEvent = 'damage' | 'heal' | 'death' | 'levelUp' | 'manaChange' | 'staminaChange' | 'revive';
type StatsCallback = (stats: CharacterStats, extra?: Record<string, unknown>) => void;

// ─── CharacterStats ───────────────────────────────────────────────────────────

const XP_PER_LEVEL = (level: number) => Math.floor(100 * Math.pow(1.4, level - 1));

export class CharacterStats {
  // Current values
  health:   number;
  mana:     number;
  stamina:  number;
  level:    number = 1;
  xp:       number = 0;

  // Base stats
  maxHealth:    number;
  maxMana:      number;
  maxStamina:   number;
  strength:     number;
  intelligence: number;
  agility:      number;
  endurance:    number;
  vitality:     number;
  spirit:       number;
  resistances:  Partial<Record<DamageType, number>>;

  // Regen rates (per second)
  manaRegenRate:    number = 2;
  staminaRegenRate: number = 8;
  private _manaAcc:    number = 0;
  private _staminaAcc: number = 0;

  alive: boolean = true;

  private _listeners: Map<StatsEvent, StatsCallback[]> = new Map();

  constructor(opts: Partial<StatBlock> = {}) {
    this.maxHealth    = opts.maxHealth    ?? 100;
    this.maxMana      = opts.maxMana      ?? 100;
    this.maxStamina   = opts.maxStamina   ?? 100;
    this.strength     = opts.strength     ?? 10;
    this.intelligence = opts.intelligence ?? 10;
    this.agility      = opts.agility      ?? 10;
    this.endurance    = opts.endurance    ?? 10;
    this.vitality     = opts.vitality     ?? 10;
    this.spirit       = opts.spirit       ?? 10;
    this.resistances  = opts.resistances  ?? {};

    this.health  = this.maxHealth;
    this.mana    = this.maxMana;
    this.stamina = this.maxStamina;
  }

  // ── Event system ───────────────────────────────────────────────────────────

  on(event: StatsEvent, cb: StatsCallback): this {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event)!.push(cb);
    return this;
  }

  off(event: StatsEvent, cb: StatsCallback): this {
    const list = this._listeners.get(event);
    if (list) this._listeners.set(event, list.filter(f => f !== cb));
    return this;
  }

  private _emit(event: StatsEvent, extra?: Record<string, unknown>): void {
    this._listeners.get(event)?.forEach(cb => cb(this, extra));
  }

  // ── Core stat mutations ────────────────────────────────────────────────────

  takeDamage(raw: number, type: DamageType = 'physical'): number {
    if (!this.alive) return 0;
    const resist  = this.resistances[type] ?? 0;
    const actual  = type === 'true' ? raw : Math.max(0, raw * (1 - resist));
    this.health   = Math.max(0, this.health - actual);
    this._emit('damage', { amount: actual, type });
    if (this.health === 0) this._die();
    return actual;
  }

  heal(amount: number): number {
    if (!this.alive) return 0;
    const actual = Math.min(amount, this.maxHealth - this.health);
    this.health += actual;
    this._emit('heal', { amount: actual });
    return actual;
  }

  useMana(amount: number): boolean {
    if (this.mana < amount) return false;
    this.mana = Math.max(0, this.mana - amount);
    this._emit('manaChange', { mana: this.mana });
    return true;
  }

  useStamina(amount: number): boolean {
    if (this.stamina < amount) return false;
    this.stamina = Math.max(0, this.stamina - amount);
    this._emit('staminaChange', { stamina: this.stamina });
    return true;
  }

  gainXp(amount: number): void {
    if (!this.alive) return;
    this.xp += amount;
    const needed = XP_PER_LEVEL(this.level);
    if (this.xp >= needed) {
      this.xp -= needed;
      this.level++;
      // Stat scaling on level up
      this.maxHealth  = Math.floor(this.maxHealth  * 1.1);
      this.maxMana    = Math.floor(this.maxMana    * 1.05);
      this.maxStamina = Math.floor(this.maxStamina * 1.05);
      this.health  = this.maxHealth;
      this.mana    = this.maxMana;
      this.stamina = this.maxStamina;
      this._emit('levelUp', { level: this.level });
    }
  }

  revive(healthFraction = 1): void {
    this.alive   = true;
    this.health  = Math.floor(this.maxHealth * healthFraction);
    this.mana    = this.maxMana;
    this.stamina = this.maxStamina;
    this._emit('revive');
  }

  private _die(): void {
    this.alive = false;
    this._emit('death');
  }

  // ── Regen tick (call from character update loop) ───────────────────────────

  tick(dt: number): void {
    if (!this.alive) return;

    this._manaAcc += dt;
    if (this._manaAcc >= 1 / this.manaRegenRate) {
      this._manaAcc = 0;
      if (this.mana < this.maxMana) {
        this.mana = Math.min(this.maxMana, this.mana + 1 + this.spirit * 0.1);
      }
    }

    this._staminaAcc += dt;
    if (this._staminaAcc >= 1 / this.staminaRegenRate) {
      this._staminaAcc = 0;
      if (this.stamina < this.maxStamina) {
        this.stamina = Math.min(this.maxStamina, this.stamina + 1 + this.endurance * 0.1);
      }
    }
  }

  // ── Snapshot (for Grudge backend sync) ────────────────────────────────────

  toJSON(): object {
    return {
      health: this.health, maxHealth: this.maxHealth,
      mana: this.mana,     maxMana: this.maxMana,
      stamina: this.stamina, maxStamina: this.maxStamina,
      level: this.level,   xp: this.xp,
      strength: this.strength, intelligence: this.intelligence,
      agility: this.agility, endurance: this.endurance,
      vitality: this.vitality, spirit: this.spirit,
      resistances: this.resistances,
    };
  }

  fromJSON(data: ReturnType<CharacterStats['toJSON']> & Record<string, any>): void {
    Object.assign(this, data);
    this.alive = this.health > 0;
  }

  // ── Convenience getters ───────────────────────────────────────────────────

  get healthPct()  { return this.health  / this.maxHealth; }
  get manaPct()    { return this.mana    / this.maxMana; }
  get staminaPct() { return this.stamina / this.maxStamina; }
  get xpNeeded()   { return XP_PER_LEVEL(this.level); }
  get xpPct()      { return this.xp / this.xpNeeded; }
}
