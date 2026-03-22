// Manager for handling damage number display and lifecycle
import { Vector3 } from '@/utils/three-exports';
import { DamageNumberData } from '@/components/DamageNumbers';

export class DamageNumberManager {
  private damageNumbers: DamageNumberData[] = [];
  private nextId = 0;

  public addDamageNumber(
    damage: number,
    isCritical: boolean,
    position: Vector3,
    damageType?: string,
    isIncomingDamage?: boolean
  ): string {
    const id = `damage_${this.nextId++}`;
    const damageNumber: DamageNumberData = {
      id,
      damage,
      isCritical,
      position: position.clone(), // Clone to avoid reference issues
      timestamp: Date.now(),
      damageType,
      isIncomingDamage,
    };

    this.damageNumbers.push(damageNumber);
    return id;
  }

  public removeDamageNumber(id: string): void {
    const index = this.damageNumbers.findIndex(dn => dn.id === id);
    if (index !== -1) {
      this.damageNumbers.splice(index, 1);
    }
  }

  public getDamageNumbers(): DamageNumberData[] {
    return [...this.damageNumbers]; // Return a copy to prevent external mutation
  }

  public cleanup(): void {
    // Remove damage numbers older than 5 seconds (failsafe)
    const now = Date.now();
    this.damageNumbers = this.damageNumbers.filter(
      dn => now - dn.timestamp < 5000
    );
    
    // Also limit total number of damage numbers to prevent memory issues
    if (this.damageNumbers.length > 50) {
      // Keep only the 50 most recent
      this.damageNumbers.sort((a, b) => b.timestamp - a.timestamp);
      this.damageNumbers = this.damageNumbers.slice(0, 50);
    }
  }

  public clear(): void {
    this.damageNumbers.length = 0;
    this.nextId = 0;
  }

  public getCount(): number {
    return this.damageNumbers.length;
  }
}
