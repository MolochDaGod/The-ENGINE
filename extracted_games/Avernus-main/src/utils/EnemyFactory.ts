// Enemy factory for creating and managing enemy entities efficiently
import { Vector3, Color, Mesh, BoxGeometry, MeshStandardMaterial, Group } from '@/utils/three-exports';
import { Entity } from '@/ecs/Entity';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { Enemy, EnemyType } from '@/ecs/components/Enemy';
import { Collider, CollisionLayer, ColliderType } from '@/ecs/components/Collider';
import { Renderer } from '@/ecs/components/Renderer';
import { HealthBar, HealthBarConfig } from '@/ecs/components/HealthBar';
import { ObjectPool } from '@/utils/ObjectPool';
import React from 'react';
import { createRoot } from 'react-dom/client';
import EliteEnemyRenderer from '@/components/enemies/EliteEnemyRenderer';

export interface EnemySpawnConfig {
  type: EnemyType;
  level?: number;
  position: Vector3;
  health?: number;
  scale?: number;
  color?: Color;
  customName?: string;
}

export interface EnemyFactoryConfig {
  enableObjectPooling?: boolean;
  maxPoolSize?: number;
  enableHealthBars?: boolean;
  healthBarConfig?: HealthBarConfig;
}

export class EnemyFactory {
  private world: World;
  private config: EnemyFactoryConfig;
  
  // Object pools for performance
  private meshPool!: ObjectPool<Mesh>;
  private geometryPool!: ObjectPool<BoxGeometry>;
  private materialPool!: ObjectPool<MeshStandardMaterial>;
  
  // Enemy configurations
  private enemyConfigs!: Map<EnemyType, {
    baseHealth: number;
    size: Vector3;
    color: Color;
    colliderRadius: number;
  }>;

  constructor(world: World, config: EnemyFactoryConfig = {}) {
    this.world = world;
    this.config = {
      enableObjectPooling: config.enableObjectPooling !== false,
      maxPoolSize: config.maxPoolSize || 50,
      enableHealthBars: config.enableHealthBars !== false,
      healthBarConfig: config.healthBarConfig || {}
    };

    // Initialize object pools
    this.initializePools();
    
    // Initialize enemy configurations
    this.initializeEnemyConfigs();
  }

  private initializePools(): void {
    if (!this.config.enableObjectPooling) return;

    this.meshPool = new ObjectPool(
      () => new Mesh(),
      (mesh) => {
        mesh.geometry = new BoxGeometry(1, 1, 1);
        mesh.material = new MeshStandardMaterial();
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        mesh.scale.set(1, 1, 1);
        mesh.visible = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      },
      this.config.maxPoolSize!
    );

    this.geometryPool = new ObjectPool(
      () => new BoxGeometry(1, 1, 1),
      (geometry) => {
        // Geometries don't need reset
      },
      this.config.maxPoolSize!
    );

    this.materialPool = new ObjectPool(
      () => new MeshStandardMaterial(),
      (material) => {
        material.color.setHex(0xffffff);
        material.opacity = 1;
        material.transparent = false;
        material.wireframe = false;
      },
      this.config.maxPoolSize!
    );
  }

  private initializeEnemyConfigs(): void {
    this.enemyConfigs = new Map([
      [EnemyType.DUMMY, {
        baseHealth: 500,
        size: new Vector3(1, 2, 1),
        color: new Color(0x8B4513), // Brown
        colliderRadius: 1.0  // Increased from 0.6 for easier hitting
      }],
      [EnemyType.GRUNT, {
        baseHealth: 500,
        size: new Vector3(0.8, 1.8, 0.8),
        color: new Color(0xFF4444), // Red
        colliderRadius: 2  // Increased from 0.5 for easier hitting
      }],
      [EnemyType.ELITE, {
        baseHealth: 1000,
        size: new Vector3(1.2, 2.2, 1.2),
        color: new Color(0x4444FF), // Blue
        colliderRadius: 2  // Increased from 0.7 for easier hitting
      }],
      [EnemyType.BOSS, {
        baseHealth: 2000,
        size: new Vector3(2, 3, 2),
        color: new Color(0x8A2BE2), // Purple
        colliderRadius: 2  // Increased from 1.2 for easier hitting
      }]
    ]);
  }

