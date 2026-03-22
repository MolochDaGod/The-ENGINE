// Pillar system for managing PVP pillar health and destruction
import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { Pillar } from '@/ecs/components/Pillar';
import { World } from '@/ecs/World';

export class PillarSystem extends System {
  public readonly requiredComponents = [Transform, Pillar, Health];
  private world: World;

  // Callback for when a pillar is destroyed
  private onPillarDestroyedCallback?: (pillarOwnerId: string, pillarIndex: number, destroyerPlayerId: string) => void;

  constructor(world: World) {
    super();
    this.world = world;
    this.priority = 20; // Run before most other systems
  }

  public setPillarDestroyedCallback(callback: (pillarOwnerId: string, pillarIndex: number, destroyerPlayerId: string) => void): void {
    this.onPillarDestroyedCallback = callback;
  }

  public update(entities: Entity[], deltaTime: number): void {
    const currentTime = Date.now() / 1000; // Convert to seconds

    for (const entity of entities) {
      const transform = entity.getComponent(Transform);
      const pillar = entity.getComponent(Pillar);
      const health = entity.getComponent(Health);

      if (!transform || !pillar || !health) continue;

      // Check if pillar is dead
      if (health.isDead && !pillar.isDead) {
        pillar.die(currentTime);
        // Notify about pillar destruction if callback is set
        if (this.onPillarDestroyedCallback) {
          // We need to track who destroyed the pillar - this will be set when damage is applied
          // For now, we'll pass an empty string and handle this in the damage callback
        }
        continue;
      }

      // Skip inactive or dead pillars
      if (!pillar.isActive || pillar.isDead) continue;
    }
  }

  public getPillarsByOwner(ownerId: string): Entity[] {
    return this.world.queryEntities([Transform, Pillar, Health])
      .filter(entity => {
        const pillar = entity.getComponent(Pillar);
        return pillar && pillar.ownerId === ownerId;
      });
  }

  public getPillarCount(ownerId: string): number {
    return this.getPillarsByOwner(ownerId).length;
  }

  public hasActivePillars(ownerId: string): boolean {
    return this.getPillarsByOwner(ownerId).some(entity => {
      const pillar = entity.getComponent(Pillar);
      const health = entity.getComponent(Health);
      return pillar && pillar.isActive && !pillar.isDead && health && !health.isDead;
    });
  }

  public getDestroyedPillarsCount(ownerId: string): number {
    return this.getPillarsByOwner(ownerId).filter(entity => {
      const pillar = entity.getComponent(Pillar);
      const health = entity.getComponent(Health);
      return pillar && (pillar.isDead || (health && health.isDead));
    }).length;
  }
}
