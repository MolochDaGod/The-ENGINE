import React, { useState, useRef, useCallback } from 'react';
import { Vector3 } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import FrostNova from './FrostNova';
import FrozenEffect from './FrozenEffect';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';

interface FrostNovaData {
  id: number;
  position: Vector3;
  startTime: number;
  duration: number;
}

interface FrozenEnemyData {
  id: number;
  enemyId: string;
  position: Vector3;
  startTime: number;
  duration: number;
}

interface FrostNovaManagerProps {
  world?: World;
}

// Global state for triggering frost nova from ControlSystem
let globalFrostNovaManager: {
  triggerFrostNova: (position: Vector3) => void;
  addFrozenEnemy: (enemyId: string, position: Vector3) => void;
  getActiveFrostNovas: () => FrostNovaData[];
} | null = null;

export const triggerGlobalFrostNova = (position: Vector3): boolean => {
  if (globalFrostNovaManager) {
    globalFrostNovaManager.triggerFrostNova(position);
    return true;
  }
  return false;
};

export const addGlobalFrozenEnemy = (enemyId: string, position: Vector3): boolean => {
  if (globalFrostNovaManager) {
    globalFrostNovaManager.addFrozenEnemy(enemyId, position);
    return true;
  }
  return false;
};

export const getActiveFrostNovas = (): FrostNovaData[] => {
  if (globalFrostNovaManager && (globalFrostNovaManager as any).getActiveFrostNovas) {
    return (globalFrostNovaManager as any).getActiveFrostNovas();
  }
  return [];
};

export default function FrostNovaManager({ world }: FrostNovaManagerProps) {
  const [activeFrostNovas, setActiveFrostNovas] = useState<FrostNovaData[]>([]);
  const [frozenEnemies, setFrozenEnemies] = useState<FrozenEnemyData[]>([]);
  const frostNovaIdCounter = useRef(0);
  const frozenEnemyIdCounter = useRef(0);
  const lastUpdateTime = useRef(0);

  // Get enemy data for frozen effect positioning
  const getEnemyData = useCallback(() => {
    if (!world) return [];
    
    const allEntities = world.getAllEntities();
    return allEntities
      .filter(entity => entity.hasComponent(Enemy) && entity.hasComponent(Transform) && entity.hasComponent(Health))
      .map(entity => {
        const enemy = entity.getComponent(Enemy)!;
        const transform = entity.getComponent(Transform)!;
        const health = entity.getComponent(Health)!;
        
        return {
          id: entity.id.toString(),
          position: transform.position.clone(),
          health: health.currentHealth,
          isDying: health.isDead,
          deathStartTime: health.isDead ? Date.now() : undefined
        };
      });
  }, [world]);

  const triggerFrostNova = useCallback((position: Vector3) => {
    const newFrostNova: FrostNovaData = {
      id: frostNovaIdCounter.current++,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1200 // 2 seconds
    };
    
    setActiveFrostNovas(prev => [...prev, newFrostNova]);
  }, []);

  const addFrozenEnemy = useCallback((enemyId: string, position: Vector3) => {
    const newFrozenEnemy: FrozenEnemyData = {
      id: frozenEnemyIdCounter.current++,
      enemyId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 5000 // 5 seconds
    };
    
    setFrozenEnemies(prev => [...prev, newFrozenEnemy]);
  }, []);

  const getActiveFrostNovas = useCallback(() => {
    return activeFrostNovas;
  }, [activeFrostNovas]);

  // Register global manager
  React.useEffect(() => {
    globalFrostNovaManager = {
      triggerFrostNova,
      addFrozenEnemy,
      getActiveFrostNovas
    };
    
    return () => {
      globalFrostNovaManager = null;
    };
  }, [triggerFrostNova, addFrozenEnemy, getActiveFrostNovas]);

  // Update frozen enemies based on world state
  useFrame((state) => {
    // Throttle updates
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.1) return; // Update every 100ms
    lastUpdateTime.current = currentTime;

    if (!world) return;

    const now = Date.now();

    // Check for newly frozen enemies and add frozen effects
    const allEntities = world.getAllEntities();
    allEntities.forEach(entity => {
      const enemy = entity.getComponent(Enemy);
      const transform = entity.getComponent(Transform);
      
      if (enemy && transform && enemy.isFrozen) {
        // Check if we already have a frozen effect for this enemy
        const existingFrozenEffect = frozenEnemies.find(fe => fe.enemyId === entity.id.toString());
        
        if (!existingFrozenEffect) {
          // Add frozen effect for this newly frozen enemy
          addFrozenEnemy(entity.id.toString(), transform.position);
        }
      }
    });

    // Clean up frozen effects based on multiple criteria
    setFrozenEnemies(prev => {
      return prev.filter(frozenEnemy => {
        // First check: Has the effect duration expired?
        const effectElapsed = now - frozenEnemy.startTime;
        if (effectElapsed >= frozenEnemy.duration) {
          return false; // Remove expired effects
        }

        // Second check: Does the entity still exist?
        const entity = allEntities.find(e => e.id.toString() === frozenEnemy.enemyId);
        if (!entity) {
          return false; // Entity no longer exists
        }
        
        const enemy = entity.getComponent(Enemy);
        const health = entity.getComponent(Health);
        
        // Third check: Is the entity still valid?
        if (!enemy || !health) {
          return false;
        }

        // Fourth check: Is the enemy dead?
        if (health.isDead) {
          return false; // Enemy is dead
        }
        
        // Keep the effect if it's still valid and within duration
        return true;
      });
    });

    // Also clean up expired frost nova explosion effects
    setActiveFrostNovas(prev => {
      return prev.filter(frostNova => {
        const effectElapsed = now - frostNova.startTime;
        if (effectElapsed >= frostNova.duration) {
          return false;
        }
        return true;
      });
    });
  });

  const handleFrostNovaComplete = (frostNovaId: number) => {
    setActiveFrostNovas(prev => prev.filter(fn => fn.id !== frostNovaId));
  };

  const handleFrozenEffectComplete = (frozenId: number) => {
    setFrozenEnemies(prev => prev.filter(fe => fe.id !== frozenId));
  };

  const enemyData = getEnemyData();

  return (
    <>
      {/* Frost Nova explosion effects */}
      {activeFrostNovas.map(frostNova => (
        <FrostNova
          key={frostNova.id}
          position={frostNova.position}
          duration={frostNova.duration}
          startTime={frostNova.startTime}
          onComplete={() => handleFrostNovaComplete(frostNova.id)}
        />
      ))}

      {/* Frozen enemy effects */}
      {frozenEnemies.map(frozenEnemy => (
        <FrozenEffect
          key={frozenEnemy.id}
          position={frozenEnemy.position}
          duration={frozenEnemy.duration}
          startTime={frozenEnemy.startTime}
          enemyId={frozenEnemy.enemyId}
          enemyData={enemyData}
          onComplete={() => handleFrozenEffectComplete(frozenEnemy.id)}
        />
      ))}
    </>
  );
}
