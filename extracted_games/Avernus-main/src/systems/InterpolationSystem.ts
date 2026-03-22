// Interpolation system for smooth entity movement and rotation
import { Vector3, Quaternion } from '@/utils/three-exports';
import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { InterpolationBuffer } from '@/ecs/components/Interpolation';
import { Movement } from '@/ecs/components/Movement';

export class InterpolationSystem extends System {
  public readonly requiredComponents = [Transform, InterpolationBuffer];
  private currentTime = 0;

  constructor() {
    super();
    this.priority = 20; // Run after physics but before rendering
  }

  /**
   * Update interpolation for all entities with interpolation buffers
   */
  public update(entities: Entity[], deltaTime: number): void {
    this.currentTime = performance.now();

    for (const entity of entities) {
      const transform = entity.getComponent(Transform);
      const interpolationBuffer = entity.getComponent(InterpolationBuffer);
      const movement = entity.getComponent(Movement);

      if (!transform?.enabled || !interpolationBuffer?.enabled) {
        continue;
      }

      // Skip local players (entities that can move) - they should not be interpolated
      // Only remote players (canMove = false) should use interpolation
      if (movement && movement.canMove) {
        continue;
      }

      // Update knockback for remote players (since they don't go through MovementSystem)
      if (movement && movement.isKnockbacked) {
        const currentTime = Date.now() / 1000; // Convert to seconds
        const knockbackResult = movement.updateKnockback(currentTime);
        
        if (knockbackResult.newPosition) {
          // Apply knockback position directly for remote players
          transform.position.copy(knockbackResult.newPosition);
          // console.log(`🌊 Remote player knockback updated: position=(${knockbackResult.newPosition.x.toFixed(2)}, ${knockbackResult.newPosition.z.toFixed(2)}), entity=${entity.id}`);
        }
        
        if (knockbackResult.isComplete) {
          // console.log(`✅ Remote player knockback completed for entity ${entity.id}`);
        }
      }

      // Only interpolate if not being knocked back (knockback has priority)
      if (!movement || !movement.isKnockbacked) {
        this.interpolateEntity(transform, interpolationBuffer);
      }
    }
  }

  /**
   * Render interpolation (called during render phase for smooth visuals)
   */
  public render(entities: Entity[], deltaTime: number): void {
    // For now, render and update phases are the same for interpolation
    // In the future, we could separate concerns if needed
    this.update(entities, deltaTime);
  }

  /**
   * Interpolate a single entity's transform
   */
  private interpolateEntity(transform: Transform, interpolationBuffer: InterpolationBuffer): void {
    const interpolatedTransform = interpolationBuffer.getInterpolatedTransform(this.currentTime);

    // Apply interpolated position
    transform.position.copy(interpolatedTransform.position);

    // Apply interpolated rotation
    transform.quaternion.copy(interpolatedTransform.rotation);

    // Update the transform's Euler rotation to match the quaternion
    transform.rotation.setFromQuaternion(transform.quaternion);

    // Mark matrices as needing update
    transform.matrixNeedsUpdate = true;
  }

  /**
   * Add server state to an entity's interpolation buffer
   */
  public addServerState(entity: Entity, position: Vector3, rotation: Quaternion, timestamp?: number): void {
    const interpolationBuffer = entity.getComponent(InterpolationBuffer);
    if (interpolationBuffer) {
      interpolationBuffer.addServerState(position, rotation, timestamp);
    }
  }

  /**
   * Get interpolation statistics for debugging
   */
  public getInterpolationStats(entity: Entity): any {
    const interpolationBuffer = entity.getComponent(InterpolationBuffer);
    if (interpolationBuffer) {
      return interpolationBuffer.getBufferStats();
    }
    return null;
  }

  /**
   * Clear interpolation buffer for an entity
   */
  public clearInterpolationBuffer(entity: Entity): void {
    const interpolationBuffer = entity.getComponent(InterpolationBuffer);
    if (interpolationBuffer) {
      interpolationBuffer.clearBuffer();
    }
  }

