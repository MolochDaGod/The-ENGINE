import { useCallback, useRef } from 'react';
import { Vector3, Matrix4 } from '@/utils/three-exports';

interface BarrageProjectile {
  id: number;
  position: Vector3;
  direction: Vector3;
  startPosition: Vector3;
  maxDistance: number;
  damage: number;
  startTime: number;
  hasCollided: boolean;
  hitEnemies: Set<string>;
  opacity?: number;
  fadeStartTime?: number | null;
}

interface UseBarrageProps {
  onHit: (targetId: string, damage: number) => void;
  enemyData: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
  }>;
  setDamageNumbers: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isBarrage?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isBarrage?: boolean;
  }>) => void;
  nextDamageNumberId: React.MutableRefObject<number>;
}

export function useBarrage({
  onHit,
  enemyData,
  setDamageNumbers,
  nextDamageNumberId
}: UseBarrageProps) {
  const activeProjectilesRef = useRef<BarrageProjectile[]>([]);
  const nextProjectileId = useRef(0);

  const shootBarrage = useCallback((unitPosition: Vector3, baseDirection: Vector3) => {
    // Create 3 arrows: center (0°), left (30°), right (-30°)
    const angles = [0, Math.PI / 6, -Math.PI / 6]; // 0°, 30°, -30°
    
    angles.forEach(angle => {
      // Rotate the base direction by the specified angle around the Y axis
      const direction = baseDirection.clone();
      const rotationMatrix = new Matrix4().makeRotationY(angle);
      direction.applyMatrix4(rotationMatrix);

      const projectile: BarrageProjectile = {
        id: nextProjectileId.current++,
        position: unitPosition.clone(),
        direction: direction,
        startPosition: unitPosition.clone(),
        maxDistance: 12, // Same as other bow projectiles
        damage: 120,
        startTime: Date.now(),
        hasCollided: false,
        hitEnemies: new Set(),
        opacity: 1,
        fadeStartTime: null
      };

      activeProjectilesRef.current.push(projectile);
    });

    return true;
  }, []);

  const updateProjectiles = useCallback(() => {
    const now = Date.now();
    
    activeProjectilesRef.current = activeProjectilesRef.current.filter(projectile => {
      const distanceTraveled = projectile.position.distanceTo(projectile.startPosition);
      
      // Handle fading when projectile reaches max distance
      if (distanceTraveled >= projectile.maxDistance && !projectile.fadeStartTime) {
        projectile.fadeStartTime = now;
      }
      
      // Handle fade effect
      if (projectile.fadeStartTime) {
        const fadeElapsed = now - projectile.fadeStartTime;
        const fadeProgress = fadeElapsed / 250; // 250ms fade duration
        projectile.opacity = Math.max(0, 1 - fadeProgress);
        
        if (fadeProgress >= 1) {
          return false; // Remove projectile after fade completes
        }
      }
      
      if (distanceTraveled < projectile.maxDistance && !projectile.hasCollided && !projectile.fadeStartTime) {
        // Move projectile
        const speed = 0.45; // Slightly faster than regular arrows
        projectile.position.add(
          projectile.direction.clone().multiplyScalar(speed)
        );

        // Check for enemy collisions
        for (const enemy of enemyData) {
          // Skip dead or dying enemies
          if (enemy.health <= 0 || enemy.isDying) continue;
          
          // Skip if we've already hit this enemy
          if (projectile.hitEnemies.has(enemy.id)) continue;

          // CRITICAL: Get the local socket ID to prevent self-damage in PVP
          const localSocketId = (window as any).localSocketId;
          
          // NEVER hit yourself - this is the critical fix for self-damage
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
          const distanceToEnemy = projectilePos2D.distanceTo(enemyPos2D);
          
          if (distanceToEnemy < 1.2) {
            // Mark this enemy as hit by this projectile
            projectile.hitEnemies.add(enemy.id);
            
            // Apply damage - but double-check we're not hitting ourselves
            if (enemy.id !== localSocketId) {
              onHit(enemy.id, projectile.damage);
              
              // Add damage number
              setDamageNumbers(prev => [...prev, {
                id: nextDamageNumberId.current++,
                damage: projectile.damage,
                position: enemy.position.clone(),
                isCritical: false,
                isBarrage: true
              }]);
            }

            // This projectile stops after hitting one enemy
            projectile.hasCollided = true;
            return false;
          }
        }
        
        return true;
      }
      
      // Keep projectile alive if it's fading
      return projectile.fadeStartTime !== null;
    });
  }, [enemyData, onHit, setDamageNumbers, nextDamageNumberId]);

  const getActiveProjectiles = useCallback(() => {
    return [...activeProjectilesRef.current];
  }, []);

  const cleanup = useCallback(() => {
    activeProjectilesRef.current = [];
  }, []);

  return {
    shootBarrage,
    updateProjectiles,
    getActiveProjectiles,
    cleanup
  };
}
