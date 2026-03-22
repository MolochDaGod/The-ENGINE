// Enemy component for identifying enemy entities
import { Component } from '../Entity';

export enum EnemyType {
  DUMMY = 'dummy',
  GRUNT = 'grunt',
  ELITE = 'elite',
  BOSS = 'boss'
}

export class Enemy extends Component {
  public static readonly componentType = 'Enemy'; // Explicit type identifier
  public readonly componentType = 'Enemy'; // Instance identifier
  public type: EnemyType;
  public level: number;
  public experienceReward: number;
  public isAggressive: boolean;
  public aggroRange: number;
  public attackRange: number;
  public attackDamage: number;
  public attackCooldown: number;
  public lastAttackTime: number;
  public movementSpeed: number;
  public isDead: boolean;
  public deathTime: number;
  public respawnTime: number;
  public canRespawn: boolean;
  
  // Freeze status effect
  public isFrozen: boolean;
  public freezeStartTime: number;
  public freezeDuration: number;
  public originalMovementSpeed: number;
  
  // Venom debuff effect
  public isVenomous: boolean;
  public venomStartTime: number;
  public venomDuration: number;
  public venomDamagePerSecond: number;
  public lastVenomDamageTime: number;
  
  // Sunder stacks effect
  public sunderStacks: number;
  public sunderLastApplied: number;
  public sunderDuration: number;
  
  // Burning stacks effect (Entropic Bolt / Crossentropy Bolt)
  public burningStacks: number;
  public burningLastApplied: number;
  public burningDuration: number;
  
  // Corrupted debuff effect (WraithStrike)
  public isCorrupted: boolean;
  public corruptedStartTime: number;
  public corruptedDuration: number;
  public corruptedInitialSlowPercent: number; // Initial slow percentage (90%)
  public corruptedRecoveryRate: number; // Recovery rate per second (10%)

  constructor(
    type: EnemyType = EnemyType.DUMMY,
    level: number = 1
  ) {
    super();
    
    this.type = type;
    this.level = level;
    this.experienceReward = this.calculateExperienceReward();
    this.isAggressive = type !== EnemyType.DUMMY;
    this.aggroRange = this.calculateAggroRange();
    this.attackRange = this.calculateAttackRange();
    this.attackDamage = this.calculateAttackDamage();
    this.attackCooldown = this.calculateAttackCooldown();
    this.lastAttackTime = 0;
    this.movementSpeed = this.calculateMovementSpeed();
    this.isDead = false;
    this.deathTime = 0;
    this.respawnTime = 30; // 30 seconds default respawn time
    this.canRespawn = true;
    
    // Initialize freeze status
    this.isFrozen = false;
    this.freezeStartTime = 0;
    this.freezeDuration = 0;
    this.originalMovementSpeed = this.movementSpeed;
    
    // Initialize venom status
    this.isVenomous = false;
    this.venomStartTime = 0;
    this.venomDuration = 0;
    this.venomDamagePerSecond = 0;
    this.lastVenomDamageTime = 0;
    
    // Initialize sunder stacks
    this.sunderStacks = 0;
    this.sunderLastApplied = 0;
    this.sunderDuration = 10.0; // 10 seconds
    
    // Initialize burning stacks
    this.burningStacks = 0;
    this.burningLastApplied = 0;
    this.burningDuration = 5.0; // 5 seconds
    
    // Initialize corrupted debuff
    this.isCorrupted = false;
    this.corruptedStartTime = 0;
    this.corruptedDuration = 8.0; // 8 seconds
    this.corruptedInitialSlowPercent = 0.9; // 90% slow initially
    this.corruptedRecoveryRate = 0.1; // 10% recovery per second
  }

  private calculateExperienceReward(): number {
    const baseExp = {
      [EnemyType.DUMMY]: 5,
      [EnemyType.GRUNT]: 10,
      [EnemyType.ELITE]: 25,
      [EnemyType.BOSS]: 100
    };
    return baseExp[this.type] * this.level;
  }

  private calculateAggroRange(): number {
    const baseRange = {
      [EnemyType.DUMMY]: 0, // Dummy enemies don't aggro
      [EnemyType.GRUNT]: 5,
      [EnemyType.ELITE]: 8,
      [EnemyType.BOSS]: 12
    };
    return baseRange[this.type];
  }

  private calculateAttackRange(): number {
    const baseRange = {
      [EnemyType.DUMMY]: 0, // Dummy enemies don't attack
      [EnemyType.GRUNT]: 1.5,
      [EnemyType.ELITE]: 2,
      [EnemyType.BOSS]: 3
    };
    return baseRange[this.type];
  }

  private calculateAttackDamage(): number {
    const baseDamage = {
      [EnemyType.DUMMY]: 0, // Dummy enemies don't deal damage
      [EnemyType.GRUNT]: 15,
      [EnemyType.ELITE]: 25,
      [EnemyType.BOSS]: 50
    };
    return baseDamage[this.type] * this.level;
  }

