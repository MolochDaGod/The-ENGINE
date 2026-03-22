// Render system for 3D rendering with Three.js
import { Scene, Camera, WebGLRenderer, Mesh, Group, Light, Object3D, Color, Texture, PCFSoftShadowMap, PerspectiveCamera, Fog, FogExp2, CubeTexture } from '@/utils/three-exports';
import { RenderSystem as BaseRenderSystem } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Renderer } from '@/ecs/components/Renderer';

export class RenderSystem extends BaseRenderSystem {
  public readonly requiredComponents = [Transform, Renderer];
  private scene: Scene;
  private camera: Camera;
  private renderer: WebGLRenderer;
  private meshMap = new Map<number, Mesh | Group>(); // Entity ID -> Mesh/Group mapping

  constructor(scene: Scene, camera: Camera, renderer: WebGLRenderer) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.priority = 1000; // Render systems should run last
  }

  public update(entities: Entity[], deltaTime: number): void {
    // Update animations and renderer components
    for (const entity of entities) {
      const transform = entity.getComponent(Transform)!;
      const rendererComponent = entity.getComponent(Renderer)!;

      if (!transform.enabled || !rendererComponent.enabled) {
        continue;
      }

      // Update animations with safety check
      if (typeof rendererComponent.updateAnimations === 'function') {
        rendererComponent.updateAnimations(deltaTime);
      } else {
        // console.warn('⚠️ Renderer component missing updateAnimations method:', rendererComponent);
      }

      // Update mesh if needed
      this.updateEntityMesh(entity, transform, rendererComponent);
    }
  }

  public render(entities: Entity[], deltaTime: number): void {
    // Update all entity transforms and meshes
    for (const entity of entities) {
      const transform = entity.getComponent(Transform)!;
      const rendererComponent = entity.getComponent(Renderer)!;

      if (!transform.enabled || !rendererComponent.enabled) {
        continue;
      }

      this.updateEntityTransform(entity, transform, rendererComponent);
    }

    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }

  private updateEntityMesh(entity: Entity, transform: Transform, rendererComponent: Renderer): void {
    const existingMesh = this.meshMap.get(entity.id);

    // Handle pre-built mesh/group (like arrows)
    if (!existingMesh && rendererComponent.mesh) {
      this.meshMap.set(entity.id, rendererComponent.mesh);
      this.scene.add(rendererComponent.mesh);
      return;
    }

    // Create mesh if it doesn't exist or needs update (traditional geometry + material)
    if (!existingMesh && rendererComponent.geometry && rendererComponent.material) {
      const mesh = rendererComponent.createMesh();
      if (mesh) {
        this.meshMap.set(entity.id, mesh);
        this.scene.add(mesh);
      }
    } else if (existingMesh) {
      // Update existing mesh with safety check
      if (typeof rendererComponent.updateMesh === 'function') {
        rendererComponent.updateMesh();
      } else {
        // console.warn('⚠️ Renderer component missing updateMesh method:', rendererComponent);
      }
    }
  }

  private updateEntityTransform(entity: Entity, transform: Transform, rendererComponent: Renderer): void {
    const meshOrGroup = this.meshMap.get(entity.id);
    if (!meshOrGroup) return;

    // Update transform matrix
    transform.updateMatrix();

    // Apply transform to mesh or group
    meshOrGroup.position.copy(transform.position);
    meshOrGroup.quaternion.copy(transform.quaternion);
    meshOrGroup.scale.copy(transform.scale);

    // Handle instanced rendering (only for meshes)
    if (rendererComponent.isInstanced && meshOrGroup instanceof Mesh) {
      rendererComponent.updateInstanceMatrix(transform.matrix);
    }
  }

  public onEntityAdded(entity: Entity): void {
    const rendererComponent = entity.getComponent(Renderer);
    if (rendererComponent) {
      // console.log(`🎨 RenderSystem: Adding entity ${entity.id} to scene`);
      
      // Handle pre-built mesh/group (like arrows and elite enemies)
      if (rendererComponent.mesh) {
        // console.log(`🏹 Adding pre-built mesh/group for entity ${entity.id}`);
        this.meshMap.set(entity.id, rendererComponent.mesh);
        this.scene.add(rendererComponent.mesh);
        return;
      }
      
      // Handle traditional geometry + material
      if (rendererComponent.geometry && rendererComponent.material) {
        // console.log(`🔷 Creating mesh from geometry + material for entity ${entity.id}`);
        const mesh = rendererComponent.createMesh();
        if (mesh) {
          this.meshMap.set(entity.id, mesh);
          this.scene.add(mesh);
        }
      } else {
        // console.log(`⚪ Entity ${entity.id} has Renderer but no geometry/material - skipping mesh creation`);
      }
    } else {
      // console.log(`⚠️ RenderSystem: Entity ${entity.id} has no Renderer component`);
    }
  }

  public onEntityRemoved(entity: Entity): void {
    const mesh = this.meshMap.get(entity.id);
    if (mesh) {
      this.scene.remove(mesh);
      this.meshMap.delete(entity.id);
    }

    const rendererComponent = entity.getComponent(Renderer);
    if (rendererComponent && typeof rendererComponent.dispose === 'function') {
      rendererComponent.dispose();
    }
  }

  public getMesh(entityId: number): Mesh | Group | undefined {
    return this.meshMap.get(entityId);
  }

  public getScene(): Scene {
    return this.scene;
  }

  public getCamera(): Camera {
    return this.camera;
  }

  public getRenderer(): WebGLRenderer {
    return this.renderer;
  }

  // Utility methods for managing the scene
  public addLight(light: Light): void {
    this.scene.add(light);
  }

  public removeLight(light: Light): void {
    this.scene.remove(light);
  }

  public addObject(object: Object3D): void {
    this.scene.add(object);
  }

  public removeObject(object: Object3D): void {
    this.scene.remove(object);
  }

  public setFog(fog: Fog | FogExp2 | null): void {
    this.scene.fog = fog;
  }

  public setBackground(background: Color | Texture | CubeTexture | null): void {
    this.scene.background = background;
  }

  public enableShadows(enable: boolean = true): void {
    this.renderer.shadowMap.enabled = enable;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
  }

  public setPixelRatio(ratio?: number): void {
    this.renderer.setPixelRatio(ratio || window.devicePixelRatio);
  }

  public setSize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    
    if (this.camera instanceof PerspectiveCamera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  public dispose(): void {
    // Clean up all meshes
    for (const [entityId, mesh] of Array.from(this.meshMap.entries())) {
      this.scene.remove(mesh);
    }
    this.meshMap.clear();

    // Dispose renderer
    this.renderer.dispose();
  }
}
