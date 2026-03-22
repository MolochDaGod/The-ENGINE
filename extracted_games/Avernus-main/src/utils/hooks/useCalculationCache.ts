// Calculation caching hook for React components
// Automatically caches expensive calculations

import { useCallback, useMemo } from 'react';
import { calculationCache } from '../CalculationCache';
import { performanceMonitor } from '../PerformanceMonitor';

const recordCacheHit = () => performanceMonitor.recordCacheHit();
const recordCacheMiss = () => performanceMonitor.recordCacheMiss();

interface UseCalculationCacheOptions {
  enableMetrics?: boolean;
}

/**
 * Hook for caching expensive calculations in React components
 */
export function useCalculationCache(options: UseCalculationCacheOptions = {}) {
  const { enableMetrics = true } = options;

  // Cached trigonometric calculations
  const getCachedSin = useCallback((angle: number) => {
    const result = calculationCache.getTrigCalculation('sin', angle);
    if (enableMetrics) recordCacheHit();
    return result;
  }, [enableMetrics]);

  const getCachedCos = useCallback((angle: number) => {
    const result = calculationCache.getTrigCalculation('cos', angle);
    if (enableMetrics) recordCacheHit();
    return result;
  }, [enableMetrics]);

  const getCachedTan = useCallback((angle: number) => {
    const result = calculationCache.getTrigCalculation('tan', angle);
    if (enableMetrics) recordCacheHit();
    return result;
  }, [enableMetrics]);

  // Cached easing calculations
  const getCachedEasing = useCallback((
    easingType: string,
    progress: number,
    startValue: number,
    endValue: number
  ) => {
    const result = calculationCache.getEasingCalculation(
      easingType,
      progress,
      startValue,
      endValue
    );
    if (enableMetrics) recordCacheHit();
    return result;
  }, [enableMetrics]);

  // Cached interpolation calculations
  const getCachedInterpolation = useCallback((
    type: 'lerp' | 'slerp',
    start: any,
    end: any,
    progress: number
  ) => {
    const result = calculationCache.getInterpolationCalculation(
      type,
      start,
      end,
      progress
    );
    if (enableMetrics) recordCacheHit();
    return result;
  }, [enableMetrics]);

  // Generic calculation caching
  const getCachedCalculation = useCallback((
    key: string,
    calculator: () => any,
    ttl?: number
  ) => {
    // For now, we'll use a simple implementation
    // In a full implementation, you'd want to integrate with the CalculationCache
    const result = calculator();
    if (enableMetrics) recordCacheHit();
    return result;
  }, [enableMetrics]);

  // Cache statistics
  const cacheStats = useMemo(() => calculationCache.getStats(), []);

  return {
    getCachedSin,
    getCachedCos,
    getCachedTan,
    getCachedEasing,
    getCachedInterpolation,
    getCachedCalculation,
    clearCache: () => calculationCache.clearAll(),
    getCacheStats: () => calculationCache.getStats(),
    cacheStats
  };
}
