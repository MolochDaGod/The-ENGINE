// Collision system for efficient collision detection and response
import { Vector3, Box3 } from '@/utils/three-exports';
import { PhysicsSystem } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Collider, CollisionLayer } from '@/ecs/components/Collider';
import { SpatialHash } from '@/utils/SpatialHash';

interface CollisionPair {
  entityA: Entity;
  entityB: Entity;
  colliderA: Collider;
  colliderB: Collider;
}

export class CollisionSystem extends PhysicsSystem {
  public readonly requiredComponents = [Transform, Collider];
  private spatialHash: SpatialHash;
  private collisionPairs: CollisionPair[] = [];
  private activeCollisions = new Map<string, CollisionPair>(); // Track ongoing collisions
  
  // Performance tracking
  private lastUpdateTime = 0;
  private collisionChecks = 0;
  private actualCollisions = 0;

  constructor(cellSize: number = 5) {
    super();
    this.priority = 15; // Run before movement but after input
    this.spatialHash = new SpatialHash(cellSize);
  }

  public update(entities: Entity[], deltaTime: number): void {
    // This runs every frame for trigger detection and broad phase
    this.updateSpatialHash(entities);
    this.detectCollisions(entities);
    this.processCollisionCallbacks();
    // Also resolve collisions in update() to ensure immediate response
    this.resolveCollisions();
  }

  public fixedUpdate(entities: Entity[], fixedDeltaTime: number): void {
    // This runs at fixed timestep for physics collision response
    this.resolveCollisions();
  }

  private updateSpatialHash(entities: Entity[]): void {
    // Update spatial hash with current entity positions
    for (const entity of entities) {
      const transform = entity.getComponent(Transform)!;
      const collider = entity.getComponent(Collider)!;

      if (!transform.enabled || !collider.enabled) {
        this.spatialHash.remove(entity);
        continue;
      }

      // Update collider bounds
      collider.updateBounds(transform.getWorldPosition());
      
      // Update spatial hash
      this.spatialHash.update(entity, collider.bounds);
    }
  }

  private detectCollisions(entities: Entity[]): void {
    this.collisionPairs.length = 0;
    this.collisionChecks = 0;
    this.actualCollisions = 0;

    const processedPairs = new Set<string>();

    for (const entity of entities) {
      const transform = entity.getComponent(Transform)!;
      const collider = entity.getComponent(Collider)!;

      if (!transform.enabled || !collider.enabled) continue;

      // Query spatial hash for potential collisions
      const candidates = this.spatialHash.query(collider.bounds);

      for (const candidate of candidates) {
        const otherEntity = candidate.entity;
        
        // Skip self
        if (entity.id === otherEntity.id) continue;

        // Create unique pair key (smaller ID first)
        const pairKey = entity.id < otherEntity.id ? 
          `${entity.id}-${otherEntity.id}` : 
          `${otherEntity.id}-${entity.id}`;

        // Skip if already processed this pair
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const otherTransform = otherEntity.getComponent(Transform);
        const otherCollider = otherEntity.getComponent(Collider);

        if (!otherTransform?.enabled || !otherCollider?.enabled) continue;

        // Check if colliders can collide
        if (!collider.canCollideWith(otherCollider)) continue;

        this.collisionChecks++;

        // Precise collision detection
        if (collider.intersects(otherCollider, transform.getWorldPosition(), otherTransform.getWorldPosition())) {
          this.actualCollisions++;
          
          // Debug logging for pillar collisions
          if ((collider.layer === 2 && otherCollider.layer === 16) || 
              (collider.layer === 16 && otherCollider.layer === 2)) {
          }
          
          const pair: CollisionPair = {
            entityA: entity,
            entityB: otherEntity,
            colliderA: collider,
            colliderB: otherCollider
          };

          this.collisionPairs.push(pair);
        }
      }
    }
  }

