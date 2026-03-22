import { useCallback, useRef, useEffect } from 'react';
import { Vector3, Group } from 'three';

interface ViperStingProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  active: boolean;
  startTime: number;
  hitEnemies: Set<string>;
  opacity: number;
  fadeStartTime: number | null;
  isReturning: boolean;
  returnHitEnemies: Set<string>;
  casterId?: string; // For PVP: remember which player cast this projectile
  casterPosition?: Vector3; // For PVP: remember the caster's position for return
}

interface SoulStealEffect {
  id: number;
  position: Vector3;
  targetPosition: Vector3;
  startTime: number;
  duration: number;
  active: boolean;
}

interface UseViperStingProps {
  parentRef: React.RefObject<Group>;
  onHit: (targetId: string, damage: number) => void;
  enemyData: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
  }>;
  setDamageNumbers: React.Dispatch<React.SetStateAction<Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isViperSting?: boolean;
  }>>>;
  nextDamageNumberId: React.MutableRefObject<number>;
  onHealthChange?: (deltaHealth: number) => void;
  createBeamEffect?: (position: Vector3, direction: Vector3, isReturning?: boolean) => void;
  applyDoT?: (enemyId: string) => void;
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
  localSocketId?: string; // Add this to properly identify local player
  players?: Array<{ // For PVP dynamic targeting
    id: string;
    position: { x: number; y: number; z: number };
    health: number;
  }>;
}

