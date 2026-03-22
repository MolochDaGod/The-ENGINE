// Collider component for collision detection
import { Vector3, Box3, Sphere } from '@/utils/three-exports';
import { Component } from '../Entity';

export enum ColliderType {
  SPHERE = 'sphere',
  BOX = 'box',
  CAPSULE = 'capsule',
  CYLINDER = 'cylinder'
}

export enum CollisionLayer {
  DEFAULT = 1,
  PLAYER = 2,
  ENEMY = 4,
  PROJECTILE = 8,
  ENVIRONMENT = 16,
  PICKUP = 32
}

export class Collider extends Component {
  public static readonly componentType = 'Collider'; // Explicit type identifier
  public readonly componentType = 'Collider'; // Instance identifier
  public type: ColliderType;
  public radius: number; // For sphere and cylinder
  public size: Vector3; // For box (width, height, depth)
  public height: number; // For capsule and cylinder
  public offset: Vector3; // Offset from transform position
  public layer: CollisionLayer;
  public mask: number; // Which layers this collider can collide with
  public isTrigger: boolean; // If true, doesn't block movement but still detects collisions
  public isStatic: boolean; // If true, collider doesn't move (optimization)
  
  // Cached bounds for performance
  public bounds: Box3;
  public boundingSphere: Sphere;
  public boundsNeedUpdate: boolean;
  
  // Collision callbacks
  public onCollisionEnter?: (other: Collider, entity: any) => void;
  public onCollisionStay?: (other: Collider, entity: any) => void;
  public onCollisionExit?: (other: Collider, entity: any) => void;
  public onTriggerEnter?: (other: Collider, entity: any) => void;
  public onTriggerStay?: (other: Collider, entity: any) => void;
  public onTriggerExit?: (other: Collider, entity: any) => void;

  constructor(
    type: ColliderType = ColliderType.SPHERE,
    radius: number = 0.5,
    layer: CollisionLayer = CollisionLayer.DEFAULT
  ) {
    super();
    
    this.type = type;
    this.radius = radius;
    this.size = new Vector3(1, 1, 1);
    this.height = 2;
    this.offset = new Vector3(0, 0, 0);
    this.layer = layer;
    this.mask = this.getDefaultMask(layer);
    this.isTrigger = false;
    this.isStatic = false;
    
    // Initialize bounds
    this.bounds = new Box3();
    this.boundingSphere = new Sphere();
    this.boundsNeedUpdate = true;
  }

  private getDefaultMask(layer: CollisionLayer): number {
    switch (layer) {
      case CollisionLayer.PLAYER:
        return CollisionLayer.ENEMY | CollisionLayer.ENVIRONMENT | CollisionLayer.PICKUP;
      case CollisionLayer.ENEMY:
        return CollisionLayer.PLAYER | CollisionLayer.PROJECTILE | CollisionLayer.ENVIRONMENT;
      case CollisionLayer.PROJECTILE:
        return CollisionLayer.PLAYER | CollisionLayer.ENEMY | CollisionLayer.ENVIRONMENT;
      case CollisionLayer.ENVIRONMENT:
        return CollisionLayer.PLAYER | CollisionLayer.ENEMY | CollisionLayer.PROJECTILE;
      case CollisionLayer.PICKUP:
        return CollisionLayer.PLAYER;
      default:
        return 0xFFFFFFFF; // Collide with everything
    }
  }

  public static createSphere(radius: number, layer: CollisionLayer = CollisionLayer.DEFAULT): Collider {
    return new Collider(ColliderType.SPHERE, radius, layer);
  }

  public static createBox(size: Vector3, layer: CollisionLayer = CollisionLayer.DEFAULT): Collider {
    const collider = new Collider(ColliderType.BOX, 0, layer);
    collider.size.copy(size);
    return collider;
  }

  public static createCapsule(radius: number, height: number, layer: CollisionLayer = CollisionLayer.DEFAULT): Collider {
    const collider = new Collider(ColliderType.CAPSULE, radius, layer);
    collider.height = height;
    return collider;
  }