  private processCollisionCallbacks(): void {
    const currentCollisions = new Map<string, CollisionPair>();

    // Process current collisions
    for (const pair of this.collisionPairs) {
      const pairKey = pair.entityA.id < pair.entityB.id ? 
        `${pair.entityA.id}-${pair.entityB.id}` : 
        `${pair.entityB.id}-${pair.entityA.id}`;

      currentCollisions.set(pairKey, pair);

      // Check if this is a new collision
      if (!this.activeCollisions.has(pairKey)) {
        // New collision - trigger enter events
        this.triggerCollisionEnter(pair);
      } else {
        // Ongoing collision - trigger stay events
        this.triggerCollisionStay(pair);
      }
    }

    // Check for collisions that ended
    this.activeCollisions.forEach((pair, pairKey) => {
      if (!currentCollisions.has(pairKey)) {
        // Collision ended - trigger exit events
        this.triggerCollisionExit(pair);
      }
    });

    // Update active collisions
    this.activeCollisions = currentCollisions;
  }

  private triggerCollisionEnter(pair: CollisionPair): void {
    if (pair.colliderA.isTrigger || pair.colliderB.isTrigger) {
      // Trigger events
      pair.colliderA.onTriggerEnter?.(pair.colliderB, pair.entityB);
      pair.colliderB.onTriggerEnter?.(pair.colliderA, pair.entityA);
    } else {
      // Collision events
      pair.colliderA.onCollisionEnter?.(pair.colliderB, pair.entityB);
      pair.colliderB.onCollisionEnter?.(pair.colliderA, pair.entityA);
    }
  }

  private triggerCollisionStay(pair: CollisionPair): void {
    if (pair.colliderA.isTrigger || pair.colliderB.isTrigger) {
      // Trigger events
      pair.colliderA.onTriggerStay?.(pair.colliderB, pair.entityB);
      pair.colliderB.onTriggerStay?.(pair.colliderA, pair.entityA);
    } else {
      // Collision events
      pair.colliderA.onCollisionStay?.(pair.colliderB, pair.entityB);
      pair.colliderB.onCollisionStay?.(pair.colliderA, pair.entityA);
    }
  }

  private triggerCollisionExit(pair: CollisionPair): void {
    if (pair.colliderA.isTrigger || pair.colliderB.isTrigger) {
      // Trigger events
      pair.colliderA.onTriggerExit?.(pair.colliderB, pair.entityB);
      pair.colliderB.onTriggerExit?.(pair.colliderA, pair.entityA);
    } else {
      // Collision events
      pair.colliderA.onCollisionExit?.(pair.colliderB, pair.entityB);
      pair.colliderB.onCollisionExit?.(pair.colliderA, pair.entityA);
    }
  }

  private resolveCollisions(): void {
    // Resolve physical collisions (non-trigger)
    for (const pair of this.collisionPairs) {
      if (pair.colliderA.isTrigger || pair.colliderB.isTrigger) {
        continue; // Skip triggers
      }

      this.resolveCollision(pair);
    }
  }

