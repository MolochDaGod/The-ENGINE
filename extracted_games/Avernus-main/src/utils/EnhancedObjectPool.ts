// Enhanced Object Pool for performance optimization
// Extends the basic ObjectPool with specialized pools for game objects
import { Vector3, Quaternion, Color, Matrix4, Euler } from '@/utils/three-exports';
import { ObjectPool } from '@/utils/ObjectPool';

// Re-export Three.js classes for convenience
export { Vector3, Quaternion, Color, Matrix4, Euler };

export interface ParticleData {
  position: Vector3;
  velocity: Vector3;
  life: number;
  maxLife: number;
  scale: number;
  color: Color;
  id: number;
}

export interface ProjectileData {
  id: number;
  position: Vector3;
  direction: Vector3;
  speed: number;
  damage: number;
  lifetime: number;
  maxLifetime: number;
  entityId: number;
}

export interface DamageNumberData {
  id: string;
  damage: number;
  isCritical: boolean;
  position: Vector3;
  timestamp: number;
  damageType?: string;
}

export interface EffectData {
  id: number;
  type: string;
  position: Vector3;
  direction: Vector3;
  duration: number;
  startTime: number;
  scale?: number;
  color?: Color;
}

/**
 * Enhanced Object Pool System
 * Provides specialized pools for different types of game objects
 */
export class EnhancedObjectPool {
  private static instance: EnhancedObjectPool;

  // Core object pools
  private vector3Pool: ObjectPool<Vector3>;
  private quaternionPool: ObjectPool<Quaternion>;
  private colorPool: ObjectPool<Color>;
  private matrix4Pool: ObjectPool<Matrix4>;
  private eulerPool: ObjectPool<Euler>;

  // Game object pools
  private particlePool: ObjectPool<ParticleData>;
  private projectilePool: ObjectPool<ProjectileData>;
  private damageNumberPool: ObjectPool<DamageNumberData>;
  private effectPool: ObjectPool<EffectData>;

  // Temporary objects for calculations (reused within single frame)
  private tempVector3s: Vector3[] = [];
  private tempQuaternions: Quaternion[] = [];
  private tempMatrices: Matrix4[] = [];
  private tempVectorIndex = 0;
  private tempQuaternionIndex = 0;
  private tempMatrixIndex = 0;

  private constructor() {
    // Initialize core object pools
    this.vector3Pool = new ObjectPool(
      () => new Vector3(),
      (vector) => vector.set(0, 0, 0),
      200 // Increased pool size for game usage
    );

    this.quaternionPool = new ObjectPool(
      () => new Quaternion(),
      (quaternion) => quaternion.set(0, 0, 0, 1),
      100
    );

    this.colorPool = new ObjectPool(
      () => new Color(),
      (color) => color.setRGB(1, 1, 1),
      50
    );

    this.matrix4Pool = new ObjectPool(
      () => new Matrix4(),
      (matrix) => matrix.identity(),
      50
    );

    this.eulerPool = new ObjectPool(
      () => new Euler(),
      (euler) => euler.set(0, 0, 0),
      50
    );

    // Initialize game object pools
    this.particlePool = new ObjectPool(
      () => ({
        position: new Vector3(),
        velocity: new Vector3(),
        life: 0,
        maxLife: 1,
        scale: 1,
        color: new Color(),
        id: 0
      }),
      (particle) => {
        particle.position.set(0, 0, 0);
        particle.velocity.set(0, 0, 0);
        particle.life = 0;
        particle.maxLife = 1;
        particle.scale = 1;
        particle.color.setRGB(1, 1, 1);
        particle.id = 0;
      },
      500 // Large pool for particles
    );

    this.projectilePool = new ObjectPool(
      () => ({
        id: 0,
        position: new Vector3(),
        direction: new Vector3(),
        speed: 0,
        damage: 0,
        lifetime: 0,
        maxLifetime: 1,
        entityId: 0
      }),
      (projectile) => {
        projectile.id = 0;
        projectile.position.set(0, 0, 0);
        projectile.direction.set(0, 0, 0);
        projectile.speed = 0;
        projectile.damage = 0;
        projectile.lifetime = 0;
        projectile.maxLifetime = 1;
        projectile.entityId = 0;
      },
      100
    );

    this.damageNumberPool = new ObjectPool<DamageNumberData>(
      (): DamageNumberData => ({
        id: '',
        damage: 0,
        isCritical: false,
        position: new Vector3(),
        timestamp: 0,
        damageType: undefined
      }),
      (damageNumber: DamageNumberData) => {
        damageNumber.id = '';
        damageNumber.damage = 0;
        damageNumber.isCritical = false;
        damageNumber.position.set(0, 0, 0);
        damageNumber.timestamp = 0;
        damageNumber.damageType = undefined;
      },
      50
    );

    this.effectPool = new ObjectPool<EffectData>(
      (): EffectData => ({
        id: 0,
        type: '',
        position: new Vector3(),
        direction: new Vector3(),
        duration: 0,
        startTime: 0,
        scale: 1,
        color: new Color()
      }),
      (effect: EffectData) => {
        effect.id = 0;
        effect.type = '';
        effect.position.set(0, 0, 0);
        effect.direction.set(0, 0, 0);
        effect.duration = 0;
        effect.startTime = 0;
        effect.scale = 1;
        if (effect.color) {
          effect.color.setRGB(1, 1, 1);
        }
      },
      100
    );

    // Pre-allocate temporary objects
    for (let i = 0; i < 20; i++) {
      this.tempVector3s.push(new Vector3());
      this.tempQuaternions.push(new Quaternion());
      this.tempMatrices.push(new Matrix4());
    }
  }

