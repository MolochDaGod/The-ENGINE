// Performance monitoring hook for React components
// Provides real-time performance metrics

import { useState, useEffect, useCallback } from 'react';
import { PerformanceMonitor } from '../PerformanceMonitor';

const performanceMonitor = PerformanceMonitor.getInstance();

interface UsePerformanceMonitorOptions {
  updateInterval?: number; // milliseconds
  enableHistory?: boolean;
}

/**
 * Hook for monitoring performance in React components
 */
export function usePerformanceMonitor(options: UsePerformanceMonitorOptions = {}) {
  const { updateInterval = 1000, enableHistory = false } = options;

  const [metrics, setMetrics] = useState(performanceMonitor.getCurrentMetrics());
  const [summary, setSummary] = useState(performanceMonitor.getPerformanceSummary());

  // Update metrics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getCurrentMetrics());
      setSummary(performanceMonitor.getPerformanceSummary());
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  // Performance recording functions
  const recordComponentRender = useCallback(() => {
    performanceMonitor.recordComponentRender();
  }, []);

  const recordMemoHit = useCallback(() => {
    performanceMonitor.recordMemoHit();
  }, []);

  const recordCacheHit = useCallback(() => {
    performanceMonitor.recordCacheHit();
  }, []);

  const recordCacheMiss = useCallback(() => {
    performanceMonitor.recordCacheMiss();
  }, []);

  // Get recommendations
  const getRecommendations = useCallback(() => {
    return performanceMonitor.getOptimizationRecommendations();
  }, []);

  // Export metrics
  const exportMetrics = useCallback(() => {
    return performanceMonitor.exportMetrics();
  }, []);

  // Get performance history
  const getPerformanceHistory = useCallback((minutes = 1) => {
    return performanceMonitor.getPerformanceHistory(minutes);
  }, []);

  return {
    metrics,
    summary,
    recordComponentRender,
    recordMemoHit,
    recordCacheHit,
    recordCacheMiss,
    getRecommendations,
    exportMetrics,
    getPerformanceHistory: enableHistory ? getPerformanceHistory : undefined
  };
}
