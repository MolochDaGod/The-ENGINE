// Performance stats hook
// Provides detailed performance statistics and health monitoring

import { useState, useEffect } from 'react';
import { PerformanceMonitor } from '../PerformanceMonitor';

const performanceMonitor = PerformanceMonitor.getInstance();

interface UsePerformanceStatsOptions {
  updateInterval?: number;
  healthThresholds?: {
    excellent: number;
    good: number;
    warning: number;
    critical: number;
  };
}

/**
 * Hook for detailed performance statistics
 */
export function usePerformanceStats(options: UsePerformanceStatsOptions = {}) {
  const { updateInterval = 2000 } = options;

  const [stats, setStats] = useState({
    summary: performanceMonitor.getPerformanceSummary(),
    recommendations: performanceMonitor.getOptimizationRecommendations(),
    isHealthy: true,
    healthColor: 'green' as 'green' | 'yellow' | 'orange' | 'red'
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const summary = performanceMonitor.getPerformanceSummary();
      const recommendations = performanceMonitor.getOptimizationRecommendations();

      // Determine health status
      let isHealthy = true;
      let healthColor: 'green' | 'yellow' | 'orange' | 'red' = 'green';

      if (summary.averageFPS < 30) {
        isHealthy = false;
        healthColor = 'red';
      } else if (summary.averageFPS < 45) {
        isHealthy = false;
        healthColor = 'orange';
      } else if (summary.averageFPS < 55) {
        healthColor = 'yellow';
      }

      setStats({
        summary,
        recommendations,
        isHealthy,
        healthColor
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  // Get health status text
  const getHealthStatus = () => {
    switch (stats.summary.health) {
      case 'excellent': return 'Excellent';
      case 'good': return 'Good';
      case 'warning': return 'Needs Attention';
      case 'critical': return 'Critical';
      default: return 'Unknown';
    }
  };

  // Get performance grade
  const getPerformanceGrade = () => {
    const fps = stats.summary.averageFPS;
    if (fps >= 55) return 'A';
    if (fps >= 45) return 'B';
    if (fps >= 35) return 'C';
    if (fps >= 25) return 'D';
    return 'F';
  };

  return {
    ...stats,
    getHealthStatus,
    getPerformanceGrade,
    isOptimized: stats.summary.cacheEfficiency > 70 && stats.summary.renderEfficiency > 80
  };
}
