// Deflect barrier for projectile reflection
import { Vector3 } from '@/utils/three-exports';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Collider, CollisionLayer, ColliderType } from '@/ecs/components/Collider';
import { Projectile } from '@/ecs/components/Projectile';
import { Health } from '@/ecs/components/Health';
import { World } from '@/ecs/World';

export class DeflectBarrier {
  private entity: Entity | null = null;
  private world: World;
  private isActive = false;
  private playerPosition: Vector3;
  private playerRotation: Vector3;
  private playerEntity: Entity | null = null;

  constructor(world: World) {
    this.world = world;
    this.playerPosition = new Vector3();
    this.playerRotation = new Vector3();
  }

  // Update barrier position to follow player
  public updatePosition(playerPosition: Vector3, playerRotation: Vector3): void {
    if (!this.isActive || !this.entity) return;

    this.playerPosition.copy(playerPosition);
    this.playerRotation.copy(playerRotation);

    // Recalculate barrier position in front of player using SAME logic as visual shield
    const forwardDirection = new Vector3(
      Math.sin(playerRotation.y), // X component
      0,                          // Y component (keep level)
      -Math.cos(playerRotation.y) // Z component (negative because forward is -Z)
    );
    
    // Position barrier 2.5 units in front of player (SAME distance as visual shield)
    const barrierPosition = playerPosition.clone().add(forwardDirection.multiplyScalar(2.5));
    barrierPosition.y += 0.5; // Raise to player center height (SAME height as visual shield)

    // Update the barrier's transform
    const transform = this.entity.getComponent(Transform);
    if (transform) {
      transform.setPosition(barrierPosition.x, barrierPosition.y, barrierPosition.z);
      transform.setRotation(playerRotation.x, playerRotation.y, playerRotation.z);
    }
  }

  public activate(playerPosition: Vector3, playerRotation: Vector3, playerEntity?: Entity): void {
    if (this.isActive) return;

    this.playerPosition.copy(playerPosition);
    this.playerRotation.copy(playerRotation);
    this.playerEntity = playerEntity || null;
    this.isActive = true;

    // Make player invulnerable during deflect
    if (this.playerEntity) {
      const playerHealth = this.playerEntity.getComponent(Health);
      if (playerHealth) {
        playerHealth.setInvulnerable(3.0); // 3 second invulnerability
      }
    }

    // Create barrier entity
    this.entity = this.world.createEntity();
    
    // Position barrier in front of player
    // Calculate forward direction based on player rotation (Y rotation only for horizontal facing)
    const forwardDirection = new Vector3(
      Math.sin(playerRotation.y), // X component
      0,                          // Y component (keep level)
      -Math.cos(playerRotation.y) // Z component (negative because forward is -Z)
    );
    
    // Position barrier 2.5 units in front of player
    const barrierPosition = playerPosition.clone().add(forwardDirection.multiplyScalar(2.5));
    barrierPosition.y += 0.5; // Raise to player center height

    // Add transform component
    const transform = new Transform();
    transform.setPosition(barrierPosition.x, barrierPosition.y, barrierPosition.z);
    transform.setRotation(playerRotation.x, playerRotation.y, playerRotation.z);
    this.entity.addComponent(transform);

    // Add collider component for projectile detection
    const collider = new Collider(ColliderType.SPHERE, 3.0); // 3 unit radius shield
    collider.layer = CollisionLayer.PLAYER; // Use player layer
    collider.isTrigger = true; // Don't physically block, just detect
    
    // Set up collision callbacks for projectile reflection
    collider.onTriggerEnter = (otherCollider, otherEntity) => {
      this.handleProjectileCollision(otherEntity);
    };

    this.entity.addComponent(collider);
  }

  public deactivate(): void {
    if (!this.isActive || !this.entity) return;

    this.world.destroyEntity(this.entity.id);
    this.entity = null;
    this.isActive = false;
  }

  private handleProjectileCollision(projectileEntity: Entity): void {
    // Check if the colliding entity is a projectile
    const projectileComponent = projectileEntity.getComponent(Projectile);
    if (!projectileComponent) return;

    const projectileTransform = projectileEntity.getComponent(Transform);
    if (!projectileTransform) return;

    // Calculate reflection direction
    const projectilePos = projectileTransform.getWorldPosition();
    const barrierPos = this.entity!.getComponent(Transform)!.getWorldPosition();
    
    // Get the direction from barrier to projectile (surface normal)
    const surfaceNormal = projectilePos.clone().sub(barrierPos).normalize();
    
    // Reflect the projectile's velocity
    const currentVelocity = projectileComponent.velocity.clone();
    const reflectedVelocity = currentVelocity.reflect(surfaceNormal);
    
    // Apply the reflected velocity
    projectileComponent.velocity.copy(reflectedVelocity);
    
    // Change projectile ownership to player (so it can damage enemies)
    projectileComponent.owner = -2; // Special owner ID for reflected projectiles
    
    // Clear hit targets so it can hit enemies
    projectileComponent.hitTargets.clear();
    
    // Reset lifetime to give it more time to travel back
    projectileComponent.lifetime = 0;
  }

  public isBarrierActive(): boolean {
    return this.isActive;
  }

  public getBarrierPosition(): Vector3 | null {
    if (!this.entity) return null;
    const transform = this.entity.getComponent(Transform);
    return transform ? transform.getWorldPosition() : null;
  }
}
