// Floating damage numbers component to display damage dealt to enemies
'use client';

import React, { useEffect, useState, memo } from 'react';
import { Vector3, Camera } from '@/utils/three-exports';

export interface DamageNumberData {
  id: string;
  damage: number;
  isCritical: boolean;
  position: Vector3;
  timestamp: number;
  damageType?: string; // Added to distinguish damage types
  isIncomingDamage?: boolean; // Whether this damage was received by the local player
}

interface DamageNumberProps {
  damageData: DamageNumberData;
  onComplete: (id: string) => void;
  camera: Camera | null;
  size: { width: number; height: number };
}

interface DamageNumberPropsExtended extends DamageNumberProps {
  stackIndex: number; // Index in the stack (0 = newest, 1 = second newest, etc.)
}

const DamageNumber = memo(function DamageNumber({ damageData, onComplete, camera, size, stackIndex }: DamageNumberPropsExtended) {
  const [opacity, setOpacity] = useState(1);
  const [yOffset, setYOffset] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const isIncoming = damageData.isIncomingDamage;
    const duration = isIncoming ? 3000 : 5000; // Shorter duration for incoming damage
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out animation
      const easeOut = 1 - Math.pow(1 - progress, 3);

      if (isIncoming) {
        // For incoming damage, float downward from under the character
        const baseFloatDistance = -2; // Float downward
        const stackOffset = stackIndex * -0.5; // Stack downward
        setYOffset(easeOut * baseFloatDistance + stackOffset);

        // Scale animation - start slightly big, settle smaller
        const initialScale = stackIndex === 0 ? 1.1 : 0.8 - (stackIndex * 0.1);
        const finalScale = 0.7 - (stackIndex * 0.1);
        const scaleProgress = Math.min(progress * 4, 1); // Scale settles faster
        setScale(initialScale + (finalScale - initialScale) * scaleProgress);

        // Fade out
        if (progress > 0.5) {
          const fadeProgress = (progress - 0.5) / 0.5;
          setOpacity(1 - fadeProgress);
        } else {
          setOpacity(1);
        }
      } else {
        // Original outgoing damage animation
        // Float upward with stacking offset
        const baseFloatDistance = 4; // Base float distance
        const stackOffset = stackIndex * 0.8; // Vertical spacing between stacked numbers
        setYOffset(easeOut * baseFloatDistance + stackOffset);

        // Scale animation - start big, settle to smaller size based on stack position
        const initialScale = stackIndex === 0 ? 1.2 : 0.9 - (stackIndex * 0.1);
        const finalScale = 0.8 - (stackIndex * 0.1);
        const scaleProgress = Math.min(progress * 3, 1); // Scale settles faster
        setScale(initialScale + (finalScale - initialScale) * scaleProgress);

        // Fade out older numbers more aggressively
        const fadeStartPoint = stackIndex === 0 ? 0.6 : 0.3 - (stackIndex * 0.1);
        if (progress > fadeStartPoint) {
          const fadeProgress = (progress - fadeStartPoint) / (1 - fadeStartPoint);
          const targetOpacity = stackIndex === 0 ? 0 : Math.max(0, 0.7 - (stackIndex * 0.2));
          setOpacity(1 - fadeProgress + (targetOpacity * fadeProgress));
        } else {
          // Older numbers start more transparent
          setOpacity(1 - (stackIndex * 0.2));
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        onComplete(damageData.id);
      }
    };

    animate();
  }, [damageData.id, onComplete, stackIndex, damageData.isIncomingDamage]);

  // Proper 3D to 2D projection using the camera
  let x = 0;
  let y = 0;
  
  if (camera && size.width > 0 && size.height > 0 && damageData.position && damageData.position.clone) {
    // Create a world position with the floating animation offset
    const worldPosition = damageData.position.clone();
    worldPosition.y += yOffset; // Apply the floating animation offset
    
    // Project the 3D world position to normalized device coordinates
    const screenPosition = worldPosition.clone().project(camera);
    
    // Convert normalized device coordinates (-1 to 1) to screen coordinates
    x = (screenPosition.x * 0.5 + 0.5) * size.width;
    y = (screenPosition.y * -0.5 + 0.5) * size.height;
    

  } else {
    // Fallback to simple projection if camera not available
    const projectionScale = 50;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    x = centerX + (damageData.position.x * projectionScale);
    y = centerY - (damageData.position.z * projectionScale) - (yOffset * 20);
  }

  return (
    <div
      className="absolute pointer-events-none select-none font-bold text-lg"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        opacity,
        transform: `translate(-50%, -50%) scale(${scale})`,
        textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
        zIndex: 1000 - stackIndex, // Newer numbers appear on top
        transition: stackIndex > 0 ? 'opacity 0.3s ease-out' : 'none', // Smooth transitions for older numbers
      }}
    >
      <span
        className={`${
          damageData.isIncomingDamage
            ? // Incoming damage: red for all damage
              'text-red-400 text-lg font-bold'
            : // Outgoing damage: original logic
              damageData.isCritical
                ? 'text-yellow-300 text-xl animate-pulse'
                : damageData.damageType === 'crossentropy'
                ? 'text-orange-400'
                : damageData.damageType === 'healing' ||
                  damageData.damageType === 'reanimate_healing' ||
                  damageData.damageType === 'smite_healing' ||
                  damageData.damageType === 'viper_sting_healing' ||
                  damageData.damageType === 'summon_totem_healing'
                ? 'text-green-400 text-lg font-extrabold'
                : damageData.damageType === 'colossus_strike'
                ? 'text-yellow-400 text-lg'
                : damageData.damageType === 'barrage'
                ? 'text-blue-400 text-lg'
                : damageData.damageType === 'cobra_shot'
                ? 'text-green-400 text-lg'
                : damageData.damageType === 'viper_sting'
                ? 'text-purple-300 text-lg'
                : damageData.damageType === 'cloudkill'
                ? 'text-teal-400 text-lg'
                : damageData.damageType === 'frost_nova'
                ? 'text-blue-300 text-lg'
                : damageData.damageType === 'entropic_cryoflame'
                ? 'text-cyan-400 text-lg'
                : 'text-red-400'
        }`}
      >
        {damageData.isIncomingDamage && '-'}
        {(damageData.damageType === 'healing' ||
          damageData.damageType === 'reanimate_healing' ||
          damageData.damageType === 'smite_healing' ||
          damageData.damageType === 'viper_sting_healing' ||
          damageData.damageType === 'summon_totem_healing') && '+'}
        {damageData.damageType === 'healing' ||
         damageData.damageType === 'reanimate_healing' ||
         damageData.damageType === 'smite_healing' ||
         damageData.damageType === 'viper_sting_healing' ||
         damageData.damageType === 'summon_totem_healing'
           ? Math.round(damageData.damage)
           : damageData.damage}
        {damageData.isCritical && '!'}
      </span>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
  return (
    prevProps.damageData.id === nextProps.damageData.id &&
    prevProps.damageData.damage === nextProps.damageData.damage &&
    prevProps.damageData.isCritical === nextProps.damageData.isCritical &&
    prevProps.damageData.damageType === nextProps.damageData.damageType &&
    prevProps.damageData.isIncomingDamage === nextProps.damageData.isIncomingDamage &&
    prevProps.damageData.timestamp === nextProps.damageData.timestamp &&
    prevProps.damageData.position.equals(nextProps.damageData.position) &&
    prevProps.stackIndex === nextProps.stackIndex &&
    prevProps.camera === nextProps.camera &&
    prevProps.size.width === nextProps.size.width &&
    prevProps.size.height === nextProps.size.height
  );
});

