// Main game engine with ECS integration
import { World } from '@/ecs/World';
import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import { EventEmitter } from '@/utils/EventEmitter';

export interface EngineConfig {
  canvas?: HTMLCanvasElement;
  enableDebug?: boolean;
  targetFPS?: number;
}

export class Engine extends EventEmitter {
  private world: World;
  private gameLoop: GameLoop;
  private inputManager: InputManager;
  private canvas: HTMLCanvasElement | null = null;
  private isInitialized = false;
  private isRunning = false;
  private debugMode = false;

  // Performance monitoring
  private frameTime = 0;
  private updateTime = 0;
  private renderTime = 0;

  constructor(config: EngineConfig = {}) {
    super();
    
    this.world = new World();
    this.gameLoop = new GameLoop();
    this.inputManager = new InputManager();
    this.debugMode = config.enableDebug || false;

    this.setupGameLoop();
  }

  public async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.canvas = canvas;
    this.inputManager.initialize(canvas);
    
    this.isInitialized = true;
    this.emit('initialized');
    
  }

  public start(): void {
    if (!this.isInitialized) {
      throw new Error('Engine must be initialized before starting');
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.gameLoop.start();
    this.emit('started');
    

  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.gameLoop.stop();
    this.emit('stopped');
    

  }

  public pause(): void {
    if (this.isRunning) {
      this.gameLoop.pause();
      this.emit('paused');
    }
  }

  public resume(): void {
    if (this.isRunning) {
      this.gameLoop.resume();
      this.emit('resumed');
    }
  }

  public getWorld(): World {
    return this.world;
  }

  public getInputManager(): InputManager {
    return this.inputManager;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  public isEngineRunning(): boolean {
    return this.isRunning;
  }

  public getCurrentFPS(): number {
    return this.gameLoop.getCurrentFPS();
  }

  public getPerformanceStats() {
    return {
      fps: this.gameLoop.getCurrentFPS(),
      frameTime: this.frameTime,
      updateTime: this.updateTime,
      renderTime: this.renderTime,
    };
  }

  public enableDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  public isDebugMode(): boolean {
    return this.debugMode;
  }

  private setupGameLoop(): void {
    // Handle fixed timestep updates (physics)
    this.gameLoop.on('fixedUpdate', ({ fixedDeltaTime }) => {
      const startTime = performance.now();
      
      this.world.fixedUpdate(fixedDeltaTime);
      
      if (this.debugMode) {
        this.updateTime = performance.now() - startTime;
      }
    });

    // Handle variable timestep updates (game logic)
    this.gameLoop.on('update', ({ deltaTime }) => {
      const startTime = performance.now();
      
      // Update world systems first so they can read input deltas
      this.world.update(deltaTime);
      
      // Update input manager after systems have processed input
      this.inputManager.update();
      
      if (this.debugMode) {
        this.updateTime = performance.now() - startTime;
      }
      
      this.emit('update', { deltaTime });
    });

    // Handle rendering
    this.gameLoop.on('render', ({ deltaTime, interpolation }) => {
      const startTime = performance.now();
      
      // Render world
      this.world.render(deltaTime);
      
      if (this.debugMode) {
        this.renderTime = performance.now() - startTime;
        this.frameTime = this.updateTime + this.renderTime;
      }
      
      this.emit('render', { deltaTime, interpolation });
    });
  }

  public destroy(): void {
    this.stop();
    
    // Clean up systems
    this.world.destroy();
    this.inputManager.destroy();
    
    // Clear event listeners
    this.removeAllListeners();
    
    this.isInitialized = false;
  }

  // Utility methods for common operations
  public requestPointerLock(): void {
    this.inputManager.requestPointerLock();
  }

  public exitPointerLock(): void {
    this.inputManager.exitPointerLock();
  }

  public isKeyPressed(key: string): boolean {
    return this.inputManager.isKeyPressed(key);
  }

  public isMouseButtonPressed(button: number): boolean {
    return this.inputManager.isMouseButtonPressed(button);
  }

  public getMouseDelta(): { x: number; y: number } {
    return this.inputManager.getMouseDelta();
  }
}
