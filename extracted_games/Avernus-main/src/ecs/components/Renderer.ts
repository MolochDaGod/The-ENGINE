// Renderer component for 3D rendering data
import { Mesh, Group, BufferGeometry, Material, AnimationMixer, AnimationClip, AnimationAction, InstancedMesh, LoopRepeat, LoopOnce, Matrix4, Vector3 } from '@/utils/three-exports';
import { Component } from '../Entity';

export interface RenderOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  frustumCulled?: boolean;
  visible?: boolean;
  renderOrder?: number;
}

export class Renderer extends Component {
  public static readonly componentType = 'Renderer'; // Explicit type identifier
  public readonly componentType = 'Renderer'; // Instance identifier
  public mesh: Mesh | Group | null = null;
  public geometry: BufferGeometry | null = null;
  public material: Material | Material[] | null = null;
  public castShadow: boolean;
  public receiveShadow: boolean;
  public frustumCulled: boolean;
  public visible: boolean;
  public renderOrder: number;
  public needsUpdate: boolean;

  // Animation properties
  public animationMixer: AnimationMixer | null = null;
  public animations: AnimationClip[] = [];
  public currentAnimation: AnimationAction | null = null;

  // Instancing support
  public isInstanced: boolean = false;
  public instancedMesh: InstancedMesh | null = null;
  public instanceId: number = -1;

  constructor(options: RenderOptions = {}) {
    super();
    
    this.castShadow = options.castShadow ?? true;
    this.receiveShadow = options.receiveShadow ?? true;
    this.frustumCulled = options.frustumCulled ?? true;
    this.visible = options.visible ?? true;
    this.renderOrder = options.renderOrder ?? 0;
    this.needsUpdate = true;
  }

  public setGeometry(geometry: BufferGeometry): void {
    if (this.geometry && this.geometry !== geometry) {
      this.geometry.dispose();
    }
    this.geometry = geometry;
    this.needsUpdate = true;
  }

  public setMaterial(material: Material | Material[]): void {
    if (this.material && this.material !== material) {
      if (Array.isArray(this.material)) {
        this.material.forEach(mat => mat.dispose());
      } else {
        this.material.dispose();
      }
    }
    this.material = material;
    this.needsUpdate = true;
  }

  public createMesh(): Mesh | null {
    if (!this.geometry || !this.material) {
      return null;
    }

    if (this.mesh) {
      this.disposeMesh();
    }

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.castShadow = this.castShadow;
    this.mesh.receiveShadow = this.receiveShadow;
    this.mesh.frustumCulled = this.frustumCulled;
    this.mesh.visible = this.visible;
    this.mesh.renderOrder = this.renderOrder;

    this.needsUpdate = false;
    return this.mesh;
  }

