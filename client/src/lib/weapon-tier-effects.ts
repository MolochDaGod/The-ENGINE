/**
 * Canonical tier visuals for weapon/armor previews.
 * Colors match ObjectStore master-weapons.json tier palette.
 */

import * as THREE from "three";

export interface TierVisualProfile {
  tier: number;
  label: string;
  color: string;
  emissiveIntensity: number;
  emissiveMix: number;
  metalnessBoost: number;
  roughnessDelta: number;
  pointLightIntensity: number;
  auraScale: number;
  auraOpacity: number;
  pulseSpeed: number;
}

/** ObjectStore canonical tier colors (T1–T8). */
export const CANONICAL_TIER_VISUALS: Record<number, TierVisualProfile> = {
  1: {
    tier: 1,
    label: "Common",
    color: "#8b7355",
    emissiveIntensity: 0,
    emissiveMix: 0,
    metalnessBoost: 0,
    roughnessDelta: 0,
    pointLightIntensity: 0,
    auraScale: 0,
    auraOpacity: 0,
    pulseSpeed: 0,
  },
  2: {
    tier: 2,
    label: "Uncommon",
    color: "#a8a8a8",
    emissiveIntensity: 0.08,
    emissiveMix: 0.15,
    metalnessBoost: 0.05,
    roughnessDelta: -0.05,
    pointLightIntensity: 0.15,
    auraScale: 0,
    auraOpacity: 0,
    pulseSpeed: 0,
  },
  3: {
    tier: 3,
    label: "Rare",
    color: "#4a9eff",
    emissiveIntensity: 0.18,
    emissiveMix: 0.35,
    metalnessBoost: 0.1,
    roughnessDelta: -0.08,
    pointLightIntensity: 0.35,
    auraScale: 0,
    auraOpacity: 0,
    pulseSpeed: 1.2,
  },
  4: {
    tier: 4,
    label: "Epic",
    color: "#9d4dff",
    emissiveIntensity: 0.28,
    emissiveMix: 0.45,
    metalnessBoost: 0.15,
    roughnessDelta: -0.1,
    pointLightIntensity: 0.55,
    auraScale: 1.15,
    auraOpacity: 0.12,
    pulseSpeed: 1.6,
  },
  5: {
    tier: 5,
    label: "Heroic",
    color: "#ff4d4d",
    emissiveIntensity: 0.38,
    emissiveMix: 0.55,
    metalnessBoost: 0.2,
    roughnessDelta: -0.12,
    pointLightIntensity: 0.75,
    auraScale: 1.25,
    auraOpacity: 0.16,
    pulseSpeed: 2.0,
  },
  6: {
    tier: 6,
    label: "Mythic",
    color: "#ffaa00",
    emissiveIntensity: 0.48,
    emissiveMix: 0.65,
    metalnessBoost: 0.28,
    roughnessDelta: -0.15,
    pointLightIntensity: 0.95,
    auraScale: 1.35,
    auraOpacity: 0.2,
    pulseSpeed: 2.4,
  },
  7: {
    tier: 7,
    label: "Ancient",
    color: "#d4a84b",
    emissiveIntensity: 0.58,
    emissiveMix: 0.75,
    metalnessBoost: 0.35,
    roughnessDelta: -0.18,
    pointLightIntensity: 1.15,
    auraScale: 1.45,
    auraOpacity: 0.24,
    pulseSpeed: 2.8,
  },
  8: {
    tier: 8,
    label: "Legendary",
    color: "#f0d890",
    emissiveIntensity: 0.72,
    emissiveMix: 0.85,
    metalnessBoost: 0.42,
    roughnessDelta: -0.22,
    pointLightIntensity: 1.4,
    auraScale: 1.55,
    auraOpacity: 0.3,
    pulseSpeed: 3.2,
  },
};

export function getTierVisualProfile(tier: number, tierColor?: string): TierVisualProfile {
  const base = CANONICAL_TIER_VISUALS[Math.max(1, Math.min(8, Math.round(tier)))] ?? CANONICAL_TIER_VISUALS[1];
  if (!tierColor) return base;
  return { ...base, color: tierColor };
}

function fixTextureColorSpace(tex: THREE.Texture | null | undefined) {
  if (!tex) return;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, tex.anisotropy || 4);
  tex.needsUpdate = true;
}

