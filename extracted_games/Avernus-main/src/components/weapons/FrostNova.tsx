import React, { useRef, useEffect, useState } from 'react';
import { Group, Vector3, Color } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface FrostNovaProps {
  position: Vector3;
  duration?: number;
  startTime?: number;
  onComplete?: () => void;
}

export default function FrostNova({ 
  position, 
  duration = 1500, // 2 seconds for the explosion effect
  startTime = Date.now(),
  onComplete 
}: FrostNovaProps) {
  const effectRef = useRef<Group>(null);
  const [intensity, setIntensity] = useState(1);
  const [fadeProgress, setFadeProgress] = useState(1);
  const [expansionProgress, setExpansionProgress] = useState(0);
  const rotationSpeed = useRef(Math.random() * 0.05 + 0.02);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [duration, onComplete]);

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

    // Expansion phase (first 30% of duration)
    if (progress < 0.3) {
      const expansionPhase = progress / 0.3;
      setExpansionProgress(expansionPhase);
    } else {
      setExpansionProgress(1);
    }

    // Fade out in the last 40% of duration
    if (progress > 0.6) {
      const fadeStart = 0.6;
      const fadePhase = (progress - fadeStart) / (1 - fadeStart);
      setFadeProgress(1 - fadePhase);
    } else {
      setFadeProgress(1);
    }

    // Pulsing intensity effect
    const pulseIntensity = 0.7 + 0.3 * Math.sin(elapsed * 0.008);
    setIntensity(pulseIntensity * fadeProgress);

    // Rotate the entire effect
    effectRef.current.rotation.y += rotationSpeed.current;
    effectRef.current.rotation.x = Math.sin(elapsed * 0.002) * 0.1;
  });

  // Calculate scale based on expansion progress
  const baseScale = 0.1 + (expansionProgress * 2.5); // Expands from 0.25 to 4 units radius (half size)
  const ringScale = baseScale * 1.15;

  return (
    <group ref={effectRef} position={position}>
      {/* Central ice explosion core */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[1 * baseScale, 16, 16]} />
        <meshStandardMaterial
          color="#B3E5FC"
          emissive="#4FC3F7"
          emissiveIntensity={0.8 * intensity}
          transparent
          opacity={0.3 * fadeProgress}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      {/* Ice crystal spikes radiating outward */}
      {[...Array(12)].map((_, i) => {
        const angle = (i * Math.PI * 2) / 12;
        const radius = baseScale * 0.8;
        return (
          <group
            key={i}
            rotation={[0, angle, 0]}
            position={[
              Math.cos(angle) * radius,
              0,
              Math.sin(angle) * radius
            ]}
          >
            <mesh rotation={[Math.PI / 6, 0, 0]}>
              <octahedronGeometry args={[0.4 * baseScale, 0]} />
              <meshStandardMaterial
                color="#E1F5FE"
                emissive="#29B6F6"
                emissiveIntensity={0.6 * intensity}
                transparent
                opacity={0.8 * fadeProgress}
                roughness={0.05}
                metalness={0.15}
              />
            </mesh>
          </group>
        );
      })}

      {/* Frost rings expanding outward */}
      {[...Array(4)].map((_, i) => (
        <mesh 
          key={`ring-${i}`}
          position={[0, 0.1 + i * 0.15, 0]}
          rotation={[Math.PI / 2, 0, (i * Math.PI) / 6]}
          scale={[ringScale * (0.8 + i * 0.2), ringScale * (0.8 + i * 0.2), 1]}
        >
          <torusGeometry args={[1, 0.08, 8, 32]} />
          <meshStandardMaterial
            color="#B3E5FC"
            emissive="#29B6F6"
            emissiveIntensity={0.7 * intensity}
            transparent
            opacity={0.6 * fadeProgress * (1 - i * 0.2)}
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>
      ))}

      {/* Ice particles scattered around */}
      {[...Array(24)].map((_, i) => {
        const angle = (i * Math.PI * 2) / 24;
        const radius = baseScale * (0.6 + Math.random() * 0.4);
        return (
          <mesh
            key={`particle-${i}`}
            position={[
              Math.cos(angle) * radius + (Math.random() - 0.5) * 2,
              Math.random() * 2 + 0.2,
              Math.sin(angle) * radius + (Math.random() - 0.5) * 2
            ]}
            rotation={[
              Math.random() * Math.PI,
              Math.random() * Math.PI,
              Math.random() * Math.PI
            ]}
          >
            <octahedronGeometry args={[0.08 + Math.random() * 0.12, 0]} />
            <meshStandardMaterial
              color="#E1F5FE"
              emissive="#4FC3F7"
              emissiveIntensity={0.9 * intensity}
              transparent
              opacity={0.5 * fadeProgress}
            />
          </mesh>
        );
      })}

      {/* Ground frost effect */}
      <mesh position={[0, -0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[baseScale * 1.1, 32]} />
        <meshStandardMaterial
          color="#E1F5FE"
          emissive="#4FC3F7"
          emissiveIntensity={0.3 * intensity}
          transparent
          opacity={0.4 * fadeProgress}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Central bright light */}
      <pointLight 
        color="#4FC3F7" 
        intensity={8 * intensity * fadeProgress} 
        distance={baseScale * 2} 
        position={[0, 1, 0]}
      />

      {/* Ambient frost glow */}
      <pointLight 
        color="#B3E5FC" 
        intensity={3 * intensity * fadeProgress} 
        distance={baseScale * 3} 
        position={[0, 0.5, 0]}
      />
    </group>
  );
}
