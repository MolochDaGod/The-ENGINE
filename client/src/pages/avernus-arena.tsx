import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import * as THREE from 'three';

// Combat constants (from @grudge/combat)
const GROUP_SCENE = 2;
const GROUP_ROLE = 4;
const GROUP_ENEMY = 8;
const MAX_DT = 1 / 60;

// ─── Constants ──────────────────────────────────────────
const ARENA_RADIUS = 40;
const WALL_HEIGHT = 8;
const PILLAR_COUNT = 12;
const PILLAR_RADIUS = 1.2;
const PILLAR_HEIGHT = 10;
const TORCH_HEIGHT = 6;
const PLAYER_SPEED = 8;
const CAMERA_DISTANCE = 6;
const CAMERA_HEIGHT = 3.5;
const CAMERA_LERP = 0.08;
const MOUSE_SENSITIVITY = 0.003;

// ─── Textures (procedural) ──────────────────────────────
function createStoneTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base stone color
  ctx.fillStyle = '#3a3632';
  ctx.fillRect(0, 0, size, size);

  // Random noise for stone grain
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const brightness = 40 + Math.random() * 30;
    ctx.fillStyle = `rgb(${brightness}, ${brightness - 5}, ${brightness - 10})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Mortar lines (grid)
  ctx.strokeStyle = '#2a2622';
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (let x = 0; x < size; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function createGroundTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Packed dirt base
  ctx.fillStyle = '#4a3f35';
  ctx.fillRect(0, 0, size, size);

  // Sand/dirt variation
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random();
    if (r < 0.3) {
      ctx.fillStyle = `rgba(90, 75, 55, ${0.3 + Math.random() * 0.4})`;
    } else if (r < 0.6) {
      ctx.fillStyle = `rgba(60, 50, 40, ${0.3 + Math.random() * 0.4})`;
    } else {
      ctx.fillStyle = `rgba(100, 85, 65, ${0.2 + Math.random() * 0.3})`;
    }
    ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }

  // Arena circle marking
  ctx.strokeStyle = 'rgba(180, 160, 100, 0.15)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

// ─── Scene builder functions ────────────────────────────
function buildGround(scene: THREE.Scene): THREE.Mesh {
  const groundTex = createGroundTexture();
  const geo = new THREE.CircleGeometry(ARENA_RADIUS, 64);
  const mat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.9,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.userData.collisionGroup = GROUP_SCENE;
  scene.add(mesh);
  return mesh;
}

function buildWalls(scene: THREE.Scene): void {
  const stoneTex = createStoneTexture();
  const wallGeo = new THREE.CylinderGeometry(
    ARENA_RADIUS + 0.5,
    ARENA_RADIUS + 0.5,
    WALL_HEIGHT,
    64,
    1,
    true
  );
  const wallMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    roughness: 0.85,
    metalness: 0.1,
    side: THREE.BackSide,
  });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.y = WALL_HEIGHT / 2;
  wall.receiveShadow = true;
  wall.castShadow = true;
  wall.userData.collisionGroup = GROUP_SCENE;
  scene.add(wall);

  // Wall cap (top rim)
  const rimGeo = new THREE.TorusGeometry(ARENA_RADIUS + 0.5, 0.4, 8, 64);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x5a4e42,
    roughness: 0.7,
    metalness: 0.2,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = WALL_HEIGHT;
  rim.castShadow = true;
  scene.add(rim);
}

function buildPillars(scene: THREE.Scene): void {
  const stoneTex = createStoneTexture();
  stoneTex.repeat.set(1, 2);

  for (let i = 0; i < PILLAR_COUNT; i++) {
    const angle = (i / PILLAR_COUNT) * Math.PI * 2;
    const x = Math.cos(angle) * (ARENA_RADIUS - 2);
    const z = Math.sin(angle) * (ARENA_RADIUS - 2);

    // Pillar column
    const pillarGeo = new THREE.CylinderGeometry(
      PILLAR_RADIUS,
      PILLAR_RADIUS * 1.15,
      PILLAR_HEIGHT,
      12
    );
    const pillarMat = new THREE.MeshStandardMaterial({
      map: stoneTex.clone(),
      roughness: 0.75,
      metalness: 0.15,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(x, PILLAR_HEIGHT / 2, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    pillar.userData.collisionGroup = GROUP_SCENE;
    scene.add(pillar);

    // Pillar capital (decorative top)
    const capGeo = new THREE.BoxGeometry(
      PILLAR_RADIUS * 2.5,
      0.6,
      PILLAR_RADIUS * 2.5
    );
    const cap = new THREE.Mesh(capGeo, pillarMat);
    cap.position.set(x, PILLAR_HEIGHT + 0.3, z);
    cap.castShadow = true;
    scene.add(cap);
  }
}

function buildTorches(scene: THREE.Scene): THREE.PointLight[] {
  const lights: THREE.PointLight[] = [];
  const torchCount = 8;

  for (let i = 0; i < torchCount; i++) {
    const angle = (i / torchCount) * Math.PI * 2 + Math.PI / torchCount;
    const x = Math.cos(angle) * (ARENA_RADIUS - 3);
    const z = Math.sin(angle) * (ARENA_RADIUS - 3);

    // Torch bracket
    const bracketGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6);
    const bracketMat = new THREE.MeshStandardMaterial({
      color: 0x3d3530,
      roughness: 0.6,
      metalness: 0.4,
    });
    const bracket = new THREE.Mesh(bracketGeo, bracketMat);
    bracket.position.set(x, TORCH_HEIGHT - 0.75, z);
    scene.add(bracket);

    // Flame glow
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff8820,
      transparent: true,
      opacity: 0.9,
    });
    const flameGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(x, TORCH_HEIGHT, z);
    scene.add(flame);

    // Point light
    const light = new THREE.PointLight(0xff6600, 2.5, 18, 1.5);
    light.position.set(x, TORCH_HEIGHT + 0.3, z);
    light.castShadow = false; // too many shadow-casting lights is expensive
    scene.add(light);
    lights.push(light);
  }

  return lights;
}

function buildPlayer(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();

  // Body (capsule = cylinder + 2 hemispheres)
  const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.0, 12);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3388cc,
    roughness: 0.4,
    metalness: 0.3,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.3, 12, 12);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xddaa77,
    roughness: 0.5,
    metalness: 0.1,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.8;
  head.castShadow = true;
  group.add(head);

  // Shoulder pads (WoW-style flair)
  const padGeo = new THREE.SphereGeometry(0.22, 8, 8);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x886633,
    roughness: 0.6,
    metalness: 0.3,
  });
  const leftPad = new THREE.Mesh(padGeo, padMat);
  leftPad.position.set(-0.45, 1.4, 0);
  leftPad.scale.set(1, 0.7, 1.2);
  leftPad.castShadow = true;
  group.add(leftPad);

  const rightPad = new THREE.Mesh(padGeo.clone(), padMat);
  rightPad.position.set(0.45, 1.4, 0);
  rightPad.scale.set(1, 0.7, 1.2);
  rightPad.castShadow = true;
  group.add(rightPad);

  group.userData.collisionGroup = GROUP_ROLE;
  scene.add(group);
  return group;
}

interface EnemyData {
  group: THREE.Group;
  name: string;
  hp: number;
  maxHp: number;
  ring: THREE.Mesh;
}

function buildEnemyDummy(
  scene: THREE.Scene,
  x: number,
  z: number,
  name: string
): EnemyData {
  const group = new THREE.Group();

  const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xcc3333,
    roughness: 0.5,
    metalness: 0.2,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  const headGeo = new THREE.SphereGeometry(0.28, 8, 8);
  const head = new THREE.Mesh(
    headGeo,
    new THREE.MeshStandardMaterial({ color: 0x994444, roughness: 0.5 })
  );
  head.position.y = 1.75;
  head.castShadow = true;
  group.add(head);

  // Target selection ring (hidden by default)
  const ringGeo = new THREE.RingGeometry(0.7, 0.9, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff4444,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;
  group.add(ring);

  group.position.set(x, 0, z);
  group.userData.collisionGroup = GROUP_ENEMY;
  group.userData.enemyName = name;
  scene.add(group);
  return { group, name, hp: 800, maxHp: 800, ring };
}

// ─── Center arena brazier ───────────────────────────────
function buildCenterBrazier(scene: THREE.Scene): THREE.PointLight {
  // Stone base
  const baseGeo = new THREE.CylinderGeometry(1.5, 2.0, 0.8, 8);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x4a4035,
    roughness: 0.8,
    metalness: 0.15,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.4;
  base.castShadow = true;
  base.receiveShadow = true;
  scene.add(base);

  // Bowl
  const bowlGeo = new THREE.CylinderGeometry(1.2, 0.8, 0.5, 8, 1, true);
  const bowlMat = new THREE.MeshStandardMaterial({
    color: 0x3a3025,
    roughness: 0.7,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  const bowl = new THREE.Mesh(bowlGeo, bowlMat);
  bowl.position.y = 1.05;
  scene.add(bowl);

  // Glowing embers inside
  const emberGeo = new THREE.CircleGeometry(1.0, 16);
  const emberMat = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.7,
  });
  const embers = new THREE.Mesh(emberGeo, emberMat);
  embers.rotation.x = -Math.PI / 2;
  embers.position.y = 0.85;
  scene.add(embers);

  // Central fire light
  const fireLight = new THREE.PointLight(0xff6622, 4, 25, 1.2);
  fireLight.position.set(0, 2.5, 0);
  fireLight.castShadow = true;
  fireLight.shadow.mapSize.width = 512;
  fireLight.shadow.mapSize.height = 512;
  scene.add(fireLight);

  // Rune circle on ground around brazier
  const runeGeo = new THREE.RingGeometry(3.5, 4.0, 64);
  const runeMat = new THREE.MeshBasicMaterial({
    color: 0xc8a040,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
  });
  const runes = new THREE.Mesh(runeGeo, runeMat);
  runes.rotation.x = -Math.PI / 2;
  runes.position.y = 0.01;
  scene.add(runes);

  // Inner rune ring
  const innerRuneGeo = new THREE.RingGeometry(2.0, 2.2, 64);
  const innerRunes = new THREE.Mesh(innerRuneGeo, runeMat.clone());
  innerRunes.rotation.x = -Math.PI / 2;
  innerRunes.position.y = 0.01;
  scene.add(innerRunes);

  return fireLight;
}

// ─── Fire particle system ───────────────────────────────
function buildFireParticles(
  scene: THREE.Scene,
  origin: THREE.Vector3,
  count: number = 60
): { points: THREE.Points; update: (dt: number) => void } {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const lifetimes = new Float32Array(count);
  const ages = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    resetParticle(i);
  }

  function resetParticle(i: number) {
    positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.8;
    positions[i * 3 + 1] = origin.y + Math.random() * 0.3;
    positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.8;
    velocities[i * 3] = (Math.random() - 0.5) * 0.3;
    velocities[i * 3 + 1] = 1.5 + Math.random() * 2.0;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    lifetimes[i] = 0.5 + Math.random() * 1.0;
    ages[i] = Math.random() * lifetimes[i]; // stagger initial ages
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xff6622,
    size: 0.25,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  function update(dt: number) {
    for (let i = 0; i < count; i++) {
      ages[i] += dt;
      if (ages[i] >= lifetimes[i]) {
        resetParticle(i);
        ages[i] = 0;
      }
      positions[i * 3] += velocities[i * 3] * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
    }
    geo.attributes.position.needsUpdate = true;
  }

  return { points, update };
}

// ─── Hotbar skill definitions ───────────────────────────
const HOTBAR_SLOTS = [
  { key: '1', label: 'Strike', icon: '⚔️', color: '#cc4444' },
  { key: '2', label: 'Shield', icon: '🛡️', color: '#4488cc' },
  { key: '3', label: 'Dash', icon: '💨', color: '#44cc88' },
  { key: '4', label: 'Hadouken', icon: '🔥', color: '#ff8800' },
  { key: '5', label: '', icon: '', color: '#333' },           // empty per user pref
  { key: '6', label: 'Food', icon: '🍖', color: '#88cc44' },
  { key: '7', label: 'Potion', icon: '🧪', color: '#cc44cc' },
  { key: '8', label: 'Relic', icon: '💎', color: '#44cccc' },
];

// ─── HUD overlay ────────────────────────────────────────
function HUD({ targetInfo }: { targetInfo: { name: string; hp: number; maxHp: number } | null }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#e8d5a3',
          fontFamily: '"Cinzel", "Times New Roman", serif',
          fontSize: 28,
          fontWeight: 700,
          textShadow: '0 0 12px rgba(200,150,50,0.6), 0 2px 4px rgba(0,0,0,0.8)',
          letterSpacing: 4,
          userSelect: 'none',
        }}
      >
        AVERNUS ARENA
      </div>

      {/* Target frame (WoW-style) */}
      {targetInfo && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 240,
            background: 'rgba(0,0,0,0.7)',
            border: '2px solid #8b0000',
            borderRadius: 6,
            padding: '6px 10px',
          }}
        >
          <div
            style={{
              color: '#ff6666',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 4,
              fontFamily: 'sans-serif',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            {targetInfo.name}
          </div>
          <div
            style={{
              background: 'rgba(40,0,0,0.5)',
              border: '1px solid #5a2020',
              borderRadius: 3,
              padding: 2,
            }}
          >
            <div
              style={{
                background: 'linear-gradient(to right, #cc2222, #ee4444)',
                height: 14,
                borderRadius: 2,
                width: `${(targetInfo.hp / targetInfo.maxHp) * 100}%`,
                transition: 'width 0.3s',
                boxShadow: '0 0 6px rgba(200,50,50,0.4)',
              }}
            />
          </div>
          <div
            style={{
              textAlign: 'center',
              color: '#aaa',
              fontSize: 10,
              marginTop: 2,
              userSelect: 'none',
            }}
          >
            {targetInfo.hp} / {targetInfo.maxHp}
          </div>
        </div>
      )}

      {/* Player health bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 280,
        }}
      >
        <div
          style={{
            background: 'rgba(0,0,0,0.6)',
            border: '2px solid #5a4a30',
            borderRadius: 4,
            padding: 3,
          }}
        >
          <div
            style={{
              background: 'linear-gradient(to right, #22aa44, #44cc66)',
              height: 18,
              borderRadius: 2,
              width: '100%',
              boxShadow: '0 0 8px rgba(50,200,80,0.4)',
            }}
          />
        </div>
        <div
          style={{
            textAlign: 'center',
            color: '#ccc',
            fontSize: 11,
            marginTop: 2,
            userSelect: 'none',
          }}
        >
          1000 / 1000
        </div>
      </div>

      {/* Combat hotbar */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 4,
        }}
      >
        {HOTBAR_SLOTS.map((slot) => (
          <div
            key={slot.key}
            style={{
              width: 48,
              height: 48,
              background: slot.icon
                ? `linear-gradient(135deg, rgba(0,0,0,0.7), ${slot.color}33)`
                : 'rgba(0,0,0,0.4)',
              border: `2px solid ${slot.icon ? slot.color + '66' : '#333'}`,
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {slot.icon && (
              <span style={{ fontSize: 18, lineHeight: 1 }}>{slot.icon}</span>
            )}
            <span
              style={{
                position: 'absolute',
                bottom: 1,
                right: 3,
                fontSize: 9,
                color: 'rgba(200,180,120,0.5)',
                fontFamily: 'monospace',
              }}
            >
              {slot.key}
            </span>
            {slot.label && (
              <span
                style={{
                  position: 'absolute',
                  top: -14,
                  fontSize: 8,
                  color: 'rgba(200,190,170,0.5)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {slot.label}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          color: 'rgba(200,190,170,0.6)',
          fontSize: 11,
          lineHeight: 1.6,
          userSelect: 'none',
        }}
      >
        <div>WASD — Move · Q/E — Strafe</div>
        <div>Mouse — Look · Tab — Target</div>
        <div>Click — Lock cursor</div>
      </div>

      {/* Minimap placeholder */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 120,
          height: 120,
          border: '2px solid rgba(200,180,120,0.3)',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 6,
            height: 6,
            background: '#3388cc',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 6px #3388cc',
          }}
        />
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────
export default function AvernusArena() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [targetInfo, setTargetInfo] = useState<{
    name: string;
    hp: number;
    maxHp: number;
  } | null>(null);

  const init = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    container.appendChild(renderer.domElement);

    // ── Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0a08);
    scene.fog = new THREE.Fog(0x0c0a08, 30, 60);

    // ── Camera
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );

    // ── Lighting
    const ambientLight = new THREE.AmbientLight(0x222244, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffe8c0, 1.2);
    dirLight.position.set(15, 25, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);
    scene.add(dirLight.target);

    // Subtle hemisphere for sky/ground bounce
    const hemiLight = new THREE.HemisphereLight(0x2233aa, 0x3a2a18, 0.35);
    scene.add(hemiLight);

    // ── Build arena
    buildGround(scene);
    buildWalls(scene);
    buildPillars(scene);
    const torchLights = buildTorches(scene);
    const centerLight = buildCenterBrazier(scene);
    const fireParticles = buildFireParticles(scene, new THREE.Vector3(0, 1.2, 0), 80);

    // ── Player
    const player = buildPlayer(scene);
    player.position.set(0, 0, 5);

    // ── Enemies with target data
    const enemies: EnemyData[] = [
      buildEnemyDummy(scene, 8, 0, 'Crimson Gladiator'),
      buildEnemyDummy(scene, -6, 10, 'Shadow Berserker'),
      buildEnemyDummy(scene, 4, -12, 'Ironclad Warden'),
    ];
    let selectedTargetIdx = -1;

    // ── Input state
    const keys: Record<string, boolean> = {};
    let yaw = 0; // horizontal camera orbit
    let pitch = 0.3; // vertical camera angle
    let isPointerLocked = false;

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;

      // Tab = cycle targets (WoW-style)
      if (e.code === 'Tab') {
        e.preventDefault();
        // Deselect previous
        if (selectedTargetIdx >= 0) {
          enemies[selectedTargetIdx].ring.visible = false;
        }
        selectedTargetIdx = (selectedTargetIdx + 1) % enemies.length;
        const tgt = enemies[selectedTargetIdx];
        tgt.ring.visible = true;
        setTargetInfo({ name: tgt.name, hp: tgt.hp, maxHp: tgt.maxHp });
      }

      // Escape clears target (in addition to unlocking pointer)
      if (e.code === 'Escape' && selectedTargetIdx >= 0) {
        enemies[selectedTargetIdx].ring.visible = false;
        selectedTargetIdx = -1;
        setTargetInfo(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerLocked) return;
      yaw -= e.movementX * MOUSE_SENSITIVITY;
      pitch -= e.movementY * MOUSE_SENSITIVITY;
      pitch = Math.max(-0.5, Math.min(1.2, pitch));
    };
    const onClick = () => {
      renderer.domElement.requestPointerLock();
    };
    const onPointerLockChange = () => {
      isPointerLocked = document.pointerLockElement === renderer.domElement;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    // ── Animation loop
    const clock = new THREE.Clock();
    let animFrameId = 0;

    // Camera target position (lerped)
    const camTarget = new THREE.Vector3();
    const camPos = new THREE.Vector3();

    function animate() {
      animFrameId = requestAnimationFrame(animate);
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, MAX_DT * 3); // clamp to prevent physics explosions

      // ── Player movement (W = forward away from camera, as per user preference)
      const moveDir = new THREE.Vector3();
      const forward = new THREE.Vector3(
        -Math.sin(yaw),
        0,
        -Math.cos(yaw)
      );
      const right = new THREE.Vector3(
        Math.cos(yaw),
        0,
        -Math.sin(yaw)
      );

      // W/S = forward/back relative to camera yaw
      if (keys['KeyW']) moveDir.add(forward);
      if (keys['KeyS']) moveDir.sub(forward);
      // A/D = turn character with camera (user pref: a/d turn, q/e strafe)
      if (keys['KeyA']) yaw += 2.0 * dt;
      if (keys['KeyD']) yaw -= 2.0 * dt;
      // Q/E = strafe
      if (keys['KeyQ']) moveDir.sub(right);
      if (keys['KeyE']) moveDir.add(right);

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize().multiplyScalar(PLAYER_SPEED * dt);

        // Move player
        const newX = player.position.x + moveDir.x;
        const newZ = player.position.z + moveDir.z;

        // Arena boundary clamp
        const distFromCenter = Math.sqrt(newX * newX + newZ * newZ);
        if (distFromCenter < ARENA_RADIUS - 1.5) {
          player.position.x = newX;
          player.position.z = newZ;
        }

        // Face movement direction (annihilate pattern: mesh.rotation.y = -facing.angle() + PI/2)
        const facingAngle = Math.atan2(moveDir.x, moveDir.z);
        player.rotation.y = facingAngle;
      }

      // ── Camera: over-the-shoulder follow (Fortnite-style per user pref)
      const shoulderOffset = 0.8; // slight right offset
      camTarget.set(
        player.position.x,
        player.position.y + 1.5,
        player.position.z
      );

      const camIdealX =
        player.position.x +
        Math.sin(yaw) * CAMERA_DISTANCE * Math.cos(pitch) +
        Math.cos(yaw) * shoulderOffset;
      const camIdealY = player.position.y + CAMERA_HEIGHT + Math.sin(pitch) * CAMERA_DISTANCE;
      const camIdealZ =
        player.position.z +
        Math.cos(yaw) * CAMERA_DISTANCE * Math.cos(pitch) -
        Math.sin(yaw) * shoulderOffset;

      camPos.lerp(new THREE.Vector3(camIdealX, camIdealY, camIdealZ), CAMERA_LERP);
      camera.position.copy(camPos);
      camera.lookAt(camTarget);

      // ── Shadow light follows player
      dirLight.position.set(
        player.position.x + 15,
        25,
        player.position.z + 10
      );
      dirLight.target.position.copy(player.position);

      // ── Torch flicker
      for (const tl of torchLights) {
        tl.intensity = 2.2 + Math.sin(Date.now() * 0.005 + tl.position.x) * 0.5;
      }

      // ── Center brazier flicker
      centerLight.intensity = 3.5 + Math.sin(Date.now() * 0.008) * 1.0;

      // ── Fire particles
      fireParticles.update(dt);

      // ── Target ring pulse
      if (selectedTargetIdx >= 0) {
        const ring = enemies[selectedTargetIdx].ring;
        const pulse = 0.4 + Math.sin(Date.now() * 0.004) * 0.2;
        (ring.material as THREE.MeshBasicMaterial).opacity = pulse;
      }

      renderer.render(scene, camera);
    }

    // Set initial camera position before first frame
    camPos.set(
      Math.sin(yaw) * CAMERA_DISTANCE,
      CAMERA_HEIGHT,
      Math.cos(yaw) * CAMERA_DISTANCE
    );
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    animate();

    // ── Resize handler
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ── Cleanup
    cleanupRef.current = () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    init();
    return () => {
      cleanupRef.current?.();
    };
  }, [init]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0c0a08',
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      {/* Three.js canvas container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* HUD overlay */}
      <HUD targetInfo={targetInfo} />

      {/* Back button */}
      <Link href="/super-engine">
        <Button variant="outline" className="absolute top-4 left-4 z-20 border-amber-400/30 text-amber-300/80 bg-black/50 hover:bg-black/70" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </Link>
    </div>
  );
}