  public static createCylinder(radius: number, height: number, layer: CollisionLayer = CollisionLayer.DEFAULT): Collider {
    const collider = new Collider(ColliderType.CYLINDER, radius, layer);
    collider.height = height;
    return collider;
  }

  public setOffset(x: number, y: number, z: number): void {
    this.offset.set(x, y, z);
    this.boundsNeedUpdate = true;
  }

  public setLayer(layer: CollisionLayer): void {
    this.layer = layer;
    this.mask = this.getDefaultMask(layer);
  }

  public setMask(mask: number): void {
    this.mask = mask;
  }

  public canCollideWith(other: Collider): boolean {
    return (this.mask & other.layer) !== 0 && (other.mask & this.layer) !== 0;
  }

  public updateBounds(worldPosition: Vector3): void {
    if (!this.boundsNeedUpdate && !this.isStatic) {
      return;
    }

    const center = worldPosition.clone().add(this.offset);

    switch (this.type) {
      case ColliderType.SPHERE:
        this.boundingSphere.set(center, this.radius);
        this.bounds.setFromCenterAndSize(center, new Vector3(
          this.radius * 2, this.radius * 2, this.radius * 2
        ));
        break;

      case ColliderType.BOX:
        this.bounds.setFromCenterAndSize(center, this.size);
        this.boundingSphere.setFromPoints([
          center.clone().add(new Vector3(-this.size.x/2, -this.size.y/2, -this.size.z/2)),
          center.clone().add(new Vector3(this.size.x/2, this.size.y/2, this.size.z/2))
        ]);
        break;

      case ColliderType.CAPSULE:
        const capsuleRadius = Math.max(this.radius, this.size.x / 2, this.size.z / 2);
        this.boundingSphere.set(center, Math.max(capsuleRadius, this.height / 2));
        this.bounds.setFromCenterAndSize(center, new Vector3(
          capsuleRadius * 2, this.height, capsuleRadius * 2
        ));
        break;

      case ColliderType.CYLINDER:
        this.boundingSphere.set(center, Math.max(this.radius, this.height / 2));
        this.bounds.setFromCenterAndSize(center, new Vector3(
          this.radius * 2, this.height, this.radius * 2
        ));
        break;
    }

    this.boundsNeedUpdate = false;
  }

  public intersects(other: Collider, thisPosition: Vector3, otherPosition: Vector3): boolean {
    // Update bounds if needed
    this.updateBounds(thisPosition);
    other.updateBounds(otherPosition);

    // Quick bounding sphere check first
    if (!this.boundingSphere.intersectsSphere(other.boundingSphere)) {
      return false;
    }

    // More precise collision detection based on collider types
    return this.preciseIntersection(other, thisPosition, otherPosition);
  }

