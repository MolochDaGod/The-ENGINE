// Health bar component for rendering health bars above entities
import { Vector3, Color, Group, Mesh, PlaneGeometry, MeshBasicMaterial, MathUtils, Material } from '@/utils/three-exports';
import { Component } from '../Entity';

export interface HealthBarConfig {
  width?: number;
  height?: number;
  offset?: Vector3;
  backgroundColor?: Color;
  healthColor?: Color;
  lowHealthColor?: Color;
  criticalHealthColor?: Color;
  borderColor?: Color;
  borderWidth?: number;
  showWhenFull?: boolean;
  fadeDistance?: number;
  lowHealthThreshold?: number;
  criticalHealthThreshold?: number;
}

export class HealthBar extends Component {
  public static readonly componentType = 'HealthBar'; // Explicit type identifier
  public readonly componentType = 'HealthBar'; // Instance identifier
  public width: number;
  public height: number;
  public offset: Vector3;
  public backgroundColor: Color;
  public healthColor: Color;
  public lowHealthColor: Color;
  public criticalHealthColor: Color;
  public borderColor: Color;
  public borderWidth: number;
  public showWhenFull: boolean;
  public fadeDistance: number;
  public lowHealthThreshold: number;
  public criticalHealthThreshold: number;

  // Rendering objects
  public group!: Group;
  public backgroundMesh!: Mesh;
  public healthMesh!: Mesh;
  public borderMesh!: Mesh;
  
  // State
  public isVisible: boolean;
  public currentHealthRatio: number;
  public lastHealthRatio: number;
  public animationSpeed: number;

  constructor(config: HealthBarConfig = {}) {
    super();
    
    // Configuration
    this.width = config.width || 1.0;
    this.height = config.height || 0.1;
    this.offset = config.offset?.clone() || new Vector3(0, 1.5, 0);
    this.backgroundColor = config.backgroundColor?.clone() || new Color(0x333333);
    this.healthColor = config.healthColor?.clone() || new Color(0x00ff00);
    this.lowHealthColor = config.lowHealthColor?.clone() || new Color(0xffff00);
    this.criticalHealthColor = config.criticalHealthColor?.clone() || new Color(0xff0000);
    this.borderColor = config.borderColor?.clone() || new Color(0x000000);
    this.borderWidth = config.borderWidth || 0.02;
    this.showWhenFull = config.showWhenFull !== undefined ? config.showWhenFull : false;
    this.fadeDistance = config.fadeDistance || 20;
    this.lowHealthThreshold = config.lowHealthThreshold || 0.5;
    this.criticalHealthThreshold = config.criticalHealthThreshold || 0.25;

    // State
    this.isVisible = true;
    this.currentHealthRatio = 1.0;
    this.lastHealthRatio = 1.0;
    this.animationSpeed = 5.0; // How fast health bar animates

    // Create rendering objects
    this.createHealthBarMeshes();
  }

  private createHealthBarMeshes(): void {
    this.group = new Group();

    // Create border (slightly larger than background)
    const borderGeometry = new PlaneGeometry(
      this.width + this.borderWidth * 2, 
      this.height + this.borderWidth * 2
    );
    const borderMaterial = new MeshBasicMaterial({ 
      color: this.borderColor,
      transparent: true,
      opacity: 0.8
    });
    this.borderMesh = new Mesh(borderGeometry, borderMaterial);
    this.borderMesh.position.z = -0.001; // Slightly behind
    this.group.add(this.borderMesh);

    // Create background
    const backgroundGeometry = new PlaneGeometry(this.width, this.height);
    const backgroundMaterial = new MeshBasicMaterial({ 
      color: this.backgroundColor,
      transparent: true,
      opacity: 0.7
    });
    this.backgroundMesh = new Mesh(backgroundGeometry, backgroundMaterial);
    this.group.add(this.backgroundMesh);

    // Create health bar (starts full width)
    const healthGeometry = new PlaneGeometry(this.width, this.height);
    const healthMaterial = new MeshBasicMaterial({ 
      color: this.healthColor,
      transparent: true,
      opacity: 0.9
    });
    this.healthMesh = new Mesh(healthGeometry, healthMaterial);
    this.healthMesh.position.z = 0.001; // Slightly in front
    this.group.add(this.healthMesh);

    // Make health bar always face camera
    this.group.lookAt(0, 0, 1);
  }

  public updateHealthBar(
    healthRatio: number, 
    cameraPosition: Vector3, 
    worldPosition: Vector3,
    deltaTime: number
  ): void {
    this.currentHealthRatio = Math.max(0, Math.min(1, healthRatio));

    // Animate health bar changes
    if (Math.abs(this.lastHealthRatio - this.currentHealthRatio) > 0.01) {
      this.lastHealthRatio = MathUtils.lerp(
        this.lastHealthRatio, 
        this.currentHealthRatio, 
        this.animationSpeed * deltaTime
      );
    } else {
      this.lastHealthRatio = this.currentHealthRatio;
    }

    // Update health bar width and position
    this.updateHealthMesh();

    // Update health bar color based on health ratio
    this.updateHealthColor();

    // Update visibility based on distance and health
    this.updateVisibility(cameraPosition, worldPosition);

    // Update position and rotation to face camera
    this.updatePositionAndRotation(cameraPosition, worldPosition);
  }

