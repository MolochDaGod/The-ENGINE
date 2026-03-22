import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Mesh, Material, AdditiveBlending } from '@/utils/three-exports';

interface ExplosionEffectProps {
  position: Vector3;
  onComplete: () => void;
  color?: Color;
  size?: number;
  duration?: number;
}

export default function ExplosionEffect({ 
  position, 
  onComplete, 
  color = new Color('#00ff44'),
  size = 0.15,
  duration = 0.5
}: ExplosionEffectProps) {
  const ringRef = useRef<Mesh>(null);
  const startTime = useRef<number | null>(null);

  useFrame((state) => {
    if (!ringRef.current) return;

    if (startTime.current === null) {
      startTime.current = state.clock.getElapsedTime();
    }

    const elapsed = (state.clock.getElapsedTime() - startTime.current) / duration;
    
    if (elapsed >= 1.0) {
      onComplete();
      return;
    }

    // Animate ring expansion and fade
    const scale = 1 + elapsed * 3; // Expand to 4x original size
    const fade = Math.max(0, 1 - elapsed);
    
    ringRef.current.scale.setScalar(scale);
    
    if (ringRef.current.material instanceof Material) {
      const material = ringRef.current.material as any;
      material.opacity = fade * 0.8;
      material.emissiveIntensity = fade * 1.5;
    }
  });

  return (
    <mesh ref={ringRef} position={position}>
      <torusGeometry args={[size * 2, size * 0.3, 8, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.5}
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
