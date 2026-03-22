// Entity Component System - Base System Classes
import { Entity, Component } from './Entity';

export abstract class System {
  public abstract readonly requiredComponents: (new () => Component)[];
  public enabled = true;
  public priority = 0; // Lower numbers run first

  public abstract update(entities: Entity[], deltaTime: number): void;

  public matchesEntity(entity: Entity): boolean {
    return entity.isActive() && entity.hasComponents(this.requiredComponents);
  }

  public onEntityAdded?(entity: Entity): void;
  public onEntityRemoved?(entity: Entity): void;
  public onEnable?(): void;
  public onDisable?(): void;
}

export abstract class RenderSystem extends System {
  public abstract render(entities: Entity[], deltaTime: number): void;
}

export abstract class PhysicsSystem extends System {
  public abstract fixedUpdate(entities: Entity[], fixedDeltaTime: number): void;
}