  public createEnemy(spawnConfig: EnemySpawnConfig): Entity {
    const entity = this.world.createEntity();
    const config = this.enemyConfigs.get(spawnConfig.type)!;
    const level = spawnConfig.level || 1;
    const scale = spawnConfig.scale || 1;

    // Add Transform component
    const transform = this.world.createComponent(Transform);
    transform.position.copy(spawnConfig.position);
    transform.setScale(scale, scale, scale);
    entity.addComponent(transform);

    // Add Enemy component
    const enemy = this.world.createComponent(Enemy);
    enemy.type = spawnConfig.type;
    enemy.level = level;
    entity.addComponent(enemy);

    // Add Health component
    const health = this.world.createComponent(Health);
    const maxHealth = spawnConfig.health || (config.baseHealth * level);
    health.maxHealth = maxHealth;
    health.currentHealth = maxHealth;
    
    // Configure health based on enemy type
    if (spawnConfig.type === EnemyType.DUMMY) {
      // Safety check for object pooling issues
      if (typeof health.enableRegeneration === 'function') {
        health.enableRegeneration(10, 2); // Fast regeneration for training dummy
      } else {
        // Fallback: manually set regeneration properties
        health.canRegenerate = true;
        health.regenerationRate = 10;
        health.regenerationDelay = 2;
      }
    }
    
    entity.addComponent(health);

    // Add Collider component
    const collider = this.world.createComponent(Collider);
    collider.type = ColliderType.SPHERE;
    collider.radius = config.colliderRadius * scale;
    collider.layer = CollisionLayer.ENEMY;
    collider.setOffset(0, config.size.y * scale * 0.5, 0); // Center on entity
    entity.addComponent(collider);

    // Add Renderer component
    const renderer = this.world.createComponent(Renderer);
    
    // Use custom renderer for Elite and Boss enemies, and standard mesh for Grunt
    if (spawnConfig.type === EnemyType.ELITE || spawnConfig.type === EnemyType.BOSS) {
      // For Elite and Boss enemies, we don't create a mesh here
      // The EliteEnemyManager and BossEnemyManager will handle the rendering via React Three Fiber
      renderer.mesh = null;
      // Ensure no geometry/material is set to prevent RenderSystem from creating a mesh
      renderer.geometry = null;
      renderer.material = null;
    } else if (spawnConfig.type === EnemyType.GRUNT) {
      // For Grunt enemies, we don't create a mesh here
      // The GruntEnemyManager will handle the React Three Fiber rendering
      renderer.mesh = null;
      // Ensure no geometry/material is set to prevent RenderSystem from creating a mesh
      renderer.geometry = null;
      renderer.material = null;
    } else {
      // Use standard mesh for other enemy types (like DUMMY)
      renderer.mesh = this.createEnemyMesh(config, spawnConfig.color || config.color, scale);
    }
    
    if (typeof renderer.setCastShadow === 'function') {
      renderer.setCastShadow(true);
    } 
    
    if (typeof renderer.setReceiveShadow === 'function') {
      renderer.setReceiveShadow(true);
    }
    entity.addComponent(renderer);

    // Add HealthBar component if enabled
    if (this.config.enableHealthBars) {
      const healthBar = this.world.createComponent(HealthBar);
      const healthBarConfig: HealthBarConfig = {
        width: Math.max(0.8, config.size.x * scale * 0.8),
        height: 0.08,
        offset: new Vector3(0, config.size.y * scale + 1.25, 0),
        showWhenFull: spawnConfig.type === EnemyType.DUMMY, // Always show for training dummy
        fadeDistance: 15,
        ...this.config.healthBarConfig
      };
      
      // Configure health bar colors based on enemy type
      if (spawnConfig.type === EnemyType.DUMMY) {
        healthBarConfig.healthColor = new Color(0x00AAFF); // Blue for training dummy
      }
      
      // Apply configuration to healthBar
      healthBar.width = healthBarConfig.width || healthBar.width;
      healthBar.height = healthBarConfig.height || healthBar.height;
      if (healthBarConfig.offset) healthBar.offset.copy(healthBarConfig.offset);
      healthBar.showWhenFull = healthBarConfig.showWhenFull !== undefined ? healthBarConfig.showWhenFull : healthBar.showWhenFull;
      healthBar.fadeDistance = healthBarConfig.fadeDistance || healthBar.fadeDistance;
      if (healthBarConfig.healthColor) healthBar.healthColor.copy(healthBarConfig.healthColor);
      
      entity.addComponent(healthBar);
    }

    
    // Notify systems that the entity is ready
    this.world.notifyEntityAdded(entity);
    
    return entity;
  }