interface DamageNumbersProps {
  damageNumbers: DamageNumberData[];
  onDamageNumberComplete: (id: string) => void;
  camera: Camera | null;
  size: { width: number; height: number };
}

const DamageNumbersComponent = memo(function DamageNumbers({ damageNumbers, onDamageNumberComplete, camera, size }: DamageNumbersProps) {
  // Group damage numbers by position to create stacks
  const positionGroups = new Map<string, DamageNumberData[]>();
  
  damageNumbers.forEach(damageData => {
    // Create a position key with some tolerance for grouping nearby damage
    const posKey = `${Math.round(damageData.position.x * 2)}_${Math.round(damageData.position.z * 2)}`;
    if (!positionGroups.has(posKey)) {
      positionGroups.set(posKey, []);
    }
    positionGroups.get(posKey)!.push(damageData);
  });

  // Sort each group by timestamp (newest first) and limit to 1 most recent
  positionGroups.forEach(group => {
    group.sort((a, b) => b.timestamp - a.timestamp);
    group.splice(1); // Keep only the 1 most recent
  });

  return (
    <div className="fixed inset-0 pointer-events-none">
      {Array.from(positionGroups.values()).flat().map((damageData) => {
        // Find the stack index for this damage number
        const posKey = `${Math.round(damageData.position.x * 2)}_${Math.round(damageData.position.z * 2)}`;
        const group = positionGroups.get(posKey)!;
        const stackIndex = group.findIndex(d => d.id === damageData.id);

        return (
          <DamageNumber
            key={damageData.id}
            damageData={damageData}
            onComplete={onDamageNumberComplete}
            camera={camera}
            size={size}
            stackIndex={stackIndex}
          />
        );
      })}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for main component
  return (
    prevProps.damageNumbers.length === nextProps.damageNumbers.length &&
    prevProps.damageNumbers.every((prev, index) => {
      const next = nextProps.damageNumbers[index];
      return prev?.id === next?.id &&
             prev?.damage === next?.damage &&
             prev?.isCritical === next?.isCritical &&
             prev?.damageType === next?.damageType &&
             prev?.isIncomingDamage === next?.isIncomingDamage &&
             prev?.timestamp === next?.timestamp;
    }) &&
    prevProps.camera === nextProps.camera &&
    prevProps.size.width === nextProps.size.width &&
    prevProps.size.height === nextProps.size.height
  );
});

export default DamageNumbersComponent;
