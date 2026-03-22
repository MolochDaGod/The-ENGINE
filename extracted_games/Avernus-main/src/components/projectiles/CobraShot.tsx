'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from '@/utils/three-exports';

export interface CobraShotProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  active: boolean;
  startTime: number;
  hitEnemies: Set<number>;
  opacity: number;
  fadeStartTime: number | null;
}

interface CobraShotProps {
  projectilePool: CobraShotProjectile[];
}

const CobraShotProjectileVisual: React.FC<{ projectile: CobraShotProjectile }> = ({ projectile }) => {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    // Update position
    groupRef.current.position.copy(projectile.position);

    // Calculate rotation based on direction (similar to ViperSting)
    const lookDirection = projectile.direction.clone().normalize();
    const rotationY = Math.atan2(lookDirection.x, lookDirection.z);
    const rotationX = Math.atan2(-lookDirection.y, Math.sqrt(lookDirection.x * lookDirection.x + lookDirection.z * lookDirection.z));
    
    // Apply rotation
    groupRef.current.rotation.set(rotationX, rotationY, 0);
  });

  if (!projectile.active) return null;

  return (
    <group ref={groupRef}>


      {/* Point light for green glow effect */}
      <pointLight
        color="#00ff40"
        intensity={2 * projectile.opacity}
        distance={3}
        decay={2}
      />
    </group>
  );
};

export default function CobraShot({ projectilePool }: CobraShotProps) {
  return (
    <>
      {projectilePool.map(projectile => (
        <CobraShotProjectileVisual key={projectile.id} projectile={projectile} />
      ))}
    </>
  );
}
