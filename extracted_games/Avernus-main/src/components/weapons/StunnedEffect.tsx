import React, { useRef, useState, useEffect, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Color } from '@/utils/three-exports';

interface StunnedEffectProps {
  position: Vector3;
  duration?: number;
  startTime?: number;
  enemyId?: string;
  onComplete?: () => void;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
    deathStartTime?: number;
  }>;
  disableCameraRotation?: boolean; // New prop to disable camera rotation during stun
}

const StunnedEffectComponent = memo(function StunnedEffect({
  position,
  duration = 4000, // 4 seconds stun duration
  startTime = Date.now(),
  enemyId,
  enemyData = [],
  onComplete,
  disableCameraRotation = false
}: StunnedEffectProps) {
  const effectRef = useRef<Group>(null);
  const [intensity, setIntensity] = useState(1);
  const [fadeProgress, setFadeProgress] = useState(1);
  const rotationSpeed = useRef(Math.random() * 0.03 + 0.02);
  const pulseSpeed = useRef(Math.random() * 0.008 + 0.006);
  const elapsedRef = useRef(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [duration, onComplete, enemyId]);

  // Handle camera rotation disable for sabre stuns
  useEffect(() => {
    if (!disableCameraRotation || !enemyId) return;

    // Disable camera rotation during stun
    const cameraSystem = (window as any).cameraSystem;
    if (cameraSystem && typeof cameraSystem.setCameraRotationDisabled === 'function') {
      cameraSystem.setCameraRotationDisabled(true, enemyId);

      // Re-enable camera rotation when stun ends
      const timeout = setTimeout(() => {
        if (cameraSystem && typeof cameraSystem.setCameraRotationDisabled === 'function') {
          cameraSystem.setCameraRotationDisabled(false, enemyId);
        }
      }, duration);

      return () => {
        clearTimeout(timeout);
        if (cameraSystem && typeof cameraSystem.setCameraRotationDisabled === 'function') {
          cameraSystem.setCameraRotationDisabled(false, enemyId);
        }
      };
    }
  }, [disableCameraRotation, enemyId, duration]);

  useFrame(() => {
    if (!effectRef.current) return;

    const currentTime = Date.now();
    const elapsed = currentTime - startTime;
    elapsedRef.current = elapsed; // Store elapsed time in ref for use in JSX
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
        targetPosition.y += 0.4; // Adjust Y offset to be at player level
        effectRef.current.position.copy(targetPosition);
      }
      // Note: If target is not found, we keep the original position passed as prop
      // This is important for PVP mode where the position is managed externally
    }

    // Fade out in the last 500ms
    if (progress > 0.875) {
      const fadeStart = 0.875;
      const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
      setFadeProgress(1 - fadeProgress);
    } else {
      setFadeProgress(1);
    }

    // Pulsing intensity effect - more aggressive than freeze
    const pulseIntensity = 0.6 + 0.4 * Math.sin(elapsed * pulseSpeed.current);
    setIntensity(pulseIntensity * fadeProgress);

    // Rotate the lightning cage
    effectRef.current.rotation.y += rotationSpeed.current;
    effectRef.current.rotation.x = Math.sin(elapsed * 0.004) * 0.15;
    effectRef.current.rotation.z = Math.cos(elapsed * 0.003) * 0.1;
  });

  return (
    <group ref={effectRef} position={position}>



      {/* Lightning bolt rings */}
      {[...Array(3)].map((_, i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 3 + Math.PI, 0]}>
          <mesh position={[0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, 1.2, 4]} />
            <meshStandardMaterial
              color={new Color(0xFFAA44)}      // Red-orange
              emissive={new Color(0xFFAA44)}
              emissiveIntensity={intensity * 1.75}
              transparent
              opacity={fadeProgress * 0.8}
            />
          </mesh>
        </group>
      ))}

      {/* Vertical lightning bolts */}
      {[...Array(4)].map((_, i) => (
        <mesh key={`vertical-${i}`}
              position={[
                0.4 * Math.cos(i * Math.PI / 2),
                0,
                0.4 * Math.sin(i * Math.PI / 2)
              ]}
              rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 2, 4]} />
          <meshStandardMaterial
            color={new Color(0xDD4444)}       // Dark red
            emissive={new Color(0xDD4444)}
            emissiveIntensity={intensity * 1}
            transparent
            opacity={fadeProgress * 0.6}
          />
        </mesh>
      ))}

      {/* Outer electric ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.05, 8, 16]} />
        <meshStandardMaterial
          color={new Color(0xFF4444)}
          emissive={new Color(0xFF4444)}
          emissiveIntensity={intensity * 5}
          transparent
          opacity={fadeProgress * 0.5}
        />
      </mesh>

      {/* Point light for illumination */}
      <pointLight
        color={new Color(0xFF4444)}
        intensity={intensity * 3}
        distance={3}
        decay={2}
      />

      {/* Electric sparks */}
      {[...Array(8)].map((_, i) => (
        <mesh key={`spark-${i}`}
              position={[
                (0.3 + Math.random() * 0.5) * Math.cos(i * Math.PI / 4),
                Math.random() * 0.4 - 0.2,
                (0.3 + Math.random() * 0.5) * Math.sin(i * Math.PI / 4)
              ]}>
          <sphereGeometry args={[0.03, 4, 4]} />
          <meshStandardMaterial
            color={new Color(0xFFFFFF)}       // White sparks
            emissive={new Color(0xFFFFFF)}
            emissiveIntensity={intensity * 6}
            transparent
            opacity={fadeProgress * Math.random() * 0.8}
          />
        </mesh>
      ))}
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
  if (!prevProps.position.equals(nextProps.position)) return false;
  if (prevProps.duration !== nextProps.duration) return false;
  if (prevProps.startTime !== nextProps.startTime) return false;
  if (prevProps.enemyId !== nextProps.enemyId) return false;
  if (prevProps.disableCameraRotation !== nextProps.disableCameraRotation) return false;
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

export default StunnedEffectComponent;
