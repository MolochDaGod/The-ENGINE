// PVP State Batching Utility for Performance Optimization
import { unstable_batchedUpdates } from 'react-dom';
import { Vector3 } from '@/utils/three-exports';

/**
 * Batches multiple React state updates to prevent unnecessary re-renders
 * Particularly important for PVP scenarios with frequent state changes
 */
export class PVPStateBatcher {
  private static instance: PVPStateBatcher;
  
  // Pending state updates to batch
  private pendingUpdates: (() => void)[] = [];
  private batchScheduled = false;
  private frameId: number | null = null;
  
  // Performance tracking
  private batchCount = 0;
  private totalUpdatesInBatch = 0;
  private lastBatchTime = 0;
  
  private constructor() {}
  
  public static getInstance(): PVPStateBatcher {
    if (!PVPStateBatcher.instance) {
      PVPStateBatcher.instance = new PVPStateBatcher();
    }
    return PVPStateBatcher.instance;
  }
  
  /**
   * Add a state update to the batch queue
   */
  public batchUpdate(updateFn: () => void): void {
    this.pendingUpdates.push(updateFn);
    
    if (!this.batchScheduled) {
      this.scheduleBatch();
    }
  }
  
  /**
   * Schedule a batch to be executed on the next frame
   */
  private scheduleBatch(): void {
    this.batchScheduled = true;
    
    // Use requestAnimationFrame to batch updates at the end of the frame
    this.frameId = requestAnimationFrame(() => {
      this.executeBatch();
    });
  }
  
  /**
   * Execute all pending state updates in a single batch
   */
  private executeBatch(): void {
    if (this.pendingUpdates.length === 0) {
      this.batchScheduled = false;
      return;
    }
    
    const updates = [...this.pendingUpdates];
    this.pendingUpdates = [];
    this.batchScheduled = false;
    
    // Track performance metrics
    this.batchCount++;
    this.totalUpdatesInBatch += updates.length;
    this.lastBatchTime = performance.now();
    
    // Execute all updates in a single React batch
    unstable_batchedUpdates(() => {
      updates.forEach(update => {
        try {
          update();
        } catch (error) {
          console.error('Error in batched state update:', error);
        }
      });
    });
  }
  
  /**
   * Force execute any pending batches immediately
   */
  public flushBatch(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.executeBatch();
  }
  
  /**
   * Get performance statistics
   */
  public getStats() {
    const avgUpdatesPerBatch = this.batchCount > 0 ? this.totalUpdatesInBatch / this.batchCount : 0;
    
    return {
      totalBatches: this.batchCount,
      totalUpdates: this.totalUpdatesInBatch,
      avgUpdatesPerBatch: Math.round(avgUpdatesPerBatch * 100) / 100,
      pendingUpdates: this.pendingUpdates.length,
      lastBatchTime: this.lastBatchTime,
      batchScheduled: this.batchScheduled
    };
  }
  
  /**
   * Reset performance statistics
   */
  public resetStats(): void {
    this.batchCount = 0;
    this.totalUpdatesInBatch = 0;
    this.lastBatchTime = 0;
  }
  
  /**
   * Clear all pending updates (useful for cleanup)
   */
  public clear(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.pendingUpdates = [];
    this.batchScheduled = false;
  }
}

// Export singleton instance
export const pvpStateBatcher = PVPStateBatcher.getInstance();

/**
 * Utility functions for common PVP state update patterns
 */
export class PVPStateUpdateHelpers {
  /**
   * Batch multiple player state updates
   */
  static batchPlayerStateUpdates(
    setMultiplayerPlayerStates: React.Dispatch<React.SetStateAction<Map<string, any>>>,
    updates: Array<{ playerId: string; stateUpdate: Partial<any> }>
  ): void {
    pvpStateBatcher.batchUpdate(() => {
      setMultiplayerPlayerStates(prev => {
        const updated = new Map(prev);
        
        updates.forEach(({ playerId, stateUpdate }) => {
          const currentState = updated.get(playerId) || {
            isCharging: false,
            chargeProgress: 0,
            isSwinging: false,
            swordComboStep: 1 as 1 | 2 | 3,
            isSpinning: false,
            isSwordCharging: false,
            isDeflecting: false,
            isViperStingCharging: false,
            viperStingChargeProgress: 0,
            isBarrageCharging: false,
            barrageChargeProgress: 0,
            isCobraShotCharging: false,
            cobraShotChargeProgress: 0,
            isSkyfalling: false,
            isBackstabbing: false
          };
          
          updated.set(playerId, {
            ...currentState,
            ...stateUpdate,
            lastAnimationUpdate: Date.now()
          });
        });
        
        return updated;
      });
    });
  }
  
  /**
   * Batch effect state updates (venom, debuff, etc.)
   */
  static batchEffectUpdates(updates: Array<{
    type: 'add' | 'remove';
    effectType: 'venom' | 'debuff' | 'reanimate' | 'frostNova' | 'smite' | 'deathgrasp' | 'colossusStrike' | 'windShear' | 'windShearTornado';
    setter: React.Dispatch<React.SetStateAction<any[]>>;
    data?: any;
    filterId?: number;
  }>): void {
    // Group updates by setter to minimize state update calls
    const updatesBySetter = new Map<React.Dispatch<React.SetStateAction<any[]>>, Array<any>>();
    
    updates.forEach(update => {
      if (!updatesBySetter.has(update.setter)) {
        updatesBySetter.set(update.setter, []);
      }
      updatesBySetter.get(update.setter)!.push(update);
    });
    
    // Batch all updates
    pvpStateBatcher.batchUpdate(() => {
      updatesBySetter.forEach((setterUpdates, setter) => {
        setter(prev => {
          let newState = [...prev];
          
          setterUpdates.forEach(update => {
            if (update.type === 'add' && update.data) {
              newState.push(update.data);
            } else if (update.type === 'remove' && update.filterId !== undefined) {
              newState = newState.filter(effect => effect.id !== update.filterId);
            }
          });
          
          return newState;
        });
      });
    });
  }
  
  /**
   * Batch game state updates (position, weapon state, etc.)
   */
  static batchGameStateUpdates(updates: Array<{
    setter: React.Dispatch<React.SetStateAction<any>>;
    value: any;
  }>): void {
    pvpStateBatcher.batchUpdate(() => {
      updates.forEach(({ setter, value }) => {
        setter(value);
      });
    });
  }
}