  private preciseIntersection(other: Collider, thisPosition: Vector3, otherPosition: Vector3): boolean {
    const thisCenter = thisPosition.clone().add(this.offset);
    const otherCenter = otherPosition.clone().add(other.offset);

    // Sphere vs Sphere
    if (this.type === ColliderType.SPHERE && other.type === ColliderType.SPHERE) {
      const distance = thisCenter.distanceTo(otherCenter);
      return distance <= (this.radius + other.radius);
    }

    // Box vs Box
    if (this.type === ColliderType.BOX && other.type === ColliderType.BOX) {
      return this.bounds.intersectsBox(other.bounds);
    }

    // Sphere vs Box
    if ((this.type === ColliderType.SPHERE && other.type === ColliderType.BOX) ||
        (this.type === ColliderType.BOX && other.type === ColliderType.SPHERE)) {
      const sphere = this.type === ColliderType.SPHERE ? this : other;
      const box = this.type === ColliderType.BOX ? this : other;
      const sphereCenter = this.type === ColliderType.SPHERE ? thisCenter : otherCenter;
      
      const closestPoint = new Vector3();
      box.bounds.clampPoint(sphereCenter, closestPoint);
      return sphereCenter.distanceTo(closestPoint) <= sphere.radius;
    }

    // Sphere vs Cylinder (for pillar collisions)
    if ((this.type === ColliderType.SPHERE && other.type === ColliderType.CYLINDER) ||
        (this.type === ColliderType.CYLINDER && other.type === ColliderType.SPHERE)) {
      const sphere = this.type === ColliderType.SPHERE ? this : other;
      const cylinder = this.type === ColliderType.CYLINDER ? this : other;
      const sphereCenter = this.type === ColliderType.SPHERE ? thisCenter : otherCenter;
      const cylinderCenter = this.type === ColliderType.CYLINDER ? thisCenter : otherCenter;
      
      // Check if sphere is within cylinder's height range
      const heightDiff = Math.abs(sphereCenter.y - cylinderCenter.y);
      if (heightDiff > (cylinder.height / 2 + sphere.radius)) {
        return false; // Sphere is above or below cylinder
      }
      
      // Check horizontal distance (XZ plane)
      const horizontalDistance = Math.sqrt(
        Math.pow(sphereCenter.x - cylinderCenter.x, 2) + 
        Math.pow(sphereCenter.z - cylinderCenter.z, 2)
      );
      
      return horizontalDistance <= (sphere.radius + cylinder.radius);
    }

    // For other combinations, fall back to bounding box intersection
    return this.bounds.intersectsBox(other.bounds);
  }

  public getClosestPoint(point: Vector3, worldPosition: Vector3): Vector3 {
    this.updateBounds(worldPosition);
    const center = worldPosition.clone().add(this.offset);

    switch (this.type) {
      case ColliderType.SPHERE:
        const direction = point.clone().sub(center).normalize();
        return center.clone().add(direction.multiplyScalar(this.radius));

      case ColliderType.BOX:
        const closestPoint = new Vector3();
        this.bounds.clampPoint(point, closestPoint);
        return closestPoint;

      default:
        // For other types, use bounding box
        const boxClosest = new Vector3();
        this.bounds.clampPoint(point, boxClosest);
        return boxClosest;
    }
  }

  public getVolume(): number {
    switch (this.type) {
      case ColliderType.SPHERE:
        return (4/3) * Math.PI * Math.pow(this.radius, 3);
      case ColliderType.BOX:
        return this.size.x * this.size.y * this.size.z;
      case ColliderType.CYLINDER:
        return Math.PI * Math.pow(this.radius, 2) * this.height;
      case ColliderType.CAPSULE:
        const sphereVolume = (4/3) * Math.PI * Math.pow(this.radius, 3);
        const cylinderVolume = Math.PI * Math.pow(this.radius, 2) * (this.height - 2 * this.radius);
        return sphereVolume + cylinderVolume;
      default:
        return 1;
    }
  }

  public reset(): void {
    this.type = ColliderType.SPHERE;
    this.radius = 0.5;
    this.size.set(1, 1, 1);
    this.height = 2;
    this.offset.set(0, 0, 0);
    this.layer = CollisionLayer.DEFAULT;
    this.mask = this.getDefaultMask(CollisionLayer.DEFAULT);
    this.isTrigger = false;
    this.isStatic = false;
    this.bounds = new Box3();
    this.boundingSphere = new Sphere();
    this.boundsNeedUpdate = true;
    this.onCollisionEnter = undefined;
    this.onCollisionStay = undefined;
    this.onCollisionExit = undefined;
    this.onTriggerEnter = undefined;
    this.onTriggerStay = undefined;
    this.onTriggerExit = undefined;
    this.enabled = true;
  }

  public clone(): Collider {
    const clone = new Collider(this.type, this.radius, this.layer);
    clone.size.copy(this.size);
    clone.height = this.height;
    clone.offset.copy(this.offset);
    clone.mask = this.mask;
    clone.isTrigger = this.isTrigger;
    clone.isStatic = this.isStatic;
    return clone;
  }
}
