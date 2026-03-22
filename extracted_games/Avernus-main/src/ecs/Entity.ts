// Entity Component System - Entity Management
export type EntityId = number;

export class Entity {
  private static nextId: EntityId = 1;
  public readonly id: EntityId;
  private components = new Map<string, Component>();
  private active = true;
  public userData: any = {}; // For storing arbitrary data like player IDs

  constructor() {
    this.id = Entity.nextId++;
  }

  public addComponent<T extends Component>(component: T): T {
    // Use explicit componentType if available, fallback to constructor name
    const componentName = (component as any).componentType || component.constructor.name;
    this.components.set(componentName, component);
    return component;
  }

  public removeComponent<T extends Component>(componentType: new () => T): void {
    this.components.delete(componentType.name);
  }

  public getComponent<T extends Component>(componentType: new () => T): T | undefined {
    // Use explicit componentType if available, fallback to constructor name
    const requestedType = (componentType as any).componentType || componentType.name;
    let component = this.components.get(requestedType);
    
    // If not found with explicit type, try searching by constructor name as fallback
    if (!component && (componentType as any).componentType) {
      component = this.components.get(componentType.name);
      if (component) {
      }
    }
    
    // If still not found, search through all components to find a match by type
    if (!component && componentType && typeof componentType === 'function') {
      const entries = Array.from(this.components.entries());
      for (const [key, comp] of entries) {
        try {
          if (comp instanceof componentType) {
            // Reduce spam - only log occasionally for instanceof fallback usage
            if (Math.random() < 0.01) { // Only log 1% of the time
            }
            component = comp;
            break;
          }
        } catch (error) {
          console.warn('Entity.getComponent: instanceof check failed for componentType:', componentType, 'error:', error);
          break;
        }
      }
    }
    
    if (component) {
      const actualType = (component as any).componentType || component.constructor.name;
      if (actualType !== requestedType && !component.constructor.name.match(/^[a-z]$/)) {
        // Only warn if it's not a minified single-letter class name
      }
    } else {
      // Reduce spam - only log occasionally for missing components
      if (Math.random() < 0.001) { // Only log 0.1% of the time
      }
    }
    
    return component as T;
  }

  public hasComponent<T extends Component>(componentType: new () => T): boolean {
    // Use explicit componentType if available, fallback to constructor name
    const requestedType = (componentType as any).componentType || componentType.name;
    
    // Check with explicit type first
    if (this.components.has(requestedType)) {
      return true;
    }
    
    // If not found with explicit type, try constructor name as fallback
    if ((componentType as any).componentType && this.components.has(componentType.name)) {
      return true;
    }
    
    // If still not found, search through all components to find a match by type
    if (componentType && typeof componentType === 'function') {
      const components = Array.from(this.components.values());
      for (const comp of components) {
        try {
          if (comp instanceof componentType) {
            return true;
          }
        } catch (error) {
          console.warn('Entity.hasComponent: instanceof check failed for componentType:', componentType, 'error:', error);
          break;
        }
      }
    }
    
    return false;
  }

  public hasComponents(componentTypes: (new () => Component)[]): boolean {
    return componentTypes.every(type => this.hasComponent(type));
  }

  public getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }

  public getComponentNames(): string[] {
    return Array.from(this.components.keys());
  }

  public isActive(): boolean {
    return this.active;
  }

  public setActive(active: boolean): void {
    this.active = active;
  }

  public destroy(): void {
    this.components.clear();
    this.active = false;
  }
}

export abstract class Component {
  public enabled = true;
  
  public abstract reset(): void; // For object pooling
}
