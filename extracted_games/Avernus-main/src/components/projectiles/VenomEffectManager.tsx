'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import VenomEffect from './VenomEffect';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';

interface VenomEffectData {
  id: number;
  enemyId: string;
  position: Vector3;
  startTime: number;
  duration: number;
}

interface VenomEffectManagerProps {
  world: World;
}

// Global manager for venom effects
let globalVenomEffectManager: {
  addVenomousEnemy?: (enemyId: string, position: Vector3) => void;
} | null = null;

export const addGlobalVenomousEnemy = (enemyId: string, position: Vector3): boolean => {
  if (globalVenomEffectManager && globalVenomEffectManager.addVenomousEnemy) {
    globalVenomEffectManager.addVenomousEnemy(enemyId, position);
    return true;
  }
  return false;
};

export default function VenomEffectManager({ world }: VenomEffectManagerProps) {
  const [venomousEnemies, setVenomousEnemies] = useState<VenomEffectData[]>([]);
  const venomEffectIdCounter = useRef(0);
  const lastUpdateTime = useRef(0);

  // Get enemy data for venom effect positioning
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

  const addVenomousEnemy = useCallback((enemyId: string, position: Vector3) => {
    const newVenomousEnemy: VenomEffectData = {
      id: venomEffectIdCounter.current++,
      enemyId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 6000 // 6 seconds venom duration
    };
    
    setVenomousEnemies(prev => [...prev, newVenomousEnemy]);
  }, []);

  // Register global manager
  React.useEffect(() => {
    globalVenomEffectManager = {
      addVenomousEnemy
    };
    
    return () => {
      globalVenomEffectManager = null;
    };
  }, [addVenomousEnemy]);

  // Update venomous enemies based on world state
  useFrame((state) => {
    // Throttle updates
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.1) return; // Update every 100ms
    lastUpdateTime.current = currentTime;

    if (!world) return;

    // Check for newly venomous enemies and add venom effects
    const allEntities = world.getAllEntities();
    allEntities.forEach(entity => {
      const enemy = entity.getComponent(Enemy);
      const transform = entity.getComponent(Transform);
      
      if (enemy && transform && enemy.isVenomous) {
        // Check if we already have a venom effect for this enemy
        const existingVenomEffect = venomousEnemies.find(ve => ve.enemyId === entity.id.toString());
        
        if (!existingVenomEffect) {
          // Add venom effect for this newly venomous enemy
          addVenomousEnemy(entity.id.toString(), transform.position);
        }
      }
    });

    // Clean up venom effects for enemies that are no longer venomous or dead
    setVenomousEnemies(prev => {
      return prev.filter(venomousEnemy => {
        const entity = allEntities.find(e => e.id.toString() === venomousEnemy.enemyId);
        if (!entity) return false; // Entity no longer exists
        
        const enemy = entity.getComponent(Enemy);
        const health = entity.getComponent(Health);
        
        if (!enemy || !health) return false;
        if (health.isDead) return false; // Enemy is dead
        
        return enemy.isVenomous; // Keep only if still venomous
      });
    });
  });

  const handleVenomEffectComplete = (venomId: number) => {
    setVenomousEnemies(prev => prev.filter(ve => ve.id !== venomId));
  };

  return (
    <>
      {/* Venom Effects on Enemies */}
      {venomousEnemies.map(venomEffect => (
        <VenomEffect
          key={venomEffect.id}
          position={venomEffect.position}
          enemyId={venomEffect.enemyId}
          enemyData={getEnemyData()}
          duration={venomEffect.duration}
          startTime={venomEffect.startTime}
          onComplete={() => handleVenomEffectComplete(venomEffect.id)}
        />
      ))}
    </>
  );
}
