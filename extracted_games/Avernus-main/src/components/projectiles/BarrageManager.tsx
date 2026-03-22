import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import { useBarrage } from './useBarrage';
import Barrage from './Barrage';

// Global state for barrage management
let globalBarrageManager: {
  triggerBarrage: (position: Vector3, direction: Vector3) => boolean;
} | null = null;

// Global trigger function that can be called from anywhere
export function triggerGlobalBarrage(position: Vector3, direction: Vector3): boolean {
  if (globalBarrageManager) {
    return globalBarrageManager.triggerBarrage(position, direction);
  }
  return false;
}

interface BarrageManagerProps {
  // Empty for now - will be populated by the unified manager
}

export default function BarrageManager({}: BarrageManagerProps) {
  const nextDamageNumberId = useRef(0);
  
  // Mock enemy data and handlers - these will be replaced by the unified manager
  const mockEnemyData: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
  }> = [];

  const mockOnHit = (targetId: string, damage: number) => {
  };

  const mockSetDamageNumbers = (callback: any) => {
    // Mock implementation
  };

  const {
    shootBarrage,
    updateProjectiles,
    getActiveProjectiles,
    cleanup
  } = useBarrage({
    onHit: mockOnHit,
    enemyData: mockEnemyData,
    setDamageNumbers: mockSetDamageNumbers,
    nextDamageNumberId
  });

  // Register global manager
  useEffect(() => {
    globalBarrageManager = {
      triggerBarrage: (position: Vector3, direction: Vector3) => {
        return shootBarrage(position, direction);
      }
    };

    return () => {
      globalBarrageManager = null;
      cleanup();
    };
  }, [shootBarrage, cleanup]);

  // Update projectiles every frame
  useFrame(() => {
    updateProjectiles();
  });

  const activeProjectiles = getActiveProjectiles();

  return <Barrage projectiles={activeProjectiles} />;
}
