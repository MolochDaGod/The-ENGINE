import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import heroStoneGuardian from "@assets/heroes/stone_guardian.png";
import heroDeathMage from "@assets/heroes/death_mage.png";
import heroHolyPaladin from "@assets/heroes/holy_paladin.png";
import heroOrcShaman from "@assets/heroes/orc_shaman.png";
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

type Faction = 'human' | 'orc';
type UnitType = 'peasant' | 'footman' | 'archer' | 'knight' | 'ballista' | 'mage' | 'paladin';
type BuildingType = 'townhall' | 'barracks' | 'farm' | 'tower' | 'blacksmith' | 'lumbermill' | 'stable' | 'church';
type ResourceType = 'gold' | 'lumber';
type GameMode = 'menu' | 'pve' | 'pvp';
type OrderType = 'move' | 'attack' | 'attackmove' | 'patrol' | 'stop' | 'hold' | 'gather' | 'build' | 'repair';

interface Position3D { x: number; y: number; z: number; }

interface GameUnit {
  id: string;
  type: UnitType;
  faction: Faction;
  position: Position3D;
  targetPosition: Position3D | null;
  health: number;
  maxHealth: number;
  damage: number;
  armor: number;
  range: number;
  speed: number;
  isSelected: boolean;
  currentOrder: OrderType | null;
  attackTarget: string | null;
  repairTarget: string | null;
  patrolStart: Position3D | null;
  patrolEnd: Position3D | null;
  carryingResource: { type: ResourceType; amount: number } | null;
  gatherTarget: string | null;
  lastGatherTarget: string | null;
  groupNumber: number | null;
  mesh?: THREE.Mesh;
  selectionRing?: THREE.Mesh;
  healthBar?: THREE.Group;
  isVisible: boolean;
  lastSeenPosition: Position3D | null;
}

interface GameBuilding {
  id: string;
  type: BuildingType;
  faction: Faction;
  position: Position3D;
  health: number;
  maxHealth: number;
  isConstructing: boolean;
  constructionProgress: number;
  productionQueue: UnitType[];
  productionProgress: number;
  rallyPoint: Position3D | null;
  mesh?: THREE.Mesh;
  auxMeshes?: THREE.Mesh[];
  healthBar?: THREE.Group;
  isVisible: boolean;
}

interface ResourceNode {
  id: string;
  type: ResourceType;
  position: Position3D;
  amount: number;
  mesh?: THREE.Mesh;
  trunkMesh?: THREE.Mesh;
}

interface FogCell {
  explored: boolean;
  visible: boolean;
}

const UNIT_STATS: Record<UnitType, { name: string; icon: string; cost: { gold: number; lumber: number }; health: number; damage: number; armor: number; range: number; speed: number; buildTime: number; commands: string[] }> = {
  peasant: { name: 'Peasant', icon: '👷', cost: { gold: 400, lumber: 0 }, health: 30, damage: 5, armor: 0, range: 1.5, speed: 3, buildTime: 45, commands: ['move', 'stop', 'attack', 'repair', 'gather', 'build'] },
  footman: { name: 'Footman', icon: '⚔️', cost: { gold: 600, lumber: 0 }, health: 60, damage: 6, armor: 2, range: 1.5, speed: 2.5, buildTime: 60, commands: ['move', 'stop', 'attack', 'patrol', 'hold'] },
  archer: { name: 'Elven Archer', icon: '🏹', cost: { gold: 500, lumber: 50 }, health: 40, damage: 3, armor: 0, range: 4, speed: 2.5, buildTime: 70, commands: ['move', 'stop', 'attack', 'patrol', 'hold'] },
  knight: { name: 'Knight', icon: '🐴', cost: { gold: 800, lumber: 100 }, health: 90, damage: 8, armor: 4, range: 1.5, speed: 5, buildTime: 90, commands: ['move', 'stop', 'attack', 'patrol', 'hold'] },
  ballista: { name: 'Ballista', icon: '🎯', cost: { gold: 900, lumber: 300 }, health: 110, damage: 80, armor: 0, range: 8, speed: 1.5, buildTime: 250, commands: ['move', 'stop', 'attack', 'patrol'] },
  mage: { name: 'Mage', icon: '🧙', cost: { gold: 1200, lumber: 0 }, health: 60, damage: 9, armor: 0, range: 2, speed: 2, buildTime: 120, commands: ['move', 'stop', 'attack', 'patrol'] },
  paladin: { name: 'Paladin', icon: '🛡️', cost: { gold: 800, lumber: 100 }, health: 90, damage: 8, armor: 4, range: 1.5, speed: 5, buildTime: 90, commands: ['move', 'stop', 'attack', 'patrol', 'hold'] }
};

const BUILDING_STATS: Record<BuildingType, { name: string; icon: string; cost: { gold: number; lumber: number }; health: number; buildTime: number; food: number; trains: UnitType[] }> = {
  townhall: { name: 'Town Hall', icon: '🏰', cost: { gold: 1200, lumber: 800 }, health: 1200, buildTime: 255, food: 1, trains: ['peasant'] },
  barracks: { name: 'Barracks', icon: '🏛️', cost: { gold: 700, lumber: 450 }, health: 800, buildTime: 200, food: 0, trains: ['footman', 'archer'] },
  farm: { name: 'Farm', icon: '🌾', cost: { gold: 500, lumber: 250 }, health: 400, buildTime: 100, food: 4, trains: [] },
  tower: { name: 'Scout Tower', icon: '🗼', cost: { gold: 550, lumber: 200 }, health: 100, buildTime: 60, food: 0, trains: [] },
  blacksmith: { name: 'Blacksmith', icon: '⚒️', cost: { gold: 800, lumber: 450 }, health: 775, buildTime: 200, food: 0, trains: [] },
  lumbermill: { name: 'Lumber Mill', icon: '🪓', cost: { gold: 600, lumber: 450 }, health: 600, buildTime: 150, food: 0, trains: [] },
  stable: { name: 'Stables', icon: '🐎', cost: { gold: 1000, lumber: 300 }, health: 500, buildTime: 150, food: 0, trains: ['knight', 'paladin'] },
  church: { name: 'Church', icon: '⛪', cost: { gold: 900, lumber: 500 }, health: 700, buildTime: 175, food: 0, trains: ['mage'] }
};

const COMMAND_ICONS: Record<string, { icon: string; name: string; hotkey: string }> = {
  move: { icon: '👆', name: 'Move', hotkey: 'M' },
  stop: { icon: '⏹️', name: 'Stop', hotkey: 'S' },
  attack: { icon: '⚔️', name: 'Attack', hotkey: 'A' },
  attackmove: { icon: '🎯', name: 'Attack Move', hotkey: 'A' },
  patrol: { icon: '🔄', name: 'Patrol', hotkey: 'P' },
  hold: { icon: '🛑', name: 'Hold Position', hotkey: 'H' },
  gather: { icon: '⛏️', name: 'Gather', hotkey: 'G' },
  build: { icon: '🔨', name: 'Build', hotkey: 'B' },
  repair: { icon: '🔧', name: 'Repair', hotkey: 'R' }
};

const MAP_SIZE = 64;
const FOG_GRID_SIZE = 64;
const VISION_RANGE = 6;

interface FloatingText {
  sprite: THREE.Sprite;
  startY: number;
  life: number;
  maxLife: number;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  fadeOut: boolean;
  type: 'spark' | 'fire' | 'dust' | 'arrow_trail';
}

interface PhysicsProjectile {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  damage: number;
  targetId: string | null;
  faction: Faction;
  life: number;
  trailMeshes: THREE.Mesh[];
}

interface PhysicsDebris {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  life: number;
}

interface FallingTree {
  mesh: THREE.Mesh;
  trunkMesh: THREE.Mesh | null;
  pivotGroup: THREE.Group;
  fallSpeed: number;
  currentAngle: number;
  maxAngle: number;
  life: number;
}

function createTextCanvas(text: string, color: string, fontSize: number = 48): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 32);
  return canvas;
}

const TERRAIN_COLORS = {
  grass: 0x3d5c2f,
  dirt: 0x5c4a2f,
  darkGrass: 0x2d4a1f,
  rock: 0x6b6b6b,
  sand: 0xc2a867,
  snow: 0xe8e8e8,
};