  private resolveCollision(pair: CollisionPair): void {
    const transformA = pair.entityA.getComponent(Transform)!;
    const transformB = pair.entityB.getComponent(Transform)!;

    const posA = transformA.getWorldPosition();
    const posB = transformB.getWorldPosition();

    // Calculate separation vector with safety checks
    if (!posA || !posA.clone || !posB || !posB.clone) {
      return;
    }
    
    const separation = posA.clone().sub(posB);
    const distance = separation.length();

    if (distance === 0) {
      // Objects are at exact same position, separate along Y axis
      separation.set(0, 1, 0);
    } else {
      separation.normalize();
    }

    // Calculate required separation distance
    let requiredSeparation = 0;
    
    if (pair.colliderA.type === 'sphere' && pair.colliderB.type === 'sphere') {
      requiredSeparation = pair.colliderA.radius + pair.colliderB.radius;
    } else if (pair.colliderA.type === 'sphere' && pair.colliderB.type === 'cylinder') {
      // Player (sphere) vs Pillar (cylinder) collision
      requiredSeparation = pair.colliderA.radius + pair.colliderB.radius;
    } else if (pair.colliderA.type === 'cylinder' && pair.colliderB.type === 'sphere') {
      // Pillar (cylinder) vs Player (sphere) collision
      requiredSeparation = pair.colliderA.radius + pair.colliderB.radius;
    } else {
      // For other shapes, use a simple approximation
      const radiusA = this.getApproximateRadius(pair.colliderA);
      const radiusB = this.getApproximateRadius(pair.colliderB);
      requiredSeparation = radiusA + radiusB;
    }

    const overlap = requiredSeparation - distance;
    if (overlap > 0) {
      // Debug logging for pillar collisions
      if ((pair.colliderA.layer === 2 && pair.colliderB.layer === 16) || 
          (pair.colliderA.layer === 16 && pair.colliderB.layer === 2)) {
      }
      
      // For static objects (like pillars), apply stronger separation to prevent penetration
      let separationMultiplier = 1.0;
      if (pair.colliderA.isStatic || pair.colliderB.isStatic) {
        separationMultiplier = 1.1; // 10% extra separation for static objects
      }
      
      // Separate objects - use enhanced separation for static objects
      const separationVector = separation.multiplyScalar(overlap * separationMultiplier);
      
      // Check if entities have Movement components for intelligent separation distribution
      const movementA = pair.entityA.getComponent(Movement);
      const movementB = pair.entityB.getComponent(Movement);
      
      // Determine separation distribution based on Movement components and static status
      let separationFactorA = 0.5; // Default: split separation equally
      let separationFactorB = 0.5;
      
      if (pair.colliderA.isStatic && !pair.colliderB.isStatic) {
        // A is static, B moves - B takes all separation
        separationFactorA = 0;
        separationFactorB = 1;
      } else if (!pair.colliderA.isStatic && pair.colliderB.isStatic) {
        // B is static, A moves - A takes all separation
        separationFactorA = 1;
        separationFactorB = 0;
      } else if (!pair.colliderA.isStatic && !pair.colliderB.isStatic) {
        // Both non-static - check for PVP scenario (both players)
        const isPlayerA = pair.colliderA.layer === CollisionLayer.PLAYER;
        const isPlayerB = pair.colliderB.layer === CollisionLayer.PLAYER || pair.colliderB.layer === CollisionLayer.ENEMY;
        
        if (isPlayerA && isPlayerB) {
          // PVP collision: check canMove property for fair collision resolution
          const canMoveA = movementA ? movementA.canMove : false;
          const canMoveB = movementB ? movementB.canMove : false;
          
          if (canMoveA && canMoveB) {
            // Both players can move - equal distribution for fair gameplay
            separationFactorA = 0.5;
            separationFactorB = 0.5;
          } else if (canMoveA && !canMoveB) {
            // Only A can move (local player), B is position-synced (remote player)
            separationFactorA = 1.0;
            separationFactorB = 0.0;
          } else if (!canMoveA && canMoveB) {
            // Only B can move (local player), A is position-synced (remote player)
            separationFactorA = 0.0;
            separationFactorB = 1.0;
          } else {
            // Neither can move - no separation (shouldn't happen in PVP)
            separationFactorA = 0.0;
            separationFactorB = 0.0;
          }
        } else {
          // Non-PVP collision - distribute based on Movement components
          if (movementA && !movementB) {
            // A has Movement, B doesn't
            separationFactorA = 0.8;
            separationFactorB = 0.2;
          } else if (!movementA && movementB) {
            // B has Movement, A doesn't
            separationFactorA = 0.2;
            separationFactorB = 0.8;
          }
          // If both have Movement or neither has Movement, use equal distribution (0.5, 0.5)
        }
      }
      
      // Apply separation with calculated factors
      if (separationFactorA > 0 && separationVector && separationVector.clone) {
        const separationA = separationVector.clone().multiplyScalar(separationFactorA);
        transformA.translate(separationA.x, separationA.y, separationA.z);
        
        // Also stop movement velocity for player when hitting static objects
        if (movementA && pair.colliderB.isStatic && movementA.velocity && movementA.velocity.clone && separation && separation.clone) {
          // Project velocity to remove component towards the static object
          const velocityTowardsStatic = movementA.velocity.clone().projectOnVector(separation.clone().negate());
          if (velocityTowardsStatic.length() > 0) {
            movementA.velocity.sub(velocityTowardsStatic);
          }
        }
      }
      
      if (separationFactorB > 0) {
        const separationB = separationVector.clone().multiplyScalar(-separationFactorB);
        transformB.translate(separationB.x, separationB.y, separationB.z);
        
        // Also stop movement velocity for player when hitting static objects
        if (movementB && pair.colliderA.isStatic) {
          // Project velocity to remove component towards the static object
          const velocityTowardsStatic = movementB.velocity.clone().projectOnVector(separation);
          if (velocityTowardsStatic.length() > 0) {
            movementB.velocity.sub(velocityTowardsStatic);
          }
        }
      }
    }
  }

