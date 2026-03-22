// Performance-optimized useCallback hook
// Automatically records performance metrics and uses calculation cache

import { useCallback, useRef, useEffect } from 'react';
import { performanceMonitor } from '../PerformanceMonitor';

const recordCacheHit = () => performanceMonitor.recordCacheHit();
const recordCacheMiss = () => performanceMonitor.recordCacheMiss();

interface UsePerformanceOptimizedCallbackOptions {
  cacheKey?: string;
  enableCache?: boolean;
  recordMetrics?: boolean;
}

/**
 * Enhanced useCallback with performance monitoring and caching
 */
export function usePerformanceOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  options: UsePerformanceOptimizedCallbackOptions = {}
): T {
  const { cacheKey, enableCache = true, recordMetrics = true } = options;
  const cacheRef = useRef<Map<string, { result: any; deps: React.DependencyList }>>(new Map());

  return useCallback((...args: Parameters<T>) => {
    if (enableCache && cacheKey) {
      const cacheKeyWithDeps = `${cacheKey}_${JSON.stringify(deps)}_${JSON.stringify(args)}`;
      const cached = cacheRef.current.get(cacheKeyWithDeps);

      if (cached) {
        if (recordMetrics) recordCacheHit();
        return cached.result;
      }

      if (recordMetrics) recordCacheMiss();
      const result = callback(...args);
      cacheRef.current.set(cacheKeyWithDeps, { result, deps: [...deps] });
      return result;
    }

    return callback(...args);
  }, deps) as T;
}
