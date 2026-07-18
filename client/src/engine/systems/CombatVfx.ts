/**
 * Grudge Engine — CombatVfx
 *
 * Lightweight, dependency-free combat VFX used by annihilate-demo and other
 * arena modes. Particle bursts (hits, slashes, dashes, death) with additive
 * blending — same approach as Avernus Arena fire particles / weapon-tier auras.
 */

import * as THREE from "three";
import type { Updatable } from "../core/GrudgeEngine";

export type VfxKind = "hit" | "slash" | "dash" | "block" | "magic" | "death" | "charge";

interface Burst {
  points: THREE.Points;
  velocities: Float32Array;
  ages: Float32Array;
  lifetimes: Float32Array;
  life: number;
  maxLife: number;
}

interface RingFlash {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  grow: number;
}

const KIND_COLORS: Record<VfxKind, number> = {
  hit: 0xff5533,
  slash: 0xffdd88,
  dash: 0x66ccff,
  block: 0x88aaff,
  magic: 0xaa66ff,
  death: 0xff2244,
  charge: 0xffcc44,
};

export class CombatVfx implements Updatable {
  private _scene: THREE.Scene;
  private _bursts: Burst[] = [];
  private _rings: RingFlash[] = [];
  private _tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this._scene = scene;
  }

  /** Spawn a radial particle burst at world position. */
  burst(
    position: THREE.Vector3 | { x: number; y: number; z: number },
    kind: VfxKind = "hit",
    count = 28,
    speed = 4,
  ): void {
    const color = KIND_COLORS[kind] ?? 0xffffff;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const ages = new Float32Array(count);
    const lifetimes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      // Hemisphere-ish spray
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.7;
      const s = speed * (0.45 + Math.random() * 0.75);
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * s;
      velocities[i * 3 + 1] = Math.cos(phi) * s * (kind === "dash" ? 0.35 : 0.85) + (kind === "death" ? 1.5 : 0.4);
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * s;
      ages[i] = 0;
      lifetimes[i] = 0.25 + Math.random() * 0.45;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size: kind === "slash" ? 0.22 : kind === "magic" ? 0.28 : 0.18,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this._scene.add(points);

    this._bursts.push({
      points,
      velocities,
      ages,
      lifetimes,
      life: 0,
      maxLife: 0.7,
    });
  }

  /** Expanding ground ring — good for land / charge / whirlwind. */
  ring(
    position: THREE.Vector3 | { x: number; y: number; z: number },
    kind: VfxKind = "slash",
    radius = 1.2,
  ): void {
    const color = KIND_COLORS[kind] ?? 0xffffff;
    const geo = new THREE.RingGeometry(radius * 0.55, radius, 32);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, position.y + 0.08, position.z);
    this._scene.add(mesh);
    this._rings.push({ mesh, life: 0, maxLife: 0.45, grow: 2.4 });
  }

  /** Arc slash in front of a character facing direction (x/z unit-ish). */
  slashArc(
    origin: THREE.Vector3 | { x: number; y: number; z: number },
    facingX: number,
    facingZ: number,
    kind: VfxKind = "slash",
  ): void {
    this._tmp.set(origin.x, origin.y + 1.1, origin.z);
    this._tmp.x += facingX * 0.9;
    this._tmp.z += facingZ * 0.9;
    this.burst(this._tmp, kind, 18, 5.5);
  }

  update(dt: number): void {
    // Bursts
    for (let b = this._bursts.length - 1; b >= 0; b--) {
      const burst = this._bursts[b];
      burst.life += dt;
      const posAttr = burst.points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const n = arr.length / 3;
      let alive = false;

      for (let i = 0; i < n; i++) {
        burst.ages[i] += dt;
        if (burst.ages[i] < burst.lifetimes[i]) {
          alive = true;
          arr[i * 3] += burst.velocities[i * 3] * dt;
          arr[i * 3 + 1] += burst.velocities[i * 3 + 1] * dt;
          arr[i * 3 + 2] += burst.velocities[i * 3 + 2] * dt;
          // Gravity-ish
          burst.velocities[i * 3 + 1] -= 6 * dt;
        }
      }
      posAttr.needsUpdate = true;

      const mat = burst.points.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 1 - burst.life / burst.maxLife);

      if (!alive || burst.life >= burst.maxLife) {
        this._scene.remove(burst.points);
        burst.points.geometry.dispose();
        mat.dispose();
        this._bursts.splice(b, 1);
      }
    }

    // Rings
    for (let r = this._rings.length - 1; r >= 0; r--) {
      const ring = this._rings[r];
      ring.life += dt;
      const t = ring.life / ring.maxLife;
      const s = 1 + t * ring.grow;
      ring.mesh.scale.set(s, s, s);
      const mat = ring.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.65 * (1 - t));
      if (ring.life >= ring.maxLife) {
        this._scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        mat.dispose();
        this._rings.splice(r, 1);
      }
    }
  }

  destroy(): void {
    for (const b of this._bursts) {
      this._scene.remove(b.points);
      b.points.geometry.dispose();
      (b.points.material as THREE.Material).dispose();
    }
    for (const r of this._rings) {
      this._scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      (r.mesh.material as THREE.Material).dispose();
    }
    this._bursts = [];
    this._rings = [];
  }
}
