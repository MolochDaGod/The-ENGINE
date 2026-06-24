/**
 * Persisted controller feel settings — from artifact animator controlsSettings.ts
 */
export interface ControlSettings {
  moveSpeed: number;
  sprintMultiplier: number;
  jumpHeight: number;
  gravity: number;
  cameraDistance: number;
  cameraHeight: number;
  mouseSensitivity: number;
  fov: number;
  turnResponsiveness: number;
  blendTime: number;
  skillForce: number;
  invertY: boolean;
  enableOverShoulder: boolean;
}

export const DEFAULT_CONTROLS: ControlSettings = {
  moveSpeed: 4.2,
  sprintMultiplier: 1.65,
  jumpHeight: 2.2,
  gravity: 22,
  cameraDistance: 5.5,
  cameraHeight: 1.6,
  mouseSensitivity: 1.1,
  fov: 70,
  turnResponsiveness: 12,
  blendTime: 0.22,
  skillForce: 14,
  invertY: false,
  enableOverShoulder: true,
};

const STORAGE_KEY = 'grudge:controller:settings';
const SCHEMA = 1;

const RANGES: Record<keyof ControlSettings, readonly [number, number] | null> = {
  moveSpeed: [1, 10],
  sprintMultiplier: [1, 3],
  jumpHeight: [0.5, 5],
  gravity: [8, 40],
  cameraDistance: [2.5, 12],
  cameraHeight: [0.5, 4],
  mouseSensitivity: [0.2, 3],
  fov: [40, 100],
  turnResponsiveness: [2, 25],
  blendTime: [0.05, 0.6],
  skillForce: [4, 30],
  invertY: null,
  enableOverShoulder: null,
};

function clampNum(v: unknown, range: readonly [number, number], fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(range[1], Math.max(range[0], v));
}

export function loadControlSettings(): ControlSettings {
  const d = DEFAULT_CONTROLS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...d };
    const o = JSON.parse(raw) as Partial<ControlSettings> & { schema?: number };
    if (o.schema !== SCHEMA) return { ...d };
    return {
      moveSpeed: clampNum(o.moveSpeed, RANGES.moveSpeed!, d.moveSpeed),
      sprintMultiplier: clampNum(o.sprintMultiplier, RANGES.sprintMultiplier!, d.sprintMultiplier),
      jumpHeight: clampNum(o.jumpHeight, RANGES.jumpHeight!, d.jumpHeight),
      gravity: clampNum(o.gravity, RANGES.gravity!, d.gravity),
      cameraDistance: clampNum(o.cameraDistance, RANGES.cameraDistance!, d.cameraDistance),
      cameraHeight: clampNum(o.cameraHeight, RANGES.cameraHeight!, d.cameraHeight),
      mouseSensitivity: clampNum(o.mouseSensitivity, RANGES.mouseSensitivity!, d.mouseSensitivity),
      fov: clampNum(o.fov, RANGES.fov!, d.fov),
      turnResponsiveness: clampNum(o.turnResponsiveness, RANGES.turnResponsiveness!, d.turnResponsiveness),
      blendTime: clampNum(o.blendTime, RANGES.blendTime!, d.blendTime),
      skillForce: clampNum(o.skillForce, RANGES.skillForce!, d.skillForce),
      invertY: typeof o.invertY === 'boolean' ? o.invertY : d.invertY,
      enableOverShoulder: typeof o.enableOverShoulder === 'boolean' ? o.enableOverShoulder : d.enableOverShoulder,
    };
  } catch {
    return { ...d };
  }
}

export function saveControlSettings(s: ControlSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, schema: SCHEMA }));
  } catch { /* quota / private mode */ }
}