  private updateHealthMesh(): void {
    // Update scale to represent health
    this.healthMesh.scale.x = this.lastHealthRatio;
    
    // Adjust position so health bar shrinks from right to left
    const offsetX = (this.width * (1 - this.lastHealthRatio)) / 2;
    this.healthMesh.position.x = -offsetX;
  }

  private updateHealthColor(): void {
    let color: Color;
    
    if (this.currentHealthRatio <= this.criticalHealthThreshold) {
      color = this.criticalHealthColor;
    } else if (this.currentHealthRatio <= this.lowHealthThreshold) {
      // Interpolate between low health and critical health colors
      const t = (this.currentHealthRatio - this.criticalHealthThreshold) / 
                (this.lowHealthThreshold - this.criticalHealthThreshold);
      color = new Color().lerpColors(this.criticalHealthColor, this.lowHealthColor, t);
    } else {
      // Interpolate between health and low health colors
      const t = (this.currentHealthRatio - this.lowHealthThreshold) / 
                (1 - this.lowHealthThreshold);
      color = new Color().lerpColors(this.lowHealthColor, this.healthColor, t);
    }

    (this.healthMesh.material as MeshBasicMaterial).color.copy(color);
  }

  private updateVisibility(cameraPosition: Vector3, worldPosition: Vector3): void {
    // Calculate distance to camera
    const distance = cameraPosition.distanceTo(worldPosition);
    
    // Determine if should be visible
    let shouldBeVisible = distance <= this.fadeDistance;
    
    // Hide when full health if configured
    if (!this.showWhenFull && this.currentHealthRatio >= 0.99) {
      shouldBeVisible = false;
    }

    // Update visibility
    this.isVisible = shouldBeVisible;
    this.group.visible = this.isVisible;

    // Fade based on distance
    if (this.isVisible && distance > this.fadeDistance * 0.7) {
      const fadeRatio = 1 - ((distance - this.fadeDistance * 0.7) / (this.fadeDistance * 0.3));
      const opacity = Math.max(0.1, fadeRatio);
      
      (this.backgroundMesh.material as MeshBasicMaterial).opacity = opacity * 0.7;
      (this.healthMesh.material as MeshBasicMaterial).opacity = opacity * 0.9;
      (this.borderMesh.material as MeshBasicMaterial).opacity = opacity * 0.8;
    } else if (this.isVisible) {
      (this.backgroundMesh.material as MeshBasicMaterial).opacity = 0.7;
      (this.healthMesh.material as MeshBasicMaterial).opacity = 0.9;
      (this.borderMesh.material as MeshBasicMaterial).opacity = 0.8;
    }
  }

  private updatePositionAndRotation(cameraPosition: Vector3, worldPosition: Vector3): void {
    // Position health bar above entity
    const barPosition = worldPosition.clone().add(this.offset);
    this.group.position.copy(barPosition);

    // Make health bar face camera
    this.group.lookAt(cameraPosition);
  }



  public setHealthRatio(ratio: number): void {
    this.currentHealthRatio = Math.max(0, Math.min(1, ratio));
  }

  public getGroup(): Group {
    return this.group;
  }

  public dispose(): void {
    // Clean up geometries and materials
    this.backgroundMesh.geometry.dispose();
    (this.backgroundMesh.material as Material).dispose();
    
    this.healthMesh.geometry.dispose();
    (this.healthMesh.material as Material).dispose();
    
    this.borderMesh.geometry.dispose();
    (this.borderMesh.material as Material).dispose();
    
    // Remove from parent if it has one
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }

  public reset(): void {
    this.currentHealthRatio = 1.0;
    this.lastHealthRatio = 1.0;
    this.isVisible = true;
    this.enabled = true;
    
    // Reset visual state
    this.updateHealthMesh();
    this.updateHealthColor();
  }

  public clone(): HealthBar {
    const config: HealthBarConfig = {
      width: this.width,
      height: this.height,
      offset: this.offset.clone(),
      backgroundColor: this.backgroundColor.clone(),
      healthColor: this.healthColor.clone(),
      lowHealthColor: this.lowHealthColor.clone(),
      criticalHealthColor: this.criticalHealthColor.clone(),
      borderColor: this.borderColor.clone(),
      borderWidth: this.borderWidth,
      showWhenFull: this.showWhenFull,
      fadeDistance: this.fadeDistance,
      lowHealthThreshold: this.lowHealthThreshold,
      criticalHealthThreshold: this.criticalHealthThreshold
    };
    
    return new HealthBar(config);
  }
}
