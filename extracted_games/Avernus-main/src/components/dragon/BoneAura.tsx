import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Group } from 'three';
import { Vector3, Euler } from '@/utils/three-exports';

interface BoneAuraProps {
  parentRef: React.RefObject<Group>;
}

const createBonePiece = () => (
  <group rotation={[Math.PI / 4, 0, 0]} position={[0, -0.125, 0]}>
    {/* Main bone shaft - thinner and more angular */}
    <mesh>
      <cylinderGeometry args={[0.0175, 0.0175, 0.175, 4]} />
      <meshStandardMaterial 
        color="#ffffff"
        roughness={0.4}
        metalness={0.3}
      />
    </mesh>
    
    {/* Bone joints */}
    <mesh position={new Vector3(0, 0.1, 0)} rotation={new Euler(0, 0, Math.PI / 6)}>
      <sphereGeometry args={[0.03, 4, 4]} />
      <meshStandardMaterial 
        color="#ffffff"
        roughness={0.5}
        metalness={0.2}
      />
    </mesh>

    <mesh position={new Vector3(0, -0.1, 0)} rotation={new Euler(0, 0, -Math.PI / 6)}>
      <sphereGeometry args={[0.0325, 4, 4]} />
      <meshStandardMaterial 
        color="#a4a4a4"
        roughness={0.5}
        metalness={0.2}
      />
    </mesh>
  </group>
);

export default function BoneAura({ parentRef }: BoneAuraProps) {
  const bonesRef = useRef<Mesh[]>([]);
  const boneCount = 12;
  const radius = 0.4;
  const groupRef = useRef<Group>(null);
  
  useFrame(() => {
    if (!parentRef.current || !groupRef.current) return;
    
    const parentPosition = parentRef.current.position;
    groupRef.current.position.set(parentPosition.x, 0, parentPosition.z);
    
    bonesRef.current.forEach((bone, i) => {
      const angle = (i / boneCount) * Math.PI * 2 + Date.now() * 0.001;
      const x = -Math.cos(angle) * radius *1.1;
      const z = Math.sin(angle) * radius *1.1;
      const y = Math.sin(Date.now() * 0.002 + i) * 0.02;
      
      bone.position.set(x, y - 0.5, z);
      bone.rotation.y = angle + Math.PI / 3;
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: boneCount }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) bonesRef.current[i] = el;
          }}
        >
          {createBonePiece()}
        </mesh>
      ))}
    </group>
  );
}