function cloneMaterial(mat: THREE.Material): THREE.Material {
  const cloned = mat.clone();
  const std = cloned as THREE.MeshStandardMaterial;
  if (std.map) std.map = std.map.clone();
  if (std.normalMap) std.normalMap = std.normalMap.clone();
  if (std.roughnessMap) std.roughnessMap = std.roughnessMap.clone();
  if (std.metalnessMap) std.metalnessMap = std.metalnessMap.clone();
  if (std.emissiveMap) std.emissiveMap = std.emissiveMap.clone();
  if (std.aoMap) std.aoMap = std.aoMap.clone();
  return cloned;
}

export interface TierEffectHandles {
  pointLight: THREE.PointLight | null;
  aura: THREE.Mesh | null;
  profile: TierVisualProfile;
  update: (elapsed: number) => void;
  dispose: () => void;
}

/**
 * Apply canonical tier glow/emissive treatment to a loaded weapon model.
 */
export function applyWeaponTierEffects(
  root: THREE.Object3D,
  tier: number,
  tierColor?: string,
): TierEffectHandles {
  const profile = getTierVisualProfile(tier, tierColor);
  const tierCol = new THREE.Color(profile.color);

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = mats.map((mat) => {
      const m = cloneMaterial(mat) as THREE.MeshStandardMaterial;
      fixTextureColorSpace(m.map);
      fixTextureColorSpace(m.emissiveMap);
      fixTextureColorSpace(m.normalMap);
      fixTextureColorSpace(m.roughnessMap);
      fixTextureColorSpace(m.metalnessMap);
      fixTextureColorSpace(m.aoMap);

      if ("metalness" in m) {
        m.metalness = Math.min(1, (m.metalness ?? 0.4) + profile.metalnessBoost);
        m.roughness = Math.max(0.08, (m.roughness ?? 0.5) + profile.roughnessDelta);
      }
      if (m.emissive) {
        m.emissive.copy(tierCol);
        m.emissiveIntensity = profile.emissiveIntensity;
        if (m.color && profile.emissiveMix > 0) {
          m.color.lerp(tierCol, profile.emissiveMix * 0.12);
        }
      }
      m.envMapIntensity = 1.2;
      m.needsUpdate = true;
      return m;
    });
    mesh.material = cloned.length === 1 ? cloned[0]! : cloned;
  });

  let pointLight: THREE.PointLight | null = null;
  let aura: THREE.Mesh | null = null;

  if (profile.pointLightIntensity > 0) {
    pointLight = new THREE.PointLight(tierCol.getHex(), profile.pointLightIntensity, 3.5, 2);
    pointLight.position.set(0, 0.3, 0);
    root.add(pointLight);
  }

  if (profile.auraScale > 0 && profile.auraOpacity > 0) {
    const auraMat = new THREE.MeshBasicMaterial({
      color: tierCol,
      transparent: true,
      opacity: profile.auraOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    aura = new THREE.Mesh(new THREE.SphereGeometry(profile.auraScale, 24, 16), auraMat);
    aura.position.set(0, 0.2, 0);
    root.add(aura);
  }

  const update = (elapsed: number) => {
    if (!profile.pulseSpeed) return;
    const pulse = 0.65 + 0.35 * Math.sin(elapsed * profile.pulseSpeed);
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        const m = mat as THREE.MeshStandardMaterial;
        if (m.emissiveIntensity !== undefined && profile.emissiveIntensity > 0) {
          m.emissiveIntensity = profile.emissiveIntensity * pulse;
        }
      }
    });
    if (pointLight) pointLight.intensity = profile.pointLightIntensity * pulse;
    if (aura) {
      const am = aura.material as THREE.MeshBasicMaterial;
      am.opacity = profile.auraOpacity * (0.7 + 0.3 * pulse);
      aura.rotation.y = elapsed * 0.35;
      aura.rotation.x = Math.sin(elapsed * 0.5) * 0.15;
    }
  };

  const dispose = () => {
    if (pointLight) {
      root.remove(pointLight);
      pointLight.dispose();
    }
    if (aura) {
      root.remove(aura);
      aura.geometry.dispose();
      (aura.material as THREE.Material).dispose();
    }
  };

  return { pointLight, aura, profile, update, dispose };
}