  public updateMesh(): void {
    if (!this.mesh) return;

    // Handle shadow properties for both Mesh and Group
    if (this.mesh instanceof Mesh) {
      this.mesh.castShadow = this.castShadow;
      this.mesh.receiveShadow = this.receiveShadow;
    } else if (this.mesh instanceof Group) {
      // Apply shadow properties to all meshes in the group
      this.mesh.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = this.castShadow;
          child.receiveShadow = this.receiveShadow;
        }
      });
    }

    this.mesh.frustumCulled = this.frustumCulled;
    this.mesh.visible = this.visible;
    this.mesh.renderOrder = this.renderOrder;

    if (this.needsUpdate && this.geometry && this.material && this.mesh instanceof Mesh) {
      this.mesh.geometry = this.geometry;
      this.mesh.material = this.material;
      this.needsUpdate = false;
    }
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.mesh) {
      this.mesh.visible = visible;
    }
  }

  public setCastShadow(castShadow: boolean): void {
    this.castShadow = castShadow;
    if (this.mesh instanceof Mesh) {
      this.mesh.castShadow = castShadow;
    } else if (this.mesh instanceof Group) {
      this.mesh.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = castShadow;
        }
      });
    }
  }

  public setReceiveShadow(receiveShadow: boolean): void {
    this.receiveShadow = receiveShadow;
    if (this.mesh instanceof Mesh) {
      this.mesh.receiveShadow = receiveShadow;
    } else if (this.mesh instanceof Group) {
      this.mesh.traverse((child) => {
        if (child instanceof Mesh) {
          child.receiveShadow = receiveShadow;
        }
      });
    }
  }

  // Animation methods
  public setupAnimations(animations: AnimationClip[]): void {
    if (!this.mesh) return;

    this.animations = animations;
    if (animations.length > 0) {
      this.animationMixer = new AnimationMixer(this.mesh);
    }
  }

  public playAnimation(name: string, loop: boolean = true, fadeTime: number = 0.2): AnimationAction | null {
    if (!this.animationMixer) return null;

    const clip = this.animations.find(clip => clip.name === name);
    if (!clip) return null;

    // Stop current animation
    if (this.currentAnimation) {
      this.currentAnimation.fadeOut(fadeTime);
    }

    // Start new animation
    const action = this.animationMixer.clipAction(clip);
    action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    action.fadeIn(fadeTime);
    action.play();

    this.currentAnimation = action;
    return action;
  }

  public stopAnimation(fadeTime: number = 0.2): void {
    if (this.currentAnimation) {
      this.currentAnimation.fadeOut(fadeTime);
      this.currentAnimation = null;
    }
  }

  public updateAnimations(deltaTime: number): void {
    if (this.animationMixer) {
      this.animationMixer.update(deltaTime);
    }
  }

  // Instancing methods
  public setupInstancing(instancedMesh: InstancedMesh, instanceId: number): void {
    this.isInstanced = true;
    this.instancedMesh = instancedMesh;
    this.instanceId = instanceId;
  }

  public updateInstanceMatrix(matrix: Matrix4): void {
    if (this.isInstanced && this.instancedMesh && this.instanceId >= 0) {
      this.instancedMesh.setMatrixAt(this.instanceId, matrix);
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public setInstanceVisible(visible: boolean): void {
    if (this.isInstanced && this.instancedMesh && this.instanceId >= 0) {
      // For instanced meshes, we can hide instances by scaling them to 0
      const matrix = new Matrix4();
      this.instancedMesh.getMatrixAt(this.instanceId, matrix);
      
      if (!visible) {
        matrix.scale(new Vector3(0, 0, 0));
      }
      
      this.instancedMesh.setMatrixAt(this.instanceId, matrix);
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public disposeMesh(): void {
    if (this.mesh) {
      if (this.mesh.parent) {
        this.mesh.parent.remove(this.mesh);
      }
      this.mesh = null;
    }
  }

  public dispose(): void {
    this.disposeMesh();

    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }

    if (this.material) {
      if (Array.isArray(this.material)) {
        this.material.forEach(mat => mat.dispose());
      } else {
        this.material.dispose();
      }
      this.material = null;
    }

    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
      this.animationMixer = null;
    }

    this.animations = [];
    this.currentAnimation = null;
    this.instancedMesh = null;
  }

  public reset(): void {
    this.dispose();
    this.castShadow = true;
    this.receiveShadow = true;
    this.frustumCulled = true;
    this.visible = true;
    this.renderOrder = 0;
    this.needsUpdate = true;
    this.isInstanced = false;
    this.instanceId = -1;
    this.enabled = true;
  }

  public clone(): Renderer {
    const clone = new Renderer({
      castShadow: this.castShadow,
      receiveShadow: this.receiveShadow,
      frustumCulled: this.frustumCulled,
      visible: this.visible,
      renderOrder: this.renderOrder,
    });

    // Note: We don't clone the actual geometry/material/mesh as they should be shared
    // The cloned component will need to have its geometry and material set separately
    
    return clone;
  }
}