export function useViperSting({
  parentRef,
  onHit,
  enemyData,
  setDamageNumbers,
  nextDamageNumberId,
  onHealthChange,
  createBeamEffect,
  applyDoT,
  charges,
  setCharges,
  localSocketId,
  players
}: UseViperStingProps) {
  const projectilePool = useRef<ViperStingProjectile[]>([]);
  const soulStealEffects = useRef<SoulStealEffect[]>([]);
  const lastShotTime = useRef(0);
  const nextProjectileId = useRef(0);
  const nextSoulStealId = useRef(0);
  
  const POOL_SIZE = 3;
  const SHOT_COOLDOWN = 2000; // 7 seconds
  const PROJECTILE_SPEED = 0.625; // Slightly faster than regular arrows
  const PROJECTILE_RETURN_SPEED = 0.525; // Slightly slower for return phase
  const DAMAGE = 61;
  const MAX_DISTANCE = 20; // Reduced max distance for return mechanic
  const FADE_DURATION = 350;
  const SOUL_STEAL_DURATION = 1250; // 1.25 seconds to travel back

  // Initialize projectile pool
  useEffect(() => {
    projectilePool.current = Array(POOL_SIZE).fill(null).map((_, index) => ({
      id: index,
      position: new Vector3(),
      direction: new Vector3(),
      startPosition: new Vector3(),
      maxDistance: MAX_DISTANCE,
      active: false,
      startTime: 0,
      hitEnemies: new Set(),
      opacity: 1,
      fadeStartTime: null,
      isReturning: false,
      returnHitEnemies: new Set()
    }));
  }, []);

  const getInactiveProjectile = useCallback(() => {
    return projectilePool.current.find(p => !p.active);
  }, []);

  const shootViperSting = useCallback((overridePosition?: Vector3, overrideDirection?: Vector3, casterId?: string) => {
    const now = Date.now();
    if (now - lastShotTime.current < SHOT_COOLDOWN) return false;

    // Use override parameters if provided (for PVP remote player effects)
    let unitPosition: Vector3;
    let direction: Vector3;
    
    if (overridePosition && overrideDirection) {
      // PVP mode: use provided position and direction from remote player
      unitPosition = overridePosition.clone();
      direction = overrideDirection.clone().normalize();
    } else {
      // Local mode: use parentRef
      if (!parentRef.current) return false;
      
      unitPosition = parentRef.current.position.clone();
      unitPosition.y += 0; // Shoot from chest level

      direction = new Vector3(0, 0, 1);
      // Check if quaternion exists and is a proper Three.js Quaternion
      if (parentRef.current.quaternion && typeof parentRef.current.quaternion.x === 'number') {
        direction.applyQuaternion(parentRef.current.quaternion);
      } else {
        // Fallback: use forward direction (for PVP mode where we don't have proper quaternion)
        direction.set(0, 0, 1);
      }
    }

    const projectile = getInactiveProjectile();
    if (!projectile) return false;

    lastShotTime.current = now;

    projectile.position.copy(unitPosition);
    projectile.direction.copy(direction);
    projectile.startPosition.copy(unitPosition);
    projectile.startTime = now;
    projectile.active = true;
    projectile.hitEnemies.clear();
    projectile.returnHitEnemies.clear();
    projectile.opacity = 1;
    projectile.fadeStartTime = null;
    projectile.isReturning = false;
    projectile.id = nextProjectileId.current++;

    // Set caster information for PVP return targeting
    projectile.casterId = casterId || localSocketId;
    projectile.casterPosition = unitPosition.clone();

    // Create beam effect for forward shot
    if (createBeamEffect) {
      createBeamEffect(unitPosition, direction, false);
    }

    return true;
  }, [createBeamEffect, parentRef, getInactiveProjectile, charges, setCharges]);

  const createSoulStealEffect = useCallback((enemyPosition: Vector3) => {
    if (!parentRef.current) return;

    const soulSteal: SoulStealEffect = {
      id: nextSoulStealId.current++,
      position: enemyPosition.clone(),
      targetPosition: parentRef.current.position.clone(),
      startTime: Date.now(),
      duration: SOUL_STEAL_DURATION,
      active: true
    };

    soulStealEffects.current.push(soulSteal);
    // Note: No need for setActiveEffects since SoulStealEffect components handle rendering
  }, [parentRef]);

  // Update projectiles and effects
  useEffect(() => {
    let animationFrameId: number;

    const updateProjectilesAndEffects = () => {
      const now = Date.now();

      // Update projectiles
      projectilePool.current.forEach(projectile => {
        if (!projectile.active) return;

        // Handle fading
        if (projectile.fadeStartTime) {
          const fadeElapsed = now - projectile.fadeStartTime;
          const fadeProgress = fadeElapsed / FADE_DURATION;
          projectile.opacity = Math.max(0, 1 - fadeProgress);
          
          if (fadeProgress >= 1) {
            projectile.active = false;
            return;
          }
        }

        if (!projectile.isReturning) {
          // Forward movement phase
          const distanceTraveled = projectile.position.distanceTo(projectile.startPosition);
          
          if (distanceTraveled < projectile.maxDistance && !projectile.fadeStartTime) {
            // Move projectile forward
            projectile.position.add(
              projectile.direction.clone().multiplyScalar(PROJECTILE_SPEED)
            );

            // Check for enemy collisions during forward phase
            for (const enemy of enemyData) {
              if (enemy.isDying || enemy.health <= 0) continue;
              if (projectile.hitEnemies.has(enemy.id)) continue;

              // CRITICAL: Prevent self-damage in PVP
              if (localSocketId && enemy.id === localSocketId) {
                continue; // Skip local player completely
              }

              const projectilePos2D = new Vector3(
                projectile.position.x,
                0,
                projectile.position.z
              );
              const enemyPos2D = new Vector3(
                enemy.position.x,
                0,
                enemy.position.z
              );

              if (projectilePos2D.distanceTo(enemyPos2D) < 1.3) {
                // Mark enemy as hit during forward phase
                projectile.hitEnemies.add(enemy.id);

                // Apply damage through the onHit callback (which routes to CombatSystem)
                onHit(enemy.id, DAMAGE);

                // Apply DoT effect
                if (applyDoT) {
                  applyDoT(enemy.id);
                }

                // Create damage number for visual feedback (like Sword weapon does)
                if (setDamageNumbers && nextDamageNumberId) {
                  setDamageNumbers(prev => [...prev, {
                    id: nextDamageNumberId.current++,
                    damage: DAMAGE,
                    position: enemy.position.clone(),
                    isCritical: false,
                    isViperSting: true // Flag for Viper Sting specific styling
                  }]);
                }

                // Create soul steal effect at enemy position
                createSoulStealEffect(enemy.position);
              }
            }
          } else if (!projectile.fadeStartTime) {
            // Switch to return mode when max distance reached
            projectile.isReturning = true;
            // Reverse direction to point back toward start position
            projectile.direction = new Vector3().subVectors(projectile.startPosition, projectile.position).normalize();
            
            // Create beam effect for return shot
            if (createBeamEffect) {
              createBeamEffect(projectile.position, projectile.direction, true);
            }
          }
        } else {
          // Return movement phase - dynamically follow caster's current position

          // Determine the current target position based on caster
          let returnTargetPosition: Vector3;

          if (projectile.casterId === localSocketId) {
            // Local player projectile - use current local position
            if (!parentRef.current) return;
            returnTargetPosition = parentRef.current.position.clone();
          } else if (projectile.casterId && players) {
            // Remote player projectile - find caster in players array
            const casterPlayer = players.find(p => p.id === projectile.casterId);
            if (casterPlayer) {
              returnTargetPosition = new Vector3(
                casterPlayer.position.x,
                casterPlayer.position.y,
                casterPlayer.position.z
              );
            } else {
              // Fallback to stored caster position if player not found
              returnTargetPosition = projectile.casterPosition || projectile.startPosition.clone();
            }
          } else {
            // Fallback for non-PVP or missing data
            returnTargetPosition = projectile.casterPosition || projectile.startPosition.clone();
          }

          returnTargetPosition.y += 0; // Match the chest level used for launching

          const distanceToTarget = projectile.position.distanceTo(returnTargetPosition);

          if (distanceToTarget > 1.5 && !projectile.fadeStartTime) {
            // Update direction toward caster's current position (dynamic following)
            projectile.direction = new Vector3().subVectors(returnTargetPosition, projectile.position).normalize();

            // Move projectile back toward caster's current position
            projectile.position.add(
              projectile.direction.clone().multiplyScalar(PROJECTILE_RETURN_SPEED)
            );

            // Check for enemy collisions during return phase (allow hitting different enemies)
            for (const enemy of enemyData) {
              if (enemy.isDying || enemy.health <= 0) continue;
              // Use separate hit tracking for return phase
              if (projectile.returnHitEnemies.has(enemy.id)) continue;

              // CRITICAL: Prevent self-damage in PVP
              if (localSocketId && enemy.id === localSocketId) {
                continue; // Skip local player completely
              }

              const projectilePos2D = new Vector3(
                projectile.position.x,
                0,
                projectile.position.z
              );
              const enemyPos2D = new Vector3(
                enemy.position.x,
                0,
                enemy.position.z
              );

              if (projectilePos2D.distanceTo(enemyPos2D) < 1.3) {
                // Mark enemy as hit during return phase
                projectile.returnHitEnemies.add(enemy.id);

                // Apply damage through the onHit callback (which routes to CombatSystem)
                onHit(enemy.id, DAMAGE);

                // Apply DoT effect for return shot as well
                if (applyDoT) {
                  applyDoT(enemy.id);
                }

                // Create damage number for visual feedback (like Sword weapon does)
                if (setDamageNumbers && nextDamageNumberId) {
                  setDamageNumbers(prev => [...prev, {
                    id: nextDamageNumberId.current++,
                    damage: DAMAGE,
                    position: enemy.position.clone(),
                    isCritical: false,
                    isViperSting: true // Flag for Viper Sting specific styling
                  }]);
                }

                // Create soul steal effect at enemy position
                createSoulStealEffect(enemy.position);
              }
            }
          } else if (!projectile.fadeStartTime) {
            // Start fading when projectile reaches caster's current position
            projectile.fadeStartTime = now;
          }
        }
      });

      // Soul steal effects are now handled by SoulStealEffect components
      // No need for duplicate movement logic here

      // Continue animation if there are active projectiles
      if (projectilePool.current.some(p => p.active)) {
        animationFrameId = requestAnimationFrame(updateProjectilesAndEffects);
      }
    };

    animationFrameId = requestAnimationFrame(updateProjectilesAndEffects);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [enemyData, onHit, setDamageNumbers, nextDamageNumberId, onHealthChange, createSoulStealEffect, parentRef, createBeamEffect, applyDoT]);

  return {
    shootViperSting,
    projectilePool,
    soulStealEffects,
    createSoulStealEffect
  };
}
