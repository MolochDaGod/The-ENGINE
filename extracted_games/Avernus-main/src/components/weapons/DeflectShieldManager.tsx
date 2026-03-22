import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import DeflectShield from './DeflectShield';

interface DeflectShieldEffect {
  id: number;
  position: Vector3;
  rotation: Vector3;
  startTime: number;
  duration: number;
  playerId?: string; // For PVP tracking
}

interface DeflectShieldManagerProps {
  // No additional props needed for visual-only manager
}

// Global state for Deflect Shield effects
let globalDeflectShieldEffects: DeflectShieldEffect[] = [];
let nextDeflectShieldId = 1;

// Global functions for triggering Deflect Shield effects
export function triggerGlobalDeflectShield(position: Vector3, rotation: Vector3, playerId?: string): number {
  const effect: DeflectShieldEffect = {
    id: nextDeflectShieldId++,
    position: position.clone(),
    rotation: rotation.clone(),
    startTime: Date.now(),
    duration: 3250, // 3 seconds
    playerId
  };
  
  globalDeflectShieldEffects.push(effect);
  return effect.id;
}

export function getActiveDeflectShields(): DeflectShieldEffect[] {
  return globalDeflectShieldEffects;
}

export function clearDeflectShieldEffect(id: number): void {
  globalDeflectShieldEffects = globalDeflectShieldEffects.filter(effect => effect.id !== id);
}

export default function DeflectShieldManager({ }: DeflectShieldManagerProps) {
  const [activeEffects, setActiveEffects] = useState<DeflectShieldEffect[]>([]);

  useFrame(() => {
    // Sync with global state
    const now = Date.now();
    const currentEffects = globalDeflectShieldEffects.filter(effect => 
      now - effect.startTime < effect.duration
    );
    
    // Remove expired effects from global state
    globalDeflectShieldEffects = currentEffects;
    
    // Update local state
    setActiveEffects(currentEffects);
  });

  return (
    <>
      {activeEffects.map(effect => (
        <DeflectShield
          key={effect.id}
          isActive={true}
          duration={effect.duration / 1000} // Convert to seconds
          playerPosition={effect.position}
          playerRotation={effect.rotation}
          onComplete={() => {
            clearDeflectShieldEffect(effect.id);
          }}
        />
      ))}
    </>
  );
}