export default function Wargus() {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const fogMeshRef = useRef<THREE.Mesh | null>(null);
  const placementPreviewRef = useRef<THREE.Mesh | null>(null);
  
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [playerFaction, setPlayerFaction] = useState<Faction>('human');
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  
  const unitsRef = useRef<GameUnit[]>([]);
  const buildingsRef = useRef<GameBuilding[]>([]);
  const resourceNodesRef = useRef<ResourceNode[]>([]);
  const fogGridRef = useRef<FogCell[][]>([]);
  const unitGroupsRef = useRef<Record<number, string[]>>({});
  
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [buildingToBuild, setBuildingToBuild] = useState<BuildingType | null>(null);
  const [currentCommand, setCurrentCommand] = useState<OrderType | null>(null);
  const [resources, setResources] = useState<{ human: { gold: number; lumber: number }; orc: { gold: number; lumber: number } }>({
    human: { gold: 2000, lumber: 1000 },
    orc: { gold: 2000, lumber: 1000 }
  });
  const [food, setFood] = useState<{ human: { used: number; max: number }; orc: { used: number; max: number } }>({
    human: { used: 5, max: 9 },
    orc: { used: 5, max: 9 }
  });
  
  const [cameraPosition, setCameraPosition] = useState({ x: 10, z: 10 });
  const [cameraZoom, setCameraZoom] = useState(1);
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [cursorStyle, setCursorStyle] = useState('default');
  const [dragSelect, setDragSelect] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const composerRef = useRef<EffectComposer | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const fireParticlesRef = useRef<Map<string, THREE.Mesh[]>>(new Map());
  const physicsWorldRef = useRef<CANNON.World | null>(null);
  const physicsProjectilesRef = useRef<PhysicsProjectile[]>([]);
  const physicsDebrisRef = useRef<PhysicsDebris[]>([]);
  const fallingTreesRef = useRef<FallingTree[]>([]);
  const groundBodyRef = useRef<CANNON.Body | null>(null);
  
  const gameLoopRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isInitializedRef = useRef(false);
  const pendingGameRef = useRef<{ mode: GameMode; faction: Faction } | null>(null);

  const initFogGrid = useCallback(() => {
    const grid: FogCell[][] = [];
    for (let x = 0; x < FOG_GRID_SIZE; x++) {
      grid[x] = [];
      for (let z = 0; z < FOG_GRID_SIZE; z++) {
        grid[x][z] = { explored: false, visible: false };
      }
    }
    fogGridRef.current = grid;
  }, []);

  const updateFogOfWar = useCallback(() => {
    const grid = fogGridRef.current;
    for (let x = 0; x < FOG_GRID_SIZE; x++) {
      for (let z = 0; z < FOG_GRID_SIZE; z++) {
        grid[x][z].visible = false;
      }
    }
    
    const playerUnits = unitsRef.current.filter(u => u.faction === playerFaction);
    const playerBuildings = buildingsRef.current.filter(b => b.faction === playerFaction);
    
    const revealArea = (wx: number, wz: number, range: number) => {
      const cellX = Math.floor((wx / MAP_SIZE) * FOG_GRID_SIZE);
      const cellZ = Math.floor((wz / MAP_SIZE) * FOG_GRID_SIZE);
      const cellRange = Math.ceil((range / MAP_SIZE) * FOG_GRID_SIZE);
      
      for (let dx = -cellRange; dx <= cellRange; dx++) {
        for (let dz = -cellRange; dz <= cellRange; dz++) {
          const nx = cellX + dx;
          const nz = cellZ + dz;
          if (nx >= 0 && nx < FOG_GRID_SIZE && nz >= 0 && nz < FOG_GRID_SIZE) {
            if (dx * dx + dz * dz <= cellRange * cellRange) {
              grid[nx][nz].explored = true;
              grid[nx][nz].visible = true;
            }
          }
        }
      }
    };
    
    playerUnits.forEach(u => revealArea(u.position.x, u.position.z, VISION_RANGE));
    playerBuildings.forEach(b => revealArea(b.position.x, b.position.z, VISION_RANGE + 2));
    
    unitsRef.current.forEach(unit => {
      if (unit.faction !== playerFaction) {
        const cellX = Math.floor((unit.position.x / MAP_SIZE) * FOG_GRID_SIZE);
        const cellZ = Math.floor((unit.position.z / MAP_SIZE) * FOG_GRID_SIZE);
        if (cellX >= 0 && cellX < FOG_GRID_SIZE && cellZ >= 0 && cellZ < FOG_GRID_SIZE) {
          unit.isVisible = grid[cellX][cellZ].visible;
          if (unit.isVisible) {
            unit.lastSeenPosition = { ...unit.position };
          }
        }
        if (unit.mesh) {
          unit.mesh.visible = unit.isVisible;
        }
        if (unit.selectionRing) {
          unit.selectionRing.visible = unit.isVisible;
        }
        if (unit.healthBar) {
          unit.healthBar.visible = unit.isVisible;
        }
      }
    });
    
    buildingsRef.current.forEach(building => {
      if (building.faction !== playerFaction) {
        const cellX = Math.floor((building.position.x / MAP_SIZE) * FOG_GRID_SIZE);
        const cellZ = Math.floor((building.position.z / MAP_SIZE) * FOG_GRID_SIZE);
        if (cellX >= 0 && cellX < FOG_GRID_SIZE && cellZ >= 0 && cellZ < FOG_GRID_SIZE) {
          building.isVisible = grid[cellX][cellZ].visible || grid[cellX][cellZ].explored;
        }
        if (building.mesh) {
          building.mesh.visible = building.isVisible;
        }
        if (building.healthBar) {
          building.healthBar.visible = building.isVisible && grid[cellX][cellZ].visible;
        }
      }
    });
    
    updateFogMesh();
  }, [playerFaction]);

  const updateFogMesh = useCallback(() => {
    if (!fogMeshRef.current) return;
    const geometry = fogMeshRef.current.geometry as THREE.PlaneGeometry;
    const colors = geometry.attributes.color;
    
    for (let i = 0; i < FOG_GRID_SIZE; i++) {
      for (let j = 0; j < FOG_GRID_SIZE; j++) {
        const idx = i * FOG_GRID_SIZE + j;
        const cell = fogGridRef.current[i]?.[j];
        if (cell) {
          const alpha = cell.visible ? 0 : cell.explored ? 0.5 : 1;
          colors.setXYZ(idx, alpha, alpha, alpha);
        }
      }
    }
    colors.needsUpdate = true;
  }, []);

  const renderMinimap = useCallback(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const scale = canvas.width / MAP_SIZE;
    
    for (let x = 0; x < FOG_GRID_SIZE; x++) {
      for (let z = 0; z < FOG_GRID_SIZE; z++) {
        const cell = fogGridRef.current[x]?.[z];
        if (cell && cell.explored) {
          const wx = (x / FOG_GRID_SIZE) * canvas.width;
          const wz = (z / FOG_GRID_SIZE) * canvas.height;
          const cellSize = canvas.width / FOG_GRID_SIZE;
          ctx.fillStyle = cell.visible ? '#2d5016' : '#1a3009';
          ctx.fillRect(wx, wz, cellSize + 1, cellSize + 1);
        }
      }
    }
    
    resourceNodesRef.current.forEach(r => {
      const x = r.position.x * scale;
      const z = r.position.z * scale;
      const cellX = Math.floor((r.position.x / MAP_SIZE) * FOG_GRID_SIZE);
      const cellZ = Math.floor((r.position.z / MAP_SIZE) * FOG_GRID_SIZE);
      if (fogGridRef.current[cellX]?.[cellZ]?.explored) {
        ctx.fillStyle = r.type === 'gold' ? '#ffd700' : '#228b22';
        ctx.beginPath();
        ctx.arc(x, z, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    buildingsRef.current.forEach(b => {
      const x = b.position.x * scale;
      const z = b.position.z * scale;
      if (b.faction === playerFaction || b.isVisible) {
        ctx.fillStyle = b.faction === 'human' ? '#4169e1' : '#dc143c';
        const size = b.type === 'townhall' ? 6 : 4;
        ctx.fillRect(x - size/2, z - size/2, size, size);
      }
    });
    
    unitsRef.current.forEach(u => {
      if (u.faction === playerFaction || u.isVisible) {
        const x = u.position.x * scale;
        const z = u.position.z * scale;
        ctx.fillStyle = u.faction === 'human' ? '#6495ed' : '#ff6347';
        if (u.isSelected) {
          ctx.fillStyle = '#00ff00';
        }
        ctx.beginPath();
        ctx.arc(x, z, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    const viewX = cameraPosition.x * scale;
    const viewZ = cameraPosition.z * scale;
    const viewW = (20 / cameraZoom) * scale;
    const viewH = (15 / cameraZoom) * scale;
    ctx.strokeRect(viewX - viewW/2, viewZ - viewH/2, viewW, viewH);
  }, [cameraPosition, cameraZoom, playerFaction]);

  const createUnit = useCallback((type: UnitType, faction: Faction, x: number, z: number): GameUnit => {
    const stats = UNIT_STATS[type];
    const unit: GameUnit = {
      id: `unit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      faction,
      position: { x, y: 0.5, z },
      targetPosition: null,
      health: stats.health,
      maxHealth: stats.health,
      damage: stats.damage,
      armor: stats.armor,
      range: stats.range,
      speed: stats.speed,
      isSelected: false,
      currentOrder: null,
      attackTarget: null,
      repairTarget: null,
      patrolStart: null,
      patrolEnd: null,
      carryingResource: null,
      gatherTarget: null,
      lastGatherTarget: null,
      groupNumber: null,
      isVisible: true,
      lastSeenPosition: null
    };
    
    if (sceneRef.current) {
      const size = type === 'knight' || type === 'paladin' ? 0.6 : type === 'ballista' ? 0.8 : 0.45;
      const geometry = new THREE.CapsuleGeometry(size * 0.4, size * 0.6, 8, 16);
      const color = faction === 'human' ? 0x4169e1 : 0xdc143c;
      const material = new THREE.MeshStandardMaterial({ 
        color,
        metalness: 0.4,
        roughness: 0.6
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, size * 0.5, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { unitId: unit.id };
      sceneRef.current.add(mesh);
      unit.mesh = mesh;
      
      const ringGeometry = new THREE.RingGeometry(size * 0.6, size * 0.8, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: faction === 'human' ? 0x00ff00 : 0xff0000, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0 
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.05, z);
      sceneRef.current.add(ring);
      unit.selectionRing = ring;
      
      const healthBarGroup = new THREE.Group();
      const bgGeometry = new THREE.PlaneGeometry(0.8, 0.12);
      const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
      const bg = new THREE.Mesh(bgGeometry, bgMaterial);
      healthBarGroup.add(bg);
      const fgGeometry = new THREE.PlaneGeometry(0.75, 0.08);
      const fgMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
      const fg = new THREE.Mesh(fgGeometry, fgMaterial);
      fg.position.z = 0.01;
      fg.name = 'healthFill';
      healthBarGroup.add(fg);
      healthBarGroup.position.set(x, size * 1.8, z);
      healthBarGroup.rotation.x = -Math.PI / 4;
      sceneRef.current.add(healthBarGroup);
      unit.healthBar = healthBarGroup;
    }
    
    return unit;
  }, []);

  const createBuilding = useCallback((type: BuildingType, faction: Faction, x: number, z: number, isConstructing: boolean = false): GameBuilding => {
    const stats = BUILDING_STATS[type];
    const building: GameBuilding = {
      id: `building-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      faction,
      position: { x, y: 0, z },
      health: isConstructing ? stats.health * 0.1 : stats.health,
      maxHealth: stats.health,
      isConstructing,
      constructionProgress: isConstructing ? 0 : 100,
      productionQueue: [],
      productionProgress: 0,
      rallyPoint: null,
      isVisible: true
    };
    
    if (sceneRef.current) {
      const size = type === 'townhall' ? 3 : type === 'farm' ? 2 : 2.5;
      const height = type === 'tower' ? 4 : type === 'townhall' ? 3.5 : type === 'church' ? 4 : 2.5;
      const geometry = new THREE.BoxGeometry(size, height, size);
      const color = faction === 'human' ? 0x4a6fa5 : 0x8b4513;
      const material = new THREE.MeshStandardMaterial({ 
        color,
        metalness: 0.1,
        roughness: 0.9,
        transparent: isConstructing,
        opacity: isConstructing ? 0.5 : 1
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, height / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { buildingId: building.id };
      sceneRef.current.add(mesh);
      building.mesh = mesh;
      
      building.auxMeshes = [];
      if (type === 'tower') {
        const roofGeom = new THREE.ConeGeometry(size * 0.7, 1.5, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b0000 });
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.set(x, height + 0.75, z);
        roof.rotation.y = Math.PI / 4;
        sceneRef.current.add(roof);
        building.auxMeshes.push(roof);
      }
      
      const healthBarGroup = new THREE.Group();
      const bgGeometry = new THREE.PlaneGeometry(size, 0.25);
      const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
      const bg = new THREE.Mesh(bgGeometry, bgMaterial);
      healthBarGroup.add(bg);
      const fgGeometry = new THREE.PlaneGeometry(size * 0.95, 0.18);
      const fgMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
      const fg = new THREE.Mesh(fgGeometry, fgMaterial);
      fg.position.z = 0.01;
      fg.name = 'healthFill';
      healthBarGroup.add(fg);
      healthBarGroup.position.set(x, height + 1.5, z);
      healthBarGroup.rotation.x = -Math.PI / 4;
      sceneRef.current.add(healthBarGroup);
      building.healthBar = healthBarGroup;
    }
    
    return building;
  }, []);

  const createResourceNode = useCallback((type: ResourceType, x: number, z: number, amount: number): ResourceNode => {
    const node: ResourceNode = {
      id: `resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      position: { x, y: 0, z },
      amount
    };
    
    if (sceneRef.current) {
      if (type === 'gold') {
        const geometry = new THREE.DodecahedronGeometry(1.2);
        const material = new THREE.MeshStandardMaterial({ 
          color: 0xffd700,
          metalness: 0.9,
          roughness: 0.1,
          emissive: 0xffaa00,
          emissiveIntensity: 0.6
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 1.2, z);
        mesh.castShadow = true;
        mesh.userData = { resourceId: node.id };
        sceneRef.current.add(mesh);
        node.mesh = mesh;
      } else {
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, 1, z);
        trunk.castShadow = true;
        sceneRef.current.add(trunk);
        node.trunkMesh = trunk;
        
        const leavesGeometry = new THREE.ConeGeometry(1.2, 2.5, 8);
        const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.set(x, 3.25, z);
        leaves.castShadow = true;
        leaves.userData = { resourceId: node.id };
        sceneRef.current.add(leaves);
        node.mesh = leaves;
      }
    }
    
    return node;
  }, []);

  const spawnFloatingText = useCallback((text: string, x: number, y: number, z: number, color: string) => {
    if (!sceneRef.current) return;
    const canvas = createTextCanvas(text, color);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(2, 0.5, 1);
    sceneRef.current.add(sprite);
    floatingTextsRef.current.push({ sprite, startY: y, life: 0, maxLife: 1.5 });
  }, []);

  const updateFloatingTexts = useCallback((dt: number) => {
    floatingTextsRef.current = floatingTextsRef.current.filter(ft => {
      ft.life += dt;
      const progress = ft.life / ft.maxLife;
      ft.sprite.position.y = ft.startY + progress * 3;
      (ft.sprite.material as THREE.SpriteMaterial).opacity = 1 - progress;
      if (ft.life >= ft.maxLife) {
        sceneRef.current?.remove(ft.sprite);
        ft.sprite.material.dispose();
        return false;
      }
      return true;
    });
  }, []);

  const spawnParticles = useCallback((x: number, y: number, z: number, type: Particle['type'], count: number = 5) => {
    if (!sceneRef.current) return;
    for (let i = 0; i < count; i++) {
      let geometry: THREE.BufferGeometry;
      let material: THREE.MeshBasicMaterial;
      let velocity: THREE.Vector3;
      let maxLife: number;

      switch (type) {
        case 'spark':
          geometry = new THREE.SphereGeometry(0.06, 4, 4);
          material = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 1 });
          velocity = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4);
          maxLife = 0.3 + Math.random() * 0.3;
          break;
        case 'fire':
          geometry = new THREE.SphereGeometry(0.12, 4, 4);
          material = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xff4400 : 0xffaa00, transparent: true, opacity: 0.9 });
          velocity = new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 2 + 1.5, (Math.random() - 0.5) * 0.8);
          maxLife = 0.5 + Math.random() * 0.5;
          break;
        case 'dust':
          geometry = new THREE.SphereGeometry(0.05, 3, 3);
          material = new THREE.MeshBasicMaterial({ color: 0x886644, transparent: true, opacity: 0.5 });
          velocity = new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 0.5 + 0.2, (Math.random() - 0.5) * 1.5);
          maxLife = 0.4 + Math.random() * 0.3;
          break;
        case 'arrow_trail':
          geometry = new THREE.SphereGeometry(0.04, 3, 3);
          material = new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.7 });
          velocity = new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.2, (Math.random() - 0.5) * 0.3);
          maxLife = 0.2 + Math.random() * 0.2;
          break;
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
      sceneRef.current.add(mesh);
      particlesRef.current.push({ mesh, velocity, life: 0, maxLife, fadeOut: true, type });
    }
  }, []);

  const updateParticles = useCallback((dt: number) => {
    particlesRef.current = particlesRef.current.filter(p => {
      p.life += dt;
      if (p.life >= p.maxLife) {
        sceneRef.current?.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        return false;
      }
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      if (p.type === 'fire') {
        p.velocity.y += dt * 0.5;
      } else {
        p.velocity.y -= dt * 3;
      }
      if (p.fadeOut) {
        const progress = p.life / p.maxLife;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
        const s = 1 - progress * 0.5;
        p.mesh.scale.set(s, s, s);
      }
      return true;
    });
  }, []);

  const updateBuildingFireEffects = useCallback((dt: number) => {
    if (!sceneRef.current) return;
    buildingsRef.current.forEach(building => {
      const healthPct = building.health / building.maxHealth;
      if (healthPct < 0.25 && healthPct > 0) {
        if (Math.random() < dt * 8) {
          spawnParticles(
            building.position.x + (Math.random() - 0.5) * 2,
            building.mesh ? building.mesh.position.y + 1 : 2,
            building.position.z + (Math.random() - 0.5) * 2,
            'fire', 3
          );
        }
      }
    });
  }, [spawnParticles]);

  const updateWaterAnimation = useCallback((time: number) => {
    if (!waterMeshRef.current) return;
    const geo = waterMeshRef.current.geometry as THREE.PlaneGeometry;
    const verts = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < verts.length; i += 3) {
      verts[i + 2] = Math.sin(verts[i] * 0.5 + time * 1.5) * 0.08 + Math.cos(verts[i + 1] * 0.7 + time * 1.2) * 0.05;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    const mat = waterMeshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.6 + Math.sin(time * 0.5) * 0.1;
  }, []);

  const spawnPhysicsProjectile = useCallback((
    startX: number, startY: number, startZ: number,
    targetX: number, targetZ: number,
    damage: number, targetId: string | null, faction: Faction,
    projectileType: 'arrow' | 'ballista' | 'magic'
  ) => {
    if (!sceneRef.current || !physicsWorldRef.current) return;
    
    const dx = targetX - startX;
    const dz = targetZ - startZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    let meshGeom: THREE.BufferGeometry;
    let meshMat: THREE.MeshStandardMaterial;
    let mass = 0.5;
    
    if (projectileType === 'ballista') {
      meshGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6);
      meshMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, emissive: 0x331100, emissiveIntensity: 0.3 });
      mass = 2;
    } else if (projectileType === 'magic') {
      meshGeom = new THREE.SphereGeometry(0.2, 8, 8);
      meshMat = new THREE.MeshStandardMaterial({ color: 0x8800ff, emissive: 0x4400aa, emissiveIntensity: 0.8 });
      mass = 0.3;
    } else {
      meshGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
      meshMat = new THREE.MeshStandardMaterial({ color: 0x8b6914 });
      mass = 0.2;
    }
    
    const mesh = new THREE.Mesh(meshGeom, meshMat);
    mesh.position.set(startX, startY, startZ);
    mesh.castShadow = true;
    sceneRef.current.add(mesh);
    
    const shape = projectileType === 'magic' 
      ? new CANNON.Sphere(0.2) 
      : new CANNON.Cylinder(0.05, 0.05, projectileType === 'ballista' ? 1.2 : 0.6, 6);
    const body = new CANNON.Body({ mass, shape });
    body.position.set(startX, startY, startZ);
    
    const speed = projectileType === 'ballista' ? 12 : projectileType === 'magic' ? 15 : 18;
    const arcHeight = projectileType === 'ballista' ? 8 : projectileType === 'magic' ? 3 : 5;
    const vx = (dx / dist) * speed;
    const vz = (dz / dist) * speed;
    const flightTime = dist / speed;
    const vy = (arcHeight / flightTime) + (9.82 * flightTime * 0.5);
    
    body.velocity.set(vx, vy, vz);
    physicsWorldRef.current.addBody(body);
    
    physicsProjectilesRef.current.push({
      mesh,
      body,
      damage,
      targetId,
      faction,
      life: 0,
      trailMeshes: []
    });
  }, []);

  const spawnBuildingDebris = useCallback((building: GameBuilding) => {
    if (!sceneRef.current || !physicsWorldRef.current) return;
    
    const debrisCount = 6 + Math.floor(Math.random() * 4);
    const size = building.type === 'townhall' ? 3 : 2;
    
    for (let i = 0; i < debrisCount; i++) {
      const debrisSize = 0.3 + Math.random() * 0.6;
      const geom = Math.random() > 0.5 
        ? new THREE.BoxGeometry(debrisSize, debrisSize, debrisSize)
        : new THREE.TetrahedronGeometry(debrisSize);
      const color = building.faction === 'human' ? 0x4a6fa5 : 0x8b4513;
      const mat = new THREE.MeshStandardMaterial({ 
        color: color + Math.floor(Math.random() * 0x222222),
        roughness: 0.9 
      });
      const mesh = new THREE.Mesh(geom, mat);
      const px = building.position.x + (Math.random() - 0.5) * size;
      const py = size * 0.5 + Math.random() * 2;
      const pz = building.position.z + (Math.random() - 0.5) * size;
      mesh.position.set(px, py, pz);
      mesh.castShadow = true;
      sceneRef.current.add(mesh);
      
      const shape = new CANNON.Box(new CANNON.Vec3(debrisSize / 2, debrisSize / 2, debrisSize / 2));
      const body = new CANNON.Body({ mass: 1 + Math.random() * 2, shape });
      body.position.set(px, py, pz);
      body.velocity.set(
        (Math.random() - 0.5) * 8,
        3 + Math.random() * 6,
        (Math.random() - 0.5) * 8
      );
      body.angularVelocity.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      physicsWorldRef.current.addBody(body);
      
      physicsDebrisRef.current.push({ mesh, body, life: 0 });
    }
  }, []);

  const spawnFallingTree = useCallback((resourceNode: ResourceNode) => {
    if (!sceneRef.current || !resourceNode.mesh || !resourceNode.trunkMesh) return;
    
    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(resourceNode.position.x, 0, resourceNode.position.z);
    sceneRef.current.add(pivotGroup);
    
    const trunk = resourceNode.trunkMesh;
    const leaves = resourceNode.mesh;
    sceneRef.current.remove(trunk);
    sceneRef.current.remove(leaves);
    
    trunk.position.set(0, 1, 0);
    leaves.position.set(0, 3.25, 0);
    pivotGroup.add(trunk);
    pivotGroup.add(leaves);
    
    const fallDirection = Math.random() * Math.PI * 2;
    
    fallingTreesRef.current.push({
      mesh: leaves,
      trunkMesh: trunk,
      pivotGroup,
      fallSpeed: 0.5 + Math.random() * 0.5,
      currentAngle: 0,
      maxAngle: Math.PI / 2,
      life: 0,
    });
    
    const axis = new THREE.Vector3(Math.sin(fallDirection), 0, Math.cos(fallDirection));
    pivotGroup.userData.fallAxis = axis;
  }, []);

  const updatePhysics = useCallback((dt: number) => {
    if (!physicsWorldRef.current) return;
    
    physicsWorldRef.current.step(1 / 60, dt, 3);
    
    physicsProjectilesRef.current = physicsProjectilesRef.current.filter(proj => {
      proj.life += dt;
      
      proj.mesh.position.set(
        proj.body.position.x,
        proj.body.position.y,
        proj.body.position.z
      );
      
      const vel = proj.body.velocity;
      if (vel.length() > 0.1) {
        const dir = new THREE.Vector3(vel.x, vel.y, vel.z).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion();
        const axis = new THREE.Vector3().crossVectors(up, dir).normalize();
        if (axis.length() > 0.001) {
          const angle = Math.acos(Math.min(1, Math.max(-1, up.dot(dir))));
          quat.setFromAxisAngle(axis, angle);
          proj.mesh.quaternion.copy(quat);
        }
      }
      
      if (proj.body.position.y <= 0.1 || proj.life > 5) {
        if (proj.targetId) {
          const targetUnit = unitsRef.current.find(u => u.id === proj.targetId);
          const targetBuilding = buildingsRef.current.find(b => b.id === proj.targetId);
          const target = targetUnit || targetBuilding;
          if (target && target.health > 0) {
            const hitDist = Math.sqrt(
              Math.pow(proj.mesh.position.x - target.position.x, 2) +
              Math.pow(proj.mesh.position.z - target.position.z, 2)
            );
            if (hitDist < 3) {
              const armor = targetUnit ? targetUnit.armor : 0;
              target.health -= Math.max(1, proj.damage - armor);
              if (target.healthBar) {
                const healthFill = target.healthBar.children.find(c => c.name === 'healthFill') as THREE.Mesh;
                if (healthFill) {
                  const pct = Math.max(0, target.health / target.maxHealth);
                  healthFill.scale.x = pct;
                  (healthFill.material as THREE.MeshBasicMaterial).color.setHex(
                    pct > 0.5 ? 0x00ff00 : pct > 0.25 ? 0xffff00 : 0xff0000
                  );
                }
              }
              spawnFloatingText(`-${proj.damage}`, target.position.x, 3, target.position.z, '#FF4444');
            }
          }
        }
        
        sceneRef.current?.remove(proj.mesh);
        proj.mesh.geometry.dispose();
        (proj.mesh.material as THREE.Material).dispose();
        proj.trailMeshes.forEach(t => {
          sceneRef.current?.remove(t);
          t.geometry.dispose();
          (t.material as THREE.Material).dispose();
        });
        physicsWorldRef.current?.removeBody(proj.body);
        return false;
      }
      
      if (proj.life > 0.05 && Math.random() < dt * 30) {
        if (sceneRef.current) {
          const trailGeom = new THREE.SphereGeometry(0.05, 4, 4);
          const trailMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
          const trailMesh = new THREE.Mesh(trailGeom, trailMat);
          trailMesh.position.copy(proj.mesh.position);
          sceneRef.current.add(trailMesh);
          proj.trailMeshes.push(trailMesh);
          if (proj.trailMeshes.length > 8) {
            const old = proj.trailMeshes.shift()!;
            sceneRef.current.remove(old);
            old.geometry.dispose();
            (old.material as THREE.Material).dispose();
          }
        }
      }
      proj.trailMeshes.forEach((t, i) => {
        const age = (proj.trailMeshes.length - i) / proj.trailMeshes.length;
        (t.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - age);
        const s = 1 - age * 0.5;
        t.scale.set(s, s, s);
      });
      
      return true;
    });
    
    physicsDebrisRef.current = physicsDebrisRef.current.filter(debris => {
      debris.life += dt;
      
      debris.mesh.position.set(
        debris.body.position.x,
        debris.body.position.y,
        debris.body.position.z
      );
      debris.mesh.quaternion.set(
        debris.body.quaternion.x,
        debris.body.quaternion.y,
        debris.body.quaternion.z,
        debris.body.quaternion.w
      );
      
      if (debris.life > 3) {
        const fadeProgress = (debris.life - 3) / 2;
        (debris.mesh.material as THREE.MeshStandardMaterial).transparent = true;
        (debris.mesh.material as THREE.MeshStandardMaterial).opacity = 1 - fadeProgress;
      }
      
      if (debris.life > 5) {
        sceneRef.current?.remove(debris.mesh);
        debris.mesh.geometry.dispose();
        (debris.mesh.material as THREE.Material).dispose();
        physicsWorldRef.current?.removeBody(debris.body);
        return false;
      }
      return true;
    });
    
    fallingTreesRef.current = fallingTreesRef.current.filter(tree => {
      tree.life += dt;
      tree.currentAngle += tree.fallSpeed * dt * 2;
      
      if (tree.currentAngle >= tree.maxAngle) {
        tree.currentAngle = tree.maxAngle;
      }
      
      const axis = tree.pivotGroup.userData.fallAxis as THREE.Vector3;
      if (axis) {
        tree.pivotGroup.setRotationFromAxisAngle(axis, tree.currentAngle);
      }
      
      if (tree.life > 3) {
        const fadeProgress = (tree.life - 3) / 2;
        [tree.mesh, tree.trunkMesh].forEach(m => {
          if (m) {
            (m.material as THREE.MeshStandardMaterial).transparent = true;
            (m.material as THREE.MeshStandardMaterial).opacity = 1 - fadeProgress;
          }
        });
      }
      
      if (tree.life > 5) {
        sceneRef.current?.remove(tree.pivotGroup);
        [tree.mesh, tree.trunkMesh].forEach(m => {
          if (m) {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
          }
        });
        return false;
      }
      return true;
    });
  }, [spawnFloatingText]);

  const [webglError, setWebglError] = useState(false);

  const initializeScene = useCallback(() => {
    if (!containerRef.current || isInitializedRef.current) return;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 30, 100);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 200);
    camera.position.set(10, 25, 35);
    camera.lookAt(10, 0, 10);
    cameraRef.current = camera;
    
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
      setWebglError(true);
      return;
    }
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(containerRef.current.clientWidth, containerRef.current.clientHeight),
      0.3,
      0.4,
      0.85
    );
    composer.addPass(bloomPass);
    composerRef.current = composer;
    
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffffcc, 1.2);
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    scene.add(sunLight);
    
    const groundRes = 128;
    const groundGeometry = new THREE.PlaneGeometry(MAP_SIZE + 16, MAP_SIZE + 16, groundRes, groundRes);
    const vertices = groundGeometry.attributes.position.array as Float32Array;
    const groundColors = new Float32Array((groundRes + 1) * (groundRes + 1) * 3);
    
    for (let i = 0; i <= groundRes; i++) {
      for (let j = 0; j <= groundRes; j++) {
        const idx = (i * (groundRes + 1) + j);
        const vIdx = idx * 3;
        const wx = (j / groundRes) * (MAP_SIZE + 16) - 8;
        const wz = (i / groundRes) * (MAP_SIZE + 16) - 8;
        
        const borderDist = Math.min(wx, wz, MAP_SIZE - wx, MAP_SIZE - wz);
        let height = 0;
        
        if (borderDist < 0) {
          height = 3 + Math.abs(borderDist) * 1.2 + Math.random() * 0.5;
        } else if (borderDist < 3) {
          const t = 1 - borderDist / 3;
          height = t * t * 3 + Math.random() * 0.3;
        } else {
          height = Math.random() * 0.15;
          const cx = MAP_SIZE / 2, cz = MAP_SIZE / 2;
          const distCenter = Math.sqrt((wx - cx) * (wx - cx) + (wz - cz) * (wz - cz));
          if (distCenter < 10) {
            height = -0.1;
          }
        }
        vertices[vIdx + 2] = height;
        
        let r: number, g: number, b: number;
        if (borderDist < 0) {
          r = 0.42; g = 0.42; b = 0.42;
        } else if (borderDist < 2) {
          const t = borderDist / 2;
          r = 0.42 * (1 - t) + 0.36 * t;
          g = 0.42 * (1 - t) + 0.30 * t;
          b = 0.42 * (1 - t) + 0.18 * t;
        } else if (borderDist < 5) {
          r = 0.36; g = 0.30; b = 0.18;
        } else {
          r = 0.24 + Math.random() * 0.06;
          g = 0.36 + Math.random() * 0.06;
          b = 0.18 + Math.random() * 0.04;
          const distCenter = Math.sqrt((wx - MAP_SIZE / 2) ** 2 + (wz - MAP_SIZE / 2) ** 2);
          if (distCenter < 10) {
            r = 0.75 + Math.random() * 0.05;
            g = 0.66 + Math.random() * 0.05;
            b = 0.40 + Math.random() * 0.05;
          }
        }
        groundColors[vIdx] = r;
        groundColors[vIdx + 1] = g;
        groundColors[vIdx + 2] = b;
      }
    }
    groundGeometry.setAttribute('color', new THREE.BufferAttribute(groundColors, 3));
    groundGeometry.computeVertexNormals();
    
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      vertexColors: true,
      roughness: 1,
      metalness: 0
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(MAP_SIZE / 2, 0, MAP_SIZE / 2);
    ground.receiveShadow = true;
    ground.name = 'ground';
    scene.add(ground);
    
    const waterGeometry = new THREE.PlaneGeometry(18, 14, 32, 32);
    const waterVerts = waterGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < waterVerts.length; i += 3) {
      waterVerts[i + 2] = Math.sin(waterVerts[i] * 0.5) * 0.05;
    }
    const waterMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a7ab5,
      transparent: true,
      opacity: 0.65,
      roughness: 0.05,
      metalness: 0.8,
      emissive: 0x0a2a40,
      emissiveIntensity: 0.15
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(MAP_SIZE / 2, 0.05, MAP_SIZE / 2);
    scene.add(water);
    waterMeshRef.current = water;
    
    const borderEdge = 4;
    for (let i = 0; i < 20; i++) {
      const side = Math.floor(Math.random() * 4);
      let rx: number, rz: number;
      if (side === 0) { rx = Math.random() * MAP_SIZE; rz = -borderEdge * Math.random(); }
      else if (side === 1) { rx = Math.random() * MAP_SIZE; rz = MAP_SIZE + borderEdge * Math.random(); }
      else if (side === 2) { rx = -borderEdge * Math.random(); rz = Math.random() * MAP_SIZE; }
      else { rx = MAP_SIZE + borderEdge * Math.random(); rz = Math.random() * MAP_SIZE; }
      const rockSize = 0.5 + Math.random() * 1.5;
      const rockGeom = new THREE.DodecahedronGeometry(rockSize, 0);
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x555555 + Math.floor(Math.random() * 0x222222), roughness: 0.9 });
      const rock = new THREE.Mesh(rockGeom, rockMat);
      rock.position.set(rx, rockSize * 0.4 + 2, rz);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      scene.add(rock);
    }
    
    const fogGeometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, FOG_GRID_SIZE - 1, FOG_GRID_SIZE - 1);
    const colors = new Float32Array(FOG_GRID_SIZE * FOG_GRID_SIZE * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = 1;
      colors[i + 1] = 1;
      colors[i + 2] = 1;
    }
    fogGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const fogMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x000000,
      transparent: true,
      opacity: 0.7,
      vertexColors: true
    });
    const fogMesh = new THREE.Mesh(fogGeometry, fogMaterial);
    fogMesh.rotation.x = -Math.PI / 2;
    fogMesh.position.set(MAP_SIZE / 2, 0.5, MAP_SIZE / 2);
    scene.add(fogMesh);
    fogMeshRef.current = fogMesh;
    
    const previewGeom = new THREE.BoxGeometry(2.5, 2, 2.5);
    const previewMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: 0.4,
      wireframe: true
    });
    const previewMesh = new THREE.Mesh(previewGeom, previewMat);
    previewMesh.visible = false;
    scene.add(previewMesh);
    placementPreviewRef.current = previewMesh;
    
    initFogGrid();
    
    const physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    });
    physicsWorld.broadphase = new CANNON.NaiveBroadphase();
    physicsWorld.defaultContactMaterial.friction = 0.5;
    physicsWorld.defaultContactMaterial.restitution = 0.3;
    physicsWorldRef.current = physicsWorld;
    
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    physicsWorld.addBody(groundBody);
    groundBodyRef.current = groundBody;
    
    isInitializedRef.current = true;
  }, [initFogGrid]);

  const initializeGameEntities = useCallback((faction: Faction, mode: GameMode) => {
    if (!sceneRef.current) return;
    
    const newUnits: GameUnit[] = [];
    const newBuildings: GameBuilding[] = [];
    const newResources: ResourceNode[] = [];
    
    const playerStartX = faction === 'human' ? 8 : MAP_SIZE - 12;
    const playerStartZ = faction === 'human' ? 8 : MAP_SIZE - 12;
    const enemyStartX = faction === 'human' ? MAP_SIZE - 12 : 8;
    const enemyStartZ = faction === 'human' ? MAP_SIZE - 12 : 8;
    
    newBuildings.push(createBuilding('townhall', faction, playerStartX, playerStartZ, false));
    newBuildings.push(createBuilding('farm', faction, playerStartX + 5, playerStartZ - 3, false));
    for (let i = 0; i < 5; i++) {
      newUnits.push(createUnit('peasant', faction, playerStartX + 4 + (i % 3) * 1.2, playerStartZ + Math.floor(i / 3) * 1.2));
    }
    
    if (mode === 'pve' || mode === 'pvp') {
      const enemyFaction: Faction = faction === 'human' ? 'orc' : 'human';
      newBuildings.push(createBuilding('townhall', enemyFaction, enemyStartX, enemyStartZ, false));
      newBuildings.push(createBuilding('barracks', enemyFaction, enemyStartX - 5, enemyStartZ, false));
      newBuildings.push(createBuilding('farm', enemyFaction, enemyStartX + 5, enemyStartZ - 3, false));
      for (let i = 0; i < 5; i++) {
        newUnits.push(createUnit('peasant', enemyFaction, enemyStartX + 4 + (i % 3) * 1.2, enemyStartZ + Math.floor(i / 3) * 1.2));
      }
      for (let i = 0; i < 4; i++) {
        newUnits.push(createUnit('footman', enemyFaction, enemyStartX - 3 + i * 1.2, enemyStartZ + 4));
      }
    }
    
    newResources.push(createResourceNode('gold', playerStartX + 7, playerStartZ - 5, 10000));
    newResources.push(createResourceNode('gold', enemyStartX + 7, enemyStartZ - 5, 10000));
    newResources.push(createResourceNode('gold', MAP_SIZE / 2 + 8, MAP_SIZE / 2, 5000));
    newResources.push(createResourceNode('gold', MAP_SIZE / 2 - 8, MAP_SIZE / 2, 5000));
    
    for (let i = 0; i < 8; i++) {
      newResources.push(createResourceNode('lumber', playerStartX + 10 + (i % 4) * 2, playerStartZ + Math.floor(i / 4) * 2, 100));
      newResources.push(createResourceNode('lumber', enemyStartX - 6 - (i % 4) * 2, enemyStartZ + Math.floor(i / 4) * 2, 100));
    }
    
    for (let i = 0; i < 15; i++) {
      const x = 12 + Math.random() * (MAP_SIZE - 24);
      const z = 12 + Math.random() * (MAP_SIZE - 24);
      if (Math.abs(x - MAP_SIZE / 2) > 8 || Math.abs(z - MAP_SIZE / 2) > 6) {
        newResources.push(createResourceNode('lumber', x, z, 100));
      }
    }
    
    unitsRef.current = newUnits;
    buildingsRef.current = newBuildings;
    resourceNodesRef.current = newResources;
    
    setResources({
      human: { gold: 2000, lumber: 1000 },
      orc: { gold: 2000, lumber: 1000 }
    });
    setFood({
      human: { used: 5, max: 9 },
      orc: { used: 5, max: 9 }
    });
    
    setCameraPosition({ x: playerStartX, z: playerStartZ });
  }, [createUnit, createBuilding, createResourceNode]);

  const startGame = useCallback((mode: GameMode, faction: Faction) => {
    setGameMode(mode);
    setPlayerFaction(faction);
    setIsPaused(false);
    setGameTime(0);
    setSelectedUnits([]);
    setSelectedBuilding(null);
    setBuildingToBuild(null);
    setCurrentCommand(null);
    setShowBuildMenu(false);
    
    if (sceneRef.current) {
      unitsRef.current.forEach(u => {
        if (u.mesh) sceneRef.current?.remove(u.mesh);
        if (u.selectionRing) sceneRef.current?.remove(u.selectionRing);
        if (u.healthBar) sceneRef.current?.remove(u.healthBar);
      });
      buildingsRef.current.forEach(b => {
        if (b.mesh) sceneRef.current?.remove(b.mesh);
        if (b.healthBar) sceneRef.current?.remove(b.healthBar);
        if (b.auxMeshes) b.auxMeshes.forEach(m => sceneRef.current?.remove(m));
      });
      resourceNodesRef.current.forEach(r => {
        if (r.mesh) sceneRef.current?.remove(r.mesh);
        if (r.trunkMesh) sceneRef.current?.remove(r.trunkMesh);
      });
      floatingTextsRef.current.forEach(ft => {
        sceneRef.current?.remove(ft.sprite);
        ft.sprite.material.dispose();
      });
      floatingTextsRef.current = [];
    }
    
    physicsProjectilesRef.current.forEach(proj => {
      sceneRef.current?.remove(proj.mesh);
      proj.mesh.geometry.dispose();
      (proj.mesh.material as THREE.Material).dispose();
      proj.trailMeshes.forEach(t => {
        sceneRef.current?.remove(t);
        t.geometry.dispose();
        (t.material as THREE.Material).dispose();
      });
      physicsWorldRef.current?.removeBody(proj.body);
    });
    physicsProjectilesRef.current = [];
    
    physicsDebrisRef.current.forEach(debris => {
      sceneRef.current?.remove(debris.mesh);
      debris.mesh.geometry.dispose();
      (debris.mesh.material as THREE.Material).dispose();
      physicsWorldRef.current?.removeBody(debris.body);
    });
    physicsDebrisRef.current = [];
    
    fallingTreesRef.current.forEach(tree => {
      sceneRef.current?.remove(tree.pivotGroup);
      [tree.mesh, tree.trunkMesh].forEach(m => {
        if (m) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    });
    fallingTreesRef.current = [];
    
    unitsRef.current = [];
    buildingsRef.current = [];
    resourceNodesRef.current = [];
    
    initFogGrid();
    updateFogMesh();
    unitGroupsRef.current = {};
    
    if (isInitializedRef.current && sceneRef.current) {
      initializeGameEntities(faction, mode);
    } else {
      pendingGameRef.current = { mode, faction };
    }
  }, [initFogGrid, initializeGameEntities, updateFogMesh]);

  const issueOrder = useCallback((order: OrderType, targetX?: number, targetZ?: number, targetId?: string) => {
    if (selectedUnits.length === 0) return;
    
    unitsRef.current = unitsRef.current.map((unit, idx) => {
      if (selectedUnits.includes(unit.id)) {
        const offsetX = (idx % 3) * 1.5;
        const offsetZ = Math.floor(idx / 3) * 1.5;
        
        switch (order) {
          case 'move':
            return { 
              ...unit, 
              currentOrder: order,
              targetPosition: targetX !== undefined ? { x: targetX + offsetX, y: 0.5, z: (targetZ || 0) + offsetZ } : null,
              attackTarget: null,
              gatherTarget: null,
              lastGatherTarget: null,
              patrolStart: null,
              patrolEnd: null
            };
          case 'attack':
            return {
              ...unit,
              currentOrder: order,
              attackTarget: targetId || null,
              targetPosition: targetX !== undefined ? { x: targetX, y: 0.5, z: targetZ || 0 } : null,
              gatherTarget: null,
              lastGatherTarget: null
            };
          case 'attackmove':
            return {
              ...unit,
              currentOrder: order,
              targetPosition: targetX !== undefined ? { x: targetX + offsetX, y: 0.5, z: (targetZ || 0) + offsetZ } : null,
              attackTarget: null,
              gatherTarget: null,
              lastGatherTarget: null
            };
          case 'patrol':
            return {
              ...unit,
              currentOrder: order,
              patrolStart: { ...unit.position },
              patrolEnd: targetX !== undefined ? { x: targetX, y: 0.5, z: targetZ || 0 } : null,
              targetPosition: targetX !== undefined ? { x: targetX, y: 0.5, z: targetZ || 0 } : null,
              attackTarget: null,
              gatherTarget: null,
              lastGatherTarget: null
            };
          case 'repair':
            if (unit.type === 'peasant' && targetId) {
              const targetBuilding = buildingsRef.current.find(b => b.id === targetId);
              if (targetBuilding && targetBuilding.faction === unit.faction) {
                return {
                  ...unit,
                  currentOrder: order,
                  repairTarget: targetId,
                  attackTarget: null,
                  targetPosition: { x: targetBuilding.position.x, y: 0.5, z: targetBuilding.position.z },
                  gatherTarget: null,
                  lastGatherTarget: null
                };
              }
            }
            return unit;
          case 'stop':
            return {
              ...unit,
              currentOrder: null,
              targetPosition: null,
              attackTarget: null,
              repairTarget: null,
              gatherTarget: null,
              lastGatherTarget: null,
              patrolStart: null,
              patrolEnd: null
            };
          case 'hold':
            return {
              ...unit,
              currentOrder: order,
              targetPosition: null,
              attackTarget: null,
              gatherTarget: null,
              lastGatherTarget: null
            };
          case 'gather':
            return {
              ...unit,
              currentOrder: order,
              gatherTarget: targetId || null,
              lastGatherTarget: targetId || null,
              targetPosition: targetX !== undefined ? { x: targetX, y: 0.5, z: targetZ || 0 } : null,
              attackTarget: null
            };
          default:
            return unit;
        }
      }
      return unit;
    });
    
    setCurrentCommand(null);
  }, [selectedUnits]);

  const getTargetAtPosition = useCallback((screenX: number, screenY: number) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = ((screenX - rect.left) / rect.width) * 2 - 1;
    const my = -((screenY - rect.top) / rect.height) * 2 + 1;
    const tempMouse = new THREE.Vector2(mx, my);
    const tempRay = new THREE.Raycaster();
    tempRay.setFromCamera(tempMouse, cameraRef.current);
    const intersects = tempRay.intersectObjects(sceneRef.current.children, true);
    const ground = intersects.find(i => i.object.name === 'ground');
    const targetPos = ground?.point;
    if (!targetPos) return { type: 'none' as const };
    const enemyUnit = unitsRef.current.find(u =>
      u.faction !== playerFaction && u.isVisible &&
      Math.abs(u.position.x - targetPos.x) < 1.5 && Math.abs(u.position.z - targetPos.z) < 1.5
    );
    if (enemyUnit) return { type: 'enemy' as const, pos: targetPos, id: enemyUnit.id };
    const enemyBuilding = buildingsRef.current.find(b =>
      b.faction !== playerFaction && b.isVisible &&
      Math.abs(b.position.x - targetPos.x) < 2.5 && Math.abs(b.position.z - targetPos.z) < 2.5
    );
    if (enemyBuilding) return { type: 'enemy' as const, pos: targetPos, id: enemyBuilding.id };
    const resource = resourceNodesRef.current.find(r =>
      Math.abs(r.position.x - targetPos.x) < 1.5 && Math.abs(r.position.z - targetPos.z) < 1.5
    );
    if (resource) return { type: 'resource' as const, pos: targetPos, id: resource.id };
    const friendlyBuilding = buildingsRef.current.find(b =>
      b.faction === playerFaction &&
      Math.abs(b.position.x - targetPos.x) < 2.5 && Math.abs(b.position.z - targetPos.z) < 2.5 &&
      b.health < b.maxHealth
    );
    if (friendlyBuilding) return { type: 'repair' as const, pos: targetPos, id: friendlyBuilding.id };
    const friendlyUnit = unitsRef.current.find(u =>
      u.faction === playerFaction &&
      Math.abs(u.position.x - targetPos.x) < 1.5 && Math.abs(u.position.z - targetPos.z) < 1.5
    );
    if (friendlyUnit) return { type: 'friendly' as const, pos: targetPos, id: friendlyUnit.id };
    return { type: 'ground' as const, pos: targetPos };
  }, [playerFaction]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0 || gameMode === 'menu') return;
    if (buildingToBuild || currentCommand) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  }, [gameMode, buildingToBuild, currentCommand]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (e.button !== 0 || gameMode === 'menu') return;
    
    if (isDraggingRef.current && dragSelect) {
      if (!containerRef.current || !cameraRef.current || !sceneRef.current) {
        setDragSelect(null);
        dragStartRef.current = null;
        setTimeout(() => { isDraggingRef.current = false; }, 50);
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const minX = Math.min(dragSelect.startX, dragSelect.endX);
      const maxX = Math.max(dragSelect.startX, dragSelect.endX);
      const minY = Math.min(dragSelect.startY, dragSelect.endY);
      const maxY = Math.max(dragSelect.startY, dragSelect.endY);
      
      const selected: string[] = [];
      const unitScreenRadius = rect.width * 0.025;
      unitsRef.current.forEach(unit => {
        if (unit.faction !== playerFaction || !unit.mesh) return;
        if (!unit.isVisible) return;
        const pos3 = new THREE.Vector3(unit.position.x, unit.position.y + 0.5, unit.position.z);
        pos3.project(cameraRef.current!);
        if (pos3.z < -1 || pos3.z > 1) return;
        const sx = ((pos3.x + 1) / 2) * rect.width + rect.left;
        const sy = ((-pos3.y + 1) / 2) * rect.height + rect.top;
        if (sx + unitScreenRadius >= minX && sx - unitScreenRadius <= maxX &&
            sy + unitScreenRadius >= minY && sy - unitScreenRadius <= maxY) {
          selected.push(unit.id);
        }
      });
      const maxGroupSize = 12;
      const trimmed = selected.slice(0, maxGroupSize);
      if (trimmed.length > 0) {
        if (e.shiftKey) {
          setSelectedUnits(prev => {
            const merged = Array.from(new Set([...prev, ...trimmed]));
            return merged.slice(0, maxGroupSize);
          });
        } else {
          setSelectedUnits(trimmed);
          setSelectedBuilding(null);
        }
      }
      setDragSelect(null);
      dragStartRef.current = null;
      setTimeout(() => { isDraggingRef.current = false; }, 50);
      return;
    }
    
    dragStartRef.current = null;
    isDraggingRef.current = false;
    setDragSelect(null);
  }, [gameMode, dragSelect, playerFaction]);

  const handleClick = useCallback((e: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current || gameMode === 'menu') return;
    if (isDraggingRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
    
    const groundIntersect = intersects.find(i => i.object.name === 'ground');
    const targetPos = groundIntersect?.point;
    
    if (e.button === 2 || currentCommand) {
      if (selectedUnits.length > 0 && targetPos) {
        const target = getTargetAtPosition(e.clientX, e.clientY);
        if (currentCommand === 'attack' && target?.type === 'enemy') {
          issueOrder('attack', targetPos.x, targetPos.z, target.id);
        } else if (currentCommand === 'gather' && target?.type === 'resource') {
          issueOrder('gather', targetPos.x, targetPos.z, target.id);
        } else if (currentCommand === 'patrol') {
          issueOrder('patrol', targetPos.x, targetPos.z);
        } else if (currentCommand === 'repair' && target?.type === 'repair') {
          issueOrder('repair', targetPos.x, targetPos.z, target.id);
        } else if (currentCommand) {
          issueOrder(currentCommand, targetPos.x, targetPos.z);
        } else if (target?.type === 'enemy') {
          issueOrder('attack', targetPos.x, targetPos.z, target.id);
        } else if (target?.type === 'resource' && unitsRef.current.some(u => selectedUnits.includes(u.id) && u.type === 'peasant')) {
          issueOrder('gather', targetPos.x, targetPos.z, target.id);
        } else {
          issueOrder('move', targetPos.x, targetPos.z);
        }
      }
      setCurrentCommand(null);
      return;
    }
    
    if (buildingToBuild && targetPos) {
      const stats = BUILDING_STATS[buildingToBuild];
      if (resources[playerFaction].gold >= stats.cost.gold && resources[playerFaction].lumber >= stats.cost.lumber) {
        const newBuilding = createBuilding(buildingToBuild, playerFaction, targetPos.x, targetPos.z, true);
        buildingsRef.current.push(newBuilding);
        
        setResources(prev => ({
          ...prev,
          [playerFaction]: {
            gold: prev[playerFaction].gold - stats.cost.gold,
            lumber: prev[playerFaction].lumber - stats.cost.lumber
          }
        }));
        
        setBuildingToBuild(null);
        setShowBuildMenu(false);
        if (placementPreviewRef.current) {
          placementPreviewRef.current.visible = false;
        }
      }
      return;
    }
    
    let clickedUnitId: string | null = null;
    let clickedBuildingId: string | null = null;
    
    for (const intersect of intersects) {
      if (intersect.object.userData?.unitId) {
        const unit = unitsRef.current.find(u => u.id === intersect.object.userData.unitId);
        if (unit && unit.faction === playerFaction) {
          clickedUnitId = unit.id;
          break;
        }
      }
      if (intersect.object.userData?.buildingId) {
        const building = buildingsRef.current.find(b => b.id === intersect.object.userData.buildingId);
        if (building && building.faction === playerFaction) {
          clickedBuildingId = building.id;
          break;
        }
      }
    }
    
    if (clickedUnitId) {
      if (e.ctrlKey || e.shiftKey) {
        setSelectedUnits(prev => 
          prev.includes(clickedUnitId!) 
            ? prev.filter(id => id !== clickedUnitId)
            : [...prev, clickedUnitId!]
        );
      } else {
        setSelectedUnits([clickedUnitId]);
        setSelectedBuilding(null);
        setShowBuildMenu(false);
      }
    } else if (clickedBuildingId) {
      setSelectedBuilding(clickedBuildingId);
      setSelectedUnits([]);
      setShowBuildMenu(false);
    } else {
      if (!e.ctrlKey && !e.shiftKey) {
        setSelectedUnits([]);
        setSelectedBuilding(null);
        setShowBuildMenu(false);
      }
    }
  }, [gameMode, selectedUnits, buildingToBuild, playerFaction, resources, currentCommand, createBuilding, issueOrder, getTargetAtPosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
    
    if (dragStartRef.current && e.button !== 2) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDraggingRef.current = true;
        setDragSelect({
          startX: dragStartRef.current.x,
          startY: dragStartRef.current.y,
          endX: e.clientX,
          endY: e.clientY
        });
      }
      return;
    }
    
    if (buildingToBuild) {
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
      const groundIntersect = intersects.find(i => i.object.name === 'ground');
      
      if (groundIntersect && placementPreviewRef.current) {
        const pos = groundIntersect.point;
        placementPreviewRef.current.position.set(pos.x, 1, pos.z);
        placementPreviewRef.current.visible = true;
        
        const canPlace = !buildingsRef.current.some(b => 
          Math.abs(b.position.x - pos.x) < 4 && Math.abs(b.position.z - pos.z) < 4
        );
        (placementPreviewRef.current.material as THREE.MeshBasicMaterial).color.setHex(canPlace ? 0x00ff00 : 0xff0000);
      }
      setCursorStyle('crosshair');
      return;
    }
    
    if (currentCommand) {
      const cmdCursors: Record<string, string> = {
        attack: 'crosshair', move: 'pointer', patrol: 'crosshair',
        gather: 'grab', repair: 'help', build: 'cell'
      };
      setCursorStyle(cmdCursors[currentCommand] || 'crosshair');
      return;
    }
    
    if (selectedUnits.length > 0 && gameMode !== 'menu') {
      const target = getTargetAtPosition(e.clientX, e.clientY);
      if (target?.type === 'enemy') setCursorStyle('crosshair');
      else if (target?.type === 'resource') setCursorStyle('grab');
      else if (target?.type === 'repair') setCursorStyle('help');
      else setCursorStyle('default');
    } else {
      setCursorStyle('default');
    }
  }, [buildingToBuild, currentCommand, selectedUnits, gameMode, getTargetAtPosition]);

  const trainUnit = useCallback((unitType: UnitType) => {
    if (!selectedBuilding) return;
    
    const building = buildingsRef.current.find(b => b.id === selectedBuilding);
    if (!building || building.faction !== playerFaction || building.isConstructing) return;
    
    const stats = UNIT_STATS[unitType];
    
    if (resources[playerFaction].gold >= stats.cost.gold && 
        resources[playerFaction].lumber >= stats.cost.lumber &&
        food[playerFaction].used < food[playerFaction].max) {
      
      setResources(prev => ({
        ...prev,
        [playerFaction]: {
          gold: prev[playerFaction].gold - stats.cost.gold,
          lumber: prev[playerFaction].lumber - stats.cost.lumber
        }
      }));
      
      building.productionQueue.push(unitType);
    }
  }, [selectedBuilding, playerFaction, resources, food]);

  const updateGame = useCallback((deltaTime: number) => {
    if (isPaused || gameMode === 'menu') return;
    
    setGameTime(prev => prev + deltaTime);
    updateFogOfWar();
    
    unitsRef.current = unitsRef.current.map(unit => {
      if (unit.targetPosition) {
        const dx = unit.targetPosition.x - unit.position.x;
        const dz = unit.targetPosition.z - unit.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < 0.3) {
          if (unit.gatherTarget) {
            const resource = resourceNodesRef.current.find(r => r.id === unit.gatherTarget);
            if (resource && resource.amount > 0) {
              const gatherAmount = Math.min(10, resource.amount);
              resource.amount -= gatherAmount;
              unit.carryingResource = { type: resource.type, amount: gatherAmount };
              
              if (resource.amount <= 0) {
                if (resource.type === 'lumber' && resource.mesh && resource.trunkMesh) {
                  spawnFallingTree(resource);
                  resource.mesh = undefined;
                  resource.trunkMesh = undefined;
                } else {
                  if (resource.mesh) sceneRef.current?.remove(resource.mesh);
                  if (resource.trunkMesh) sceneRef.current?.remove(resource.trunkMesh);
                }
              }
              
              const townhall = buildingsRef.current.find(b => b.type === 'townhall' && b.faction === unit.faction);
              if (townhall) {
                unit.targetPosition = { x: townhall.position.x + 3, y: 0.5, z: townhall.position.z };
                unit.gatherTarget = null;
              }
            } else {
              unit.gatherTarget = null;
              if (unit.lastGatherTarget) {
                const nearbyResource = resourceNodesRef.current.find(r =>
                  r.amount > 0 && r.type === (resource?.type || 'gold') &&
                  Math.abs(r.position.x - unit.position.x) < 10 &&
                  Math.abs(r.position.z - unit.position.z) < 10
                );
                if (nearbyResource) {
                  unit.gatherTarget = nearbyResource.id;
                  unit.lastGatherTarget = nearbyResource.id;
                  unit.targetPosition = { x: nearbyResource.position.x, y: 0.5, z: nearbyResource.position.z };
                } else {
                  unit.lastGatherTarget = null;
                  unit.targetPosition = null;
                  unit.currentOrder = null;
                }
              }
            }
          } else if (unit.carryingResource) {
            const townhall = buildingsRef.current.find(b => 
              b.type === 'townhall' && 
              b.faction === unit.faction &&
              Math.abs(b.position.x - unit.position.x) < 5 &&
              Math.abs(b.position.z - unit.position.z) < 5
            );
            if (townhall) {
              const resType = unit.carryingResource.type;
              const resAmount = unit.carryingResource.amount;
              unit.carryingResource = null;
              const textColor = resType === 'gold' ? '#FFD700' : '#22DD22';
              const textIcon = resType === 'gold' ? '💰' : '🪵';
              spawnFloatingText(`+${resAmount} ${textIcon}`, townhall.position.x, 5, townhall.position.z, textColor);
              setResources(prev => ({
                ...prev,
                [unit.faction]: {
                  ...prev[unit.faction],
                  [resType]: prev[unit.faction][resType] + resAmount
                }
              }));
              
              if (unit.lastGatherTarget) {
                const lastResource = resourceNodesRef.current.find(r => r.id === unit.lastGatherTarget);
                if (lastResource && lastResource.amount > 0) {
                  unit.gatherTarget = unit.lastGatherTarget;
                  unit.currentOrder = 'gather';
                  unit.targetPosition = { x: lastResource.position.x, y: 0.5, z: lastResource.position.z };
                } else {
                  const nearbyResource = resourceNodesRef.current.find(r =>
                    r.amount > 0 && r.type === resType &&
                    Math.abs(r.position.x - unit.position.x) < 15 &&
                    Math.abs(r.position.z - unit.position.z) < 15
                  );
                  if (nearbyResource) {
                    unit.gatherTarget = nearbyResource.id;
                    unit.lastGatherTarget = nearbyResource.id;
                    unit.currentOrder = 'gather';
                    unit.targetPosition = { x: nearbyResource.position.x, y: 0.5, z: nearbyResource.position.z };
                  } else {
                    unit.lastGatherTarget = null;
                    unit.currentOrder = null;
                  }
                }
              }
            }
          } else if (unit.currentOrder === 'patrol' && unit.patrolStart && unit.patrolEnd) {
            const distToStart = Math.sqrt(
              Math.pow(unit.position.x - unit.patrolStart.x, 2) + 
              Math.pow(unit.position.z - unit.patrolStart.z, 2)
            );
            const distToEnd = Math.sqrt(
              Math.pow(unit.position.x - unit.patrolEnd.x, 2) + 
              Math.pow(unit.position.z - unit.patrolEnd.z, 2)
            );
            if (distToEnd < 1) {
              unit.targetPosition = { ...unit.patrolStart };
            } else if (distToStart < 1) {
              unit.targetPosition = { ...unit.patrolEnd };
            }
            return { ...unit, targetPosition: unit.targetPosition };
          }
          
          if (!unit.gatherTarget && !unit.carryingResource && unit.currentOrder !== 'patrol') {
            return { ...unit, targetPosition: null };
          }
        } else {
          const moveSpeed = unit.speed * deltaTime;
          const moveX = (dx / dist) * Math.min(moveSpeed, dist);
          const moveZ = (dz / dist) * Math.min(moveSpeed, dist);
          
          const newPos = {
            x: unit.position.x + moveX,
            y: unit.position.y,
            z: unit.position.z + moveZ
          };
          
          if (unit.mesh) {
            unit.mesh.position.set(newPos.x, unit.mesh.position.y, newPos.z);
            unit.mesh.lookAt(unit.targetPosition.x, unit.mesh.position.y, unit.targetPosition.z);
          }
          if (unit.selectionRing) {
            unit.selectionRing.position.set(newPos.x, 0.05, newPos.z);
          }
          if (unit.healthBar) {
            unit.healthBar.position.set(newPos.x, unit.healthBar.position.y, newPos.z);
          }
          
          if (Math.random() < deltaTime * 3) {
            spawnParticles(newPos.x, 0.1, newPos.z, 'dust', 2);
          }
          
          if (unit.currentOrder === 'attackmove') {
            const nearbyEnemy = unitsRef.current.find(u => 
              u.faction !== unit.faction && u.isVisible &&
              Math.sqrt(Math.pow(u.position.x - unit.position.x, 2) + Math.pow(u.position.z - unit.position.z, 2)) < unit.range + 2
            );
            if (nearbyEnemy) {
              return { ...unit, position: newPos, attackTarget: nearbyEnemy.id };
            }
          }
          
          return { ...unit, position: newPos };
        }
      }
      
      if (unit.attackTarget) {
        const target = unitsRef.current.find(u => u.id === unit.attackTarget) ||
                       buildingsRef.current.find(b => b.id === unit.attackTarget);
        
        if (target && target.health > 0) {
          const dx = target.position.x - unit.position.x;
          const dz = target.position.z - unit.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          
          if (dist <= unit.range) {
            const isRanged = unit.type === 'archer' || unit.type === 'ballista' || unit.type === 'mage';
            
            if (isRanged) {
              if (Math.random() < deltaTime * 1.5) {
                const projType = unit.type === 'ballista' ? 'ballista' : unit.type === 'mage' ? 'magic' : 'arrow';
                spawnPhysicsProjectile(
                  unit.position.x, unit.position.y + 1.2, unit.position.z,
                  target.position.x, target.position.z,
                  unit.damage, unit.attackTarget!, unit.faction,
                  projType
                );
              }
            } else {
              const targetArmor = 'armor' in target ? target.armor : 0;
              const rawDmg = Math.max(1, unit.damage - targetArmor);
              const damageDealt = rawDmg * deltaTime;
              target.health -= damageDealt;
              
              if (Math.random() < deltaTime * 2) {
                spawnFloatingText(`-${rawDmg}`, target.position.x + (Math.random() - 0.5), 3, target.position.z + (Math.random() - 0.5), '#FF4444');
              }
              
              if (Math.random() < deltaTime * 4) {
                spawnParticles(target.position.x, 1.0, target.position.z, 'spark', 4);
              }
              
              if (target.healthBar) {
                const healthFill = target.healthBar.children.find(c => c.name === 'healthFill') as THREE.Mesh;
                if (healthFill) {
                  const healthPercent = Math.max(0, target.health / target.maxHealth);
                  healthFill.scale.x = healthPercent;
                  (healthFill.material as THREE.MeshBasicMaterial).color.setHex(
                    healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000
                  );
                }
              }
            }
          } else {
            return { ...unit, targetPosition: { x: target.position.x, y: 0.5, z: target.position.z } };
          }
        } else {
          return { ...unit, attackTarget: null };
        }
      }
      
      if (unit.currentOrder === 'hold') {
        const nearbyEnemy = unitsRef.current.find(u => 
          u.faction !== unit.faction && u.isVisible &&
          Math.sqrt(Math.pow(u.position.x - unit.position.x, 2) + Math.pow(u.position.z - unit.position.z, 2)) < unit.range
        );
        if (nearbyEnemy) {
          return { ...unit, attackTarget: nearbyEnemy.id };
        }
      }
      
      if (unit.currentOrder === 'repair' && unit.repairTarget) {
        const targetBuilding = buildingsRef.current.find(b => b.id === unit.repairTarget);
        if (targetBuilding && targetBuilding.health < targetBuilding.maxHealth) {
          const dx = targetBuilding.position.x - unit.position.x;
          const dz = targetBuilding.position.z - unit.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          
          if (dist <= 3) {
            const repairAmount = 5 * deltaTime;
            targetBuilding.health = Math.min(targetBuilding.maxHealth, targetBuilding.health + repairAmount);
            
            if (targetBuilding.healthBar) {
              const healthFill = targetBuilding.healthBar.children.find(c => c.name === 'healthFill') as THREE.Mesh;
              if (healthFill) {
                const healthPercent = targetBuilding.health / targetBuilding.maxHealth;
                healthFill.scale.x = healthPercent;
                (healthFill.material as THREE.MeshBasicMaterial).color.setHex(
                  healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000
                );
              }
            }
            
            if (targetBuilding.health >= targetBuilding.maxHealth) {
              return { ...unit, currentOrder: null, repairTarget: null, targetPosition: null };
            }
          } else {
            return { ...unit, targetPosition: { x: targetBuilding.position.x, y: 0.5, z: targetBuilding.position.z } };
          }
        } else {
          return { ...unit, currentOrder: null, repairTarget: null };
        }
      }
      
      return unit;
    });
    
    unitsRef.current = unitsRef.current.filter(unit => {
      if (unit.health <= 0) {
        if (unit.mesh) sceneRef.current?.remove(unit.mesh);
        if (unit.selectionRing) sceneRef.current?.remove(unit.selectionRing);
        if (unit.healthBar) sceneRef.current?.remove(unit.healthBar);
        setFood(prev => ({
          ...prev,
          [unit.faction]: { ...prev[unit.faction], used: Math.max(0, prev[unit.faction].used - 1) }
        }));
        return false;
      }
      return true;
    });
    
    buildingsRef.current = buildingsRef.current.map(building => {
      if (building.isConstructing) {
        const newProgress = building.constructionProgress + deltaTime * 0.5;
        building.health = building.maxHealth * (newProgress / 100);
        
        if (newProgress >= 100) {
          building.isConstructing = false;
          building.constructionProgress = 100;
          building.health = building.maxHealth;
          
          if (building.mesh) {
            (building.mesh.material as THREE.MeshStandardMaterial).transparent = false;
            (building.mesh.material as THREE.MeshStandardMaterial).opacity = 1;
          }
          
          const stats = BUILDING_STATS[building.type];
          if (stats.food > 0) {
            setFood(prev => ({
              ...prev,
              [building.faction]: { ...prev[building.faction], max: prev[building.faction].max + stats.food }
            }));
          }
        } else {
          building.constructionProgress = newProgress;
        }
      }
      
      if (building.productionQueue.length > 0 && !building.isConstructing) {
        const unitType = building.productionQueue[0];
        const unitStats = UNIT_STATS[unitType];
        building.productionProgress += (deltaTime * 100 / unitStats.buildTime);
        
        if (building.productionProgress >= 100) {
          const rallyX = building.rallyPoint?.x || building.position.x + 3;
          const rallyZ = building.rallyPoint?.z || building.position.z;
          const newUnit = createUnit(unitType, building.faction, rallyX, rallyZ);
          unitsRef.current.push(newUnit);
          
          setFood(prev => ({
            ...prev,
            [building.faction]: { ...prev[building.faction], used: prev[building.faction].used + 1 }
          }));
          
          building.productionQueue.shift();
          building.productionProgress = 0;
        }
      }
      
      if (building.type === 'tower' && !building.isConstructing) {
        const towerRange = 6;
        const nearbyEnemy = unitsRef.current.find(u =>
          u.faction !== building.faction && u.isVisible &&
          Math.sqrt(Math.pow(u.position.x - building.position.x, 2) + Math.pow(u.position.z - building.position.z, 2)) < towerRange
        );
        if (nearbyEnemy && Math.random() < deltaTime * 1.2) {
          spawnPhysicsProjectile(
            building.position.x, 4.5, building.position.z,
            nearbyEnemy.position.x, nearbyEnemy.position.z,
            8, nearbyEnemy.id, building.faction,
            'arrow'
          );
        }
      }
      
      return building;
    });
    
    buildingsRef.current = buildingsRef.current.filter(building => {
      if (building.health <= 0) {
        spawnBuildingDebris(building);
        if (building.mesh) sceneRef.current?.remove(building.mesh);
        if (building.healthBar) sceneRef.current?.remove(building.healthBar);
        if (building.auxMeshes) building.auxMeshes.forEach(m => sceneRef.current?.remove(m));
        const stats = BUILDING_STATS[building.type];
        if (stats.food > 0) {
          setFood(prev => ({
            ...prev,
            [building.faction]: { ...prev[building.faction], max: Math.max(0, prev[building.faction].max - stats.food) }
          }));
        }
        return false;
      }
      return true;
    });
    
    unitsRef.current.forEach(unit => {
      if (unit.selectionRing) {
        const isSelected = selectedUnits.includes(unit.id);
        (unit.selectionRing.material as THREE.MeshBasicMaterial).opacity = isSelected ? 0.8 : 0;
      }
    });
    
    if (gameMode === 'pve') {
      const enemyFaction: Faction = playerFaction === 'human' ? 'orc' : 'human';
      const enemyUnits = unitsRef.current.filter(u => u.faction === enemyFaction);
      const enemyBuildings = buildingsRef.current.filter(b => b.faction === enemyFaction);
      
      if (Math.random() < 0.03 * deltaTime && resources[enemyFaction].gold >= 600) {
        const barracks = enemyBuildings.find(b => b.type === 'barracks' && !b.isConstructing && b.productionQueue.length < 5);
        if (barracks && food[enemyFaction].used < food[enemyFaction].max) {
          barracks.productionQueue.push('footman');
          setResources(prev => ({
            ...prev,
            [enemyFaction]: { ...prev[enemyFaction], gold: prev[enemyFaction].gold - 600 }
          }));
        }
      }
      
      const idleEnemyUnits = enemyUnits.filter(u => !u.targetPosition && !u.attackTarget && u.type !== 'peasant');
      if (idleEnemyUnits.length >= 6 && Math.random() < 0.015 * deltaTime) {
        const playerBuildings = buildingsRef.current.filter(b => b.faction === playerFaction);
        if (playerBuildings.length > 0) {
          const target = playerBuildings[0];
          idleEnemyUnits.forEach(unit => {
            unit.currentOrder = 'attackmove';
            unit.targetPosition = { x: target.position.x, y: 0.5, z: target.position.z };
          });
        }
      }
    }
    
    updateFloatingTexts(deltaTime);
    updatePhysics(deltaTime);
    renderMinimap();
  }, [isPaused, gameMode, selectedUnits, playerFaction, createUnit, resources, food, updateFogOfWar, renderMinimap, spawnFloatingText, updateFloatingTexts, spawnParticles, updatePhysics, spawnPhysicsProjectile, spawnBuildingDebris, spawnFallingTree]);

  useEffect(() => {
    if (gameMode !== 'menu' && containerRef.current && !isInitializedRef.current) {
      setTimeout(() => {
        if (containerRef.current && containerRef.current.clientWidth > 0) {
          initializeScene();
          if (pendingGameRef.current) {
            const { faction, mode } = pendingGameRef.current;
            initializeGameEntities(faction, mode);
            pendingGameRef.current = null;
          }
        }
      }, 100);
    }
  }, [gameMode, initializeScene, initializeGameEntities]);

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    
    const animate = () => {
      const now = performance.now();
      const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      
      if (gameMode !== 'menu') {
        updateGame(deltaTime);
        updateParticles(deltaTime);
        updateBuildingFireEffects(deltaTime);
      }
      
      const elapsed = now / 1000;
      updateWaterAnimation(elapsed);
      
      if (cameraRef.current) {
        const height = 25 / cameraZoom;
        const offset = 25 / cameraZoom;
        cameraRef.current.position.x = cameraPosition.x;
        cameraRef.current.position.z = cameraPosition.z + offset;
        cameraRef.current.position.y = height;
        cameraRef.current.lookAt(cameraPosition.x, 0, cameraPosition.z);
      }
      
      if (composerRef.current) {
        composerRef.current.render();
      } else {
        rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
      }
      gameLoopRef.current = requestAnimationFrame(animate);
    };
    
    lastTimeRef.current = performance.now();
    gameLoopRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameMode, cameraPosition, cameraZoom, updateGame, updateParticles, updateBuildingFireEffects, updateWaterAnimation]);

  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;
    
    const onContextMenu = (e: Event) => { e.preventDefault(); handleClick(e as MouseEvent); };
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleClick, handleMouseMove, handleMouseDown, handleMouseUp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameMode === 'menu') return;
      
      const moveSpeed = 2;
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          setCameraPosition(prev => ({ ...prev, z: Math.max(5, prev.z - moveSpeed) }));
          break;
        case 'arrowdown':
        case 's':
          if (!e.ctrlKey) setCameraPosition(prev => ({ ...prev, z: Math.min(MAP_SIZE - 5, prev.z + moveSpeed) }));
          break;
        case 'arrowleft':
        case 'a':
          setCameraPosition(prev => ({ ...prev, x: Math.max(5, prev.x - moveSpeed) }));
          break;
        case 'arrowright':
        case 'd':
          setCameraPosition(prev => ({ ...prev, x: Math.min(MAP_SIZE - 5, prev.x + moveSpeed) }));
          break;
        case 'escape':
          setBuildingToBuild(null);
          setCurrentCommand(null);
          setShowBuildMenu(false);
          if (placementPreviewRef.current) placementPreviewRef.current.visible = false;
          break;
        case ' ':
          e.preventDefault();
          setIsPaused(prev => !prev);
          break;
        case 'm':
          setCurrentCommand('move');
          break;
        case 'p':
          setCurrentCommand('patrol');
          break;
        case 'h':
          issueOrder('hold');
          break;
        case 'b':
          if (selectedUnits.some(id => unitsRef.current.find(u => u.id === id)?.type === 'peasant')) {
            setShowBuildMenu(true);
          }
          break;
        case 'g':
          setCurrentCommand('gather');
          break;
      }
      
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const groupNum = parseInt(e.key);
        if (selectedUnits.length > 0) {
          const oldGroup = unitGroupsRef.current[groupNum] || [];
          oldGroup.forEach(id => {
            const u = unitsRef.current.find(unit => unit.id === id);
            if (u && u.groupNumber === groupNum) u.groupNumber = null;
          });
          unitGroupsRef.current[groupNum] = [...selectedUnits];
          selectedUnits.forEach(id => {
            const u = unitsRef.current.find(unit => unit.id === id);
            if (u) u.groupNumber = groupNum;
          });
        }
      } else if (!e.ctrlKey && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        const groupNum = parseInt(e.key);
        const group = unitGroupsRef.current[groupNum];
        if (group && group.length > 0) {
          const validIds = group.filter(id => unitsRef.current.some(u => u.id === id));
          unitGroupsRef.current[groupNum] = validIds;
          if (validIds.length > 0) {
            setSelectedUnits(validIds);
            setSelectedBuilding(null);
            setShowBuildMenu(false);
          }
        }
      }
    };
    
    const handleWheel = (e: WheelEvent) => {
      setCameraZoom(prev => Math.max(0.5, Math.min(2.5, prev + e.deltaY * -0.001)));
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [gameMode, selectedUnits, issueOrder]);

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * MAP_SIZE;
    const z = ((e.clientY - rect.top) / rect.height) * MAP_SIZE;
    
    if (e.button === 2 && selectedUnits.length > 0) {
      issueOrder('move', x, z);
    } else {
      setCameraPosition({ x: Math.max(5, Math.min(MAP_SIZE - 5, x)), z: Math.max(5, Math.min(MAP_SIZE - 5, z)) });
    }
  }, [selectedUnits, issueOrder]);

  if (gameMode === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a0a00] via-[#2d1810] to-[#1a0a00] text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0 grid grid-cols-2 grid-rows-2 opacity-20">
          <img src={heroStoneGuardian} alt="" className="w-full h-full object-cover" />
          <img src={heroDeathMage} alt="" className="w-full h-full object-cover" />
          <img src={heroHolyPaladin} alt="" className="w-full h-full object-cover" />
          <img src={heroOrcShaman} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#1a0a00]/60 via-[#2d1810]/40 to-[#1a0a00]/70" />
        <div className="absolute top-4 left-4 z-10">
          <Link href="/super-engine">
            <Button variant="outline" className="border-amber-600 text-amber-400 hover:bg-amber-600 hover:text-black" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
        
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
          <div className="relative mb-4">
            <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-800 drop-shadow-lg"
                style={{ textShadow: '3px 3px 6px rgba(0,0,0,0.8)' }}>
              WARGUS
            </h1>
          </div>
          <p className="text-lg text-amber-200/80 mb-10 mt-8">3D Real-Time Strategy • Warcraft II Clone</p>
          
          <div className="bg-[#2d1a10] border-4 border-amber-700 rounded-lg p-8 max-w-md">
            <h2 className="text-center text-2xl text-amber-400 mb-6 border-b-2 border-amber-700 pb-2">
              ⚔️ SELECT FACTION ⚔️
            </h2>
            
            <div className="space-y-4">
              <button
                onClick={() => startGame('pve', 'human')}
                className="w-full bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900 border-2 border-blue-400 rounded p-4 hover:from-blue-800 hover:via-blue-600 hover:to-blue-800 transition-all"
                data-testid="button-play-human"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl">👑</span>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-200">ALLIANCE</div>
                    <div className="text-sm text-blue-300">Humans, Elves, Dwarves</div>
                  </div>
                  <span className="text-3xl">🛡️</span>
                </div>
              </button>
              
              <button
                onClick={() => startGame('pve', 'orc')}
                className="w-full bg-gradient-to-r from-red-900 via-red-700 to-red-900 border-2 border-red-400 rounded p-4 hover:from-red-800 hover:via-red-600 hover:to-red-800 transition-all"
                data-testid="button-play-orc"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl">💀</span>
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-200">HORDE</div>
                    <div className="text-sm text-red-300">Orcs, Trolls, Ogres</div>
                  </div>
                  <span className="text-3xl">⚔️</span>
                </div>
              </button>
            </div>
            
            <div className="mt-6 pt-4 border-t border-amber-800 text-center text-amber-500 text-sm">
              Press SPACE to pause • WASD to scroll • Mouse wheel to zoom
            </div>
          </div>
          
          <div ref={containerRef} className="hidden" />
        </div>
      </div>
    );
  }

  const selectedUnitData = selectedUnits.length > 0 ? unitsRef.current.filter(u => selectedUnits.includes(u.id)) : [];
  const selectedBuildingData = selectedBuilding ? buildingsRef.current.find(b => b.id === selectedBuilding) : null;
  const firstSelectedUnit = selectedUnitData[0];
  const isPeasantSelected = selectedUnitData.some(u => u.type === 'peasant');

  if (webglError) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-[#1a1a2e]">
        <div className="text-center p-8 bg-[#0d0d0d] border-2 border-amber-700 rounded-lg max-w-md">
          <h2 className="text-2xl font-bold text-amber-400 mb-4">WebGL Not Available</h2>
          <p className="text-amber-200 mb-4">
            This 3D game requires WebGL support which is not available in this browser environment.
          </p>
          <p className="text-amber-300 text-sm mb-4">
            Try opening the app in a new browser tab or on a device with WebGL support.
          </p>
          <Link href="/super-engine">
            <Button className="bg-amber-700 hover:bg-amber-600 text-white">
              Return to Game Engine
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" style={{ bottom: '140px', cursor: cursorStyle }} data-testid="game-container" />
      
      {dragSelect && (
        <div
          className="fixed border-2 border-green-400 bg-green-400/10 pointer-events-none z-50"
          style={{
            left: Math.min(dragSelect.startX, dragSelect.endX),
            top: Math.min(dragSelect.startY, dragSelect.endY),
            width: Math.abs(dragSelect.endX - dragSelect.startX),
            height: Math.abs(dragSelect.endY - dragSelect.startY)
          }}
        />
      )}
      
      <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] border-b-2 border-amber-700 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setGameMode('menu')}
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 h-7 px-2"
            data-testid="button-menu"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsPaused(!isPaused)}
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 h-7 px-2"
            data-testid="button-pause"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMuted(!isMuted)}
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 h-7 px-2"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              isInitializedRef.current = false;
              startGame(gameMode, playerFaction);
            }}
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 h-7 px-2"
            data-testid="button-restart"
          >
            🔄 Restart
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            className="text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 h-7 px-2"
            data-testid="button-help"
          >
            ❓ Help
          </Button>
        </div>
        
        <div className="flex items-center gap-6 text-lg font-bold">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">💰</span>
            <span className="text-yellow-300" data-testid="text-gold">{resources[playerFaction]?.gold || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">🪵</span>
            <span className="text-green-300" data-testid="text-lumber">{resources[playerFaction]?.lumber || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-400">🍖</span>
            <span className="text-blue-300" data-testid="text-food">
              {food[playerFaction]?.used || 0}/{food[playerFaction]?.max || 0}
            </span>
          </div>
        </div>
        
        <div className="text-amber-500 text-sm">
          {Math.floor(gameTime / 60)}:{(Math.floor(gameTime) % 60).toString().padStart(2, '0')}
        </div>
      </div>
      
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20" style={{ bottom: '140px' }}>
          <div className="text-5xl font-bold text-amber-400 border-4 border-amber-600 bg-black/80 px-8 py-4">
            ⏸️ PAUSED
          </div>
        </div>
      )}
      
      {showHelp && (
        <div className="absolute top-12 right-4 w-72 max-h-[70vh] overflow-y-auto bg-[#1a0a00]/95 border-2 border-amber-700 rounded-lg p-4 z-30 text-sm">
          <div className="flex justify-between items-center mb-3 border-b border-amber-800 pb-2">
            <h3 className="text-amber-400 font-bold">📜 Controls & Tips</h3>
            <button onClick={() => setShowHelp(false)} className="text-amber-500 hover:text-amber-300">✕</button>
          </div>
          <div className="space-y-2 text-amber-200">
            <div className="font-bold text-amber-400 mt-2">Camera:</div>
            <div>• WASD / Arrow Keys - Pan camera</div>
            <div>• Mouse Wheel - Zoom in/out</div>
            <div className="font-bold text-amber-400 mt-2">Selection:</div>
            <div>• Left Click - Select unit/building</div>
            <div>• Left Drag - Box select units</div>
            <div>• Shift+Click - Add to selection</div>
            <div>• Right Click - Move/Attack command</div>
            <div className="font-bold text-amber-400 mt-2">Commands:</div>
            <div>• M - Move</div>
            <div>• A - Attack / Attack-Move</div>
            <div>• P - Patrol</div>
            <div>• S - Stop</div>
            <div>• H - Hold Position</div>
            <div>• G - Gather (peasants)</div>
            <div>• B - Build menu (peasants)</div>
            <div>• R - Repair (peasants)</div>
            <div className="font-bold text-amber-400 mt-2">Groups:</div>
            <div>• Ctrl+1-9 - Assign group</div>
            <div>• 1-9 - Select group</div>
            <div className="font-bold text-amber-400 mt-2">Gameplay Tips:</div>
            <div>• Build farms for more food supply</div>
            <div>• Workers auto-repeat gathering</div>
            <div>• Gold mines and trees are resources</div>
            <div>• Click minimap to navigate</div>
            <div className="font-bold text-amber-400 mt-2">3D Assets (Map Objects):</div>
            <div className="text-xs space-y-0.5 mt-1">
              <div className="text-cyan-300">Units:</div>
              <div>• CapsuleGeometry - all units</div>
              <div>• Blue (#4169E1) = Human</div>
              <div>• Red (#DC143C) = Orc</div>
              <div>• Size: Knight/Paladin 0.6, Ballista 0.8, others 0.45</div>
              <div className="text-cyan-300 mt-1">Buildings:</div>
              <div>• BoxGeometry - all buildings</div>
              <div>• TownHall: 3x3.5x3</div>
              <div>• Barracks/Smith/Lumber/Stable/Church: 2.5xH</div>
              <div>• Farm: 2x2.5x2</div>
              <div>• Tower: 2.5x4 + ConeGeometry roof</div>
              <div className="text-cyan-300 mt-1">Resources:</div>
              <div>• Gold: DodecahedronGeometry r=1.2</div>
              <div>• Tree: CylinderGeometry trunk + ConeGeometry leaves</div>
              <div className="text-cyan-300 mt-1">Terrain:</div>
              <div>• Ground: PlaneGeometry 80x80 128-res heightmap</div>
              <div>• Border: Raised cliffs (h=3+) with rocks</div>
              <div>• Water: PlaneGeometry with wave offset</div>
              <div>• Fog: PlaneGeometry with vertex colors</div>
              <div className="text-cyan-300 mt-1">Map Size: {MAP_SIZE}x{MAP_SIZE}</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 h-[140px] bg-gradient-to-t from-[#1a0a00] via-[#2d1810] to-[#1a0a00] border-t-4 border-amber-700 flex z-10">
        <div className="w-[160px] p-2 border-r-2 border-amber-800">
          <canvas 
            ref={minimapRef} 
            width={140} 
            height={120} 
            className="w-full h-full border-2 border-amber-700 cursor-crosshair"
            onClick={handleMinimapClick}
            onContextMenu={(e) => { e.preventDefault(); handleMinimapClick(e); }}
            data-testid="minimap"
          />
        </div>
        
        <div className="w-[220px] p-2 border-r-2 border-amber-800 flex flex-col items-center justify-center overflow-hidden">
          {selectedUnitData.length === 1 && firstSelectedUnit && (
            <>
              <div className="text-4xl mb-1">{UNIT_STATS[firstSelectedUnit.type].icon}</div>
              <div className="text-amber-300 font-bold text-sm">{UNIT_STATS[firstSelectedUnit.type].name}</div>
              <div className="flex items-center gap-1 mt-1 w-full px-2">
                <span className="text-xs text-red-400">♥</span>
                <div className="flex-1 bg-gray-800 h-2 rounded">
                  <div className="h-full rounded transition-all" style={{
                    width: `${(firstSelectedUnit.health / firstSelectedUnit.maxHealth) * 100}%`,
                    backgroundColor: firstSelectedUnit.health / firstSelectedUnit.maxHealth > 0.5 ? '#22c55e' : firstSelectedUnit.health / firstSelectedUnit.maxHealth > 0.25 ? '#eab308' : '#ef4444'
                  }} />
                </div>
                <span className="text-xs text-green-400 w-16 text-right">{Math.ceil(firstSelectedUnit.health)}/{firstSelectedUnit.maxHealth}</span>
              </div>
              <div className="text-amber-500 text-xs mt-1">
                ⚔️{firstSelectedUnit.damage} 🛡️{firstSelectedUnit.armor} 📏{firstSelectedUnit.range.toFixed(1)}
              </div>
              {firstSelectedUnit.currentOrder && (
                <div className="text-cyan-400 text-xs mt-1">
                  {COMMAND_ICONS[firstSelectedUnit.currentOrder]?.icon} {COMMAND_ICONS[firstSelectedUnit.currentOrder]?.name}
                </div>
              )}
              {firstSelectedUnit.groupNumber && (
                <div className="text-amber-600 text-xs">Group {firstSelectedUnit.groupNumber}</div>
              )}
            </>
          )}
          {selectedUnitData.length > 1 && (
            <div className="w-full h-full overflow-y-auto">
              <div className="text-amber-400 text-xs font-bold mb-1 text-center">{selectedUnitData.length} units selected</div>
              <div className="grid grid-cols-4 gap-0.5">
                {selectedUnitData.slice(0, 16).map(u => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedUnits([u.id]); setSelectedBuilding(null); }}
                    className="flex flex-col items-center p-0.5 rounded border border-amber-800/50 hover:border-amber-400 bg-amber-900/20 transition-all"
                  >
                    <span className="text-lg leading-none">{UNIT_STATS[u.type].icon}</span>
                    <div className="w-full bg-gray-800 h-1 rounded mt-0.5">
                      <div className="h-full rounded" style={{
                        width: `${(u.health / u.maxHealth) * 100}%`,
                        backgroundColor: u.health / u.maxHealth > 0.5 ? '#22c55e' : '#ef4444'
                      }} />
                    </div>
                  </button>
                ))}
              </div>
              {selectedUnitData.length > 16 && (
                <div className="text-amber-500 text-xs text-center mt-1">+{selectedUnitData.length - 16} more</div>
              )}
            </div>
          )}
          {selectedBuildingData && (
            <>
              <div className="text-4xl mb-1">{BUILDING_STATS[selectedBuildingData.type].icon}</div>
              <div className="text-amber-300 font-bold text-sm">{BUILDING_STATS[selectedBuildingData.type].name}</div>
              <div className="flex items-center gap-1 mt-1 w-full px-2">
                <span className="text-xs text-red-400">♥</span>
                <div className="flex-1 bg-gray-800 h-2 rounded">
                  <div className="h-full rounded transition-all" style={{
                    width: `${(selectedBuildingData.health / selectedBuildingData.maxHealth) * 100}%`,
                    backgroundColor: selectedBuildingData.health / selectedBuildingData.maxHealth > 0.5 ? '#22c55e' : '#ef4444'
                  }} />
                </div>
                <span className="text-xs text-green-400 w-16 text-right">{Math.ceil(selectedBuildingData.health)}/{selectedBuildingData.maxHealth}</span>
              </div>
              {selectedBuildingData.isConstructing && (
                <div className="w-full mt-1 px-2">
                  <div className="text-amber-500 text-xs text-center">Building... {Math.floor(selectedBuildingData.constructionProgress)}%</div>
                  <div className="w-full bg-gray-800 h-2 rounded mt-1">
                    <div className="bg-amber-500 h-full rounded transition-all" style={{ width: `${selectedBuildingData.constructionProgress}%` }} />
                  </div>
                </div>
              )}
            </>
          )}
          {!firstSelectedUnit && !selectedBuildingData && (
            <div className="text-amber-600 text-sm text-center">
              <div className="text-2xl mb-1">🎮</div>
              No selection
            </div>
          )}
        </div>
        
        <div className="flex-1 p-2">
          {showBuildMenu && isPeasantSelected ? (
            <div className="grid grid-cols-4 gap-1 h-full">
              {(Object.entries(BUILDING_STATS) as [BuildingType, typeof BUILDING_STATS[BuildingType]][]).map(([type, stats]) => {
                const canAfford = resources[playerFaction].gold >= stats.cost.gold && resources[playerFaction].lumber >= stats.cost.lumber;
                return (
                  <button
                    key={type}
                    onClick={() => { setBuildingToBuild(type); setShowBuildMenu(false); }}
                    disabled={!canAfford}
                    className={`flex flex-col items-center justify-center rounded border-2 transition-all text-xs
                      ${buildingToBuild === type ? 'border-green-400 bg-green-900/50' : 
                        canAfford ? 'border-amber-700 bg-amber-900/30 hover:bg-amber-800/50 hover:border-amber-500' : 
                        'border-gray-700 bg-gray-900/50 opacity-50 cursor-not-allowed'}`}
                    data-testid={`button-build-${type}`}
                  >
                    <span className="text-2xl">{stats.icon}</span>
                    <span className="text-amber-300 truncate w-full text-center">{stats.name}</span>
                    <span className="text-yellow-400">{stats.cost.gold}💰 {stats.cost.lumber > 0 && `${stats.cost.lumber}🪵`}</span>
                  </button>
                );
              })}
            </div>
          ) : selectedBuildingData && BUILDING_STATS[selectedBuildingData.type].trains.length > 0 && !selectedBuildingData.isConstructing ? (
            <div className="h-full">
              <div className="grid grid-cols-4 gap-1">
                {BUILDING_STATS[selectedBuildingData.type].trains.map(unitType => {
                  const stats = UNIT_STATS[unitType];
                  const canAfford = resources[playerFaction].gold >= stats.cost.gold && 
                                   resources[playerFaction].lumber >= stats.cost.lumber &&
                                   food[playerFaction].used < food[playerFaction].max;
                  return (
                    <button
                      key={unitType}
                      onClick={() => trainUnit(unitType)}
                      disabled={!canAfford}
                      className={`flex flex-col items-center justify-center p-2 rounded border-2 transition-all
                        ${canAfford ? 'border-amber-700 bg-amber-900/30 hover:bg-amber-800/50 hover:border-amber-500' : 
                          'border-gray-700 bg-gray-900/50 opacity-50 cursor-not-allowed'}`}
                      data-testid={`button-train-${unitType}`}
                    >
                      <span className="text-3xl">{stats.icon}</span>
                      <span className="text-amber-300 text-xs">{stats.name}</span>
                      <span className="text-yellow-400 text-xs">{stats.cost.gold}💰</span>
                    </button>
                  );
                })}
              </div>
              {selectedBuildingData.productionQueue.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-amber-500 text-xs">Queue:</span>
                  {selectedBuildingData.productionQueue.map((ut, i) => (
                    <span key={i} className="text-lg">{UNIT_STATS[ut].icon}</span>
                  ))}
                  <div className="flex-1 bg-gray-800 h-2 rounded ml-2">
                    <div className="bg-amber-500 h-full rounded transition-all" style={{ width: `${selectedBuildingData.productionProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          ) : selectedUnitData.length > 0 ? (
            <div className="grid grid-cols-6 gap-1 h-full">
              {firstSelectedUnit && UNIT_STATS[firstSelectedUnit.type].commands.map(cmd => {
                const cmdInfo = COMMAND_ICONS[cmd];
                if (!cmdInfo) return null;
                return (
                  <button
                    key={cmd}
                    onClick={() => {
                      if (cmd === 'stop') issueOrder('stop');
                      else if (cmd === 'hold') issueOrder('hold');
                      else if (cmd === 'build') setShowBuildMenu(true);
                      else setCurrentCommand(cmd as OrderType);
                    }}
                    className={`flex flex-col items-center justify-center rounded border-2 transition-all
                      ${currentCommand === cmd ? 'border-green-400 bg-green-900/50' : 
                        'border-amber-700 bg-amber-900/30 hover:bg-amber-800/50 hover:border-amber-500'}`}
                    data-testid={`button-cmd-${cmd}`}
                  >
                    <span className="text-2xl">{cmdInfo.icon}</span>
                    <span className="text-amber-300 text-xs">{cmdInfo.name}</span>
                    <span className="text-amber-500 text-xs">[{cmdInfo.hotkey}]</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-amber-600">
              Select units or buildings to see commands
            </div>
          )}
        </div>
        
        <div className="w-[170px] p-2 border-l-2 border-amber-800 text-xs text-amber-400 overflow-y-auto">
          <div className="font-bold text-amber-300 mb-1 border-b border-amber-800 pb-1">GROUPS</div>
          <div className="grid grid-cols-3 gap-0.5 mb-2">
            {[1,2,3,4,5,6,7,8,9].map(n => {
              const group = unitGroupsRef.current[n];
              const count = group ? group.filter(id => unitsRef.current.some(u => u.id === id)).length : 0;
              return (
                <button
                  key={n}
                  onClick={() => {
                    if (count > 0) {
                      const validIds = group!.filter(id => unitsRef.current.some(u => u.id === id));
                      setSelectedUnits(validIds);
                      setSelectedBuilding(null);
                    }
                  }}
                  className={`text-center rounded py-0.5 border transition-all ${
                    count > 0 
                      ? 'border-amber-600 bg-amber-900/40 hover:bg-amber-800/60 text-amber-300' 
                      : 'border-gray-700 bg-gray-900/30 text-gray-600'
                  }`}
                >
                  <div className="font-bold">{n}</div>
                  {count > 0 && <div className="text-[10px]">{count}</div>}
                </button>
              );
            })}
          </div>
          <div className="font-bold text-amber-300 mb-1 border-b border-amber-800 pb-1">KEYS</div>
          <div className="space-y-0.5">
            <div>WASD - Scroll</div>
            <div>Wheel - Zoom</div>
            <div>Drag - Box Select</div>
            <div>Shift+Click - Add</div>
            <div>RClick - Order</div>
            <div>Ctrl+# - Set Group</div>
            <div>M A P H S B G</div>
            <div>Space - Pause</div>
            <div>Esc - Cancel</div>
          </div>
        </div>
      </div>
      
      {currentCommand && (
        <div className="absolute bottom-[150px] left-1/2 -translate-x-1/2 bg-amber-900/90 border-2 border-amber-500 px-4 py-2 rounded text-amber-200 z-10">
          {COMMAND_ICONS[currentCommand]?.icon} {COMMAND_ICONS[currentCommand]?.name} - Click to target or ESC to cancel
        </div>
      )}
      
      {buildingToBuild && (
        <div className="absolute bottom-[150px] left-1/2 -translate-x-1/2 bg-amber-900/90 border-2 border-amber-500 px-4 py-2 rounded text-amber-200 z-10">
          🔨 Place {BUILDING_STATS[buildingToBuild].name} - Click to build or ESC to cancel
        </div>
      )}
    </div>
  );
}
