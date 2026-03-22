// Health bar system for rendering health bars above entities
import { Scene, Camera, Group } from '@/utils/three-exports';
import { RenderSystem } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { HealthBar } from '@/ecs/components/HealthBar';

export class HealthBarSystem extends RenderSystem {
  public readonly requiredComponents = [Transform, Health, HealthBar];
  private scene: Scene;
  private camera: Camera;

  constructor(scene: Scene, camera: Camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.priority = 100; // Render after main objects
  }

  public update(entities: Entity[], deltaTime: number): void {
    // Update health bar logic
    for (const entity of entities) {
      const transform = entity.getComponent(Transform)!;
      const health = entity.getComponent(Health)!;
      const healthBar = entity.getComponent(HealthBar)!;

      if (!transform.enabled || !health.enabled || !healthBar.enabled) {
        continue;
      }

      // Update health bar with current health ratio
      const worldPosition = transform.getWorldPosition();
      const cameraPosition = this.camera.position;
      
      healthBar.updateHealthBar(
        health.getHealthRatio(),
        cameraPosition,
        worldPosition,
        deltaTime
      );
    }
  }

  public render(entities: Entity[], deltaTime: number): void {
    // Health bars are automatically rendered as part of the scene
    // This method can be used for any additional rendering logic
  }

  public onEntityAdded(entity: Entity): void {
    const healthBar = entity.getComponent(HealthBar);
    if (healthBar) {
      // Add health bar group to scene
      this.scene.add(healthBar.getGroup());
    }
  }

  public onEntityRemoved(entity: Entity): void {
    const healthBar = entity.getComponent(HealthBar);
    if (healthBar) {
      // Remove health bar group from scene and dispose resources
      this.scene.remove(healthBar.getGroup());
      healthBar.dispose();
    }
  }

  public onDisable(): void {
    // Clean up all health bars from scene
    const healthBarGroups: Group[] = [];
    
    this.scene.traverse((object) => {
      if (object instanceof Group && object.userData.isHealthBar) {
        healthBarGroups.push(object);
      }
    });

    for (const group of healthBarGroups) {
      this.scene.remove(group);
    }
  }
}
