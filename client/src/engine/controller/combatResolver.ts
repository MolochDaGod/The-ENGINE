/**
 * Melee combat resolution — ported from artifact animator src/three/combat.ts.
 * Shared damage model for player + AI (OWR range respect).
 */
import * as THREE from 'three';

export interface WeaponCombatProfile {
  intensity: number;
  range: [number, number];
}

export interface MeleeStrike {
  reach: number;
  radius: number;
  damage: number;
  force: number;
}

export interface OWR {
  inner: number;
  optimalMin: number;
  optimalMax: number;
  outer: number;
}

/** Distance attenuation: 1 at centre → 0 at rim; -1 when out of range. */
export function aoeFalloff(dist: number, radius: number): number {
  if (radius <= 0 || dist > radius) return -1;
  return 1 - dist / radius;
}

export function meleeStrike(
  combat: WeaponCombatProfile,
  opts: { finisher?: boolean; skill?: boolean; skillForce: number; damageScale?: number },
): MeleeStrike {
  const intensityN = THREE.MathUtils.clamp(combat.intensity, 1, 100) / 100;
  const [rMin, rMax] = combat.range;
  const finisher = opts.finisher ?? false;
  const skill = opts.skill ?? false;
  const damageScale = opts.damageScale ?? 1;
  const damage = (10 + 26 * intensityN) * (finisher ? 1.6 : 1) * (skill ? 1.5 : 1) * damageScale;
  const force = opts.skillForce * (0.4 + intensityN * 0.9) * (finisher ? 1.5 : 1) * (skill ? 1.4 : 1);
  const radius = (rMax - rMin) * 0.5 + 0.5 + (finisher ? 0.3 : 0) + (skill ? 0.6 : 0);
  return { reach: (rMin + rMax) * 0.5, radius, damage, force };
}

/** Build optimal weapon range envelope from a reach band. */
export function buildOWR(range: [number, number]): OWR {
  const [rMin, rMax] = range;
  const span = rMax - rMin;
  return {
    inner: Math.max(0.3, rMin * 0.6),
    optimalMin: rMin,
    optimalMax: rMax,
    outer: rMax + span * 0.35 + 0.4,
  };
}

/** Strike quality from attacker/target OWR positioning (artifact animator OWR model). */
export function strikeQuality(
  distance: number,
  attacker: OWR,
  target: OWR,
): 'whiff' | 'weak' | 'clean' | 'punish' {
  if (distance > attacker.outer) return 'whiff';
  if (distance < attacker.inner) return 'weak';
  if (distance >= attacker.optimalMin && distance <= attacker.optimalMax) return 'clean';
  if (distance > target.optimalMax && distance <= attacker.outer) return 'punish';
  return 'weak';
}

export function damageScaleForQuality(q: ReturnType<typeof strikeQuality>): number {
  switch (q) {
    case 'clean': return 1;
    case 'punish': return 1.25;
    case 'weak': return 0.45;
    default: return 0;
  }
}