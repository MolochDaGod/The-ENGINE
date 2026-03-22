import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Group, AdditiveBlending } from 'three';
import { MeshStandardMaterial } from '@/utils/three-exports';

interface ElementalVortexProps {
  parentRef: React.RefObject<Group>;
}

const createVortexPiece = () => (
  <group>
    {/* Mist-like particle similar to ReaperMistEffect */}
    <mesh>
      <sphereGeometry args={[0.125, 8, 8]} />
      <meshStandardMaterial 
        color="#4FC3F7"
        emissive="#4FC3F7"
        emissiveIntensity={0.35}
        transparent
        opacity={0.7}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  </group>
);

function ElementalVortex({ parentRef }: ElementalVortexProps) {
  const vortexPiecesRef = useRef<(Group | null)[]>([]);
  const pieceCount = 40; // More particles for denser effect
  const baseRadius = 1.25; // Larger radius
  const groupRef = useRef<Group>(null);
  
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    
    vortexPiecesRef.current.forEach((piece, i) => {
      if (!piece) return;
      
      const time = clock.getElapsedTime();
      const heightOffset = ((i / pieceCount) * 1.5 - 0.175); // Taller vortex
      const radiusMultiplier = 0.8 - (heightOffset * 0.375); // Gentler taper
      
      // More complex spiral motion like mist particles
      const spiralAngle = (i / pieceCount) * Math.PI * 6 + time * 1.5;
      const floatAngle = time * 2 + i * 0.5;
      const radius = baseRadius * radiusMultiplier + Math.sin(floatAngle) * 0.2;
      
      const x = Math.cos(spiralAngle) * radius;
      const z = Math.sin(spiralAngle) * radius;
      const y = heightOffset + Math.sin(time * 2 + i) * 0.3 + 0.2; // Start from ground level, swirl up around Elite
      
      piece.position.set(x, y, z);
      
      // Gentle rotation like mist particles
      piece.rotation.y = spiralAngle + Math.PI / 2;
      piece.rotation.x = Math.sin(time + i) * 0.2;
      piece.rotation.z = Math.cos(time * 0.8 + i) * 0.2;
      
              // Fade particles as they rise (like mist)
        const meshChild = piece.children[0] as Mesh;
        if (meshChild && meshChild.material) {
          const material = meshChild.material as MeshStandardMaterial;
          const fadeProgress = heightOffset / 1.5;
          material.opacity = Math.max(0.2, 0.8 * (1 - fadeProgress)); // More visible
          
          // Scale particles down as they rise
          const scale = 1 - fadeProgress * 0.3; // Less scaling
          piece.scale.setScalar(scale);
        }
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: pieceCount }).map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            if (el) vortexPiecesRef.current[i] = el;
          }}
        >
          {createVortexPiece()}
        </group>
      ))}
      
      <pointLight 
        color="#4FC3F7"
        intensity={12}
        distance={12}
        decay={1.2}
        position={[0, 0.5, 0]}
      />
    </group>
  );
}

export default ElementalVortex;
