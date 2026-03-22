import React, { useState, useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import StunnedEffect from './StunnedEffect';

interface StunnedEnemyData {
  id: number;
  enemyId: string;
  position: Vector3;
  startTime: number;
  duration: number;
}

interface StunManagerProps {
  world?: World;
}

// Global state for triggering stun effects from ControlSystem
let globalStunManager: {
  addStunnedEnemy: (enemyId: string, position: Vector3) => void;
  getActiveStunnedEnemies: () => StunnedEnemyData[];
} | null = null;

export const addGlobalStunnedEnemy = (enemyId: string, position: Vector3): boolean => {
  if (globalStunManager) {
    globalStunManager.addStunnedEnemy(enemyId, position);
    return true;
  }
  return false;
};

export const getActiveStunnedEnemies = (): StunnedEnemyData[] => {
  if (globalStunManager) {
    return globalStunManager.getActiveStunnedEnemies();
  }
  return [];
};

export default function StunManager({ world }: StunManagerProps) {
  const [stunnedEnemies, setStunnedEnemies] = useState<StunnedEnemyData[]>([]);
  const stunnedEnemyIdCounter = useRef(0);
  const lastUpdateTime = useRef(0);

  // Get enemy data for stunned effect positioning
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

  const addStunnedEnemy = useCallback((enemyId: string, position: Vector3) => {
    const newStunnedEnemy: StunnedEnemyData = {
      id: stunnedEnemyIdCounter.current++,
      enemyId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 4000 // 4 seconds stun duration
    };
    
    setStunnedEnemies(prev => [...prev, newStunnedEnemy]);
  }, []);

  const getActiveStunnedEnemies = useCallback(() => {
    return stunnedEnemies;
  }, [stunnedEnemies]);

  // Register global manager
  React.useEffect(() => {
    globalStunManager = {
      addStunnedEnemy,
      getActiveStunnedEnemies
    };
    
    return () => {
      globalStunManager = null;
    };
  }, [addStunnedEnemy, getActiveStunnedEnemies]);

  // Update stunned enemies based on world state
  useFrame((state) => {
    // Throttle updates
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.1) return; // Update every 100ms
    lastUpdateTime.current = currentTime;

    if (!world) return;

    const now = Date.now();

    // Check for newly stunned enemies and add stun effects
    const allEntities = world.getAllEntities();
    allEntities.forEach(entity => {
      const enemy = entity.getComponent(Enemy);
      const transform = entity.getComponent(Transform);
      
      if (enemy && transform && enemy.isFrozen) {
        // Check if this is a stun effect (we reuse the freeze mechanism but with different visuals)
        // We'll identify stun effects by checking if they were applied by Sunder
        const existingStunnedEffect = stunnedEnemies.find(se => se.enemyId === entity.id.toString());
        
        if (!existingStunnedEffect) {
          // Check if this enemy was recently hit by Sunder (this is a simple heuristic)
          // In a more complex system, we might add a separate stun flag to the Enemy component
          // For now, we'll add stun effects for all newly frozen enemies
          // The ControlSystem will call addGlobalStunnedEnemy directly for Sunder stuns
        }
      }
    });

    // Clean up stunned effects based on multiple criteria
    setStunnedEnemies(prev => prev.filter(stunnedEnemy => {
      const elapsed = now - stunnedEnemy.startTime;
      
      // Remove if duration has passed
      if (elapsed >= stunnedEnemy.duration) {
        return false;
      }
      
      // Remove if enemy no longer exists or is dead
      const entity = allEntities.find(e => e.id.toString() === stunnedEnemy.enemyId);
      if (!entity) {
        return false;
      }
      
      const health = entity.getComponent(Health);
      if (health && health.isDead) {
        return false;
      }
      
      // Remove if enemy is no longer stunned/frozen
      const enemy = entity.getComponent(Enemy);
      if (enemy && !enemy.isFrozen) {
        return false;
      }
      
      return true;
    }));
  });

  const enemyData = getEnemyData();

  return (
    <>
      {stunnedEnemies.map(stunnedEnemy => (
        <StunnedEffect
          key={stunnedEnemy.id}
          position={stunnedEnemy.position}
          duration={stunnedEnemy.duration}
          startTime={stunnedEnemy.startTime}
          enemyId={stunnedEnemy.enemyId}
          enemyData={enemyData}
          onComplete={() => {
            setStunnedEnemies(prev => prev.filter(se => se.id !== stunnedEnemy.id));
          }}
        />
      ))}
    </>
  );
}
