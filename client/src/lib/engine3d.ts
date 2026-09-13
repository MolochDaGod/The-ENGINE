/**
 * Shared Three.js system presets for Grudge Studio Forge previews.
 * Patterns from grudgedot-launcher engine3d + GrudgeEngine defaults.
 */

export type CameraPresetId = "rts" | "thirdPerson" | "fps" | "isometric" | "platformer" | "orbit";
export type LightingPresetId = "forge" | "day" | "night" | "sunset" | "indoor" | "arena";
export type ToneMappingId = "none" | "linear" | "reinhard" | "cineon" | "aces";

export interface CameraPreset {
  fov: number;
  near: number;
  far: number;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  autoRotate?: boolean;
}

export interface LightingPreset {
  ambient: { color: string; intensity: number };
  hemisphere?: { sky: string; ground: string; intensity: number };
  directional?: { color: string; intensity: number; position: { x: number; y: number; z: number } };
  fog?: { color: string; near: number; far: number };
  background: string;
}

export interface ForgeRenderSettings {
  lighting: LightingPresetId;
  camera: CameraPresetId;
  toneMapping: ToneMappingId;
  exposure: number;
  pixelRatio: number;
  showGrid: boolean;
  fogEnabled: boolean;
  autoRotate: boolean;
  shadows: boolean;
}

export const DEFAULT_FORGE_SETTINGS: ForgeRenderSettings = {
  lighting: "forge",
  camera: "orbit",
  toneMapping: "aces",
  exposure: 1.1,
  /** Cap DPR — 1.5 is a good desktop default; mobile callers should pass ≤1.5 */
  pixelRatio: 1.5,
  showGrid: true,
  fogEnabled: true,
  autoRotate: true,
  shadows: true,
};

/** Shared canvas quality helper for all Grudge Engine game players. */
export function resolveCanvasQuality(opts?: {
  preferHighDpr?: boolean;
}): {
  maxDpr: number;
  antialias: boolean;
  powerPreference: WebGLPowerPreference;
  shadows: boolean;
} {
  const mobile =
    typeof navigator !== "undefined" &&
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const maxDpr = mobile ? 1.5 : opts?.preferHighDpr ? 2 : 1.75;
  return {
    maxDpr,
    antialias: !mobile,
    powerPreference: "high-performance",
    shadows: !mobile,
  };
}

export function applyRendererQuality(
  renderer: {
    setPixelRatio: (n: number) => void;
    setSize: (w: number, h: number, updateStyle?: boolean) => void;
    shadowMap: { enabled: boolean };
  },
  width: number,
  height: number,
  quality = resolveCanvasQuality(),
): void {
  if (width < 1 || height < 1) return;
  const dpr =
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  renderer.setPixelRatio(Math.min(dpr, quality.maxDpr));
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = quality.shadows;
}

export const CAMERA_PRESETS: Record<CameraPresetId, CameraPreset> = {
  rts: {
    fov: 55,
    near: 0.1,
    far: 500,
    position: { x: 0, y: 28, z: 22 },
    target: { x: 0, y: 0, z: 0 },
  },
  thirdPerson: {
    fov: 50,
    near: 0.1,
    far: 400,
    position: { x: 0, y: 6, z: 12 },
    target: { x: 0, y: 1.5, z: 0 },
  },
  fps: {
    fov: 72,
    near: 0.1,
    far: 300,
    position: { x: 0, y: 1.7, z: 4 },
    target: { x: 0, y: 1.5, z: -6 },
  },
  isometric: {
    fov: 42,
    near: 0.1,
    far: 600,
    position: { x: 18, y: 18, z: 18 },
    target: { x: 0, y: 0, z: 0 },
  },
  platformer: {
    fov: 60,
    near: 0.1,
    far: 250,
    position: { x: 0, y: 4, z: 10 },
    target: { x: 0, y: 1, z: 0 },
  },
  orbit: {
    fov: 48,
    near: 0.1,
    far: 350,
    position: { x: 8, y: 5, z: 10 },
    target: { x: 0, y: 0.8, z: 0 },
    autoRotate: true,
  },
};

export const LIGHTING_PRESETS: Record<LightingPresetId, LightingPreset> = {
  forge: {
    ambient: { color: "#1a1428", intensity: 0.35 },
    hemisphere: { sky: "#ff8c42", ground: "#1a0a1e", intensity: 0.55 },
    directional: { color: "#ffd4a8", intensity: 1.1, position: { x: 6, y: 14, z: 8 } },
    fog: { color: "#120a18", near: 12, far: 80 },
    background: "#0a0610",
  },
  day: {
    ambient: { color: "#ffffff", intensity: 0.4 },
    directional: { color: "#fffaf0", intensity: 1.0, position: { x: 12, y: 20, z: 10 } },
    fog: { color: "#87ceeb", near: 30, far: 120 },
    background: "#1a2a3e",
  },
  night: {
    ambient: { color: "#1a1a2e", intensity: 0.25 },
    directional: { color: "#6a7aff", intensity: 0.35, position: { x: -8, y: 12, z: -6 } },
    fog: { color: "#0a0a1a", near: 8, far: 60 },
    background: "#050510",
  },
  sunset: {
    ambient: { color: "#ff6b35", intensity: 0.3 },
    directional: { color: "#ff8c42", intensity: 0.85, position: { x: -14, y: 6, z: 2 } },
    fog: { color: "#3d1a10", near: 10, far: 70 },
    background: "#1a0808",
  },
  indoor: {
    ambient: { color: "#ffecd2", intensity: 0.45 },
    directional: { color: "#fff8e7", intensity: 0.55, position: { x: 0, y: 8, z: 4 } },
    background: "#141018",
  },
  arena: {
    ambient: { color: "#2a1040", intensity: 0.3 },
    hemisphere: { sky: "#a855f7", ground: "#1a0520", intensity: 0.5 },
    directional: { color: "#e879f9", intensity: 0.9, position: { x: 4, y: 16, z: -4 } },
    fog: { color: "#180820", near: 6, far: 55 },
    background: "#0c0414",
  },
};

/** Map game tags/capabilities to a sensible default camera. */
export function cameraPresetForGame(tags: string[] = [], capabilities: string[] = []): CameraPresetId {
  if (tags.includes("rts")) return "rts";
  if (tags.includes("arena") || tags.includes("pvp")) return "thirdPerson";
  if (capabilities.includes("2D")) return "platformer";
  if (tags.includes("mmo")) return "thirdPerson";
  return "orbit";
}

export function lightingPresetForGame(tags: string[] = []): LightingPresetId {
  if (tags.includes("arena") || tags.includes("pvp")) return "arena";
  if (tags.includes("rts")) return "day";
  return "forge";
}

export function hexToThreeColor(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}