  private calculateAttackCooldown(): number {
    const baseCooldown = {
      [EnemyType.DUMMY]: 0, // Dummy enemies don't attack
      [EnemyType.GRUNT]: 2,
      [EnemyType.ELITE]: 1.5,
      [EnemyType.BOSS]: 1
    };
    return baseCooldown[this.type];
  }

  private calculateMovementSpeed(): number {
    const baseSpeed = {
      [EnemyType.DUMMY]: 0, // Dummy enemies don't move
      [EnemyType.GRUNT]: 3,
      [EnemyType.ELITE]: 0, // Elite enemies are stationary like training dummies
      [EnemyType.BOSS]: 2.5
    };
    return baseSpeed[this.type];
  }

  public canAttack(currentTime: number): boolean {
    if (!this.isAggressive || this.isDead || this.attackDamage === 0) {
      return false;
    }
    return (currentTime - this.lastAttackTime) >= this.attackCooldown;
  }

  public performAttack(currentTime: number): void {
    this.lastAttackTime = currentTime;
  }

  public takeDamage(): void {
    // This will be handled by the Health component
    // This method is for enemy-specific damage reactions
  }

  public die(currentTime: number): void {
    this.isDead = true;
    this.deathTime = currentTime;
  }

  public canRespawnNow(currentTime: number): boolean {
    if (!this.canRespawn || !this.isDead) {
      return false;
    }
    return (currentTime - this.deathTime) >= this.respawnTime;
  }

  public respawn(): void {
    this.isDead = false;
    this.deathTime = 0;
    this.lastAttackTime = 0;
    // Clear freeze status on respawn
    this.unfreeze();
    // Clear venom status on respawn
    this.removeVenom();
    // Clear corrupted status on respawn
    this.removeCorrupted();
  }
  
  public freeze(duration: number, currentTime: number): void {
    if (this.isDead) return; // Can't freeze dead enemies
    
    this.isFrozen = true;
    this.freezeStartTime = currentTime;
    this.freezeDuration = duration;
    // Set movement speed to 0 when frozen
    this.movementSpeed = 0;
  }
  
  public unfreeze(): void {
    this.isFrozen = false;
    this.freezeStartTime = 0;
    this.freezeDuration = 0;
    // Restore original movement speed
    this.movementSpeed = this.originalMovementSpeed;
  }
  
  public updateFreezeStatus(currentTime: number): void {
    if (!this.isFrozen) return;
    
    const elapsed = currentTime - this.freezeStartTime;
    if (elapsed >= this.freezeDuration) {
      this.unfreeze();
    }
  }
  
  public canMove(): boolean {
    return !this.isFrozen && !this.isDead;
  }
  
  public getEffectiveMovementSpeed(): number {
    if (this.isDead || this.isFrozen) {
      return 0;
    }
    
    let speed = this.movementSpeed;
    
    // Apply corrupted debuff slow effect
    if (this.isCorrupted) {
      const slowMultiplier = this.getCorruptedSlowMultiplier();
      speed *= (1 - slowMultiplier);
    }
    
    return speed;
  }
  
  private getCorruptedSlowMultiplier(): number {
    if (!this.isCorrupted) return 0;
    
    const currentTime = Date.now() / 1000;
    const elapsed = currentTime - this.corruptedStartTime;
    
    // Calculate current slow percentage based on gradual recovery
    // Initial: 90% slow, recovers 10% per second
    const currentSlowPercent = Math.max(0, this.corruptedInitialSlowPercent - (elapsed * this.corruptedRecoveryRate));
    
    return currentSlowPercent;
  }
  
  public applyVenom(duration: number, damagePerSecond: number, currentTime: number): void {
    if (this.isDead) return; // Can't apply venom to dead enemies
    
    this.isVenomous = true;
    this.venomStartTime = currentTime;
    this.venomDuration = duration;
    this.venomDamagePerSecond = damagePerSecond;
    this.lastVenomDamageTime = currentTime;
  }
  
  public removeVenom(): void {
    this.isVenomous = false;
    this.venomStartTime = 0;
    this.venomDuration = 0;
    this.venomDamagePerSecond = 0;
    this.lastVenomDamageTime = 0;
  }
  
  public updateVenomStatus(currentTime: number): { shouldDealDamage: boolean; damage: number } {
    if (!this.isVenomous) return { shouldDealDamage: false, damage: 0 };
    
    const elapsed = currentTime - this.venomStartTime;
    if (elapsed >= this.venomDuration) {
      this.removeVenom();
      return { shouldDealDamage: false, damage: 0 };
    }
    
    // Check if we should deal damage (every second)
    const timeSinceLastDamage = currentTime - this.lastVenomDamageTime;
    if (timeSinceLastDamage >= 1.0) {
      this.lastVenomDamageTime = currentTime;
      return { shouldDealDamage: true, damage: this.venomDamagePerSecond };
    }
    
    return { shouldDealDamage: false, damage: 0 };
  }
  
  public applySunderStack(currentTime: number): void {
    if (this.isDead) return; // Can't apply sunder to dead enemies
    
    // Check if existing stacks have expired
    if (this.sunderStacks > 0 && (currentTime - this.sunderLastApplied) > this.sunderDuration) {
      this.sunderStacks = 0;
    }
    
    // Add new stack (max 3)
    if (this.sunderStacks < 3) {
      this.sunderStacks++;
    }
    
    // Update timing
    this.sunderLastApplied = currentTime;
  }
  