  public static getInstance(): EnhancedObjectPool {
    if (!EnhancedObjectPool.instance) {
      EnhancedObjectPool.instance = new EnhancedObjectPool();
    }
    return EnhancedObjectPool.instance;
  }

  // Core object pool methods
  public acquireVector3(x = 0, y = 0, z = 0): Vector3 {
    const vector = this.vector3Pool.acquire();
    vector.set(x, y, z);
    return vector;
  }

  public releaseVector3(vector: Vector3): void {
    this.vector3Pool.release(vector);
  }

  public acquireQuaternion(x = 0, y = 0, z = 0, w = 1): Quaternion {
    const quaternion = this.quaternionPool.acquire();
    quaternion.set(x, y, z, w);
    return quaternion;
  }

  public releaseQuaternion(quaternion: Quaternion): void {
    this.quaternionPool.release(quaternion);
  }

  public acquireColor(r = 1, g = 1, b = 1): Color {
    const color = this.colorPool.acquire();
    color.setRGB(r, g, b);
    return color;
  }

  public releaseColor(color: Color): void {
    this.colorPool.release(color);
  }

  public acquireMatrix4(): Matrix4 {
    return this.matrix4Pool.acquire();
  }

  public releaseMatrix4(matrix: Matrix4): void {
    this.matrix4Pool.release(matrix);
  }

  public acquireEuler(x = 0, y = 0, z = 0): Euler {
    const euler = this.eulerPool.acquire();
    euler.set(x, y, z);
    return euler;
  }

  public releaseEuler(euler: Euler): void {
    this.eulerPool.release(euler);
  }

  // Game object pool methods
  public acquireParticle(
    position: Vector3,
    velocity: Vector3,
    life: number,
    scale = 1,
    color?: Color
  ): ParticleData {
    const particle = this.particlePool.acquire();
    particle.position.copy(position);
    particle.velocity.copy(velocity);
    particle.life = life;
    particle.maxLife = life;
    particle.scale = scale;
    particle.color = color ? color.clone() : new Color(1, 1, 1);
    particle.id = Math.random();
    return particle;
  }

  public releaseParticle(particle: ParticleData): void {
    this.particlePool.release(particle);
  }

