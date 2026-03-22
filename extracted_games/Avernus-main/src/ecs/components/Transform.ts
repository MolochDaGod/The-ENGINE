// Transform component for position, rotation, and scale
import { Vector3, Euler, Quaternion, Matrix4 } from '@/utils/three-exports';
import { Component } from '../Entity';

export class Transform extends Component {
  public static readonly componentType = 'Transform'; // Explicit type identifier
  public readonly componentType = 'Transform'; // Instance identifier
  public position: Vector3;
  public rotation: Euler;
  public scale: Vector3;
  public quaternion: Quaternion;

  // Cached matrices for performance
  public matrix: Matrix4;
  public worldMatrix: Matrix4;
  public matrixNeedsUpdate = true;

  // Parent-child relationships
  public parent: Transform | null = null;
  public children: Transform[] = [];

  constructor(
    position: Vector3 = new Vector3(0, 0, 0),
    rotation: Euler = new Euler(0, 0, 0),
    scale: Vector3 = new Vector3(1, 1, 1)
  ) {
    super();
    
    this.position = position.clone();
    this.rotation = rotation.clone();
    this.scale = scale.clone();
    this.quaternion = new Quaternion();
    this.matrix = new Matrix4();
    this.worldMatrix = new Matrix4();
    
    this.updateQuaternion();
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.markMatrixDirty();
  }

  public setRotation(x: number, y: number, z: number): void {
    this.rotation.set(x, y, z);
    this.updateQuaternion();
    this.markMatrixDirty();
  }

  public setScale(x: number, y: number, z: number): void {
    this.scale.set(x, y, z);
    this.markMatrixDirty();
  }

  public translate(x: number, y: number, z: number): void {
    this.position.x += x;
    this.position.y += y;
    this.position.z += z;
    this.markMatrixDirty();
  }

  public rotate(x: number, y: number, z: number): void {
    this.rotation.x += x;
    this.rotation.y += y;
    this.rotation.z += z;
    this.updateQuaternion();
    this.markMatrixDirty();
  }

  public lookAt(target: Vector3, up: Vector3 = new Vector3(0, 1, 0)): void {
    const matrix = new Matrix4();
    matrix.lookAt(this.position, target, up);
    this.quaternion.setFromRotationMatrix(matrix);
    this.rotation.setFromQuaternion(this.quaternion);
    this.markMatrixDirty();
  }

  public getForward(): Vector3 {
    const forward = new Vector3(0, 0, -1);
    forward.applyQuaternion(this.quaternion);
    return forward;
  }

  public getRight(): Vector3 {
    const right = new Vector3(1, 0, 0);
    right.applyQuaternion(this.quaternion);
    return right;
  }

  public getUp(): Vector3 {
    const up = new Vector3(0, 1, 0);
    up.applyQuaternion(this.quaternion);
    return up;
  }

  public getWorldPosition(): Vector3 {
    this.updateWorldMatrix();
    const worldPosition = new Vector3();
    worldPosition.setFromMatrixPosition(this.worldMatrix);
    return worldPosition;
  }

  public getWorldRotation(): Quaternion {
    this.updateWorldMatrix();
    const worldQuaternion = new Quaternion();
    worldQuaternion.setFromRotationMatrix(this.worldMatrix);
    return worldQuaternion;
  }

  public getWorldScale(): Vector3 {
    this.updateWorldMatrix();
    const worldScale = new Vector3();
    worldScale.setFromMatrixScale(this.worldMatrix);
    return worldScale;
  }

  public updateMatrix(): void {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.matrixNeedsUpdate = false;
  }

  public updateWorldMatrix(): void {
    if (this.matrixNeedsUpdate) {
      this.updateMatrix();
    }

    if (this.parent) {
      this.parent.updateWorldMatrix();
      this.worldMatrix.multiplyMatrices(this.parent.worldMatrix, this.matrix);
    } else {
      this.worldMatrix.copy(this.matrix);
    }
  }

  public addChild(child: Transform): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    
    child.parent = this;
    this.children.push(child);
  }

  public removeChild(child: Transform): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  public removeFromParent(): void {
    if (this.parent) {
      this.parent.removeChild(this);
    }
  }

  private updateQuaternion(): void {
    this.quaternion.setFromEuler(this.rotation);
  }

  private markMatrixDirty(): void {
    this.matrixNeedsUpdate = true;
    
    // Mark all children as dirty too
    for (const child of this.children) {
      child.markMatrixDirty();
    }
  }

  public reset(): void {
    // Ensure Vector3 objects are properly initialized
    if (!this.position) {
      this.position = new Vector3(0, 0, 0);
    } else {
      this.position.set(0, 0, 0);
    }
    
    if (!this.rotation) {
      this.rotation = new Euler(0, 0, 0);
    } else {
      this.rotation.set(0, 0, 0);
    }
    
    if (!this.scale) {
      this.scale = new Vector3(1, 1, 1);
    } else {
      this.scale.set(1, 1, 1);
    }
    
    if (!this.quaternion) {
      this.quaternion = new Quaternion();
    } else {
      this.quaternion.set(0, 0, 0, 1);
    }
    
    if (!this.matrix) {
      this.matrix = new Matrix4();
    } else {
      this.matrix.identity();
    }
    
    if (!this.worldMatrix) {
      this.worldMatrix = new Matrix4();
    } else {
      this.worldMatrix.identity();
    }
    
    this.matrixNeedsUpdate = true;
    
    // Clear parent-child relationships
    this.removeFromParent();
    while (this.children.length > 0) {
      this.removeChild(this.children[0]);
    }
    
    this.enabled = true;
  }

  public clone(): Transform {
    const clone = new Transform(this.position, this.rotation, this.scale);
    clone.quaternion.copy(this.quaternion);
    return clone;
  }
}
