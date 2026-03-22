// Camera system for third-person camera controls
import { PerspectiveCamera, Spherical, Vector3 } from '@/utils/three-exports';
import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { InputManager } from '@/core/InputManager';
import { MathUtils } from '@/utils/MathUtils';

export interface CameraConfig {
  distance: number;
  height: number;
  mouseSensitivity: number;
  smoothing: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  maxDistance: number;
}

export class CameraSystem extends System {
  public readonly requiredComponents = [Transform];
  private camera: PerspectiveCamera;
  private inputManager: InputManager;
  private target: Entity | null = null;
  
  // Camera configuration
  private config: CameraConfig = {
    distance: 10,
    height: 5,
    mouseSensitivity: 0.005, // Increased for better responsiveness
    smoothing: 0.1,
    minPolarAngle: Math.PI / 3.5, // Prevent camera from going above horizon
    maxPolarAngle: Math.PI / 2.5, // Prevent camera from looking underneath the map
    maxDistance: 12.5,
  };

  // Camera state
  private spherical = new Spherical(10, Math.PI / 3, 0);
  private targetPosition = new Vector3();
  private currentPosition = new Vector3();
  private currentLookAt = new Vector3();
  private targetLookAt = new Vector3();
  
  // Mouse state for camera rotation
  private isRightMouseDown = false;
  private wheelListenerAdded = false;

  // Stun state for camera rotation disable
  private cameraRotationDisabled = false;
  private disabledByEntityId: string | null = null;

  constructor(camera: PerspectiveCamera, inputManager: InputManager, config?: Partial<CameraConfig>) {
    super();
    this.camera = camera;
    this.inputManager = inputManager;
    this.priority = 900; // Run late, after movement

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.spherical.radius = this.config.distance;
    this.spherical.phi = Math.PI / 3; // Start at 60 degrees
    this.spherical.theta = 0;

    this.setupEventListeners();
    this.setupInitialPosition();
  }

  public setTarget(entity: Entity): void {
    this.target = entity;
  }

  public setConfig(config: Partial<CameraConfig>): void {
    this.config = { ...this.config, ...config };
    this.spherical.radius = this.config.distance;
  }

