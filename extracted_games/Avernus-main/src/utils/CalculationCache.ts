// Calculation Cache for performance optimization
// Caches expensive calculations to avoid redundant computations

import { Vector3, Matrix4, Quaternion } from '@/utils/three-exports';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface WeaponPositionKey {
  weaponType: string;
  comboStep: number;
  isInCombo: boolean;
  comboTransitionProgress: number;
}

interface AnimationKey {
  animationType: string;
  progress: number;
  parameters: Record<string, any>;
}

/**
 * Calculation Cache System
 * Provides caching for expensive calculations with TTL-based invalidation
 */
export class CalculationCache {
  private static instance: CalculationCache;

  // Cache stores with different TTLs
  private weaponPositionCache = new Map<string, CacheEntry<Vector3>>();
  private animationCache = new Map<string, CacheEntry<any>>();
  private mathCache = new Map<string, CacheEntry<number>>();
  private vectorCache = new Map<string, CacheEntry<Vector3>>();
  private matrixCache = new Map<string, CacheEntry<Matrix4>>();

  // Default TTL values (in milliseconds)
  private readonly WEAPON_POSITION_TTL = 100; // Weapon positions change frequently
  private readonly ANIMATION_TTL = 50; // Animation calculations need to be fresh
  private readonly MATH_TTL = 1000; // Math calculations can be cached longer
  private readonly VECTOR_TTL = 100; // Vector calculations
  private readonly MATRIX_TTL = 200; // Matrix calculations

