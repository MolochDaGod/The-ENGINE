import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color } from '@/utils/three-exports';
import ExplosionEffect from './ExplosionEffect';
import { World } from '@/ecs/World';

interface ExplosionData {
  id: number;
  position: Vector3;
  color: Color;
  size: number;
  duration: number;
}

interface ExplosionManagerProps {
  world: World;
}

export default function ExplosionManager({ world }: ExplosionManagerProps) {
  const [activeExplosions, setActiveExplosions] = useState<ExplosionData[]>([]);
  const explosionIdCounter = useRef(0);
  const lastUpdateTime = useRef(0);

  // Listen for explosion events from the world
  useFrame((state) => {
    // Throttle updates
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.016) return; // ~60fps
    lastUpdateTime.current = currentTime;

    if (!world) return;

    // Check for new explosion events
    const explosionEvents = world.getEvents?.('explosion') || [];
    
    for (const event of explosionEvents) {
      const newExplosion: ExplosionData = {
        id: explosionIdCounter.current++,
        position: event.position.clone(),
        color: event.color || new Color('#00ff44'),
        size: event.size || 1,
        duration: event.duration || 2
      };
      
      setActiveExplosions(prev => [...prev, newExplosion]);
    }

    // Clear processed events
    if (explosionEvents.length > 0) {
      world.clearEvents?.('explosion');
    }
  });

  const handleExplosionComplete = (explosionId: number) => {
    setActiveExplosions(prev => prev.filter(explosion => explosion.id !== explosionId));
  };

  return (
    <>
      {activeExplosions.map(explosion => (
        <ExplosionEffect
          key={explosion.id}
          position={explosion.position}
          color={explosion.color}
          size={explosion.size}
          duration={explosion.duration}
          onComplete={() => handleExplosionComplete(explosion.id)}
        />
      ))}
    </>
  );
}
