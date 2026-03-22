// Event system for decoupled communication
export type EventListener<T = any> = (data: T) => void;

export class EventEmitter {
  private listeners = new Map<string, EventListener[]>();

  public on<T = any>(event: string, listener: EventListener<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  public off<T = any>(event: string, listener: EventListener<T>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  public emit<T = any>(event: string, data?: T): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      // Create a copy to avoid issues if listeners are modified during emission
      const listeners = [...eventListeners];
      for (const listener of listeners) {
        listener(data);
      }
    }
  }

  public once<T = any>(event: string, listener: EventListener<T>): void {
    const onceListener: EventListener<T> = (data) => {
      listener(data);
      this.off(event, onceListener);
    };
    this.on(event, onceListener);
  }

  public removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  public getListenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
}
