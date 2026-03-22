// Performance Optimizations Integration
// Unified interface for all performance optimization utilities

export { EnhancedObjectPool, enhancedObjectPool } from './EnhancedObjectPool';
export { CalculationCache, calculationCache } from './CalculationCache';
export { PerformanceMonitor, performanceMonitor, recordComponentRender, recordMemoHit, recordCacheHit, recordCacheMiss } from './PerformanceMonitor';

// Re-export the original ObjectPool for backward compatibility
export { ObjectPool } from './ObjectPool';
export { PVPObjectPool, pvpObjectPool } from './PVPObjectPool';

// React optimization hooks
export { usePerformanceOptimizedCallback } from './hooks/usePerformanceOptimizedCallback';
export { usePerformanceOptimizedMemo } from './hooks/usePerformanceOptimizedMemo';
export { useObjectPooling } from './hooks/useObjectPooling';
export { useCalculationCache } from './hooks/useCalculationCache';

// Performance monitoring hooks
export { usePerformanceMonitor } from './hooks/usePerformanceMonitor';
export { usePerformanceStats } from './hooks/usePerformanceStats';

// Utility functions
export * from './performanceUtils';