  /**
   * Set interpolation delay for all entities (in milliseconds)
   */
  public setInterpolationDelay(entity: Entity, delayMs: number): void {
    // Note: This would require modifying the InterpolationBuffer component
    // For now, the delay is fixed in the component itself
    // console.warn('Interpolation delay is currently fixed in InterpolationBuffer component');
  }

  /**
   * Get the current render time used for interpolation
   */
  public getCurrentRenderTime(): number {
    return this.currentTime;
  }

  /**
   * Advanced interpolation methods for smoother movement
   */

  /**
   * Hermite spline interpolation for smoother curves
   * This provides better interpolation between keyframes by considering velocity
   */
  public static hermiteInterpolate(
    p0: Vector3, // Start position
    p1: Vector3, // End position
    v0: Vector3, // Start velocity (tangent)
    v1: Vector3, // End velocity (tangent)
    t: number   // Interpolation factor [0,1]
  ): Vector3 {
    const t2 = t * t;
    const t3 = t2 * t;

    // Hermite basis functions
    const h00 = 2 * t3 - 3 * t2 + 1;    // (1 + 2t)(1 - t)^2
    const h10 = t3 - 2 * t2 + t;        // t(1 - t)^2
    const h01 = -2 * t3 + 3 * t2;       // t^2(3 - 2t)
    const h11 = t3 - t2;                // t^2(t - 1)

    const result = new Vector3();
    result.addScaledVector(p0, h00);
    result.addScaledVector(v0, h10);
    result.addScaledVector(p1, h01);
    result.addScaledVector(v1, h11);

    return result;
  }

  /**
   * Catmull-Rom spline interpolation for smooth curves through waypoints
   */
  public static catmullRomInterpolate(
    p0: Vector3, // Previous point
    p1: Vector3, // Start point
    p2: Vector3, // End point
    p3: Vector3, // Next point
    t: number    // Interpolation factor [0,1]
  ): Vector3 {
    const t2 = t * t;
    const t3 = t2 * t;

    // Catmull-Rom basis functions
    const c00 = -0.5 * t3 + t2 - 0.5 * t;
    const c10 = 1.5 * t3 - 2.5 * t2 + 1;
    const c20 = -1.5 * t3 + 2 * t2 + 0.5 * t;
    const c30 = 0.5 * t3 - 0.5 * t2;

    const result = new Vector3();
    result.addScaledVector(p0, c00);
    result.addScaledVector(p1, c10);
    result.addScaledVector(p2, c20);
    result.addScaledVector(p3, c30);

    return result;
  }

  /**
   * Cubic Bezier interpolation for smooth curves with control points
   */
  public static bezierInterpolate(
    p0: Vector3, // Start point
    p1: Vector3, // Control point 1
    p2: Vector3, // Control point 2
    p3: Vector3, // End point
    t: number    // Interpolation factor [0,1]
  ): Vector3 {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    const result = new Vector3();
    result.addScaledVector(p0, uuu);      // (1-t)^3 * p0
    result.addScaledVector(p1, 3 * uu * t); // 3*(1-t)^2*t * p1
    result.addScaledVector(p2, 3 * u * tt);  // 3*(1-t)*t^2 * p2
    result.addScaledVector(p3, ttt);       // t^3 * p3

    return result;
  }

  /**
   * Smooth step interpolation for easing
   */
  public static smoothStepInterpolate(start: Vector3, end: Vector3, t: number): Vector3 {
    // Smoothstep function: 3t^2 - 2t^3
    const smoothT = t * t * (3 - 2 * t);
    return new Vector3().lerpVectors(start, end, smoothT);
  }

  /**
   * Smoother step interpolation for even smoother easing
   */
  public static smootherStepInterpolate(start: Vector3, end: Vector3, t: number): Vector3 {
    // Smootherstep function: 6t^5 - 15t^4 + 10t^3
    const smoothT = t * t * t * (t * (6 * t - 15) + 10);
    return new Vector3().lerpVectors(start, end, smoothT);
  }
}