  public update(entities: Entity[], deltaTime: number): void {
    if (!this.target) return;

    const targetTransform = this.target.getComponent(Transform);
    if (!targetTransform) return;

    // Handle mouse input for camera rotation
    this.handleMouseInput();

    // Update target position
    this.targetLookAt.copy(targetTransform.position);
    this.targetLookAt.y += this.config.height;

    // Calculate camera position based on spherical coordinates
    this.targetPosition.setFromSpherical(this.spherical);
    this.targetPosition.add(this.targetLookAt);

    // Smooth camera movement
    this.currentPosition.lerp(this.targetPosition, this.config.smoothing);
    this.currentLookAt.lerp(this.targetLookAt, this.config.smoothing);

    // Update camera
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  private handleMouseInput(): void {
    const mouseDelta = this.inputManager.getMouseDelta();

    // Only rotate camera when right mouse button is held down AND camera rotation is not disabled
    if ((mouseDelta.x !== 0 || mouseDelta.y !== 0) && this.isRightMouseDown && !this.cameraRotationDisabled) {
      // Update spherical coordinates based on mouse movement
      this.spherical.theta -= mouseDelta.x * this.config.mouseSensitivity;
      this.spherical.phi -= mouseDelta.y * this.config.mouseSensitivity; // Inverted Y for natural camera feel

      // Clamp phi to prevent camera flipping
      this.spherical.phi = MathUtils.clamp(
        this.spherical.phi,
        this.config.minPolarAngle,
        this.config.maxPolarAngle
      );

      // Normalize theta
      this.spherical.theta = MathUtils.normalizeAngle(this.spherical.theta);
    }
  }

  private setupEventListeners(): void {
    // Mouse button events for camera rotation
    this.inputManager.on('mouseDown', ({ button }) => {
      if (button === 2) { // Right mouse button
        this.isRightMouseDown = true;
      }
    });

    this.inputManager.on('mouseUp', ({ button }) => {
      if (button === 2) { // Right mouse button
        this.isRightMouseDown = false;
      }
    });

    // Mouse wheel for zoom - only add listener once
    if (!this.wheelListenerAdded) {
      this.inputManager.on('wheel', ({ deltaY }) => {
        this.spherical.radius += deltaY * 0.01;
        this.spherical.radius = MathUtils.clamp(this.spherical.radius, 2, this.config.maxDistance);
      });
      this.wheelListenerAdded = true;
    }
  }

  private setupInitialPosition(): void {
    this.currentPosition.setFromSpherical(this.spherical);
    this.currentLookAt.set(0, this.config.height, 0);
    this.targetPosition.copy(this.currentPosition);
    this.targetLookAt.copy(this.currentLookAt);
    
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  // Utility methods
  public getCameraDirection(): Vector3 {
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    return direction;
  }

  public getCameraRight(): Vector3 {
    const direction = this.getCameraDirection();
    const right = new Vector3();
    right.crossVectors(direction, new Vector3(0, 1, 0));
    right.normalize();
    return right;
  }

  public getCameraForward(): Vector3 {
    const right = this.getCameraRight();
    const forward = new Vector3();
    forward.crossVectors(new Vector3(0, 1, 0), right);
    forward.normalize();
    return forward;
  }

  public getDistance(): number {
    return this.spherical.radius;
  }

  public setDistance(distance: number): void {
    this.spherical.radius = MathUtils.clamp(distance, 2, this.config.maxDistance);
  }

  public getHorizontalAngle(): number {
    return this.spherical.theta;
  }

  public getVerticalAngle(): number {
    return this.spherical.phi;
  }

  public setAngles(horizontal: number, vertical: number): void {
    this.spherical.theta = MathUtils.normalizeAngle(horizontal);
    this.spherical.phi = MathUtils.clamp(
      vertical,
      this.config.minPolarAngle,
      this.config.maxPolarAngle
    );
  }

  public resetCamera(): void {
    this.spherical.radius = this.config.distance;
    this.spherical.phi = Math.PI / 3;
    this.spherical.theta = 0;
    this.setupInitialPosition();
  }

  public snapToTarget(): void {
    if (!this.target) return;

    const targetTransform = this.target.getComponent(Transform);
    if (!targetTransform || !targetTransform.position) return;

    // Safety check: ensure position is properly initialized
    if (targetTransform.position.x === undefined || 
        targetTransform.position.y === undefined || 
        targetTransform.position.z === undefined) {
      return;
    }

    this.targetLookAt.copy(targetTransform.position);
    this.targetLookAt.y += this.config.height;

    this.targetPosition.setFromSpherical(this.spherical);
    this.targetPosition.add(this.targetLookAt);

    this.currentPosition.copy(this.targetPosition);
    this.currentLookAt.copy(this.targetLookAt);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  public getCamera(): PerspectiveCamera {
    return this.camera;
  }

  // Disable/enable camera rotation (used for stun effects)
  public setCameraRotationDisabled(disabled: boolean, entityId?: string): void {
    this.cameraRotationDisabled = disabled;
    this.disabledByEntityId = disabled ? (entityId || null) : null;
  }

  // Check if camera rotation is disabled
  public isCameraRotationDisabled(): boolean {
    return this.cameraRotationDisabled;
  }

  // Get the entity ID that disabled camera rotation
  public getCameraRotationDisabledBy(): string | null {
    return this.disabledByEntityId;
  }

  // Disable/enable camera rotation for death state
  public setDeathCameraDisabled(disabled: boolean, playerId?: string): void {
    this.setCameraRotationDisabled(disabled, playerId);
  }
}
