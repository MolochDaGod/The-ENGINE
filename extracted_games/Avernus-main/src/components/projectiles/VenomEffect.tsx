'use client';

import React, { useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Mesh, MeshStandardMaterial, AdditiveBlending } from '@/utils/three-exports';

interface VenomEffectProps {
  position: Vector3;
  onComplete: () => void;
  duration?: number;
  startTime?: number;
  enemyId?: string;
  // For tracking enemy position updates
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
    deathStartTime?: number;
  }>;
}

const VenomEffectComponent = memo(function VenomEffect({
  position,
  onComplete,
  duration = 1000, // 1 second per pulse
  startTime = Date.now(),
  enemyId,
  enemyData = []
}: VenomEffectProps) {
  const groupRef = useRef<Group>(null);
  const startTimeRef = useRef(startTime);
  
  useFrame(() => {
    if (!groupRef.current) return;
    
    const currentTime = Date.now();
    const elapsed = currentTime - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);

    // Update position to follow enemy if enemyId is provided
    if (enemyId && enemyData.length > 0) {
      const target = enemyData.find(enemy => enemy.id === enemyId);
      
      if (target && target.health > 0 && !target.isDying && !target.deathStartTime) {
        // Update the group position to follow the enemy
        const targetPosition = target.position.clone();
        targetPosition.y += 1; // Keep the same Y offset as originally set
        groupRef.current.position.copy(targetPosition);
      }
    }
    
    // Scale effect and fade out
    const scale = 1 + progress * 1.5;
    groupRef.current.scale.set(scale, scale, scale);
    
    // Apply opacity with pulsing effect for persistent venom
    const pulseOpacity = enemyId ? 
      0.8 + 0.2 * Math.sin(elapsed * 0.01) : // Persistent pulsing for enemy effects
      1 - progress; // Fade out for one-time effects
    
    groupRef.current.children.forEach(child => {
      if (child instanceof Mesh) {
        const material = child.material as MeshStandardMaterial;
        if (material.opacity !== undefined) {
          material.opacity = pulseOpacity;
        }
      }
    });
    
    // Remove when complete (only for non-persistent effects)
    if (progress >= 1 && !enemyId) {
      onComplete();
    }
  });
  
  // Randomize rotation for variety
  const randomRotation = useRef(Math.random() * Math.PI * 2);
  
  return (
    <group 
      ref={groupRef} 
      position={[position.x, position.y + 1, position.z]}
      rotation={[0, randomRotation.current, 0]}
    >
      {/* Main venom cloud */}
      <mesh>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial 
          color="#00FF44"
          emissive="#00FF44"
          emissiveIntensity={1.5}
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      
      {/* Inner toxic core */}
      <mesh>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial 
          color="#33FF33"
          emissive="#33FF33"
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      
      {/* Toxic tendrils */}
      {[...Array(6)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const radiusX = 0.3 + Math.random() * 0.2;
        const radiusZ = 0.3 + Math.random() * 0.2;
        return (
          <mesh 
            key={i}
            position={[
              Math.cos(angle) * radiusX,
              Math.random() * 0.4 - 0.2,
              Math.sin(angle) * radiusZ
            ]}
          >
            <sphereGeometry args={[0.15 + Math.random() * 0.1, 8, 8]} />
            <meshStandardMaterial 
              color="#00BB33"
              emissive="#00BB33"
              emissiveIntensity={1.5}
              transparent
              opacity={0.7}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}
      
      {/* Toxic particles */}
      {[...Array(10)].map((_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.5;
        const height = Math.random() * 0.4 - 0.2;
        return (
          <mesh 
            key={`particle-${i}`}
            position={[
              Math.cos(angle) * radius,
              height,
              Math.sin(angle) * radius
            ]}
          >
            <sphereGeometry args={[0.05 + Math.random() * 0.04, 6, 6]} />
            <meshStandardMaterial 
              color={i % 2 === 0 ? "#00FF44" : "#55FF00"}
              emissive={i % 2 === 0 ? "#00FF44" : "#55FF00"}
              emissiveIntensity={2}
              transparent
              opacity={0.8}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}
      
      {/* Venom glow light */}
      <pointLight color="#00FF44" intensity={1.5} distance={3} decay={2} />
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
  if (!prevProps.position.equals(nextProps.position)) return false;
  if (prevProps.duration !== nextProps.duration) return false;
  if (prevProps.startTime !== nextProps.startTime) return false;
  if (prevProps.enemyId !== nextProps.enemyId) return false;
  if ((prevProps.enemyData?.length || 0) !== (nextProps.enemyData?.length || 0)) return false;

  if (prevProps.enemyData && nextProps.enemyData) {
    for (let i = 0; i < prevProps.enemyData.length; i++) {
      const prev = prevProps.enemyData[i];
      const next = nextProps.enemyData[i];
      if (!prev || !next) return false;
      if (prev.id !== next.id || prev.health !== next.health || !prev.position.equals(next.position) ||
          prev.isDying !== next.isDying || prev.deathStartTime !== next.deathStartTime) {
        return false;
      }
    }
  }

  return true;
});

export default VenomEffectComponent;
