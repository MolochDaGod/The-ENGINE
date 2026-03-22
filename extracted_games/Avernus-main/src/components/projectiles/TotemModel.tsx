import React, { useRef } from 'react';
import { Group, MeshStandardMaterial, CylinderGeometry, ConeGeometry, PlaneGeometry, SphereGeometry } from 'three';

const SHARED_MATERIALS = {
  bone: new MeshStandardMaterial({
    color: "#A0C8E0",
    roughness: 0.3,
    metalness: 0.7
  }),
  spikes: new MeshStandardMaterial({
    color: "#8BB8D0",
    roughness: 0.3,
    metalness: 0.7
  }),
  runes: new MeshStandardMaterial({
    color: "#0099ff",
    emissive: "#0099ff",
    transparent: true,
    opacity: 0.9
  }),
  crown: new MeshStandardMaterial({
    color: "#B8D8F0",
    roughness: 0.2,
    metalness: 0.8
  })
};

const SHARED_GEOMETRIES = {
  tower: new CylinderGeometry(0.6, 0.8, 4, 8),
  spike: new ConeGeometry(0.2, 0.8, 4),
  rune: new PlaneGeometry(0.2, 0.2),
  crown: new ConeGeometry(0.15, 1.2, 4),
  eye: new SphereGeometry(0.45, 32, 32),
  base: new CylinderGeometry(1, 1.2, 0.6, 8),
  lightning: new SphereGeometry(0.1, 16, 16)
};

interface TotemModelProps {
  isAttacking: boolean;
}

export default function TotemModel({ isAttacking }: TotemModelProps) {
  const totemRef = useRef<Group>(null);

  return (
    <group ref={totemRef} scale={0.3} position={[0, -0.80, 0]}>
      {/* Main tower structure */}
      <mesh position={[0, 1.75, 0]}>
        <primitive object={SHARED_GEOMETRIES.tower} />
        <primitive object={SHARED_MATERIALS.bone} />
      </mesh>

   
      {/* Glowing rune circles */}
      {[1.25, 2.25, 3.25].map((height, i) => (
        <group key={i} position={[0, height, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.75, 0.075, 16, 32]} />
            <primitive object={SHARED_MATERIALS.runes} emissiveIntensity={isAttacking ? 3 : 1} />
          </mesh>
          {/* Floating rune symbols */}
          {[...Array(4)].map((_, j) => (
            <mesh
              key={j}
              position={[
                Math.cos((Math.PI * 2 * j) / 4) * 0.7,
                Math.sin(Date.now() * 0.001 + j) * 0.1,
                Math.sin((Math.PI * 2 * j) / 4) * 0.7
              ]}
            >
              <primitive object={SHARED_GEOMETRIES.rune} />
              <primitive object={SHARED_MATERIALS.runes} emissiveIntensity={isAttacking ? 4 : 2} opacity={0.8} side={2} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Top crown structure */}
      <group position={[0, 3.75, 0]}>
  

        {/* Central eye */}
        <mesh position={[0, 0.35, 0]}>
          <primitive object={SHARED_GEOMETRIES.eye} />
          <primitive object={SHARED_MATERIALS.runes} emissiveIntensity={isAttacking ? 5 : 3} />
        </mesh>
      </group>

      {/* Base structure */}
      <mesh position={[0, 0.1, 0]}>
        <primitive object={SHARED_GEOMETRIES.base} />
        <primitive object={SHARED_MATERIALS.bone} />
      </mesh>

    </group>
  );
}
