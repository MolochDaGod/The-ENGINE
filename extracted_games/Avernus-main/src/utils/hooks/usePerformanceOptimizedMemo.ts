// Performance-optimized useMemo hook
// Automatically records performance metrics

import { useMemo } from 'react';
import { performanceMonitor } from '../PerformanceMonitor';

const recordMemoHit = () => performanceMonitor.recordMemoHit();

interface UsePerformanceOptimizedMemoOptions {
  enableMetrics?: boolean;
}

/**
 * Enhanced useMemo with performance monitoring
 */
export function usePerformanceOptimizedMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  options: UsePerformanceOptimizedMemoOptions = {}
): T {
  const { enableMetrics = true } = options;

  return useMemo(() => {
    if (enableMetrics) {
      recordMemoHit();
    }
    return factory();
  }, deps);
}
