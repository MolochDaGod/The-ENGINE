import React, { useRef, useEffect, useState } from 'react';
import { Group, Vector3 } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface FrozenEffectProps {
  position: Vector3;
  duration?: number;
  startTime?: number;
  enemyId?: string;
  onComplete?: () => void;
  // For tracking enemy position updates
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
    deathStartTime?: number;
  }>;
}

export default function FrozenEffect({ 
  position, 
  duration = 5000, // 5 seconds freeze duration
  startTime = Date.now(),
  enemyId,
  enemyData = [],
  onComplete 
}: FrozenEffectProps) {
  const effectRef = useRef<Group>(null);
  const [intensity, setIntensity] = useState(1);
  const [fadeProgress, setFadeProgress] = useState(1);
  const rotationSpeed = useRef(Math.random() * 0.02 + 0.01);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [duration, onComplete, enemyId]);

  useFrame(() => {
    if (!effectRef.current) return;

    const currentTime = Date.now();
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Safety check: if effect has exceeded its duration, trigger completion
    if (progress >= 1 && onComplete) {
      onComplete();
      return;
    }

    // Update position to follow enemy if enemyId is provided
    if (enemyId && enemyData.length > 0) {
      const target = enemyData.find(enemy => enemy.id === enemyId);
      
      if (target && target.health > 0 && !target.isDying && !target.deathStartTime) {
        // Update the group position to follow the enemy
        const targetPosition = target.position.clone();
        targetPosition.y += 0.5; // Adjust Y offset to be at player level
        effectRef.current.position.copy(targetPosition);
      }
      // Note: If target is not found, we keep the original position passed as prop
      // This is important for PVP mode where the position is managed externally
    }

    // Fade out in the last 500ms
    if (progress > 0.9) {
      const fadeStart = 0.9;
      const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
      setFadeProgress(1 - fadeProgress);
    } else {
      setFadeProgress(1);
    }

    // Pulsing intensity effect
    const pulseIntensity = 0.8 + 0.2 * Math.sin(elapsed * 0.005);
    setIntensity(pulseIntensity * fadeProgress);

    // Rotate the ice crystal
    effectRef.current.rotation.y += rotationSpeed.current;
    effectRef.current.rotation.x = Math.sin(elapsed * 0.003) * 0.1;
  });

  return (
    <group ref={effectRef} position={position}>
      {/* Ice prison base */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.8, 0.9, 0.5, 8]} />
        <meshStandardMaterial
          color="#B3E5FC"
          emissive="#81D4FA"
          emissiveIntensity={0.3 * intensity}
          transparent
          opacity={0.7 * fadeProgress}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      {/* Main ice crystal */}
      <mesh position={[0, 0.95, 0]}>
        <octahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial
          color="#E1F5FE"
          emissive="#4FC3F7"
          emissiveIntensity={0.5 * intensity}
          transparent
          opacity={0.8 * fadeProgress}
          roughness={0.05}
          metalness={0.1}
        />
      </mesh>

      {/* Ice shards around the crystal */}
      {[...Array(6)].map((_, i) => (
        <group
          key={i}
          rotation={[0, (i * Math.PI) / 3, 0]}
          position={[
            Math.cos((i * Math.PI) / 3) * 0.7,
            -0.2 + Math.sin(i) * 0.3,
            Math.sin((i * Math.PI) / 3) * 0.7
          ]}
        >
          <mesh rotation={[Math.PI / 6, 0, Math.PI / 4]}>
            <octahedronGeometry args={[0.25, 0]} />
            <meshStandardMaterial
              color="#B3E5FC"
              emissive="#29B6F6"
              emissiveIntensity={0.4 * intensity}
              transparent
              opacity={0.6 * fadeProgress}
              roughness={0.1}
              metalness={0.15}
            />
          </mesh>
        </group>
      ))}

      {/* Ice particles */}
      {[...Array(12)].map((_, i) => (
        <mesh
          key={`particle-${i}`}
          position={[
            (Math.random() - 0.5) * 2,
            Math.random() * 2.5 - 0.2,
            (Math.random() - 0.5) * 2
          ]}
          rotation={[
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
          ]}
        >
          <octahedronGeometry args={[0.05 + Math.random() * 0.1, 0]} />
          <meshStandardMaterial
            color="#E1F5FE"
            emissive="#4FC3F7"
            emissiveIntensity={0.8 * intensity}
            transparent
            opacity={0.4 * fadeProgress}
          />
        </mesh>
      ))}

      {/* Frost rings */}
      {[...Array(3)].map((_, i) => (
        <mesh 
          key={`ring-${i}`}
          position={[0, -0.0 + i * 0.2, 0]}
          rotation={[Math.PI / 2, 0, (i * Math.PI) / 4]}
        >
          <torusGeometry args={[0.6 + i * 0.25, 0.05, 8, 32]} />
          <meshStandardMaterial
            color="#B3E5FC"
            emissive="#29B6F6"
            emissiveIntensity={0.6 * intensity}
            transparent
            opacity={0.5 * fadeProgress}
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>
      ))}

      {/* Ice glow effect */}
      <mesh>
        <sphereGeometry args={[1.0, 16, 16]} />
        <meshStandardMaterial
          color="#E1F5FE"
          emissive="#4FC3F7"
          emissiveIntensity={0.2 * intensity}
          transparent
          opacity={0.4 * fadeProgress}
        />
      </mesh>

      {/* Point light for ice glow */}
      <pointLight 
        color="#4FC3F7" 
        intensity={3 * intensity * fadeProgress} 
        distance={6} 
        position={[0, 1, 0]}
      />
    </group>
  );
}
