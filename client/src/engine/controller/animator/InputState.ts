/**
 * Ported from grudgecontroller/artifacts/animator/src/three/input.ts
 * Lightweight keyboard + mouse state tracker for Grudge Engine games.
 */

function clampMove(v: number, max: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < -max ? -max : v > max ? max : v;
}

const DOUBLE_TAP_MS = 280;

export class InputState {
  keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;

  private tapAt: Record<string, number> = {};
  private doubleTaps = new Set<string>();
  private pressed = new Set<string>();

  moveX = 0;
  moveY = 0;
  lookActive = false;
  touchSprint = false;

  private freshLock = false;
  private dom: HTMLElement;

  private onKeyDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const fresh = !this.keys.has(e.code);
    this.keys.add(e.code);
    if (fresh) {
      this.pressed.add(e.code);
      const now = performance.now();
      const last = this.tapAt[e.code] ?? 0;
      if (now - last <= DOUBLE_TAP_MS) {
        this.doubleTaps.add(e.code);
        this.tapAt[e.code] = 0;
      } else {
        this.tapAt[e.code] = now;
      }
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    if (this.freshLock) {
      this.freshLock = false;
      return;
    }
    const MAX_MOVE = 120;
    this.mouseDX += clampMove(e.movementX, MAX_MOVE);
    this.mouseDY += clampMove(e.movementY, MAX_MOVE);
  };

  private onWheel = (e: WheelEvent) => {
    this.wheel += e.deltaY;
  };

  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.dom;
    if (this.locked) {
      this.freshLock = true;
      this.mouseDX = 0;
      this.mouseDY = 0;
    } else {
      this.keys.clear();
      this.doubleTaps.clear();
      this.pressed.clear();
      this.tapAt = {};
    }
  };

  constructor(dom: HTMLElement) {
    this.dom = dom;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  setMove(x: number, y: number): void {
    this.moveX = x;
    this.moveY = y;
  }

  addLook(dx: number, dy: number): void {
    this.mouseDX += dx;
    this.mouseDY += dy;
  }

  pressVirtual(code: string): void {
    this.keys.add(code);
  }

  releaseVirtual(code: string): void {
    this.keys.delete(code);
  }

  requestLock(): void {
    this.dom.requestPointerLock?.();
  }

  exitLock(): void {
    if (document.pointerLockElement === this.dom) document.exitPointerLock?.();
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  consumeDoubleTap(code: string): boolean {
    if (this.doubleTaps.has(code)) {
      this.doubleTaps.delete(code);
      return true;
    }
    return false;
  }

  consumePress(code: string): boolean {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  consumeMouse(): { dx: number; dy: number; wheel: number } {
    const out = { dx: this.mouseDX, dy: this.mouseDY, wheel: this.wheel };
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    return out;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.dom.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onLockChange);
  }
}