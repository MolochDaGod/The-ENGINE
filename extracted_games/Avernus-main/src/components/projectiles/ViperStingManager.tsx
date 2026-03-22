import React, { useState, useRef, useEffect } from 'react';
import { Vector3, Group } from 'three';
import ViperSting from './ViperSting';
import ViperStingBeam from './ViperStingBeam';
import SoulStealEffect from './SoulStealEffect';
import { useViperSting } from './useViperSting';
import { useViperStingBeam } from './useViperStingBeam';

interface ViperStingManagerProps {
  parentRef: React.RefObject<Group>;
  enemyData: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
  }>;
  onHit: (targetId: string, damage: number) => void;
  setDamageNumbers: React.Dispatch<React.SetStateAction<Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isViperSting?: boolean;
    isHealing?: boolean;
  }>>>;
  nextDamageNumberId: React.MutableRefObject<number>;
  onHealthChange?: (deltaHealth: number) => void;
  charges: Array<{
    id: number;
    available: boolean;
    cooldownStartTime: number | null;
  }>;
  setCharges: React.Dispatch<React.SetStateAction<Array<{
    id: number;
    available: boolean;
    cooldownStartTime: number | null;
  }>>>;
  localSocketId?: string; // Add this to prevent self-damage
  players?: Array<{ // For PVP dynamic targeting
    id: string;
    position: { x: number; y: number; z: number };
    health: number;
  }>;
}

interface SoulStealEffect {
  id: number;
  position: Vector3;
  targetPosition: Vector3;
  startTime: number;
  duration: number;
  active: boolean;
}

// Global state for Viper Sting manager
let globalViperStingManager: {
  shootViperSting?: (position?: Vector3, direction?: Vector3, casterId?: string) => boolean;
  getProjectiles?: () => any[];
  createSoulSteal?: (enemyPosition: Vector3) => void;
} = {};

export const triggerGlobalViperSting = (position?: Vector3, direction?: Vector3, casterId?: string): boolean => {
  if (globalViperStingManager.shootViperSting) {
    return globalViperStingManager.shootViperSting(position, direction, casterId);
  }
  return false;
};

export const getGlobalViperStingProjectiles = (): any[] => {
  if (globalViperStingManager.getProjectiles) {
    return globalViperStingManager.getProjectiles();
  }
  return [];
};

export const triggerGlobalViperStingSoulSteal = (enemyPosition: Vector3): void => {
  if (globalViperStingManager.createSoulSteal) {
    globalViperStingManager.createSoulSteal(enemyPosition);
  }
};

export default function ViperStingManager({
  parentRef,
  enemyData,
  onHit,
  setDamageNumbers,
  nextDamageNumberId,
  onHealthChange,
  charges,
  setCharges,
  localSocketId,
  players
}: ViperStingManagerProps) {
  const [soulStealEffects, setSoulStealEffects] = useState<SoulStealEffect[]>([]);
  const nextSoulStealId = useRef(0);
  
  // Beam effects management
  const { activeEffects: beamEffects, createBeamEffect, removeEffect: removeBeamEffect } = useViperStingBeam();

  // Viper Sting projectile management with soul steal effect creation
  const { shootViperSting, projectilePool, soulStealEffects: viperStingSoulStealEffects, createSoulStealEffect } = useViperSting({
    parentRef,
    onHit,
    enemyData,
    setDamageNumbers,
    nextDamageNumberId,
    onHealthChange,
    createBeamEffect,
    applyDoT: (enemyId: string) => {
      // Viper Sting does not apply DoT effects - only Cobra Shot does
      // This is a no-op function to satisfy the interface
    },
    charges,
    setCharges,
    localSocketId, // Pass the local socket ID to prevent self-damage
    players // Pass players data for dynamic PVP targeting
  });

  // Register global manager
  useEffect(() => {
    globalViperStingManager.shootViperSting = shootViperSting;
    globalViperStingManager.getProjectiles = () => projectilePool.current;
    globalViperStingManager.createSoulSteal = createSoulStealEffect;

    return () => {
      globalViperStingManager = {};
    };
  }, [shootViperSting, projectilePool, createSoulStealEffect]);



  // Get current player position for soul steal effects
  const getCurrentPlayerPosition = () => {
    return parentRef.current ? parentRef.current.position.clone() : new Vector3();
  };

  return (
    <>
      {/* Viper Sting Projectiles */}
      <ViperSting projectilePool={projectilePool} />
      
      {/* Beam Effects */}
      {beamEffects.map(effect => (
        <ViperStingBeam
          key={effect.id}
          position={effect.position}
          direction={effect.direction}
          isReturning={effect.isReturning}
          onComplete={() => removeBeamEffect(effect.id)}
        />
      ))}

      {/* Soul Steal Effects */}
      {viperStingSoulStealEffects.current.map(effect => (
        <SoulStealEffect
          key={effect.id}
          id={effect.id}
          startPosition={effect.position}
          targetPosition={effect.targetPosition}
          startTime={effect.startTime}
          duration={effect.duration}
          getCurrentPlayerPosition={() => {
            // Return current player position for dynamic tracking
            if (parentRef.current) {
              return parentRef.current.position.clone();
            }
            return effect.targetPosition; // Fallback to original target
          }}
          onComplete={() => {
            // Only process healing if this is NOT PVP mode (check if onHealthChange is a real function)
            const isPVPMode = !onHealthChange || onHealthChange.toString().includes('No-op');
            
            if (!isPVPMode && onHealthChange) {
              // Non-PVP mode: Heal 20 HP when soul reaches player
              onHealthChange(20);

              // Show healing damage number
              if (parentRef.current && setDamageNumbers && typeof setDamageNumbers === 'function') {
                const healingPosition = parentRef.current.position.clone().add(new Vector3(0, 1.5, 0));
                try {
                  setDamageNumbers(prev => [...prev, {
                    id: nextDamageNumberId.current++,
                    damage: 20,
                    position: healingPosition,
                    isCritical: false,
                    isHealing: true
                  }]);
                } catch (error) {
                  // console.warn('ViperSting: Failed to add healing damage number:', error);
                }
              }
            }
            
            // Remove the effect from the array
            viperStingSoulStealEffects.current = viperStingSoulStealEffects.current.filter(e => e.id !== effect.id);
          }}
        />
      ))}
    </>
  );
}
