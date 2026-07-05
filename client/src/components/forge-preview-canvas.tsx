import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FleetGameCard, Capability } from "@/data/fleetGames";
import {
  CAMERA_PRESETS,
  LIGHTING_PRESETS,
  type CameraPresetId,
  type ForgeRenderSettings,
  type LightingPresetId,
  type ToneMappingId,
  hexToThreeColor,
} from "@/lib/engine3d";

interface ForgePreviewCanvasProps {
  game: FleetGameCard;
  settings: ForgeRenderSettings;
  className?: string;
  interactive?: boolean;
}

const TONE_MAP: Record<ToneMappingId, THREE.ToneMapping> = {
  none: THREE.NoToneMapping,
  linear: THREE.LinearToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  cineon: THREE.CineonToneMapping,
  aces: THREE.ACESFilmicToneMapping,
};

const ACCENT: Record<string, number> = {
  "from-amber-900/60 to-amber-800/30": 0xd4af37,
  "from-red-900/60 to-red-800/30": 0xff4444,
  "from-orange-900/60 to-orange-800/30": 0xff7722,
  "from-purple-900/60 to-purple-800/30": 0xa855f7,
  "from-blue-900/60 to-blue-800/30": 0x3b82f6,
  "from-cyan-900/60 to-cyan-800/30": 0x22d3ee,
  "from-green-900/60 to-green-800/30": 0x22c55e,
  "from-indigo-900/60 to-indigo-800/30": 0x6366f1,
  "from-violet-900/60 to-purple-800/30": 0x8b5cf6,
  "from-rose-900/60 to-rose-800/30": 0xf43f5e,
  "from-teal-900/60 to-teal-800/30": 0x14b8a6,
  "from-zinc-900/60 to-zinc-800/30": 0x94a3b8,
  "from-emerald-900/60 to-emerald-800/30": 0x10b981,
  "from-lime-900/60 to-green-800/30": 0x84cc16,
  "from-pink-900/60 to-rose-800/30": 0xec4899,
  "from-slate-900/60 to-slate-800/30": 0x64748b,
};

function gameAccent(game: FleetGameCard): number {
  return ACCENT[game.color] ?? 0xff7722;
}