  private constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanup(), 1000);
  }

  public static getInstance(): CalculationCache {
    if (!CalculationCache.instance) {
      CalculationCache.instance = new CalculationCache();
    }
    return CalculationCache.instance;
  }

  /**
   * Cache weapon position calculations
   */
  public getWeaponPosition(
    weaponType: string,
    comboStep: number,
    isInCombo: boolean,
    comboTransitionProgress: number,
    calculator: () => Vector3
  ): Vector3 {
    const key = this.createWeaponPositionKey(weaponType, comboStep, isInCombo, comboTransitionProgress);
    const cached = this.weaponPositionCache.get(key);

    if (cached && this.isValid(cached)) {
      return cached.value.clone();
    }

    const result = calculator();
    this.weaponPositionCache.set(key, {
      value: result.clone(),
      timestamp: Date.now(),
      ttl: this.WEAPON_POSITION_TTL
    });

    return result;
  }

  /**
   * Cache animation calculations
   */
  public getAnimationCalculation(
    animationType: string,
    progress: number,
    parameters: Record<string, any>,
    calculator: () => any
  ): any {
    const key = this.createAnimationKey(animationType, progress, parameters);
    const cached = this.animationCache.get(key);

    if (cached && this.isValid(cached)) {
      return this.deepClone(cached.value);
    }

    const result = calculator();
    this.animationCache.set(key, {
      value: this.deepClone(result),
      timestamp: Date.now(),
      ttl: this.ANIMATION_TTL
    });

    return result;
  }

  /**
   * Cache expensive math calculations
   */
  public getMathCalculation(
    operation: string,
    params: number[],
    calculator: () => number
  ): number {
    const key = `${operation}_${params.join('_')}`;
    const cached = this.mathCache.get(key);

    if (cached && this.isValid(cached)) {
      return cached.value;
    }

    const result = calculator();
    this.mathCache.set(key, {
      value: result,
      timestamp: Date.now(),
      ttl: this.MATH_TTL
    });

    return result;
  }

  /**
   * Cache vector calculations
   */
  public getVectorCalculation(
    operation: string,
    vectors: Vector3[],
    calculator: () => Vector3
  ): Vector3 {
    const key = `${operation}_${vectors.map(v => `${v.x}_${v.y}_${v.z}`).join('_')}`;
    const cached = this.vectorCache.get(key);

    if (cached && this.isValid(cached)) {
      return cached.value.clone();
    }

    const result = calculator();
    this.vectorCache.set(key, {
      value: result.clone(),
      timestamp: Date.now(),
      ttl: this.VECTOR_TTL
    });

    return result;
  }

  /**
   * Cache matrix calculations
   */
  public getMatrixCalculation(
    operation: string,
    matrices: Matrix4[],
    calculator: () => Matrix4
  ): Matrix4 {
    const key = `${operation}_${matrices.map(m => m.elements.join('_')).join('|')}`;
    const cached = this.matrixCache.get(key);

    if (cached && this.isValid(cached)) {
      return cached.value.clone();
    }

    const result = calculator();
    this.matrixCache.set(key, {
      value: result.clone(),
      timestamp: Date.now(),
      ttl: this.MATRIX_TTL
    });

    return result;
  }

  /**
   * Cache trigonometric calculations (very common in animations)
   */
  public getTrigCalculation(
    func: 'sin' | 'cos' | 'tan',
    angle: number
  ): number {
    const key = `${func}_${angle.toFixed(6)}`;
    const cached = this.mathCache.get(key);

    if (cached && this.isValid(cached)) {
      return cached.value;
    }

    let result: number;
    switch (func) {
      case 'sin': result = Math.sin(angle); break;
      case 'cos': result = Math.cos(angle); break;
      case 'tan': result = Math.tan(angle); break;
    }

    this.mathCache.set(key, {
      value: result,
      timestamp: Date.now(),
      ttl: this.MATH_TTL
    });

    return result;
  }

  /**
   * Cache easing function calculations
   */
  public getEasingCalculation(
    easingType: string,
    progress: number,
    startValue: number,
    endValue: number
  ): number {
    const key = `ease_${easingType}_${progress.toFixed(6)}_${startValue}_${endValue}`;
    const cached = this.mathCache.get(key);

    if (cached && this.isValid(cached)) {
      return cached.value;
    }

    let result: number;
    switch (easingType) {
      case 'easeOut':
        result = 1 - Math.pow(1 - progress, 3);
        break;
      case 'easeIn':
        result = progress * progress * progress;
        break;
      case 'easeInOut':
        result = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        break;
      case 'easeOutQuad':
        result = 1 - Math.pow(1 - progress, 2);
        break;
      default:
        result = startValue + (endValue - startValue) * progress;
    }

    result = startValue + (endValue - startValue) * result;

    this.mathCache.set(key, {
      value: result,
      timestamp: Date.now(),
      ttl: this.MATH_TTL
    });

    return result;
  }

  /**
   * Cache interpolation calculations
   */
  public getInterpolationCalculation(
    type: 'lerp' | 'slerp',
    start: any,
    end: any,
    progress: number
  ): any {
    const key = `interp_${type}_${JSON.stringify(start)}_${JSON.stringify(end)}_${progress.toFixed(6)}`;
    const cached = this.animationCache.get(key);

    if (cached && this.isValid(cached)) {
      return this.deepClone(cached.value);
    }

    let result: any;
    if (type === 'lerp') {
      if (start instanceof Vector3 && end instanceof Vector3) {
        result = start.clone().lerp(end, progress);
      } else if (typeof start === 'number' && typeof end === 'number') {
        result = start + (end - start) * progress;
      } else {
        result = start; // Fallback
      }
    } else if (type === 'slerp') {
      if (start instanceof Quaternion && end instanceof Quaternion) {
        result = start.clone().slerp(end, progress);
      } else {
        result = start; // Fallback for non-quaternion objects
      }
    }

    this.animationCache.set(key, {
      value: this.deepClone(result),
      timestamp: Date.now(),
      ttl: this.ANIMATION_TTL
    });

    return result;
  }

  /**
   * Clear cache entries that have expired
   */
  private cleanup(): void {
    const now = Date.now();

    // Clean weapon position cache
    this.weaponPositionCache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        this.weaponPositionCache.delete(key);
      }
    });

    // Clean animation cache
    this.animationCache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        this.animationCache.delete(key);
      }
    });

    // Clean math cache
    this.mathCache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        this.mathCache.delete(key);
      }
    });

    // Clean vector cache
    this.vectorCache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        this.vectorCache.delete(key);
      }
    });

    // Clean matrix cache
    this.matrixCache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        this.matrixCache.delete(key);
      }
    });
  }

  /**
   * Clear all caches (useful for level changes, etc.)
   */
  public clearAll(): void {
    this.weaponPositionCache.clear();
    this.animationCache.clear();
    this.mathCache.clear();
    this.vectorCache.clear();
    this.matrixCache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  public getStats() {
    return {
      weaponPositionCache: this.weaponPositionCache.size,
      animationCache: this.animationCache.size,
      mathCache: this.mathCache.size,
      vectorCache: this.vectorCache.size,
      matrixCache: this.matrixCache.size,
      totalCached: this.weaponPositionCache.size +
                   this.animationCache.size +
                   this.mathCache.size +
                   this.vectorCache.size +
                   this.matrixCache.size
    };
  }

  private createWeaponPositionKey(
    weaponType: string,
    comboStep: number,
    isInCombo: boolean,
    comboTransitionProgress: number
  ): string {
    return `${weaponType}_${comboStep}_${isInCombo}_${comboTransitionProgress.toFixed(3)}`;
  }

  private createAnimationKey(
    animationType: string,
    progress: number,
    parameters: Record<string, any>
  ): string {
    const paramString = Object.entries(parameters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('_');
    return `${animationType}_${progress.toFixed(3)}_${paramString}`;
  }

  private isValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Vector3) return obj.clone();
    if (obj instanceof Matrix4) return obj.clone();
    if (obj instanceof Quaternion) return obj.clone();

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    const cloned = {} as any;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

// Export singleton instance
export const calculationCache = CalculationCache.getInstance();
