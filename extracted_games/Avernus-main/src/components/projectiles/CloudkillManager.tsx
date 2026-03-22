import React, { useState, useCallback, useRef } from 'react';
import { Vector3 } from 'three';
import CloudkillArrow from './CloudkillArrow';
import { Enemy } from '@/contexts/MultiplayerContext';

interface CloudkillTarget {
  position: Vector3;
  targetId: string;
  delay: number;
  casterPosition?: Vector3; // Position of the player who cast the cloudkill
}

interface CloudkillManagerProps {
  enemyData: Enemy[];
  onHit: (targetId: string, damage: number, isCritical: boolean, position: Vector3) => void;
  playerPosition: Vector3;
  onPlayerHit?: (damage: number) => void;
  players?: Array<{ id: string; position: { x: number; y: number; z: number }; isVenomed?: boolean; venomedUntil?: number }>; // For PVP - check if players have venom debuff and get their positions
  localSocketId?: string; // To exclude the casting player from targets
  // Add callback to get real-time player positions
  getCurrentPlayerPositions?: () => Array<{ id: string; position: { x: number; y: number; z: number }; health?: number }>;
}

interface ActiveCloudkill {
  id: number;
  targets: CloudkillTarget[];
  startTime: number;
}

export default function CloudkillManager({
  enemyData,
  onHit,
  playerPosition,
  onPlayerHit,
  players = [],
  localSocketId,
  getCurrentPlayerPositions
}: CloudkillManagerProps) {
  const [activeCloudkills, setActiveCloudkills] = useState<ActiveCloudkill[]>([]);
  const lastCastTime = useRef<number>(0);

  // Constants
  const ARROW_COUNT = 3;
  const ARROW_DELAY_INTERVAL = 250; // 0.3 seconds between arrows
  const COOLDOWN = 4000; // 1.5 seconds cooldown (handled by ControlSystem)

  const findClosestTargets = useCallback((count: number): Array<{ id: string; position: { x: number; y: number; z: number } }> => {
    // Combine enemies and players as potential targets
    const allTargets: Array<{ id: string; position: { x: number; y: number; z: number } }> = [];

    // Add enemies
    enemyData.forEach(enemy => {
      if (enemy.health > 0) {
        allTargets.push({
          id: enemy.id,
          position: enemy.position
        });
      }
    });

    // Add players (for PVP) - exclude the casting player
    players.forEach(player => {
      if (player.position && player.id !== localSocketId) {
        allTargets.push({
          id: player.id,
          position: player.position
        });
      }
    });

    if (allTargets.length === 0) return [];

    // Calculate distances and sort by proximity
    const targetsWithDistance = allTargets.map(target => ({
      target,
      distance: playerPosition.distanceTo(new Vector3(target.position.x, 0, target.position.z))
    }));

    targetsWithDistance.sort((a, b) => a.distance - b.distance);

    // Return up to 'count' closest targets
    return targetsWithDistance.slice(0, count).map(item => item.target);
  }, [enemyData, players, playerPosition, localSocketId]);

  const distributeArrowsToTargets = useCallback((targetCount: number): CloudkillTarget[] => {
    const closestTargets = findClosestTargets(Math.min(targetCount, ARROW_COUNT));

    if (closestTargets.length === 0) return [];

    const targets: CloudkillTarget[] = [];

    // Distribute all arrows among available targets
    for (let i = 0; i < ARROW_COUNT; i++) {
      const target = closestTargets[i % closestTargets.length];

      targets.push({
        position: new Vector3(target.position.x, 0, target.position.z),
        targetId: target.id,
        delay: i * ARROW_DELAY_INTERVAL, // Staggered delays: 0ms, 300ms, 600ms
        casterPosition: playerPosition.clone() // Use local player position as caster for self-cast
      });
    }

    return targets;
  }, [findClosestTargets, players, enemyData]);

  // Function to distribute arrows to targets from a specific caster's perspective
  const distributeArrowsToTargetsFromCaster = useCallback((casterId: string, targetCount: number): CloudkillTarget[] => {
    // Find the caster's position
    const caster = players.find(p => p.id === casterId);
    if (!caster || !caster.position) {
      return [];
    }

    const casterPosition = new Vector3(caster.position.x, caster.position.y, caster.position.z);

    // Find closest targets from caster's perspective (excluding the caster)
    const allTargets: Array<{ id: string; position: { x: number; y: number; z: number } }> = [];

    // Add enemies
    enemyData.forEach(enemy => {
      if (enemy.health > 0) {
        allTargets.push({
          id: enemy.id,
          position: enemy.position
        });
      }
    });

    // Add players (excluding the caster)
    players.forEach(player => {
      if (player.position && player.id !== casterId) {
        allTargets.push({
          id: player.id,
          position: player.position
        });
      }
    });

    if (allTargets.length === 0) {
      return [];
    }

    // Calculate distances from caster's position and sort by proximity
    const targetsWithDistance = allTargets.map(target => ({
      target,
      distance: casterPosition.distanceTo(new Vector3(target.position.x, 0, target.position.z))
    }));

    targetsWithDistance.sort((a, b) => a.distance - b.distance);

    // Get closest targets
    const closestTargets = targetsWithDistance.slice(0, Math.min(targetCount, ARROW_COUNT)).map(item => item.target);

    const targets: CloudkillTarget[] = [];

    // Distribute all arrows among available targets
    for (let i = 0; i < ARROW_COUNT; i++) {
      const target = closestTargets[i % closestTargets.length];
      const targetPosition = new Vector3(target.position.x, 0, target.position.z);

      targets.push({
        position: targetPosition,
        targetId: target.id,
        delay: i * ARROW_DELAY_INTERVAL, // Staggered delays: 0ms, 300ms, 600ms
        casterPosition: casterPosition.clone() // Store the caster's position for each target
      });
    }
    return targets;
  }, [players, enemyData, ARROW_COUNT, ARROW_DELAY_INTERVAL]);

  // Function to distribute arrows to targets from a specific caster position (for remote casts)
  const distributeArrowsToTargetsFromCasterPosition = useCallback((casterId: string, casterPosition: Vector3, targetCount: number): CloudkillTarget[] => {
    // Find closest targets from caster's perspective (excluding the caster)
    const allTargets: Array<{ id: string; position: { x: number; y: number; z: number } }> = [];

    // Add enemies
    enemyData.forEach(enemy => {
      if (enemy.health > 0) {
        allTargets.push({
          id: enemy.id,
          position: enemy.position
        });
      }
    });

    // Add players (excluding the caster)
    players.forEach(player => {
      if (player.position && player.id !== casterId) {
        allTargets.push({
          id: player.id,
          position: player.position
        });
      }
    });

    if (allTargets.length === 0) {
      return [];
    }

    // Calculate distances from caster's position and sort by proximity
    const targetsWithDistance = allTargets.map(target => ({
      target,
      distance: casterPosition.distanceTo(new Vector3(target.position.x, 0, target.position.z))
    }));

    targetsWithDistance.sort((a, b) => a.distance - b.distance);

    // Get closest targets
    const closestTargets = targetsWithDistance.slice(0, Math.min(targetCount, ARROW_COUNT)).map(item => item.target);

    const targets: CloudkillTarget[] = [];

    // Distribute all arrows among available targets
    for (let i = 0; i < ARROW_COUNT; i++) {
      const target = closestTargets[i % closestTargets.length];
      const targetPosition = new Vector3(target.position.x, 0, target.position.z);

      targets.push({
        position: targetPosition,
        targetId: target.id,
        delay: i * ARROW_DELAY_INTERVAL, // Staggered delays: 0ms, 300ms, 600ms
        casterPosition: casterPosition.clone() // Use the provided caster position
      });
    }
    return targets;
  }, [players, enemyData, ARROW_COUNT, ARROW_DELAY_INTERVAL]);

  const castCloudkill = useCallback(() => {
    const now = Date.now();
    if (now - lastCastTime.current < COOLDOWN) {
      return false;
    }

    // Check if we have any targets (enemies or players)
    const totalTargets = enemyData.length + players.length;
    if (totalTargets === 0) {
      return false; // No targets to attack
    }

    lastCastTime.current = now;

    const targets = distributeArrowsToTargets(totalTargets);

    if (targets.length === 0) {
      return false;
    }

    const cloudkillEffect: ActiveCloudkill = {
      id: Date.now(),
      targets,
      startTime: now
    };

    setActiveCloudkills(prev => [...prev, cloudkillEffect]);

    // Clean up the effect after all arrows have fallen and impacts completed
    const totalDuration = 1000 + (ARROW_COUNT - 1) * ARROW_DELAY_INTERVAL + 1500; // Extra time for impact effects
    setTimeout(() => {
      setActiveCloudkills(prev =>
        prev.filter(effect => effect.id !== cloudkillEffect.id)
      );
    }, totalDuration);

    return true;
  }, [enemyData, distributeArrowsToTargets]);

  // Special function to cast cloudkill that targets the local player (for receiving player in PVP)
  const castCloudkillTargetingLocalPlayer = useCallback((casterId: string, localPlayerPosition: Vector3) => {
    const now = Date.now();
    if (now - lastCastTime.current < COOLDOWN) {
      return false;
    }

    // Find the local player's data
    const localPlayer = players.find(p => p.id === localSocketId);
    if (!localPlayer) {
      return false;
    }

    lastCastTime.current = now;

    // Create targets that specifically target the local player
    const targets: CloudkillTarget[] = [];

    // Create arrows targeting the local player
    for (let i = 0; i < ARROW_COUNT; i++) {
      targets.push({
        position: localPlayerPosition.clone(),
        targetId: localPlayer.id,
        delay: i * ARROW_DELAY_INTERVAL, // Staggered delays: 0ms, 300ms, 600ms
        casterPosition: localPlayerPosition.clone() // Use local player position as both target and caster for visual effect
      });
    }

    const cloudkillEffect: ActiveCloudkill = {
      id: Date.now(),
      targets,
      startTime: now
    };

    setActiveCloudkills(prev => [...prev, cloudkillEffect]);

    // Clean up the effect after all arrows have fallen and impacts completed
    const totalDuration = 1000 + (ARROW_COUNT - 1) * ARROW_DELAY_INTERVAL + 1500;
    setTimeout(() => {
      setActiveCloudkills(prev =>
        prev.filter(effect => effect.id !== cloudkillEffect.id)
      );
    }, totalDuration);

    return true;
  }, [players, localSocketId, ARROW_COUNT, ARROW_DELAY_INTERVAL, COOLDOWN]);

  // Special function to cast cloudkill from a specific caster's perspective
  const castCloudkillFromCaster = useCallback((casterId: string, casterPosition?: Vector3) => {
    const now = Date.now();
    if (now - lastCastTime.current < COOLDOWN) {
      return false;
    }

    // Find targets that are enemies of the caster (all players except the caster)
    const enemyPlayers = players.filter(p => p.id !== casterId);
    const totalTargets = enemyData.length + enemyPlayers.length;
    
    if (totalTargets === 0) {
      return false;
    }

    lastCastTime.current = now;

    // Create targets from caster's perspective using provided position or lookup
    const targets = casterPosition 
      ? distributeArrowsToTargetsFromCasterPosition(casterId, casterPosition, totalTargets)
      : distributeArrowsToTargetsFromCaster(casterId, totalTargets);

    if (targets.length === 0) {
      return false;
    }

    const cloudkillEffect: ActiveCloudkill = {
      id: Date.now(),
      targets,
      startTime: now
    };

    setActiveCloudkills(prev => [...prev, cloudkillEffect]);

    // Clean up the effect after all arrows have fallen and impacts completed
    const totalDuration = 1000 + (ARROW_COUNT - 1) * ARROW_DELAY_INTERVAL + 1500;
    setTimeout(() => {
      setActiveCloudkills(prev =>
        prev.filter(effect => effect.id !== cloudkillEffect.id)
      );
    }, totalDuration);

    return true;
  }, [enemyData, players, distributeArrowsToTargetsFromCaster, distributeArrowsToTargetsFromCasterPosition, ARROW_COUNT, ARROW_DELAY_INTERVAL, COOLDOWN]);

  // Set up global trigger
  React.useEffect(() => {
    const triggerCallback = (position: Vector3, casterId: string) => {
      // Only trigger if we have targets
      const totalTargets = enemyData.length + players.filter(p => p.id !== casterId).length;

      if (totalTargets > 0) {
        // Check if this is a PVP scenario (casterId is different from local player)
        const isReceivingPlayer = localSocketId && casterId !== localSocketId;

        if (isReceivingPlayer) {
          // For the receiving player: create arrows targeting themselves at their current position
          // The position passed is the receiving player's position, and casterId is the remote player
          castCloudkillTargetingLocalPlayer(casterId, position);
        } else {
          // For the casting player: create arrows targeting other players from caster's position
          castCloudkillFromCaster(casterId, position);
        }
      }
    };

    setGlobalCloudkillTrigger(triggerCallback);

    return () => {
      setGlobalCloudkillTrigger(() => {});
    };
  }, [enemyData, players, castCloudkill, castCloudkillTargetingLocalPlayer, localSocketId]);

  const removeCloudkill = useCallback((id: number) => {
    setActiveCloudkills(prev => prev.filter(effect => effect.id !== id));
  }, []);

  const handleArrowImpact = useCallback((damage: number) => {
    if (onPlayerHit) {
      onPlayerHit(damage);
    }
  }, [onPlayerHit]);

  const handleArrowComplete = useCallback((cloudkillId: number, arrowIndex: number) => {
    // Check if this was the last arrow in the cloudkill effect
    setActiveCloudkills(prev => {
      const updated = prev.map(effect => {
        if (effect.id === cloudkillId) {
          // Mark this arrow as completed by removing its delay (simplified tracking)
          return effect;
        }
        return effect;
      });

      return updated;
    });
  }, []);

  return (
    <>
      {activeCloudkills.map((cloudkill) => (
        <React.Fragment key={cloudkill.id}>
          {cloudkill.targets.map((target, index) => (
            <CloudkillArrow
              key={`${cloudkill.id}-${index}`}
              targetId={target.targetId}
              initialTargetPosition={target.position}
              onImpact={handleArrowImpact}
              onComplete={() => handleArrowComplete(cloudkill.id, index)}
              playerPosition={target.casterPosition || playerPosition}
              enemyData={enemyData}
              onHit={onHit}
              players={players}
              getCurrentPlayerPositions={getCurrentPlayerPositions}
              localSocketId={localSocketId}
            />
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

// Hook for managing Cloudkill effects
export function useCloudkillManager({ enemyData, playerPosition }: {
  enemyData: Enemy[];
  playerPosition: Vector3;
}) {
  const [activeCloudkills, setActiveCloudkills] = useState<ActiveCloudkill[]>([]);
  const lastCastTime = useRef<number>(0);

  const castCloudkill = useCallback(() => {
    // Implementation similar to the component above
    // This hook version can be used for external control
    const now = Date.now();
    if (now - lastCastTime.current < 1500) { // 1.5s cooldown
      return false;
    }

    // Basic implementation - can be expanded
    lastCastTime.current = now;
    return true;
  }, []);

  return {
    activeCloudkills,
    castCloudkill,
    removeCloudkill: (id: number) => setActiveCloudkills(prev => prev.filter(c => c.id !== id))
  };
}

// Global trigger mechanism for PVP Cloudkill
let globalCloudkillTrigger: ((position: Vector3, casterId: string) => void) | null = null;

export const setGlobalCloudkillTrigger = (callback: (position: Vector3, casterId: string) => void) => {
  globalCloudkillTrigger = callback;
};

export const triggerGlobalCloudkill = (position: Vector3, casterId: string) => {
  if (globalCloudkillTrigger) {
    globalCloudkillTrigger(position, casterId);
  }
};

export const triggerGlobalCloudkillWithTargets = (targetPositions: Array<{ x: number; y: number; z: number }>, casterId: string) => {
  if (globalCloudkillTrigger) {
    // For each target position, trigger cloudkill at that specific location
    targetPositions.forEach(targetPos => {
      const position = new Vector3(targetPos.x, targetPos.y, targetPos.z);
      globalCloudkillTrigger!(position, casterId);
    });
  }
};
