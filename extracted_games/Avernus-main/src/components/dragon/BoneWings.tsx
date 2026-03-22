import { useRef, useMemo, useEffect, useState } from 'react';
import { Group, Vector3, Euler } from 'three';
import { useFrame } from '@react-three/fiber';
import React from 'react';

interface BonePosition {
  pos: Vector3;
  rot: Euler;
  scale: number;
}

interface BoneWingsProps {
  isLeftWing: boolean;
  parentRef: React.RefObject<Group>;
  isDashing: boolean;
}

const BoneWings = React.memo(({ isLeftWing, isDashing }: BoneWingsProps) => {
  const wingsRef = useRef<Group>(null);
  const [isFlapping, setIsFlapping] = useState(false);
  const [flapStartTime, setFlapStartTime] = useState(0);
  const flapDuration = 0.45; // Match dash duration
  const boneRefs = useRef<(Group | null)[]>([]);
  
  const wingBonePositions: BonePosition[] = useMemo(() => [
    // Main central arm bone - original absolute positions
    { 
      pos: new Vector3(isLeftWing ? -0.3 : 0.3, 0.275, 0), 
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 5 : Math.PI / 5), 
      scale: 1.2 
    },
    { 
      pos: new Vector3(isLeftWing ? -0.5 : 0.5, 0.45, 0), 
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 3.5 : Math.PI / 3.5), 
      scale: 1.4 
    },
    
    // Upper wing section - original absolute positions
    { 
      pos: new Vector3(isLeftWing ? -0.65 : 0.65, 0.6, 0), 
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 2.5 : Math.PI / 2.5), 
      scale: 1.0 
    },
    { 
      pos: new Vector3(isLeftWing ? -0.85 : 0.85, 0.72, 0.1), 
      rot: new Euler(0.1, 0, isLeftWing ? -Math.PI / 2.2 : Math.PI / 2.2), 
      scale: 1.0 
    },
    { 
      pos: new Vector3(isLeftWing ? -1.05 : 1.05, 0.8, 0.2), 
      rot: new Euler(0.2, 0, isLeftWing ? -Math.PI / 2 : Math.PI / 2), 
      scale: 0.9 
    },
    { 
      pos: new Vector3(isLeftWing ? -1.2 : 1.2, 0.9, 0.2), 
      rot: new Euler(0.2, 0, isLeftWing ? -Math.PI / 1.8 : Math.PI / 1.8), 
      scale: 0.8 
    },
    // Tip bone segment 1 - original absolute position (this will be the parent for the connection)
    { 
      pos: new Vector3(isLeftWing ? -1.3 : 1.3, 0.75, 0.2), 
      rot: new Euler(0.05, 0, isLeftWing ? -Math.PI / -0.475 : Math.PI / -0.475), 
      scale: 1.0 
    },

    // Tip bone segment 2 - will be positioned relative to segment 1 (lower wing section)
    { 
      pos: new  Vector3(isLeftWing ? 0.05 : -0.05, -0.5, -0.0), 
      rot: new Euler(0.05, 0, isLeftWing ? -Math.PI / -0.475 : Math.PI / -0.475), 
      scale: 0.8 
    },
  ], [isLeftWing]);

  // Define parent-child relationships - only for the two tip segments
  const boneConnections = useMemo(() => [
    -1, // bone 0: no parent (independent)
    -1, // bone 1: no parent (independent)
    -1, // bone 2: no parent (independent)
    -1, // bone 3: no parent (independent)
    -1, // bone 4: no parent (independent)
    -1, // bone 5: no parent (independent)
    -1, // bone 6: no parent (independent) - tip segment 1
    6,  // bone 7: parent is bone 6 - tip segment 2 connected to segment 1
  ], []);

  // Store original rotations for restoration
  const originalRotations = useMemo(() => 
    wingBonePositions.map(bone => bone.rot.clone()), 
    [wingBonePositions]
  );

  // Trigger flapping when dash starts
  useEffect(() => {
    if (isDashing && !isFlapping) {
      setIsFlapping(true);
      setFlapStartTime(Date.now() / 1000);
    }
  }, [isDashing, isFlapping]);

  // Wing flapping animation
  useFrame(() => {
    if (isFlapping && boneRefs.current.length > 0) {
      const currentTime = Date.now() / 1000;
      const elapsed = currentTime - flapStartTime;
      const progress = Math.min(elapsed / flapDuration, 1);

      if (progress >= 1) {
        // Animation complete - restore original positions
        setIsFlapping(false);
        boneRefs.current.forEach((boneRef, index) => {
          if (boneRef && originalRotations[index]) {
            boneRef.rotation.copy(originalRotations[index]);
          }
        });
      } else {
        // Apply flapping animation
        const flapIntensity = Math.sin(progress * Math.PI * 2) * 0.3; // 4 flaps during dash
        const flapOffset = Math.sin(progress * Math.PI) * 0.5; // Overall wing movement
        
        boneRefs.current.forEach((boneRef, index) => {
          if (boneRef && originalRotations[index]) {
            const originalRot = originalRotations[index];
            const flapAmount = flapIntensity * (1 - index * 0.1); // Diminishing effect along wing
            
            // Apply flapping rotation (mainly Z-axis for wing flap)
            boneRef.rotation.x = originalRot.x;
            boneRef.rotation.y = originalRot.y;
            boneRef.rotation.z = originalRot.z + (isLeftWing ? -flapAmount - flapOffset : flapAmount + flapOffset);
          }
        });
      }
    }
  });

  const createBonePiece = useMemo(() => () => (
    <group>
      {/* Main bone shaft */}
      <mesh>
        <cylinderGeometry args={[0.023, 0.0175, 0.32, 3]} />
        <meshStandardMaterial 
          color="#ffffff"
          emissive="#304040"
          emissiveIntensity={0.6}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
      
      {/* Upper joint */}
      <mesh position={new Vector3(0, 0.2, 0)}>
        <sphereGeometry args={[0.035, 4, 4]} />
        <meshStandardMaterial 
          color="#ffffff"
          emissive="#304040"
          emissiveIntensity={0.6}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
    </group>
  ), []);
  
  // Function to render a single bone with potential children
  const renderBone = (boneIndex: number): React.ReactNode => {
    if (boneIndex >= wingBonePositions.length) return null;
    
    const bone = wingBonePositions[boneIndex];
    const children = boneConnections
      .map((parentIndex, childIndex) => parentIndex === boneIndex ? childIndex : -1)
      .filter(childIndex => childIndex !== -1);
    
    return (
      <group
        key={`bone-${boneIndex}`}
        ref={(ref) => { boneRefs.current[boneIndex] = ref; }}
        position={bone.pos}
        rotation={bone.rot}
        scale={bone.scale}
      >
        {createBonePiece()}
        {/* Render child bones at the end of this bone (only for connected tip bones) */}
        {children.map(childIndex => (
          <group key={`child-${childIndex}`} position={new Vector3(0, 0.16, 0)}>
            {renderBone(childIndex)}
          </group>
        ))}
      </group>
    );
  };

  return (
    <group 
      ref={wingsRef}
      rotation={new Euler(0, Math.PI, 0)}
      position={new Vector3(0, -0.3, 0)}
    >
      {/* Render all bones that don't have parents (most bones + the parent tip bone) */}
      {boneConnections.map((parentIndex, boneIndex) => 
        parentIndex === -1 ? renderBone(boneIndex) : null
      )}
    </group>
  );
});

BoneWings.displayName = 'BoneWings';

export default BoneWings;