  private getApproximateRadius(collider: Collider): number {
    switch (collider.type) {
      case 'sphere':
        return collider.radius;
      case 'box':
        return Math.max(collider.size.x, collider.size.y, collider.size.z) * 0.5;
      case 'capsule':
      case 'cylinder':
        return Math.max(collider.radius, collider.height * 0.5);
      default:
        return 0.5;
    }
  }

  // Utility methods for other systems
  public queryColliders(bounds: Box3): Entity[] {
    const entries = this.spatialHash.query(bounds);
    return entries.map(entry => entry.entity);
  }

  public queryCollidersRadius(center: Vector3, radius: number): Entity[] {
    const entries = this.spatialHash.queryRadius(center, radius);
    return entries.map(entry => entry.entity);
  }

  public queryCollidersPoint(point: Vector3): Entity[] {
    const entries = this.spatialHash.queryPoint(point);
    return entries.map(entry => entry.entity);
  }

  public getCollidersInLayer(layer: CollisionLayer, bounds?: Box3): Entity[] {
    const candidates = bounds ? this.spatialHash.query(bounds) : Array.from(this.spatialHash['entityCells'].keys()).map(id => {
      const entries = this.spatialHash.query(new Box3().setFromCenterAndSize(new Vector3(), new Vector3(1000, 1000, 1000)));
      return entries.find(e => e.entity.id === id);
    }).filter(Boolean) as any[];

    return candidates
      .filter(entry => {
        const collider = entry.entity.getComponent(Collider);
        return collider && collider.layer === layer;
      })
      .map(entry => entry.entity);
  }

  // Performance and debugging
  public getPerformanceStats(): {
    collisionChecks: number;
    actualCollisions: number;
    activeCollisions: number;
    spatialHashStats: any;
  } {
    return {
      collisionChecks: this.collisionChecks,
      actualCollisions: this.actualCollisions,
      activeCollisions: this.activeCollisions.size,
      spatialHashStats: this.spatialHash.getStats()
    };
  }

  public onEntityRemoved(entity: Entity): void {
    // Clean up spatial hash when entity is removed
    this.spatialHash.remove(entity);
    
    // Remove from active collisions
    const keysToRemove: string[] = [];
    this.activeCollisions.forEach((pair, key) => {
      if (pair.entityA.id === entity.id || pair.entityB.id === entity.id) {
        keysToRemove.push(key);
      }
    });
    
    for (const key of keysToRemove) {
      this.activeCollisions.delete(key);
    }
  }

  public onDisable(): void {
    this.spatialHash.clear();
    this.activeCollisions.clear();
    this.collisionPairs.length = 0;
  }
}