  public acquireProjectile(
    position: Vector3,
    direction: Vector3,
    speed: number,
    damage: number,
    lifetime: number,
    entityId: number
  ): ProjectileData {
    const projectile = this.projectilePool.acquire();
    projectile.position.copy(position);
    projectile.direction.copy(direction);
    projectile.speed = speed;
    projectile.damage = damage;
    projectile.lifetime = 0;
    projectile.maxLifetime = lifetime;
    projectile.entityId = entityId;
    projectile.id = Math.random();
    return projectile;
  }

  public releaseProjectile(projectile: ProjectileData): void {
    this.projectilePool.release(projectile);
  }

  public acquireDamageNumber(
    damage: number,
    isCritical: boolean,
    position: Vector3,
    damageType?: string
  ): DamageNumberData {
    const damageNumber = this.damageNumberPool.acquire();
    damageNumber.id = Math.random().toString(36).substr(2, 9);
    damageNumber.damage = damage;
    damageNumber.isCritical = isCritical;
    damageNumber.position.copy(position);
    damageNumber.timestamp = Date.now();
    damageNumber.damageType = damageType;
    return damageNumber;
  }

  public releaseDamageNumber(damageNumber: DamageNumberData): void {
    this.damageNumberPool.release(damageNumber);
  }

  public acquireEffect(
    type: string,
    position: Vector3,
    direction: Vector3,
    duration: number,
    scale = 1,
    color?: Color
  ): EffectData {
    const effect = this.effectPool.acquire();
    effect.id = Math.random();
    effect.type = type;
    effect.position.copy(position);
    effect.direction.copy(direction);
    effect.duration = duration;
    effect.startTime = Date.now();
    effect.scale = scale;
    effect.color = color ? color.clone() : new Color(1, 1, 1);
    return effect;
  }

  public releaseEffect(effect: EffectData): void {
    this.effectPool.release(effect);
  }

  // Temporary object methods (for single-frame calculations)
  public getTempVector3(x = 0, y = 0, z = 0): Vector3 {
    const index = this.tempVectorIndex % this.tempVector3s.length;
    this.tempVectorIndex++;
    const vector = this.tempVector3s[index];
    vector.set(x, y, z);
    return vector;
  }

  public getTempQuaternion(x = 0, y = 0, z = 0, w = 1): Quaternion {
    const index = this.tempQuaternionIndex % this.tempQuaternions.length;
    this.tempQuaternionIndex++;
    const quaternion = this.tempQuaternions[index];
    quaternion.set(x, y, z, w);
    return quaternion;
  }

  public getTempMatrix(): Matrix4 {
    const index = this.tempMatrixIndex % this.tempMatrices.length;
    this.tempMatrixIndex++;
    return this.tempMatrices[index].identity();
  }

  // Reset temporary objects (call once per frame)
  public resetFrameTemporaries(): void {
    this.tempVectorIndex = 0;
    this.tempQuaternionIndex = 0;
    this.tempMatrixIndex = 0;
  }

  // Pool statistics for debugging
  public getStats() {
    return {
      vector3Pool: this.vector3Pool.getPoolSize(),
      quaternionPool: this.quaternionPool.getPoolSize(),
      colorPool: this.colorPool.getPoolSize(),
      matrix4Pool: this.matrix4Pool.getPoolSize(),
      eulerPool: this.eulerPool.getPoolSize(),
      particlePool: this.particlePool.getPoolSize(),
      projectilePool: this.projectilePool.getPoolSize(),
      damageNumberPool: this.damageNumberPool.getPoolSize(),
      effectPool: this.effectPool.getPoolSize(),
      tempVector3sUsed: this.tempVectorIndex,
      tempQuaternionsUsed: this.tempQuaternionIndex,
      tempMatricesUsed: this.tempMatrixIndex
    };
  }

  // Clear all pools (useful for cleanup)
  public clearAll(): void {
    this.vector3Pool.clear();
    this.quaternionPool.clear();
    this.colorPool.clear();
    this.matrix4Pool.clear();
    this.eulerPool.clear();
    this.particlePool.clear();
    this.projectilePool.clear();
    this.damageNumberPool.clear();
    this.effectPool.clear();
    this.resetFrameTemporaries();
  }
}

// Export singleton instance
export const enhancedObjectPool = EnhancedObjectPool.getInstance();
