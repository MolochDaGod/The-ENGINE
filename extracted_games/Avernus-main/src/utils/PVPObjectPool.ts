// PVP Object Pool for performance optimization in multiplayer scenarios
import { Vector3, Quaternion } from '@/utils/three-exports';
import { ObjectPool } from '@/utils/ObjectPool';

/**
 * Centralized object pooling system for PVP components
 * Reduces garbage collection pressure by reusing frequently created objects
 */
export class PVPObjectPool {
  private static instance: PVPObjectPool;
  
  // Object pools for different types
  private vector3Pool: ObjectPool<Vector3>;
  private quaternionPool: ObjectPool<Quaternion>;
  private hitKeyPool: ObjectPool<string>;
  private effectDataPool: ObjectPool<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
    debuffType: 'frozen' | 'slowed' | undefined;
  }>;
  
  // Temporary objects for calculations (reused within single frame)
  private tempVector3s: Vector3[] = [];
  private tempQuaternions: Quaternion[] = [];
  private tempVectorIndex = 0;
  private tempQuaternionIndex = 0;
  
  private constructor() {
    // Initialize Vector3 pool
    this.vector3Pool = new ObjectPool(
      () => new Vector3(),
      (vector) => vector.set(0, 0, 0),
      50 // Pool size for PVP scenarios
    );
    
    // Initialize Quaternion pool
    this.quaternionPool = new ObjectPool(
      () => new Quaternion(),
      (quaternion) => quaternion.set(0, 0, 0, 1),
      20
    );
    
    // Initialize hit key pool (for collision tracking)
    this.hitKeyPool = new ObjectPool(
      () => '',
      (key) => '', // Strings are immutable, reset happens on acquire
      100
    );
    
    // Initialize effect data pool
    this.effectDataPool = new ObjectPool(
      () => ({
        id: 0,
        playerId: '',
        position: new Vector3(),
        startTime: 0,
        duration: 0,
        debuffType: undefined as 'frozen' | 'slowed' | undefined
      }),
      (effectData) => {
        effectData.id = 0;
        effectData.playerId = '';
        effectData.position.set(0, 0, 0);
        effectData.startTime = 0;
        effectData.duration = 0;
        effectData.debuffType = undefined;
      },
      30
    );
    
    // Pre-allocate temporary objects for frame calculations
    for (let i = 0; i < 10; i++) {
      this.tempVector3s.push(new Vector3());
      this.tempQuaternions.push(new Quaternion());
    }
  }
  
  public static getInstance(): PVPObjectPool {
    if (!PVPObjectPool.instance) {
      PVPObjectPool.instance = new PVPObjectPool();
    }
    return PVPObjectPool.instance;
  }
  
  /**
   * Get a Vector3 from the pool
   * Remember to call releaseVector3 when done
   */
  public acquireVector3(x = 0, y = 0, z = 0): Vector3 {
    const vector = this.vector3Pool.acquire();
    vector.set(x, y, z);
    return vector;
  }
  
  /**
   * Return a Vector3 to the pool
   */
  public releaseVector3(vector: Vector3): void {
    this.vector3Pool.release(vector);
  }
  
  /**
   * Get a temporary Vector3 for single-frame calculations
   * These are automatically reset each frame, don't need to release
   */
  public getTempVector3(x = 0, y = 0, z = 0): Vector3 {
    const index = this.tempVectorIndex % this.tempVector3s.length;
    this.tempVectorIndex++;
    const vector = this.tempVector3s[index];
    vector.set(x, y, z);
    return vector;
  }
  
  /**
   * Get a Quaternion from the pool
   */
  public acquireQuaternion(x = 0, y = 0, z = 0, w = 1): Quaternion {
    const quaternion = this.quaternionPool.acquire();
    quaternion.set(x, y, z, w);
    return quaternion;
  }
  
  /**
   * Return a Quaternion to the pool
   */
  public releaseQuaternion(quaternion: Quaternion): void {
    this.quaternionPool.release(quaternion);
  }
  
  /**
   * Get a temporary Quaternion for single-frame calculations
   */
  public getTempQuaternion(x = 0, y = 0, z = 0, w = 1): Quaternion {
    const index = this.tempQuaternionIndex % this.tempQuaternions.length;
    this.tempQuaternionIndex++;
    const quaternion = this.tempQuaternions[index];
    quaternion.set(x, y, z, w);
    return quaternion;
  }
  
  /**
   * Create a hit key for collision tracking
   */
  public createHitKey(entityId: number | string, playerId: string): string {
    return `${entityId}-${playerId}`;
  }
  
  /**
   * Get an effect data object from the pool
   */
  public acquireEffectData(): {
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
    debuffType: 'frozen' | 'slowed' | undefined;
  } {
    return this.effectDataPool.acquire();
  }
  
  /**
   * Return an effect data object to the pool
   */
  public releaseEffectData(effectData: {
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
    debuffType: 'frozen' | 'slowed' | undefined;
  }): void {
    this.effectDataPool.release(effectData);
  }
  
  /**
   * Reset temporary object indices (call once per frame)
   */
  public resetFrameTemporaries(): void {
    this.tempVectorIndex = 0;
    this.tempQuaternionIndex = 0;
  }
  
  /**
   * Get pool statistics for debugging
   */
  public getStats() {
    return {
      vector3Pool: this.vector3Pool.getPoolSize(),
      quaternionPool: this.quaternionPool.getPoolSize(),
      hitKeyPool: this.hitKeyPool.getPoolSize(),
      effectDataPool: this.effectDataPool.getPoolSize(),
      tempVector3sUsed: this.tempVectorIndex,
      tempQuaternionsUsed: this.tempQuaternionIndex
    };
  }
  
  /**
   * Clear all pools (useful for cleanup)
   */
  public clearAll(): void {
    this.vector3Pool.clear();
    this.quaternionPool.clear();
    this.hitKeyPool.clear();
    this.effectDataPool.clear();
    this.resetFrameTemporaries();
  }
}

// Export singleton instance for easy access
export const pvpObjectPool = PVPObjectPool.getInstance();
