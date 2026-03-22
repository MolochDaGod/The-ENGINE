// Health component for damage and healing
import { Component } from '../Entity';
import { Shield } from './Shield';

export class Health extends Component {
  public static readonly componentType = 'Health'; // Explicit type identifier
  public readonly componentType = 'Health'; // Instance identifier
  public currentHealth: number;
  public maxHealth: number;
  public isInvulnerable: boolean;
  public invulnerabilityDuration: number;
  public invulnerabilityTimer: number;
  public isDead: boolean;
  public canRegenerate: boolean;
  public regenerationRate: number;
  public regenerationDelay: number;
  public lastDamageTime: number;

  constructor(maxHealth: number = 100) {
    super();
    
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth; // Always start with full health
    this.isInvulnerable = false;
    this.invulnerabilityDuration = 0.5; // 0.5 seconds of invulnerability after damage
    this.invulnerabilityTimer = 0;
    this.isDead = false;
    this.canRegenerate = false;
    this.regenerationRate = 5; // Health per second
    this.regenerationDelay = 3; // Seconds after damage before regeneration starts
    this.lastDamageTime = 0;
  }

  public takeDamage(amount: number, currentTime: number = Date.now() / 1000, entity?: any, bypassInvulnerability: boolean = false): boolean {
    if (this.isDead || (!bypassInvulnerability && this.isInvulnerable) || amount <= 0) {
      return false;
    }

    let finalDamage = amount;

    // Check if entity has a shield component and absorb damage through it first
    if (entity) {
      const shield = entity.getComponent(Shield);
      if (shield) {
        const shieldBefore = shield.currentShield;
        finalDamage = shield.absorbDamage(amount);
        const shieldAfter = shield.currentShield;
        const shieldDamage = shieldBefore - shieldAfter;
        
      }
    }

    // Apply remaining damage to health
    if (finalDamage > 0) {
      this.currentHealth = Math.max(0, this.currentHealth - finalDamage);
      this.lastDamageTime = currentTime;
      
      // Start invulnerability period
      this.isInvulnerable = true;
      this.invulnerabilityTimer = this.invulnerabilityDuration;

      // Check if dead
      if (this.currentHealth <= 0) {
        this.isDead = true;
      }
    }

    return true;
  }

  public heal(amount: number): boolean {
    if (this.isDead || amount <= 0) {
      return false;
    }

    const oldHealth = this.currentHealth;
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
    
    return this.currentHealth > oldHealth;
  }

  public setMaxHealth(newMaxHealth: number): void {
    const healthRatio = this.getHealthRatio();
    const oldMaxHealth = this.maxHealth;
    const oldCurrentHealth = this.currentHealth;
    this.maxHealth = Math.max(1, newMaxHealth);
    this.currentHealth = Math.floor(this.maxHealth * healthRatio);
  }

  public getHealthRatio(): number {
    return this.maxHealth > 0 ? this.currentHealth / this.maxHealth : 0;
  }

  public getHealthPercentage(): number {
    return this.getHealthRatio() * 100;
  }

  public isFullHealth(): boolean {
    return this.currentHealth >= this.maxHealth;
  }

  public isLowHealth(threshold: number = 0.25): boolean {
    return this.getHealthRatio() <= threshold;
  }

  public isCriticalHealth(threshold: number = 0.1): boolean {
    return this.getHealthRatio() <= threshold;
  }

  public revive(healthAmount?: number): void {
    this.isDead = false;
    this.currentHealth = healthAmount !== undefined ? 
      Math.min(this.maxHealth, healthAmount) : 
      this.maxHealth;
    this.isInvulnerable = false;
    this.invulnerabilityTimer = 0;
  }

  public update(deltaTime: number, currentTime: number = Date.now() / 1000): void {
    // Update invulnerability timer
    if (this.isInvulnerable) {
      this.invulnerabilityTimer -= deltaTime;
      if (this.invulnerabilityTimer <= 0) {
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
      }
    }

    // Handle regeneration
    if (this.canRegenerate && !this.isDead && !this.isFullHealth()) {
      const timeSinceLastDamage = currentTime - this.lastDamageTime;
      if (timeSinceLastDamage >= this.regenerationDelay) {
        this.heal(this.regenerationRate * deltaTime);
      }
    }
  }

  public setInvulnerable(duration: number): void {
    this.isInvulnerable = true;
    this.invulnerabilityTimer = duration;
  }

  public removeInvulnerability(): void {
    this.isInvulnerable = false;
    this.invulnerabilityTimer = 0;
  }

  public enableRegeneration(rate: number = 5, delay: number = 3): void {
    this.canRegenerate = true;
    this.regenerationRate = rate;
    this.regenerationDelay = delay;
  }

  public disableRegeneration(): void {
    this.canRegenerate = false;
  }

  public reset(): void {
    this.currentHealth = this.maxHealth;
    this.isInvulnerable = false;
    this.invulnerabilityTimer = 0;
    this.isDead = false;
    this.canRegenerate = false;
    this.regenerationRate = 5;
    this.regenerationDelay = 3;
    this.lastDamageTime = 0;
    this.enabled = true;
  }

  public clone(): Health {
    const clone = new Health(this.maxHealth);
    clone.currentHealth = this.currentHealth;
    clone.isInvulnerable = this.isInvulnerable;
    clone.invulnerabilityDuration = this.invulnerabilityDuration;
    clone.invulnerabilityTimer = this.invulnerabilityTimer;
    clone.isDead = this.isDead;
    clone.canRegenerate = this.canRegenerate;
    clone.regenerationRate = this.regenerationRate;
    clone.regenerationDelay = this.regenerationDelay;
    clone.lastDamageTime = this.lastDamageTime;
    return clone;
  }
}
