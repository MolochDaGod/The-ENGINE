// Performance Monitor for tracking optimization effectiveness
// Provides real-time performance metrics and optimization insights

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage?: number;
  drawCalls?: number;
  triangles?: number;
  timestamp: number;
}

interface CacheMetrics {
  objectPoolStats: Record<string, number>;
  calculationCacheStats: Record<string, number>;
  hitRate: number;
  totalRequests: number;
  cacheHits: number;
}

interface RenderMetrics {
  componentsRendered: number;
  reRendersPrevented: number;
  totalRenders: number;
  memoHitRate: number;
}

/**
 * Performance Monitor System
 * Tracks and analyzes performance metrics for optimization insights
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;

  // Performance tracking
  private frameCount = 0;
  private lastTime = 0;
  private fps = 0;
  private frameTime = 0;
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsHistory = 300; // Keep 5 minutes of data at 60fps

  // Cache tracking
  private cacheMetrics: CacheMetrics = {
    objectPoolStats: {},
    calculationCacheStats: {},
    hitRate: 0,
    totalRequests: 0,
    cacheHits: 0
  };

  // Render tracking
  private renderMetrics: RenderMetrics = {
    componentsRendered: 0,
    reRendersPrevented: 0,
    totalRenders: 0,
    memoHitRate: 0
  };

  // Performance thresholds
  private readonly TARGET_FPS = 60;
  private readonly TARGET_FRAME_TIME = 1000 / 60; // ~16.67ms
  private readonly WARNING_FPS_THRESHOLD = 50;
  private readonly CRITICAL_FPS_THRESHOLD = 30;

  // Monitoring flags
  private isEnabled = true;
  private isDetailedMode = false;

  private constructor() {
    this.startMonitoring();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    if (typeof window !== 'undefined') {
      this.lastTime = performance.now();
      this.monitorFrame();
    }
  }

  /**
   * Monitor frame performance
   */
  private monitorFrame = (): void => {
    if (!this.isEnabled) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;

    if (deltaTime >= 1000) { // Update every second
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameTime = deltaTime / this.frameCount;

      const metrics: PerformanceMetrics = {
        fps: this.fps,
        frameTime: this.frameTime,
        memoryUsage: this.getMemoryUsage(),
        timestamp: currentTime
      };

      this.metrics.push(metrics);

      // Keep only recent metrics
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics.shift();
      }

      // Reset counters
      this.frameCount = 0;
      this.lastTime = currentTime;

      // Log warnings for poor performance
      if (this.fps < this.CRITICAL_FPS_THRESHOLD) {
        console.warn(`[Performance] Critical FPS: ${this.fps}`);
      } else if (this.fps < this.WARNING_FPS_THRESHOLD) {
        console.warn(`[Performance] Low FPS: ${this.fps}`);
      }
    }

    this.frameCount++;
    requestAnimationFrame(this.monitorFrame);
  };

  /**
   * Get current memory usage (if available)
   */
  private getMemoryUsage(): number | undefined {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return undefined;
  }

  /**
   * Update cache metrics
   */
  public updateCacheMetrics(
    objectPoolStats: Record<string, number>,
    calculationCacheStats: Record<string, number>,
    totalRequests: number,
    cacheHits: number
  ): void {
    this.cacheMetrics.objectPoolStats = { ...objectPoolStats };
    this.cacheMetrics.calculationCacheStats = { ...calculationCacheStats };
    this.cacheMetrics.totalRequests = totalRequests;
    this.cacheMetrics.cacheHits = cacheHits;
    this.cacheMetrics.hitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;
  }

  /**
   * Update render metrics
   */
  public updateRenderMetrics(
    componentsRendered: number,
    reRendersPrevented: number,
    totalRenders: number
  ): void {
    this.renderMetrics.componentsRendered = componentsRendered;
    this.renderMetrics.reRendersPrevented = reRendersPrevented;
    this.renderMetrics.totalRenders = totalRenders;
    this.renderMetrics.memoHitRate = totalRenders > 0 ? (reRendersPrevented / totalRenders) * 100 : 0;
  }

  /**
   * Record a cache hit
   */
  public recordCacheHit(): void {
    this.cacheMetrics.totalRequests++;
    this.cacheMetrics.cacheHits++;
  }

  /**
   * Record a cache miss
   */
  public recordCacheMiss(): void {
    this.cacheMetrics.totalRequests++;
  }

  /**
   * Record a memo hit (re-render prevented)
   */
  public recordMemoHit(): void {
    this.renderMetrics.reRendersPrevented++;
    this.renderMetrics.totalRenders++;
  }

  /**
   * Record a component render
   */
  public recordComponentRender(): void {
    this.renderMetrics.componentsRendered++;
    this.renderMetrics.totalRenders++;
  }

  /**
   * Get current performance metrics
   */
  public getCurrentMetrics(): {
    performance: PerformanceMetrics;
    cache: CacheMetrics;
    render: RenderMetrics;
  } {
    return {
      performance: {
        fps: this.fps,
        frameTime: this.frameTime,
        memoryUsage: this.getMemoryUsage(),
        timestamp: performance.now()
      },
      cache: this.cacheMetrics,
      render: this.renderMetrics
    };
  }

  /**
   * Get performance history
   */
  public getPerformanceHistory(minutes: number = 1): PerformanceMetrics[] {
    const now = performance.now();
    const timeRange = minutes * 60 * 1000; // Convert minutes to milliseconds
    const cutoff = now - timeRange;

    return this.metrics.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    averageFrameTime: number;
    memoryUsage: number | undefined;
    cacheEfficiency: number;
    renderEfficiency: number;
    health: 'excellent' | 'good' | 'warning' | 'critical';
  } {
    if (this.metrics.length === 0) {
      return {
        averageFPS: 0,
        minFPS: 0,
        maxFPS: 0,
        averageFrameTime: 0,
        memoryUsage: undefined,
        cacheEfficiency: 0,
        renderEfficiency: 0,
        health: 'critical'
      };
    }

    const recentMetrics = this.getPerformanceHistory(1); // Last minute
    const fpsValues = recentMetrics.map(m => m.fps);

    const averageFPS = fpsValues.reduce((sum, fps) => sum + fps, 0) / fpsValues.length;
    const minFPS = Math.min(...fpsValues);
    const maxFPS = Math.max(...fpsValues);
    const averageFrameTime = recentMetrics.reduce((sum, m) => sum + m.frameTime, 0) / recentMetrics.length;

    let health: 'excellent' | 'good' | 'warning' | 'critical';
    if (averageFPS >= 55) {
      health = 'excellent';
    } else if (averageFPS >= 45) {
      health = 'good';
    } else if (averageFPS >= 35) {
      health = 'warning';
    } else {
      health = 'critical';
    }

    return {
      averageFPS: Math.round(averageFPS),
      minFPS,
      maxFPS,
      averageFrameTime: Math.round(averageFrameTime * 100) / 100,
      memoryUsage: this.getMemoryUsage(),
      cacheEfficiency: Math.round(this.cacheMetrics.hitRate * 100) / 100,
      renderEfficiency: Math.round(this.renderMetrics.memoHitRate * 100) / 100,
      health
    };
  }

  /**
   * Get optimization recommendations
   */
  public getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const summary = this.getPerformanceSummary();

    if (summary.averageFPS < this.WARNING_FPS_THRESHOLD) {
      recommendations.push('Consider reducing particle effects or object complexity');
      recommendations.push('Check for memory leaks - current memory usage seems high');
    }

    if (summary.cacheEfficiency < 70) {
      recommendations.push('Cache hit rate is low - consider adjusting cache TTL or cache key generation');
    }

    if (summary.renderEfficiency < 80) {
      recommendations.push('Many components are re-rendering - ensure React.memo is properly implemented');
    }

    if (summary.memoryUsage && summary.memoryUsage > 100) {
      recommendations.push('Memory usage is high - consider implementing object pooling');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance looks good! Keep monitoring for any degradation.');
    }

    return recommendations;
  }

  /**
   * Enable/disable monitoring
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Enable/disable detailed mode (more logging)
   */
  public setDetailedMode(enabled: boolean): void {
    this.isDetailedMode = enabled;
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.metrics.length = 0;
    this.frameCount = 0;
    this.cacheMetrics = {
      objectPoolStats: {},
      calculationCacheStats: {},
      hitRate: 0,
      totalRequests: 0,
      cacheHits: 0
    };
    this.renderMetrics = {
      componentsRendered: 0,
      reRendersPrevented: 0,
      totalRenders: 0,
      memoHitRate: 0
    };
    this.lastTime = performance.now();
  }

  /**
   * Export metrics for analysis
   */
  public exportMetrics(): {
    performanceHistory: PerformanceMetrics[];
    cacheMetrics: CacheMetrics;
    renderMetrics: RenderMetrics;
    summary: ReturnType<PerformanceMonitor['getPerformanceSummary']>;
    recommendations: string[];
  } {
    return {
      performanceHistory: [...this.metrics],
      cacheMetrics: { ...this.cacheMetrics },
      renderMetrics: { ...this.renderMetrics },
      summary: this.getPerformanceSummary(),
      recommendations: this.getOptimizationRecommendations()
    };
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Global performance monitoring helpers
export const recordComponentRender = () => performanceMonitor.recordComponentRender();
export const recordMemoHit = () => performanceMonitor.recordMemoHit();
export const recordCacheHit = () => performanceMonitor.recordCacheHit();
export const recordCacheMiss = () => performanceMonitor.recordCacheMiss();
