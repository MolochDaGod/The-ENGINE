import React, { useRef } from 'react';
import { Group, Vector3 } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface HauntedSoulEffectProps {
  position: Vector3;
  onComplete?: () => void;
}

export default function HauntedSoulEffect({ position, onComplete }: HauntedSoulEffectProps) {
  const soulRef = useRef<Group>(null);
  const progressRef = useRef(0);
  const startPosition = useRef(position.clone());

  useFrame((_, delta) => {
    if (!soulRef.current) return;

    progressRef.current += delta * 2; // Speed of the soul rising

    if (progressRef.current >= 1) {
      // Effect complete
      if (onComplete) {
        onComplete();
      }
      return;
    }

    // Move the soul upwards in a curved path
    const height = progressRef.current * 8; // Rise 8 units up
    const horizontalDrift = Math.sin(progressRef.current * Math.PI * 2) * 0.5; // Slight horizontal drift

    soulRef.current.position.set(
      startPosition.current.x + horizontalDrift,
      startPosition.current.y + height,
      startPosition.current.z
    );

    // Fade out as it rises
    const opacity = 1 - progressRef.current;
    // The opacity will be applied to the materials in the JSX below
  });

  return (
    <group ref={soulRef} position={[startPosition.current.x, startPosition.current.y, startPosition.current.z]}>
      {/* Main soul orb */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color="#4a148c"
          transparent
          opacity={1 - progressRef.current}
          emissive="#6a1b9a"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Inner glowing core */}
      <mesh>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial
          color="#ba68c8"
          transparent
          opacity={1 - progressRef.current}
          emissive="#e1bee7"
          emissiveIntensity={1.0}
        />
      </mesh>

      {/* Particle trail effect */}
      <group>
        {Array.from({ length: 5 }, (_, i) => {
          const angle = (i / 5) * Math.PI * 2;
          const radius = 0.2;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const y = (progressRef.current - i * 0.1) * 2;

          if (y < 0) return null;

          return (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[0.05, 6, 6]} />
              <meshStandardMaterial
                color="#9c27b0"
                transparent
                opacity={(1 - progressRef.current) * 0.7}
                emissive="#ce93d8"
                emissiveIntensity={0.3}
              />
            </mesh>
          );
        })}
      </group>

      {/* Spectral wisps */}
      {Array.from({ length: 3 }, (_, i) => {
        const angle = (i / 3) * Math.PI * 2 + progressRef.current * Math.PI;
        const radius = 0.4 + Math.sin(progressRef.current * Math.PI * 3) * 0.1;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return (
          <mesh key={`wisp-${i}`} position={[x, progressRef.current * 6, z]}>
            <planeGeometry args={[0.1, 0.8]} />
            <meshStandardMaterial
              color="#7b1fa2"
              transparent
              opacity={(1 - progressRef.current) * 0.4}
              emissive="#ab47bc"
              emissiveIntensity={0.2}
              side={2} // DoubleSide
            />
          </mesh>
        );
      })}
    </group>
  );
}
