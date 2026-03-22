import { Component } from '../Entity';

export class Shield extends Component {
  public static readonly componentType = 'Shield'; // Explicit type identifier
  public readonly componentType = 'Shield'; // Instance identifier
  public maxShield: number;
  public currentShield: number;
  public regenRate: number; // Shield regenerated per second
  public regenDelay: number; // Seconds before regen starts
  public lastDamageTime: number; // Timestamp of last damage taken
  public isRegenerating: boolean;

  constructor(maxShield: number = 200, regenRate: number = 20, regenDelay: number = 5) {
    super();
    this.maxShield = maxShield;
    this.currentShield = maxShield;
    this.regenRate = regenRate;
    this.regenDelay = regenDelay;
    this.lastDamageTime = 0;
    this.isRegenerating = false;
  }

  /**
   * Absorb damage with the shield. Returns the amount of damage that passed through.
   */
  public absorbDamage(damage: number): number {
    if (this.currentShield <= 0) {
      return damage; // No shield left, all damage passes through
    }

    const damageAbsorbed = Math.min(damage, this.currentShield);
    this.currentShield -= damageAbsorbed;
    this.lastDamageTime = Date.now();
    this.isRegenerating = false;

    // Return the damage that wasn't absorbed
    return damage - damageAbsorbed;
  }

  /**
   * Update shield regeneration based on delta time
   */
  public update(deltaTime: number): void {
    if (this.currentShield >= this.maxShield) {
      this.isRegenerating = false;
      return;
    }

    const timeSinceLastDamage = (Date.now() - this.lastDamageTime) / 1000;
    
    if (timeSinceLastDamage >= this.regenDelay) {
      if (!this.isRegenerating) {
        this.isRegenerating = true;
      }
      
      const regenAmount = this.regenRate * deltaTime;
      this.currentShield = Math.min(this.maxShield, this.currentShield + regenAmount);
    }
  }

  /**
   * Get shield percentage (0-1)
   */
  public getShieldPercentage(): number {
    return this.maxShield > 0 ? this.currentShield / this.maxShield : 0;
  }

  /**
   * Check if shield is at full capacity
   */
  public isFullShield(): boolean {
    return this.currentShield >= this.maxShield;
  }

  /**
   * Check if shield is completely depleted
   */
  public isShieldDepleted(): boolean {
    return this.currentShield <= 0;
  }

  /**
   * Instantly restore shield to full (for testing or special abilities)
   */
  public restoreShield(): void {
    this.currentShield = this.maxShield;
    this.isRegenerating = false;
  }

  /**
   * Set shield values (useful for multiplayer sync)
   */
  public setShield(current: number, max: number): void {
    this.currentShield = Math.max(0, Math.min(max, current));
    this.maxShield = max;
  }

  /**
   * Reset shield to initial state (required by Component interface)
   */
  public reset(): void {
    this.currentShield = this.maxShield;
    this.lastDamageTime = 0;
    this.isRegenerating = false;
    this.enabled = true;
  }
}