  private createEnemyMesh(
    config: { size: Vector3; color: Color }, 
    color: Color, 
    scale: number
  ): Mesh {
    let geometry: BoxGeometry;
    let material: MeshStandardMaterial;
    let mesh: Mesh;

    if (this.config.enableObjectPooling) {
      // Use pooled objects
      geometry = this.geometryPool.acquire();
      material = this.materialPool.acquire();
      mesh = this.meshPool.acquire();
      
      // Configure geometry
      geometry.dispose(); // Dispose old geometry
      geometry = new BoxGeometry(
        config.size.x * scale,
        config.size.y * scale,
        config.size.z * scale
      );
    } else {
      // Create new objects
      geometry = new BoxGeometry(
        config.size.x * scale,
        config.size.y * scale,
        config.size.z * scale
      );
      material = new MeshStandardMaterial();
      mesh = new Mesh();
    }

    // Configure material
    material.color.copy(color);
    material.roughness = 0.7;
    material.metalness = 0.1;

    // Configure mesh
    mesh.geometry = geometry;
    mesh.material = material;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add enemy identification for collision detection
    mesh.name = 'enemy';
    mesh.userData.isEnemy = true;

    // Position mesh so bottom is at transform position
    mesh.position.y = (config.size.y * scale) / 2;

    return mesh;
  }

  private createEliteEnemyGroup(entityId: number): Group {
    // Create a placeholder group that will be populated by the React component
    const group = new Group();
    group.name = 'elite-enemy';
    group.userData.isEnemy = true;
    group.userData.entityId = entityId;
    
    // The actual Elite model will be rendered by the EliteEnemyRenderer React component
    // This group serves as a placeholder and container for the React-rendered content
    
    return group;
  }

  public createTrainingDummy(position: Vector3): Entity {
    return this.createEnemy({
      type: EnemyType.DUMMY,
      level: 1,
      position: position.clone(),
      health: 500,
      color: new Color(0x8B4513) // Brown
    });
  }

  public createGrunt(position: Vector3, level: number = 1): Entity {
    return this.createEnemy({
      type: EnemyType.GRUNT,
      level,
      position: position.clone(),
      color: new Color(0xFF4444) // Red
    });
  }

  public createElite(position: Vector3, level: number = 1): Entity {
    return this.createEnemy({
      type: EnemyType.ELITE,
      level,
      position: position.clone(),
      color: new Color(0x4444FF) // Blue
    });
  }

  public createBoss(position: Vector3, level: number = 1): Entity {
    return this.createEnemy({
      type: EnemyType.BOSS,
      level,
      position: position.clone(),
      color: new Color(0x8A2BE2) // Purple
    });
  }

  public spawnEnemiesInCircle(
    center: Vector3,
    radius: number,
    count: number,
    enemyType: EnemyType = EnemyType.GRUNT,
    level: number = 1
  ): Entity[] {
    const enemies: Entity[] = [];
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      const position = new Vector3(
        center.x + Math.cos(angle) * radius,
        center.y,
        center.z + Math.sin(angle) * radius
      );

      const enemy = this.createEnemy({
        type: enemyType,
        level,
        position
      });

      enemies.push(enemy);
    }

    return enemies;
  }

  public spawnEnemiesInArea(
    center: Vector3,
    size: Vector3,
    count: number,
    enemyType: EnemyType = EnemyType.GRUNT,
    level: number = 1
  ): Entity[] {
    const enemies: Entity[] = [];

    for (let i = 0; i < count; i++) {
      const position = new Vector3(
        center.x + (Math.random() - 0.5) * size.x,
        center.y,
        center.z + (Math.random() - 0.5) * size.z
      );

      const enemy = this.createEnemy({
        type: enemyType,
        level,
        position
      });

      enemies.push(enemy);
    }

    return enemies;
  }

  public releaseEnemy(entity: Entity): void {
    if (!this.config.enableObjectPooling) return;

    const renderer = entity.getComponent(Renderer);
    if (renderer && renderer.mesh) {
      const meshOrGroup = renderer.mesh;
      
      // Only handle pooling for regular meshes, not Groups (Elite enemies)
      if (meshOrGroup instanceof Mesh) {
        // Return objects to pools
        if (meshOrGroup.geometry && this.geometryPool) {
          this.geometryPool.release(meshOrGroup.geometry as BoxGeometry);
        }
        if (meshOrGroup.material && this.materialPool) {
          this.materialPool.release(meshOrGroup.material as MeshStandardMaterial);
        }
        if (this.meshPool) {
          this.meshPool.release(meshOrGroup);
        }
      }
      // Groups (Elite enemies) are handled by their React components and don't use object pooling
    }
  }

  public getPoolStats(): {
    meshPool: number;
    geometryPool: number;
    materialPool: number;
  } | null {
    if (!this.config.enableObjectPooling) return null;

    return {
      meshPool: this.meshPool.getPoolSize(),
      geometryPool: this.geometryPool.getPoolSize(),
      materialPool: this.materialPool.getPoolSize()
    };
  }

  public dispose(): void {
    if (this.config.enableObjectPooling) {
      this.meshPool?.clear();
      this.geometryPool?.clear();
      this.materialPool?.clear();
    }
  }
}
