// Performance utility functions
// Helper functions for performance optimization

import { Vector3, Matrix4, Quaternion } from '@/utils/three-exports';

/**
 * Fast distance calculation (squared to avoid sqrt)
 */
export function fastDistanceSquared(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Fast distance calculation with sqrt
 */
export function fastDistance(a: Vector3, b: Vector3): number {
  return Math.sqrt(fastDistanceSquared(a, b));
}

/**
 * Fast vector normalization
 */
export function fastNormalize(vector: Vector3): Vector3 {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
  if (length > 0) {
    vector.x /= length;
    vector.y /= length;
    vector.z /= length;
  }
  return vector;
}

/**
 * Fast dot product
 */
export function fastDot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Fast cross product
 */
export function fastCross(a: Vector3, b: Vector3, result: Vector3 = new Vector3()): Vector3 {
  result.x = a.y * b.z - a.z * b.y;
  result.y = a.z * b.x - a.x * b.z;
  result.z = a.x * b.y - a.y * b.x;
  return result;
}

/**
 * Fast matrix multiplication for common transformations
 */
export function fastMatrixMultiply(a: Matrix4, b: Matrix4, result: Matrix4 = new Matrix4()): Matrix4 {
  const ae = a.elements;
  const be = b.elements;
  const te = result.elements;

  const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
  const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
  const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
  const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];

  const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
  const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
  const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
  const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];

  te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
  te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
  te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
  te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

  te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
  te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
  te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
  te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

  te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
  te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
  te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
  te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

  te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
  te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
  te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
  te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

  return result;
}

/**
 * Fast quaternion slerp for smooth rotations
 */
export function fastSlerp(
  qa: Quaternion,
  qb: Quaternion,
  t: number,
  result: Quaternion = new Quaternion()
): Quaternion {
  // Use proper spherical linear interpolation for quaternions
  return result.copy(qa).slerp(qb, t);
}

/**
 * Fast bounding box check
 */
export function fastAABBCheck(
  centerA: Vector3,
  sizeA: Vector3,
  centerB: Vector3,
  sizeB: Vector3
): boolean {
  return (
    Math.abs(centerA.x - centerB.x) <= (sizeA.x + sizeB.x) / 2 &&
    Math.abs(centerA.y - centerB.y) <= (sizeA.y + sizeB.y) / 2 &&
    Math.abs(centerA.z - centerB.z) <= (sizeA.z + sizeB.z) / 2
  );
}

/**
 * Fast sphere-sphere collision check
 */
export function fastSphereCheck(
  centerA: Vector3,
  radiusA: number,
  centerB: Vector3,
  radiusB: number
): boolean {
  const distanceSquared = fastDistanceSquared(centerA, centerB);
  const radiusSum = radiusA + radiusB;
  return distanceSquared <= radiusSum * radiusSum;
}

/**
 * Fast point-in-sphere check
 */
export function fastPointInSphere(
  point: Vector3,
  sphereCenter: Vector3,
  sphereRadius: number
): boolean {
  return fastDistanceSquared(point, sphereCenter) <= sphereRadius * sphereRadius;
}

/**
 * Fast clamp function
 */
export function fastClamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Fast lerp function
 */
export function fastLerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Fast smoothstep function
 */
export function fastSmoothstep(edge0: number, edge1: number, x: number): number {
  const t = fastClamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Fast smootherstep function
 */
export function fastSmootherstep(edge0: number, edge1: number, x: number): number {
  const t = fastClamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Fast random number generation
 */
export function fastRandom(): number {
  return Math.random();
}

/**
 * Fast random in range
 */
export function fastRandomRange(min: number, max: number): number {
  return min + (max - min) * Math.random();
}

/**
 * Fast random integer in range
 */
export function fastRandomInt(min: number, max: number): number {
  return Math.floor(min + (max - min + 1) * Math.random());
}

/**
 * Fast power of 2 check
 */
export function fastIsPowerOf2(n: number): boolean {
  return (n & (n - 1)) === 0;
}

/**
 * Fast next power of 2
 */
export function fastNextPowerOf2(n: number): number {
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  return n + 1;
}

/**
 * Fast angle normalization
 */
export function fastNormalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Fast angle difference
 */
export function fastAngleDifference(a: number, b: number): number {
  const diff = fastNormalizeAngle(a - b);
  return Math.abs(diff) > Math.PI ? diff - Math.sign(diff) * 2 * Math.PI : diff;
}
