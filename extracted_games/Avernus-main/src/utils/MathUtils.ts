// Math utilities for game development
import { Vector3 } from '@/utils/three-exports';

export class MathUtils {
  public static readonly DEG_TO_RAD = Math.PI / 180;
  public static readonly RAD_TO_DEG = 180 / Math.PI;

  // Clamp value between min and max
  public static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // Linear interpolation
  public static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // Smooth step interpolation
  public static smoothStep(edge0: number, edge1: number, x: number): number {
    const t = this.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // Distance between two 2D points
  public static distance2D(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Distance between two 3D points
  public static distance3D(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Normalize angle to [-PI, PI]
  public static normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  // Random number between min and max
  public static random(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  // Random integer between min and max (inclusive)
  public static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Check if point is inside circle
  public static pointInCircle(
    px: number, py: number,
    cx: number, cy: number,
    radius: number
  ): boolean {
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= radius * radius;
  }

  // Vector3 utilities
  public static vector3Distance(a: Vector3, b: Vector3): number {
    return a.distanceTo(b);
  }

  public static vector3Lerp(a: Vector3, b: Vector3, t: number): Vector3 {
    return new Vector3().lerpVectors(a, b, t);
  }

  // Convert degrees to radians
  public static degToRad(degrees: number): number {
    return degrees * this.DEG_TO_RAD;
  }

  // Convert radians to degrees
  public static radToDeg(radians: number): number {
    return radians * this.RAD_TO_DEG;
  }

  // Check if number is approximately equal (for floating point comparison)
  public static approximately(a: number, b: number, epsilon: number = 0.0001): boolean {
    return Math.abs(a - b) < epsilon;
  }

  // Map value from one range to another
  public static map(
    value: number,
    fromMin: number, fromMax: number,
    toMin: number, toMax: number
  ): number {
    return (value - fromMin) * (toMax - toMin) / (fromMax - fromMin) + toMin;
  }
}
