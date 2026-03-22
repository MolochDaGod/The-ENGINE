import { useState, useCallback, useRef } from 'react';
import { Vector3 } from 'three';

export interface ViperStingBeamEffect {
  id: number;
  position: Vector3;
  direction: Vector3;
  isReturning: boolean;
  startTime: number;
}

export const useViperStingBeam = () => {
  const [activeEffects, setActiveEffects] = useState<ViperStingBeamEffect[]>([]);
  const nextEffectId = useRef(1);

  const createBeamEffect = useCallback((
    position: Vector3,
    direction: Vector3,
    isReturning: boolean = false
  ) => {
    const effectId = nextEffectId.current++;
    
    const newEffect: ViperStingBeamEffect = {
      id: effectId,
      position: position.clone(),
      direction: direction.clone().normalize(),
      isReturning,
      startTime: Date.now()
    };

    setActiveEffects(prev => [...prev, newEffect]);
    
    return effectId;
  }, []);

  const removeEffect = useCallback((effectId: number) => {
    setActiveEffects(prev => prev.filter(effect => effect.id !== effectId));
  }, []);

  const clearAllEffects = useCallback(() => {
    setActiveEffects([]);
  }, []);

  return {
    activeEffects,
    createBeamEffect,
    removeEffect,
    clearAllEffects
  };
};