  public getSunderStacks(): number {
    return this.sunderStacks;
  }
  
  public clearSunderStacks(): void {
    this.sunderStacks = 0;
    this.sunderLastApplied = 0;
  }
  
  public updateSunderStatus(currentTime: number): void {
    if (this.sunderStacks <= 0) return;
    
    const elapsed = currentTime - this.sunderLastApplied;
    if (elapsed >= this.sunderDuration) {
      this.clearSunderStacks();
    }
  }

  public setLevel(newLevel: number): void {
    this.level = Math.max(1, newLevel);
    this.experienceReward = this.calculateExperienceReward();
    this.attackDamage = this.calculateAttackDamage();
  }

  public getDisplayName(): string {
    const typeNames = {
      [EnemyType.DUMMY]: 'Training Dummy',
      [EnemyType.GRUNT]: 'Grunt',
      [EnemyType.ELITE]: 'Elite',
      [EnemyType.BOSS]: 'Boss'
    };
    return `${typeNames[this.type]} (Lv.${this.level})`;
  }

  public reset(): void {
    this.type = EnemyType.DUMMY;
    this.level = 1;
    this.experienceReward = this.calculateExperienceReward();
    this.isAggressive = false;
    this.aggroRange = this.calculateAggroRange();
    this.attackRange = this.calculateAttackRange();
    this.attackDamage = this.calculateAttackDamage();
    this.attackCooldown = this.calculateAttackCooldown();
    this.lastAttackTime = 0;
    this.movementSpeed = this.calculateMovementSpeed();
    this.isDead = false;
    this.deathTime = 0;
    this.respawnTime = 30;
    this.canRespawn = true;
    this.enabled = true;
    
    // Reset freeze status
    this.isFrozen = false;
    this.freezeStartTime = 0;
    this.freezeDuration = 0;
    this.originalMovementSpeed = this.movementSpeed;
    
    // Reset venom status
    this.isVenomous = false;
    this.venomStartTime = 0;
    this.venomDuration = 0;
    this.venomDamagePerSecond = 0;
    this.lastVenomDamageTime = 0;
    
    // Reset sunder stacks
    this.sunderStacks = 0;
    this.sunderLastApplied = 0;
  }

  public clone(): Enemy {
    const clone = new Enemy(this.type, this.level);
    clone.experienceReward = this.experienceReward;
    clone.isAggressive = this.isAggressive;
    clone.aggroRange = this.aggroRange;
    clone.attackRange = this.attackRange;
    clone.attackDamage = this.attackDamage;
    clone.attackCooldown = this.attackCooldown;
    clone.lastAttackTime = this.lastAttackTime;
    clone.movementSpeed = this.movementSpeed;
    clone.isDead = this.isDead;
    clone.deathTime = this.deathTime;
    clone.respawnTime = this.respawnTime;
    clone.canRespawn = this.canRespawn;
    
    // Clone freeze status
    clone.isFrozen = this.isFrozen;
    clone.freezeStartTime = this.freezeStartTime;
    clone.freezeDuration = this.freezeDuration;
    clone.originalMovementSpeed = this.originalMovementSpeed;
    
    // Clone venom status
    clone.isVenomous = this.isVenomous;
    clone.venomStartTime = this.venomStartTime;
    clone.venomDuration = this.venomDuration;
    clone.venomDamagePerSecond = this.venomDamagePerSecond;
    clone.lastVenomDamageTime = this.lastVenomDamageTime;
    
    // Clone sunder stacks
    clone.sunderStacks = this.sunderStacks;
    clone.sunderLastApplied = this.sunderLastApplied;
    
    // Clone corrupted status
    clone.isCorrupted = this.isCorrupted;
    clone.corruptedStartTime = this.corruptedStartTime;
    clone.corruptedDuration = this.corruptedDuration;
    clone.corruptedInitialSlowPercent = this.corruptedInitialSlowPercent;
    clone.corruptedRecoveryRate = this.corruptedRecoveryRate;
    
    return clone;
  }
  
  public applyCorrupted(duration: number, currentTime: number): void {
    if (this.isDead) return; // Can't apply corrupted to dead enemies
    
    this.isCorrupted = true;
    this.corruptedStartTime = currentTime;
    this.corruptedDuration = duration;
  }
  
  public removeCorrupted(): void {
    this.isCorrupted = false;
    this.corruptedStartTime = 0;
    this.corruptedDuration = 0;
  }
  
  public updateCorruptedStatus(currentTime: number): void {
    if (!this.isCorrupted) return;
    
    const elapsed = currentTime - this.corruptedStartTime;
    if (elapsed >= this.corruptedDuration) {
      this.removeCorrupted();
    }
  }
  
  public getCorruptedTimeRemaining(currentTime: number): number {
    if (!this.isCorrupted) return 0;
    
    const elapsed = currentTime - this.corruptedStartTime;
    return Math.max(0, this.corruptedDuration - elapsed);
  }
}
