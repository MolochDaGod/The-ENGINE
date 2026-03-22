import React, { useRef, useEffect } from 'react';
import SummonTotemManager, { setGlobalSummonTotemTrigger, SummonTotemManagerRef } from './SummonTotemManager';
import { Vector3 } from '@/utils/three-exports';

interface LocalSummonTotemManagerProps {
  enemyData?: Array<{ id: string; position: Vector3; health: number }>;
  onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void;
  setActiveEffects?: (callback: (prev: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => void;
  activeEffects?: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>;
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSummon?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSummon?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  onHealPlayer?: (healAmount: number) => void;
  playerId?: string; // Local player ID for healing
}

const LocalSummonTotemManager: React.FC<LocalSummonTotemManagerProps> = ({
  enemyData = [],
  onDamage,
  setActiveEffects,
  activeEffects = [],
  setDamageNumbers,
  nextDamageNumberId,
  onHealPlayer,
  playerId
}) => {
  const managerRef = React.useRef<SummonTotemManagerRef>(null);

  React.useEffect(() => {
    setGlobalSummonTotemTrigger((position, enemyDataParam, onDamageParam, setActiveEffectsParam, activeEffectsParam, setDamageNumbersParam, nextDamageNumberIdParam, onHealPlayerParam, casterId) => {
      if (managerRef.current) {
        const finalEnemyData = enemyDataParam || enemyData;
        managerRef.current.createTotem(
          position,
          finalEnemyData,
          onDamageParam || onDamage,
          setActiveEffectsParam || setActiveEffects,
          activeEffectsParam || activeEffects,
          setDamageNumbersParam || setDamageNumbers,
          nextDamageNumberIdParam || nextDamageNumberId,
          onHealPlayerParam || onHealPlayer
        );
      }
    });

    return () => {
      setGlobalSummonTotemTrigger(() => {});
    };
  }, [enemyData, onDamage, setActiveEffects, activeEffects, setDamageNumbers, nextDamageNumberId, onHealPlayer, playerId]);

  return (
    <SummonTotemManager
      ref={managerRef}

    />
  );
};

export default LocalSummonTotemManager;
