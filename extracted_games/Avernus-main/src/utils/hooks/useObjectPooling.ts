// Object pooling hook for React components
// Automatically manages object lifecycle

import { useRef, useEffect, useCallback } from 'react';
import { enhancedObjectPool } from '../EnhancedObjectPool';
import { Vector3, Color, Quaternion, Matrix4, Euler } from '@/utils/three-exports';

interface UseObjectPoolingOptions {
  initialSize?: number;
  autoCleanup?: boolean;
}

/**
 * Hook for managing object pools in React components
 */
export function useObjectPooling(options: UseObjectPoolingOptions = {}) {
  const { initialSize = 10, autoCleanup = true } = options;
  const pooledObjectsRef = useRef<Set<any>>(new Set());

  // Vector3 pooling
  const acquireVector3 = useCallback((x = 0, y = 0, z = 0) => {
    const vector = enhancedObjectPool.acquireVector3(x, y, z);
    pooledObjectsRef.current.add(vector);
    return vector;
  }, []);

  const releaseVector3 = useCallback((vector: Vector3) => {
    enhancedObjectPool.releaseVector3(vector);
    pooledObjectsRef.current.delete(vector);
  }, []);

  // Color pooling
  const acquireColor = useCallback((r = 1, g = 1, b = 1) => {
    const color = enhancedObjectPool.acquireColor(r, g, b);
    pooledObjectsRef.current.add(color);
    return color;
  }, []);

  const releaseColor = useCallback((color: Color) => {
    enhancedObjectPool.releaseColor(color);
    pooledObjectsRef.current.delete(color);
  }, []);

  // Quaternion pooling
  const acquireQuaternion = useCallback((x = 0, y = 0, z = 0, w = 1) => {
    const quaternion = enhancedObjectPool.acquireQuaternion(x, y, z, w);
    pooledObjectsRef.current.add(quaternion);
    return quaternion;
  }, []);

  const releaseQuaternion = useCallback((quaternion: Quaternion) => {
    enhancedObjectPool.releaseQuaternion(quaternion);
    pooledObjectsRef.current.delete(quaternion);
  }, []);

  // Matrix4 pooling
  const acquireMatrix4 = useCallback(() => {
    const matrix = enhancedObjectPool.acquireMatrix4();
    pooledObjectsRef.current.add(matrix);
    return matrix;
  }, []);

  const releaseMatrix4 = useCallback((matrix: Matrix4) => {
    enhancedObjectPool.releaseMatrix4(matrix);
    pooledObjectsRef.current.delete(matrix);
  }, []);

  // Euler pooling
  const acquireEuler = useCallback((x = 0, y = 0, z = 0) => {
    const euler = enhancedObjectPool.acquireEuler(x, y, z);
    pooledObjectsRef.current.add(euler);
    return euler;
  }, []);

  const releaseEuler = useCallback((euler: Euler) => {
    enhancedObjectPool.releaseEuler(euler);
    pooledObjectsRef.current.delete(euler);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    if (!autoCleanup) return;

    return () => {
      // Release all pooled objects
      pooledObjectsRef.current.forEach(obj => {
        if (obj instanceof Vector3) {
          enhancedObjectPool.releaseVector3(obj);
        } else if (obj instanceof Color) {
          enhancedObjectPool.releaseColor(obj);
        } else if (obj instanceof Quaternion) {
          enhancedObjectPool.releaseQuaternion(obj);
        } else if (obj instanceof Matrix4) {
          enhancedObjectPool.releaseMatrix4(obj);
        } else if (obj instanceof Euler) {
          enhancedObjectPool.releaseEuler(obj);
        }
      });
      pooledObjectsRef.current.clear();
    };
  }, [autoCleanup]);

  // Reset frame temporaries at the end of each frame
  useEffect(() => {
    const resetFrame = () => {
      enhancedObjectPool.resetFrameTemporaries();
    };

    // Use requestAnimationFrame for frame-based cleanup
    let animationId: number;
    const scheduleReset = () => {
      resetFrame();
      animationId = requestAnimationFrame(scheduleReset);
    };

    animationId = requestAnimationFrame(scheduleReset);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return {
    acquireVector3,
    releaseVector3,
    acquireColor,
    releaseColor,
    acquireQuaternion,
    releaseQuaternion,
    acquireMatrix4,
    releaseMatrix4,
    acquireEuler,
    releaseEuler,
    getPoolStats: () => enhancedObjectPool.getStats(),
    clearAllPools: () => enhancedObjectPool.clearAll()
  };
}
