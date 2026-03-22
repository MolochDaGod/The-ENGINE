import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from '@/utils/three-exports';

interface LODLevel {
  distance: number;
  children: React.ReactNode;
}

interface LODManagerProps {
  levels: LODLevel[];
  position?: [number, number, number];
}

/**
 * Simple Level of Detail (LOD) manager that switches between different
 * detail levels based on camera distance
 */
const LODManager: React.FC<LODManagerProps> = ({
  levels,
  position = [0, 0, 0]
}) => {
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();
  const currentLevelRef = useRef(0);

  // Sort levels by distance (closest first)
  const sortedLevels = useMemo(() => {
    return [...levels].sort((a, b) => a.distance - b.distance);
  }, [levels]);

  useFrame(() => {
    if (!groupRef.current) return;

    const worldPosition = new Vector3(...position);
    const cameraPosition = camera.position;
    const distance = worldPosition.distanceTo(cameraPosition);

    // Find the appropriate LOD level
    let newLevel = 0;
    for (let i = sortedLevels.length - 1; i >= 0; i--) {
      if (distance >= sortedLevels[i].distance) {
        newLevel = i;
        break;
      }
    }

    // Update current level if changed
    if (newLevel !== currentLevelRef.current) {
      currentLevelRef.current = newLevel;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {sortedLevels[currentLevelRef.current]?.children}
    </group>
  );
};

/**
 * High-level LOD wrapper for common use cases
 */
export const LODWrapper: React.FC<{
  children?: React.ReactNode;
  position?: [number, number, number];
  highDetailDistance?: number;
  mediumDetailDistance?: number;
  lowDetailDistance?: number;
  highDetail?: React.ReactNode;
  mediumDetail?: React.ReactNode;
  lowDetail?: React.ReactNode;
}> = ({
  children,
  position = [0, 0, 0],
  highDetailDistance = 20,
  mediumDetailDistance = 40,
  lowDetailDistance = 80,
  highDetail,
  mediumDetail,
  lowDetail
}) => {
  const levels = useMemo(() => {
    const lodLevels: LODLevel[] = [];

    if (lowDetail) {
      lodLevels.push({ distance: lowDetailDistance, children: lowDetail });
    }

    if (mediumDetail) {
      lodLevels.push({ distance: mediumDetailDistance, children: mediumDetail });
    }

    if (highDetail) {
      lodLevels.push({ distance: highDetailDistance, children: highDetail });
    }

    // If no custom levels provided, use the children as high detail
    if (lodLevels.length === 0 && children) {
      lodLevels.push({ distance: 0, children: children });
    }

    return lodLevels;
  }, [children, highDetailDistance, mediumDetailDistance, lowDetailDistance, highDetail, mediumDetail, lowDetail]);

  return (
    <LODManager levels={levels} position={position} />
  );
};

export default LODManager;
