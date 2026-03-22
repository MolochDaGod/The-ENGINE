// Core damage calculation system with critical hit mechanics
// Placed in core/ for performance and shared access across all systems

import { WeaponType } from '@/components/dragon/weapons';

export interface DamageResult {
  damage: number;
  isCritical: boolean;
}

// Global references
let globalCriticalRuneCount = 0;
let globalCritDamageRuneCount = 0;
let globalControlSystem: any = null; // Reference to control system for passive ability checks

export function setControlSystem(controlSystem: any) {
  globalControlSystem = controlSystem;
}

export function setGlobalCriticalRuneCount(count: number) {
  globalCriticalRuneCount = count;
}

export function setGlobalCritDamageRuneCount(count: number) {
  globalCritDamageRuneCount = count;
}

export function calculateDamage(baseAmount: number, weaponType?: WeaponType): DamageResult {
  // Base crit chance is 11%, each rune adds 3%
  let criticalChance = 0.11 + (globalCriticalRuneCount * 0.03);

  // Add Bow passive: TEMPEST ROUNDS (+5% crit chance)
  if (weaponType === WeaponType.BOW && globalControlSystem) {
    // Check if Bow passive is unlocked
    const weaponSlot = globalControlSystem.selectedWeapons?.primary === WeaponType.BOW ? 'primary' : 'secondary';
    if (weaponSlot && globalControlSystem.isPassiveAbilityUnlocked &&
        globalControlSystem.isPassiveAbilityUnlocked('P', WeaponType.BOW, weaponSlot)) {
      criticalChance += 0.10; // +5% crit chance
    }
  }

  const isCritical = Math.random() < criticalChance;

  // Base crit damage multiplier is 2x, each crit damage rune adds 0.15x
  const criticalDamageMultiplier = 2.0 + (globalCritDamageRuneCount * 0.15);
  const rawDamage = isCritical ? baseAmount * criticalDamageMultiplier : baseAmount;

  // Round down to integer to avoid floating point precision issues
  const damage = Math.floor(rawDamage);



  return { damage, isCritical };
}

// Utility functions for debugging and testing
export function getCriticalChance(weaponType?: WeaponType): number {
  let criticalChance = 0.11 + (globalCriticalRuneCount * 0.03);

  // Add Bow passive: TEMPEST ROUNDS (+5% crit chance)
  if (weaponType === WeaponType.BOW && globalControlSystem) {
    // Check if Bow passive is unlocked
    const weaponSlot = globalControlSystem.selectedWeapons?.primary === WeaponType.BOW ? 'primary' : 'secondary';
    if (weaponSlot && globalControlSystem.isPassiveAbilityUnlocked &&
        globalControlSystem.isPassiveAbilityUnlocked('P', WeaponType.BOW, weaponSlot)) {
      criticalChance += 0.05; // +5% crit chance
    }
  }

  return criticalChance;
}

export function getCriticalDamageMultiplier(): number {
  return 2.0 + (globalCritDamageRuneCount * 0.15);
}

export function getGlobalRuneCounts(): { criticalRunes: number; critDamageRunes: number } {
  return {
    criticalRunes: globalCriticalRuneCount,
    critDamageRunes: globalCritDamageRuneCount
  };
}
