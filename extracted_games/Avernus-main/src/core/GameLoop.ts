// Optimized game loop with fixed timestep physics
import { EventEmitter } from '@/utils/EventEmitter';

export interface GameLoopEvents {
  update: { deltaTime: number };
  fixedUpdate: { fixedDeltaTime: number };
  render: { deltaTime: number; interpolation: number };
}

export class GameLoop extends EventEmitter {
  private isRunning = false;
  private lastTime = 0;
  private accumulator = 0;
  private currentTime = 0;
  private frameId = 0;

  // Performance settings
  private readonly fixedTimeStep = 1 / 60; // 60 FPS physics
  private readonly maxFrameTime = 1 / 30;  // Prevent spiral of death at 30 FPS
  private readonly maxSubSteps = 5;        // Maximum physics substeps per frame

  // Performance monitoring
  private frameCount = 0;
  private fpsUpdateTime = 0;
  private currentFPS = 0;

  constructor() {
    super();
  }

  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.frameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  public getCurrentFPS(): number {
    return this.currentFPS;
  }

  public getFixedTimeStep(): number {
    return this.fixedTimeStep;
  }

  private gameLoop(currentTime: number): void {
    if (!this.isRunning) return;

    // Calculate delta time and clamp it to prevent large jumps
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, this.maxFrameTime);
    this.lastTime = currentTime;
    this.currentTime = currentTime;

    // Update FPS counter
    this.updateFPS(deltaTime);

    // Accumulate time for fixed timestep physics
    this.accumulator += deltaTime;

    // Fixed timestep physics updates
    let subSteps = 0;
    while (this.accumulator >= this.fixedTimeStep && subSteps < this.maxSubSteps) {
      this.emit('fixedUpdate', { fixedDeltaTime: this.fixedTimeStep });
      this.accumulator -= this.fixedTimeStep;
      subSteps++;
    }

    // Variable timestep game logic update
    this.emit('update', { deltaTime });

    // Calculate interpolation factor for smooth rendering
    const interpolation = this.accumulator / this.fixedTimeStep;

    // Render with interpolation
    this.emit('render', { deltaTime, interpolation });

    // Schedule next frame
    this.frameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  private updateFPS(deltaTime: number): void {
    this.frameCount++;
    this.fpsUpdateTime += deltaTime;

    // Update FPS every second
    if (this.fpsUpdateTime >= 1.0) {
      this.currentFPS = Math.round(this.frameCount / this.fpsUpdateTime);
      this.frameCount = 0;
      this.fpsUpdateTime = 0;
    }
  }

  public pause(): void {
    if (this.isRunning) {
      this.stop();
    }
  }

  public resume(): void {
    if (!this.isRunning) {
      this.start();
    }
  }

  public isPaused(): boolean {
    return !this.isRunning;
  }

  // Get current time for systems that need it
  public getCurrentTime(): number {
    return this.currentTime;
  }

  // Get accumulator ratio for interpolation
  public getInterpolationRatio(): number {
    return this.accumulator / this.fixedTimeStep;
  }
}
