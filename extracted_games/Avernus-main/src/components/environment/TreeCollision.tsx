import React, { useEffect, useRef } from 'react';
import { Vector3 } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Collider, ColliderType, CollisionLayer } from '@/ecs/components/Collider';
import { Entity } from '@/ecs/Entity';
import { DetailedTree } from './DetailedTrees';

interface TreeCollisionProps {
  world: World;
  trees: DetailedTree[];
}

/**
 * Creates invisible collision entities for tree trunks in the ECS world
 * This ensures players and projectiles cannot pass through tree trunks
 * Tree trunks are roughly half the diameter of pillars for collision purposes
 */
const TreeCollision: React.FC<TreeCollisionProps> = ({ world, trees }) => {
  const collisionEntitiesRef = useRef<Entity[]>([]);

  useEffect(() => {
    // Create collision entities for each tree trunk
    const entities: Entity[] = [];

    trees.forEach((tree) => {
      // Create entity for tree trunk collision
      const entity = world.createEntity();

      // Add Transform component at tree position
      const transform = world.createComponent(Transform);
      transform.setPosition(tree.position.x, tree.position.y + tree.height / 2, tree.position.z); // Center at trunk middle
      entity.addComponent(transform);

      // Add Collider component - cylinder shape to match tree trunk
      const collider = world.createComponent(Collider);
      collider.type = ColliderType.CYLINDER;
      collider.radius = 0.7; // Roughly half the pillar diameter (pillar radius is 0.7, tree trunk radius is ~0.2-0.25, collision slightly larger)
      collider.height = tree.height; // Full trunk height for collision
      collider.layer = CollisionLayer.ENVIRONMENT;
      collider.isStatic = true; // Trees don't move
      collider.isTrigger = false; // Solid collision, blocks movement
      collider.setOffset(0, 0, 0); // No offset needed
      entity.addComponent(collider);

      // Notify world that entity is ready
      world.notifyEntityAdded(entity);
      entities.push(entity);
    });

    collisionEntitiesRef.current = entities;

    // Cleanup function
    return () => {
      entities.forEach(entity => {
        if (world.getEntity(entity.id)) {
          world.destroyEntity(entity.id);
        }
      });
      collisionEntitiesRef.current = [];
    };
  }, [world, trees]);

  // This component doesn't render anything visual
  return null;
};

export default TreeCollision;
