import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { World } from '@/ecs/World';
import { Entity } from '@/ecs/Entity';
import { Enemy, EnemyType } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Renderer } from '@/ecs/components/Renderer';
import EliteRenderer from './EliteRenderer';

interface EliteEnemyManagerProps {
  world: World;
}

export default function EliteEnemyManager({ world }: EliteEnemyManagerProps) {
  const eliteEntitiesRef = useRef<number[]>([]);

  useFrame(() => {
    // Get all entities with Enemy, Transform, and Renderer components
    const entities = world.queryEntities([Enemy, Transform, Renderer]);
    
    const currentEliteIds = entities
      .filter((entity: Entity) => {
        const enemy = entity.getComponent(Enemy)!;
        return enemy.type === EnemyType.ELITE;
      })
      .map((entity: Entity) => entity.id);

    eliteEntitiesRef.current = currentEliteIds;
  });

  return (
    <>
      {eliteEntitiesRef.current.map(entityId => {
        const entity = world.getEntity(entityId);
        if (!entity) return null;

        const transform = entity.getComponent(Transform);
        if (!transform) return null;

        return (
          <EliteRenderer
            key={entityId}
            entityId={entityId}
            position={transform.position}
            world={world}
          />
        );
      })}
    </>
  );
}
