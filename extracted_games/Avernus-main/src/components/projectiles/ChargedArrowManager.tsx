import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Projectile } from '@/ecs/components/Projectile';
import { Renderer } from '@/ecs/components/Renderer';
import ChargedArrow from './ChargedArrow';
import { Vector3 } from '@/utils/three-exports';

interface ChargedArrowData {
  id: number;
  position: Vector3;
  direction: Vector3;
  entityId: number;
}

interface ChargedArrowManagerProps {
  world: World;
}

export default function ChargedArrowManager({ world }: ChargedArrowManagerProps) {
  const [activeArrows, setActiveArrows] = useState<ChargedArrowData[]>([]);
  const arrowIdCounter = useRef(0);
  const lastUpdateTime = useRef(0);

  useFrame((state) => {
    // Throttle updates to avoid excessive re-renders
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.016) return; // ~60fps
    lastUpdateTime.current = currentTime;

    if (!world) return;

    const projectileEntities = world.queryEntities([Transform, Projectile, Renderer]);
    const newArrows: ChargedArrowData[] = [];

    for (const entity of projectileEntities) {
      const renderer = entity.getComponent(Renderer);
      const transform = entity.getComponent(Transform);
      const projectile = entity.getComponent(Projectile);

      if (renderer?.mesh?.userData?.isChargedArrow && transform && projectile) {
        // Check if this arrow already exists
        const existingArrow = activeArrows.find(arrow => arrow.entityId === entity.id);
        
        if (existingArrow) {
          // Update existing arrow position - this ensures the visual follows the ECS entity
          existingArrow.position.copy(transform.position);
          newArrows.push(existingArrow);
        } else {
          // Create new arrow
          const direction = renderer.mesh.userData.direction || projectile.velocity.clone().normalize();
          newArrows.push({
            id: arrowIdCounter.current++, 
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id
          });
        }
      }
    }

    // Update state if arrows have changed
    if (newArrows.length !== activeArrows.length || 
        newArrows.some(arrow => !activeArrows.find(existing => existing.entityId === arrow.entityId))) {
      setActiveArrows(newArrows);
    }
  });

  const handleArrowImpact = (arrowId: number) => {
    // console.log(`🏹 ChargedArrow ${arrowId} impact handled`);
    // Impact effects could be added here
  };

  return (
    <group name="charged-arrow-manager">
      {activeArrows.map((arrowData) => (
        <ChargedArrow
          key={arrowData.id}
          position={arrowData.position}
          direction={arrowData.direction}
          onImpact={() => handleArrowImpact(arrowData.id)}
        />
      ))}
    </group>
  );
}