function buildScene(
  scene: THREE.Scene,
  game: FleetGameCard,
  accent: number,
  caps: Set<Capability>,
) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({ color: 0x1a1428, roughness: 0.92, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = "__floor";
  scene.add(floor);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.1, 1),
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.25,
      roughness: 0.35,
      metalness: 0.55,
    }),
  );
  core.position.y = 1.4;
  core.castShadow = true;
  core.name = "__core";
  scene.add(core);

  if (caps.has("3D") || caps.has("Physics")) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.08, 12, 48),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.15 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    ring.name = "__ring";
    scene.add(ring);
  }

  if (caps.has("Physics")) {
    for (let i = 0; i < 5; i++) {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.22 + Math.random() * 0.12, 12, 12),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL((i * 0.12 + 0.05) % 1, 0.7, 0.55),
          roughness: 0.4,
          metalness: 0.3,
        }),
      );
      const angle = (i / 5) * Math.PI * 2;
      ball.position.set(Math.cos(angle) * 3.2, 0.4 + i * 0.15, Math.sin(angle) * 3.2);
      ball.castShadow = true;
      ball.name = `__ball_${i}`;
      scene.add(ball);
    }
  }

  if (caps.has("Multiplayer")) {
    for (let i = 0; i < 3; i++) {
      const avatar = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.25, 0.7, 4, 8),
        new THREE.MeshStandardMaterial({
          color: i === 0 ? accent : 0x4ade80,
          roughness: 0.5,
        }),
      );
      avatar.position.set(-2.5 + i * 2.5, 0.85, -2.8);
      avatar.castShadow = true;
      avatar.name = `__avatar_${i}`;
      scene.add(avatar);
    }
  }

  if (caps.has("AI")) {
    const beacon = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.9, 6),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.4 }),
    );
    beacon.position.set(3.5, 0.55, 2.5);
    beacon.name = "__ai_beacon";
    scene.add(beacon);
  }

  if (caps.has("2D")) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2.4, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 }),
    );
    panel.position.set(0, 2.2, -1.5);
    panel.name = "__screen";
    scene.add(panel);

    const sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.8),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.85 }),
    );
    sprite.position.set(0, 2.2, -1.42);
    sprite.name = "__sprite";
    scene.add(sprite);
  }

  if (caps.has("Particles")) {
    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.5 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const y = 0.5 + Math.random() * 3;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * r;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geom,
      new THREE.PointsMaterial({
        color: accent,
        size: 0.07,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    points.name = "__particles";
    scene.add(points);
  }
}

function applyLighting(scene: THREE.Scene, presetId: LightingPresetId, fogEnabled: boolean) {
  const toRemove = scene.children.filter(
    (c) => c.name.startsWith("__light_") || c.name === "__grid",
  );
  for (const obj of toRemove) scene.remove(obj);

  const preset = LIGHTING_PRESETS[presetId];
  scene.background = new THREE.Color(hexToThreeColor(preset.background));

  if (fogEnabled && preset.fog) {
    scene.fog = new THREE.Fog(
      hexToThreeColor(preset.fog.color),
      preset.fog.near,
      preset.fog.far,
    );
  } else {
    scene.fog = null;
  }

  const ambient = new THREE.AmbientLight(
    hexToThreeColor(preset.ambient.color),
    preset.ambient.intensity,
  );
  ambient.name = "__light_ambient";
  scene.add(ambient);

  if (preset.hemisphere) {
    const hemi = new THREE.HemisphereLight(
      hexToThreeColor(preset.hemisphere.sky),
      hexToThreeColor(preset.hemisphere.ground),
      preset.hemisphere.intensity,
    );
    hemi.name = "__light_hemi";
    scene.add(hemi);
  }

  if (preset.directional) {
    const dir = new THREE.DirectionalLight(
      hexToThreeColor(preset.directional.color),
      preset.directional.intensity,
    );
    dir.position.set(
      preset.directional.position.x,
      preset.directional.position.y,
      preset.directional.position.z,
    );
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.name = "__light_dir";
    scene.add(dir);
  }
}

function applyGrid(scene: THREE.Scene, show: boolean) {
  const existing = scene.getObjectByName("__grid");
  if (existing) scene.remove(existing);
  if (!show) return;

  const grid = new THREE.GridHelper(24, 24, 0x444444, 0x222222);
  grid.position.y = 0.02;
  (grid.material as THREE.Material).opacity = 0.2;
  (grid.material as THREE.Material).transparent = true;
  grid.name = "__grid";
  scene.add(grid);
}

export function ForgePreviewCanvas({
  game,
  settings,
  className = "",
  interactive = true,
}: ForgePreviewCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    raf: number;
    clock: THREE.Clock;
  } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const w = host.clientWidth || 640;
    const h = host.clientHeight || 360;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatio));
    renderer.shadowMap.enabled = settings.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = TONE_MAP[settings.toneMapping];
    renderer.toneMappingExposure = settings.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const caps = new Set(game.capabilities);
    const accent = gameAccent(game);
    buildScene(scene, game, accent, caps);

    const camPreset = CAMERA_PRESETS[settings.camera];
    const camera = new THREE.PerspectiveCamera(camPreset.fov, w / h, camPreset.near, camPreset.far);
    camera.position.set(camPreset.position.x, camPreset.position.y, camPreset.position.z);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(camPreset.target.x, camPreset.target.y, camPreset.target.z);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enableZoom = interactive;
    controls.enablePan = interactive;
    controls.autoRotate = settings.autoRotate;
    controls.autoRotateSpeed = 0.8;
    controls.enabled = interactive;

    applyLighting(scene, settings.lighting, settings.fogEnabled);
    applyGrid(scene, settings.showGrid);

    const clock = new THREE.Clock();
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      const core = scene.getObjectByName("__core");
      if (core) {
        core.rotation.y = t * 0.6;
        core.rotation.x = Math.sin(t * 0.4) * 0.15;
      }

      const ring = scene.getObjectByName("__ring");
      if (ring) ring.rotation.z = t * 0.35;

      scene.children.forEach((child) => {
        if (child.name.startsWith("__ball_")) {
          child.position.y = 0.35 + Math.abs(Math.sin(t * 2 + child.position.x)) * 0.8;
        }
        if (child.name.startsWith("__avatar_")) {
          child.rotation.y = Math.sin(t + child.position.x) * 0.2;
        }
      });

      const particles = scene.getObjectByName("__particles") as THREE.Points | undefined;
      if (particles) {
        particles.rotation.y = t * 0.15;
        const pos = particles.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          pos.setY(i, pos.getY(i) + Math.sin(t * 2 + i) * 0.002);
        }
        pos.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const cw = host.clientWidth;
      const ch = host.clientHeight;
      if (cw === 0 || ch === 0) return;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    stateRef.current = { renderer, scene, camera, controls, raf, clock };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, [game.id, interactive]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;

    const { renderer, scene, camera, controls } = state;
    const camPreset = CAMERA_PRESETS[settings.camera];

    renderer.toneMapping = TONE_MAP[settings.toneMapping];
    renderer.toneMappingExposure = settings.exposure;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatio));
    renderer.shadowMap.enabled = settings.shadows;

    camera.fov = camPreset.fov;
    camera.near = camPreset.near;
    camera.far = camPreset.far;
    camera.position.set(camPreset.position.x, camPreset.position.y, camPreset.position.z);
    camera.updateProjectionMatrix();

    controls.target.set(camPreset.target.x, camPreset.target.y, camPreset.target.z);
    controls.autoRotate = settings.autoRotate;

    applyLighting(scene, settings.lighting, settings.fogEnabled);
    applyGrid(scene, settings.showGrid);
  }, [settings]);

  return (
    <div
      ref={hostRef}
      className={`relative w-full h-full overflow-hidden bg-black ${className}`}
      data-testid={`forge-canvas-${game.id}`}
    />
  );
}