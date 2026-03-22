// Spatial hash for efficient collision detection
import { Vector3, Box3 } from '@/utils/three-exports';
import { Entity } from '@/ecs/Entity';

export interface SpatialHashEntry {
  entity: Entity;
  bounds: Box3;
}

export class SpatialHash {
  private cellSize: number;
  private grid: Map<string, SpatialHashEntry[]>;
  private entityCells: Map<number, string[]>; // Track which cells each entity is in
  
  // Reusable objects to reduce allocations
  private tempBox = new Box3();
  private tempVector = new Vector3();

  constructor(cellSize: number = 5) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this.entityCells = new Map();
  }

  private getCellKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  private getCellCoords(position: Vector3): Vector3 {
    return new Vector3(
      Math.floor(position.x / this.cellSize),
      Math.floor(position.y / this.cellSize),
      Math.floor(position.z / this.cellSize)
    );
  }

  private getCellsForBounds(bounds: Box3): string[] {
    const cells: string[] = [];
    
    const minCell = this.getCellCoords(bounds.min);
    const maxCell = this.getCellCoords(bounds.max);

    for (let x = minCell.x; x <= maxCell.x; x++) {
      for (let y = minCell.y; y <= maxCell.y; y++) {
        for (let z = minCell.z; z <= maxCell.z; z++) {
          cells.push(this.getCellKey(x, y, z));
        }
      }
    }

    return cells;
  }

  public insert(entity: Entity, bounds: Box3): void {
    // Remove entity from old cells first
    this.remove(entity);

    const entry: SpatialHashEntry = { entity, bounds: bounds.clone() };
    const cells = this.getCellsForBounds(bounds);

    // Add to new cells
    for (const cellKey of cells) {
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, []);
      }
      this.grid.get(cellKey)!.push(entry);
    }

    // Track which cells this entity is in
    this.entityCells.set(entity.id, cells);
  }

  public remove(entity: Entity): void {
    const cells = this.entityCells.get(entity.id);
    if (!cells) return;

    // Remove from all cells
    for (const cellKey of cells) {
      const cellEntries = this.grid.get(cellKey);
      if (cellEntries) {
        const index = cellEntries.findIndex(entry => entry.entity.id === entity.id);
        if (index !== -1) {
          cellEntries.splice(index, 1);
        }
        
        // Clean up empty cells
        if (cellEntries.length === 0) {
          this.grid.delete(cellKey);
        }
      }
    }

    this.entityCells.delete(entity.id);
  }

  public update(entity: Entity, newBounds: Box3): void {
    const oldCells = this.entityCells.get(entity.id) || [];
    const newCells = this.getCellsForBounds(newBounds);

    // Check if cells have changed
    if (this.arraysEqual(oldCells, newCells)) {
      // Just update the bounds in existing cells
      for (const cellKey of oldCells) {
        const cellEntries = this.grid.get(cellKey);
        if (cellEntries) {
          const entry = cellEntries.find(e => e.entity.id === entity.id);
          if (entry) {
            entry.bounds.copy(newBounds);
          }
        }
      }
    } else {
      // Cells have changed, need to re-insert
      this.insert(entity, newBounds);
    }
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, index) => val === sortedB[index]);
  }

  public query(bounds: Box3): SpatialHashEntry[] {
    const results: SpatialHashEntry[] = [];
    const seenEntities = new Set<number>();
    const cells = this.getCellsForBounds(bounds);

    for (const cellKey of cells) {
      const cellEntries = this.grid.get(cellKey);
      if (!cellEntries) continue;

      for (const entry of cellEntries) {
        // Avoid duplicates (entity might be in multiple cells)
        if (seenEntities.has(entry.entity.id)) continue;
        seenEntities.add(entry.entity.id);

        // Check if bounds actually intersect
        if (bounds.intersectsBox(entry.bounds)) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  public queryRadius(center: Vector3, radius: number): SpatialHashEntry[] {
    // Create bounding box for the sphere
    this.tempBox.setFromCenterAndSize(center, new Vector3(radius * 2, radius * 2, radius * 2));
    const candidates = this.query(this.tempBox);

    // Filter by actual distance
    const results: SpatialHashEntry[] = [];
    const radiusSquared = radius * radius;

    for (const entry of candidates) {
      // Get closest point on bounds to center
      this.tempVector.copy(center);
      entry.bounds.clampPoint(this.tempVector, this.tempVector);
      
      if (center.distanceToSquared(this.tempVector) <= radiusSquared) {
        results.push(entry);
      }
    }

    return results;
  }

  public queryPoint(point: Vector3): SpatialHashEntry[] {
    const cellCoords = this.getCellCoords(point);
    const cellKey = this.getCellKey(cellCoords.x, cellCoords.y, cellCoords.z);
    const cellEntries = this.grid.get(cellKey);
    
    if (!cellEntries) return [];

    const results: SpatialHashEntry[] = [];
    for (const entry of cellEntries) {
      if (entry.bounds.containsPoint(point)) {
        results.push(entry);
      }
    }

    return results;
  }

  public getNearbyEntities(entity: Entity, maxDistance: number): Entity[] {
    const cells = this.entityCells.get(entity.id);
    if (!cells) return [];

    const results: Entity[] = [];
    const seenEntities = new Set<number>();
    const maxDistanceSquared = maxDistance * maxDistance;

    // Get entity's bounds
    const entityEntry = this.getEntityEntry(entity);
    if (!entityEntry) return [];

    const entityCenter = new Vector3();
    entityEntry.bounds.getCenter(entityCenter);

    // Check nearby cells
    const expandedCells = this.getExpandedCells(cells, Math.ceil(maxDistance / this.cellSize));

    for (const cellKey of expandedCells) {
      const cellEntries = this.grid.get(cellKey);
      if (!cellEntries) continue;

      for (const entry of cellEntries) {
        if (entry.entity.id === entity.id || seenEntities.has(entry.entity.id)) continue;
        seenEntities.add(entry.entity.id);

        // Check distance
        const otherCenter = new Vector3();
        entry.bounds.getCenter(otherCenter);
        
        if (entityCenter.distanceToSquared(otherCenter) <= maxDistanceSquared) {
          results.push(entry.entity);
        }
      }
    }

    return results;
  }

  private getEntityEntry(entity: Entity): SpatialHashEntry | null {
    const cells = this.entityCells.get(entity.id);
    if (!cells || cells.length === 0) return null;

    const cellEntries = this.grid.get(cells[0]);
    if (!cellEntries) return null;

    return cellEntries.find(entry => entry.entity.id === entity.id) || null;
  }

  private getExpandedCells(baseCells: string[], expansion: number): string[] {
    const expandedCells = new Set<string>();

    for (const cellKey of baseCells) {
      const [x, y, z] = cellKey.split(',').map(Number);
      
      for (let dx = -expansion; dx <= expansion; dx++) {
        for (let dy = -expansion; dy <= expansion; dy++) {
          for (let dz = -expansion; dz <= expansion; dz++) {
            expandedCells.add(this.getCellKey(x + dx, y + dy, z + dz));
          }
        }
      }
    }

    return Array.from(expandedCells);
  }

  public clear(): void {
    this.grid.clear();
    this.entityCells.clear();
  }

  public getStats(): {
    totalCells: number;
    totalEntities: number;
    averageEntitiesPerCell: number;
    maxEntitiesInCell: number;
  } {
    const totalCells = this.grid.size;
    const totalEntities = this.entityCells.size;
    let maxEntitiesInCell = 0;
    let totalEntitiesInCells = 0;

    this.grid.forEach((entries) => {
      totalEntitiesInCells += entries.length;
      maxEntitiesInCell = Math.max(maxEntitiesInCell, entries.length);
    });

    return {
      totalCells,
      totalEntities,
      averageEntitiesPerCell: totalCells > 0 ? totalEntitiesInCells / totalCells : 0,
      maxEntitiesInCell
    };
  }
 
  public debugVisualize(): string[] {
    const lines: string[] = [];
    lines.push(`Spatial Hash Stats: ${JSON.stringify(this.getStats(), null, 2)}`);
    
    this.grid.forEach((entries, cellKey) => {
      if (entries.length > 0) {
        lines.push(`Cell ${cellKey}: ${entries.length} entities`);
      }
    });

    return lines;
  }
}
