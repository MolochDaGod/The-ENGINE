import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import * as THREE from 'three';

type WeaponType = 'greatsword' | 'bow' | 'sabres' | 'scythe' | 'runeblade';
type AbilityKey = 'Q' | 'E' | 'R' | 'F';

interface Ability {
  key: AbilityKey;
  name: string;
  cooldown: number;
  maxCooldown: number;
  cost: number;
  costType: 'mana' | 'rage' | 'energy';
  description: string;
  unlocked: boolean;
}

interface WeaponData {
  type: WeaponType;
  name: string;
  icon: string;
  subclass: string;
  abilities: Ability[];
  resourceType: 'mana' | 'rage' | 'energy';
  color: string;
}

interface EnemyUnit {
  mesh: THREE.Group;
  health: number;
  maxHealth: number;
  type: 'skeleton' | 'demon' | 'wraith';
  position: THREE.Vector3;
  speed: number;
  attackCooldown: number;
  isDying: boolean;
  deathTimer: number;
  hitFlashTimer: number;
  originalEmissives: Map<THREE.Mesh, THREE.Color>;
  parts: {
    leftArm?: THREE.Object3D;
    rightArm?: THREE.Object3D;
    leftLeg?: THREE.Object3D;
    rightLeg?: THREE.Object3D;
    body?: THREE.Object3D;
    wings?: THREE.Object3D[];
  };
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
  type: 'ability' | 'death' | 'xp' | 'wraith_trail' | 'magic_bolt';
  targetPos?: THREE.Vector3;
}

interface GroundRing {
  mesh: THREE.Mesh;
  lifetime: number;
  maxLifetime: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  team: 'player' | 'enemy';
  type: string;
  lifetime: number;
}

const WEAPONS: WeaponData[] = [
  {
    type: 'greatsword',
    name: 'Greatsword',
    icon: '💎',
    subclass: 'IMMORTAL',
    color: '#00bfff',
    resourceType: 'rage',
    abilities: [
      { key: 'Q', name: 'Fullguard', cooldown: 0, maxCooldown: 7, cost: 0, costType: 'rage', description: 'Block all damage for 3s', unlocked: true },
      { key: 'E', name: 'Charge', cooldown: 0, maxCooldown: 8, cost: 0, costType: 'rage', description: 'Dash forward, gain 25 rage', unlocked: false },
      { key: 'R', name: 'Colossus Strike', cooldown: 0, maxCooldown: 5, cost: 25, costType: 'rage', description: 'Lightning bolt scales with rage', unlocked: false },
      { key: 'F', name: 'Divine Wind', cooldown: 0, maxCooldown: 1.5, cost: 10, costType: 'rage', description: 'Launch sword, 120 piercing damage', unlocked: false },
    ]
  },
  {
    type: 'bow',
    name: 'Bow',
    icon: '🏹',
    subclass: 'VIPER',
    color: '#00ff00',
    resourceType: 'energy',
    abilities: [
      { key: 'Q', name: 'Frost Bite', cooldown: 0, maxCooldown: 5, cost: 50, costType: 'energy', description: 'Fire 5 arrows, apply SLOW', unlocked: true },
      { key: 'E', name: 'Cobra Shot', cooldown: 0, maxCooldown: 2, cost: 60, costType: 'energy', description: 'Apply VENOM DoT', unlocked: false },
      { key: 'R', name: 'Viper Sting', cooldown: 0, maxCooldown: 2, cost: 60, costType: 'energy', description: 'Piercing arrow returns to heal', unlocked: false },
      { key: 'F', name: 'Cloudkill', cooldown: 0, maxCooldown: 4, cost: 40, costType: 'energy', description: 'Arrow barrage from sky', unlocked: false },
    ]
  },
  {
    type: 'sabres',
    name: 'Sabres',
    icon: '⚔️',
    subclass: 'ASSASSIN',
    color: '#ff4444',
    resourceType: 'energy',
    abilities: [
      { key: 'Q', name: 'Backstab', cooldown: 0, maxCooldown: 2, cost: 60, costType: 'energy', description: '75 dmg, 175 from behind', unlocked: true },
      { key: 'E', name: 'Flourish', cooldown: 0, maxCooldown: 1.5, cost: 35, costType: 'energy', description: 'Flurry, stacks to STUN', unlocked: false },
      { key: 'R', name: 'Divebomb', cooldown: 0, maxCooldown: 6, cost: 40, costType: 'energy', description: 'Leap crash, STUN 2s', unlocked: false },
      { key: 'F', name: 'Shadow Step', cooldown: 0, maxCooldown: 10, cost: 0, costType: 'energy', description: 'INVISIBLE 5s', unlocked: false },
    ]
  },
  {
    type: 'scythe',
    name: 'Scythe',
    icon: '🦋',
    subclass: 'WEAVER',
    color: '#4169e1',
    resourceType: 'mana',
    abilities: [
      { key: 'Q', name: 'Sunwell', cooldown: 0, maxCooldown: 1, cost: 30, costType: 'mana', description: 'Heal 60 HP', unlocked: true },
      { key: 'E', name: 'Coldsnap', cooldown: 0, maxCooldown: 12, cost: 50, costType: 'mana', description: 'FREEZE enemies 6s', unlocked: false },
      { key: 'R', name: 'Crossentropy', cooldown: 0, maxCooldown: 2, cost: 40, costType: 'mana', description: 'Plasma bolt, +10 per BURN stack', unlocked: false },
      { key: 'F', name: 'Mantra', cooldown: 0, maxCooldown: 5, cost: 75, costType: 'mana', description: 'Healing totem 8s', unlocked: false },
    ]
  },
  {
    type: 'runeblade',
    name: 'Runeblade',
    icon: '🔮',
    subclass: 'TEMPLAR',
    color: '#9400d3',
    resourceType: 'mana',
    abilities: [
      { key: 'Q', name: 'Void Grasp', cooldown: 0, maxCooldown: 5, cost: 35, costType: 'mana', description: 'Pull enemy towards you', unlocked: true },
      { key: 'E', name: 'Wraithblade', cooldown: 0, maxCooldown: 3, cost: 35, costType: 'mana', description: 'CORRUPTED, 90% slow', unlocked: false },
      { key: 'R', name: 'Hexed Smite', cooldown: 0, maxCooldown: 3, cost: 45, costType: 'mana', description: 'AoE damage, heal same amount', unlocked: false },
      { key: 'F', name: 'Heartrend', cooldown: 0, maxCooldown: 0, cost: 24, costType: 'mana', description: 'Toggle: +45% crit, +75% crit dmg', unlocked: false },
    ]
  }
];

export default function Avernus3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameInitializedRef = useRef(false);
  const gameLoopIdRef = useRef<number | null>(null);
  
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [selectedWeapons, setSelectedWeapons] = useState<{ primary: WeaponType | null; secondary: WeaponType | null }>({ primary: null, secondary: null });
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType | null>(null);
  
  const [playerHealth, setPlayerHealth] = useState(1000);
  const [maxHealth] = useState(1000);
  const [playerShield, setPlayerShield] = useState(100);
  const [maxShield] = useState(100);
  const [resource, setResource] = useState(100);
  const [maxResource] = useState(100);
  
  const [level, setLevel] = useState(1);
  const [experience, setExperience] = useState(0);
  const [kills, setKills] = useState(0);
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const weaponGroupRef = useRef<THREE.Group | null>(null);
  const enemiesRef = useRef<EnemyUnit[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const groundRingsRef = useRef<GroundRing[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const clockRef = useRef(new THREE.Clock());
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef({ x: 0, y: 0, down: false });
  const attackAnimRef = useRef({ active: false, timer: 0 });
  const cameraShakeRef = useRef({ active: false, timer: 0, intensity: 0 });
  const spawnTimerRef = useRef(0);
  const currentWeaponRef = useRef<WeaponType | null>(null);
  const selectedWeaponsRef = useRef<{ primary: WeaponType | null; secondary: WeaponType | null }>({ primary: null, secondary: null });
  
  const playerPosRef = useRef(new THREE.Vector3(0, 0, 0));
  const playerRotRef = useRef(0);
  const playerPartsRef = useRef<{
    torso?: THREE.Object3D;
    head?: THREE.Object3D;
    leftUpperArm?: THREE.Object3D;
    leftForearm?: THREE.Object3D;
    rightUpperArm?: THREE.Object3D;
    rightForearm?: THREE.Object3D;
    leftUpperLeg?: THREE.Object3D;
    leftLowerLeg?: THREE.Object3D;
    rightUpperLeg?: THREE.Object3D;
    rightLowerLeg?: THREE.Object3D;
    cape?: THREE.Object3D;
    leftShoulder?: THREE.Object3D;
    rightShoulder?: THREE.Object3D;
  }>({});

  const gameStateRef = useRef(gameState);
  const killsRef = useRef(0);
  const experienceRef = useRef(0);
  const levelRef = useRef(1);
  const playerHealthRef = useRef(1000);

  const handleWeaponSelect = useCallback((weapon: WeaponType) => {
    setSelectedWeapons(prev => {
      if (prev.primary === weapon) return { ...prev, primary: null };
      if (prev.secondary === weapon) return { ...prev, secondary: null };
      if (!prev.primary) return { ...prev, primary: weapon };
      if (!prev.secondary) return { ...prev, secondary: weapon };
      return prev;
    });
  }, []);

  const startGame = useCallback(() => {
    if (!selectedWeapons.primary || !selectedWeapons.secondary) return;
    setCurrentWeapon(selectedWeapons.primary);
    currentWeaponRef.current = selectedWeapons.primary;
    selectedWeaponsRef.current = selectedWeapons;
    setGameState('playing');
    gameStateRef.current = 'playing';
    setPlayerHealth(1000);
    playerHealthRef.current = 1000;
    setPlayerShield(100);
    setResource(100);
    setLevel(1);
    levelRef.current = 1;
    setExperience(0);
    experienceRef.current = 0;
    setKills(0);
    killsRef.current = 0;
  }, [selectedWeapons]);

  const createWeaponModel = useCallback((type: WeaponType): THREE.Group => {
    const group = new THREE.Group();
    const weapon = WEAPONS.find(w => w.type === type);
    const color = weapon ? weapon.color : '#ffffff';
    
    if (type === 'greatsword') {
      const bladeGeom = new THREE.BoxGeometry(0.15, 2.5, 0.08);
      const bladeMat = new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.2 });
      const blade = new THREE.Mesh(bladeGeom, bladeMat);
      blade.position.y = 1.5;
      group.add(blade);
      const guardGeom = new THREE.BoxGeometry(0.6, 0.1, 0.15);
      const guard = new THREE.Mesh(guardGeom, bladeMat);
      guard.position.y = 0.2;
      group.add(guard);
      const handleGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
      const handleMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
      const handle = new THREE.Mesh(handleGeom, handleMat);
      handle.position.y = -0.1;
      group.add(handle);
    } else if (type === 'bow') {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.8, 0.3),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.8, 0.3)
      ]);
      const tubeGeom = new THREE.TubeGeometry(curve, 20, 0.03, 8, false);
      const bowMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
      const bow = new THREE.Mesh(tubeGeom, bowMat);
      group.add(bow);
      const stringGeom = new THREE.CylinderGeometry(0.005, 0.005, 1.6, 4);
      const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const bowString = new THREE.Mesh(stringGeom, stringMat);
      bowString.position.z = 0.15;
      group.add(bowString);
    } else if (type === 'sabres') {
      for (let i = 0; i < 2; i++) {
        const bladeGeom = new THREE.BoxGeometry(0.08, 1.2, 0.02);
        const bladeMat = new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.1 });
        const blade = new THREE.Mesh(bladeGeom, bladeMat);
        blade.position.set(i === 0 ? -0.15 : 0.15, 0.8, 0);
        blade.rotation.z = i === 0 ? 0.1 : -0.1;
        group.add(blade);
      }
    } else if (type === 'scythe') {
      const staffGeom = new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8);
      const staffMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
      const staff = new THREE.Mesh(staffGeom, staffMat);
      group.add(staff);
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0, 0);
      bladeShape.quadraticCurveTo(0.8, 0.2, 1.2, 0);
      bladeShape.quadraticCurveTo(0.8, -0.1, 0, -0.15);
      const bladeGeom = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.02, bevelEnabled: false });
      const bladeMat = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.2 });
      const blade = new THREE.Mesh(bladeGeom, bladeMat);
      blade.position.set(0, 1.25, 0);
      blade.rotation.z = -Math.PI / 6;
      group.add(blade);
    } else if (type === 'runeblade') {
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0, 0);
      bladeShape.lineTo(-0.1, 0.1);
      bladeShape.quadraticCurveTo(0.8, 0.05, 1.8, 0.2);
      bladeShape.lineTo(1.8, -0.1);
      bladeShape.quadraticCurveTo(0.8, -0.2, 0, -0.15);
      bladeShape.lineTo(0, 0);
      const bladeGeom = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01 });
      const bladeMat = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3, emissive: color, emissiveIntensity: 0.3 });
      const blade = new THREE.Mesh(bladeGeom, bladeMat);
      blade.rotation.z = -Math.PI / 4;
      blade.position.y = 0.5;
      group.add(blade);
    }
    
    return group;
  }, []);

  const createPlayerModel = useCallback((): THREE.Group => {
    const group = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, metalness: 0.6, roughness: 0.4 });
    const armorTrimMat = new THREE.MeshStandardMaterial({ color: 0x666688, metalness: 0.8, roughness: 0.2 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });

    const torso = new THREE.Group();
    torso.position.y = 1.2;
    const chestGeom = new THREE.BoxGeometry(0.6, 0.7, 0.35);
    const chest = new THREE.Mesh(chestGeom, armorMat);
    chest.castShadow = true;
    torso.add(chest);
    const chestPlateGeom = new THREE.BoxGeometry(0.5, 0.5, 0.05);
    const chestPlate = new THREE.Mesh(chestPlateGeom, armorTrimMat);
    chestPlate.position.z = 0.2;
    torso.add(chestPlate);
    group.add(torso);
    playerPartsRef.current.torso = torso;

    const leftShoulderPivot = new THREE.Group();
    leftShoulderPivot.position.set(-0.4, 0.3, 0);
    const leftShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0x3a3a4a, metalness: 0.7, roughness: 0.3, emissive: 0x222244, emissiveIntensity: 0.3 }));
    leftShoulderPivot.add(leftShoulder);
    torso.add(leftShoulderPivot);
    playerPartsRef.current.leftShoulder = leftShoulderPivot;

    const rightShoulderPivot = new THREE.Group();
    rightShoulderPivot.position.set(0.4, 0.3, 0);
    const rightShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0x3a3a4a, metalness: 0.7, roughness: 0.3, emissive: 0x222244, emissiveIntensity: 0.3 }));
    rightShoulderPivot.add(rightShoulder);
    torso.add(rightShoulderPivot);
    playerPartsRef.current.rightShoulder = rightShoulderPivot;

    const leftUpperArm = new THREE.Group();
    leftUpperArm.position.set(-0.45, 0.15, 0);
    const lUpperArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.4, 8), armorMat);
    lUpperArmMesh.position.y = -0.2;
    lUpperArmMesh.castShadow = true;
    leftUpperArm.add(lUpperArmMesh);
    const leftForearm = new THREE.Group();
    leftForearm.position.y = -0.4;
    const lForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.35, 8), armorMat);
    lForearmMesh.position.y = -0.175;
    lForearmMesh.castShadow = true;
    leftForearm.add(lForearmMesh);
    leftUpperArm.add(leftForearm);
    torso.add(leftUpperArm);
    playerPartsRef.current.leftUpperArm = leftUpperArm;
    playerPartsRef.current.leftForearm = leftForearm;

    const rightUpperArm = new THREE.Group();
    rightUpperArm.position.set(0.45, 0.15, 0);
    const rUpperArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.4, 8), armorMat);
    rUpperArmMesh.position.y = -0.2;
    rUpperArmMesh.castShadow = true;
    rightUpperArm.add(rUpperArmMesh);
    const rightForearm = new THREE.Group();
    rightForearm.position.y = -0.4;
    const rForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.35, 8), armorMat);
    rForearmMesh.position.y = -0.175;
    rForearmMesh.castShadow = true;
    rightForearm.add(rForearmMesh);
    rightUpperArm.add(rightForearm);
    torso.add(rightUpperArm);
    playerPartsRef.current.rightUpperArm = rightUpperArm;
    playerPartsRef.current.rightForearm = rightForearm;

    const headGroup = new THREE.Group();
    headGroup.position.y = 1.65;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skinMat);
    head.castShadow = true;
    headGroup.add(head);
    const helmetGeom = new THREE.BoxGeometry(0.42, 0.3, 0.4);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.8, roughness: 0.2 });
    const helmet = new THREE.Mesh(helmetGeom, helmetMat);
    helmet.position.y = 0.05;
    helmet.castShadow = true;
    headGroup.add(helmet);
    const visorGeom = new THREE.BoxGeometry(0.35, 0.08, 0.05);
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x0066aa, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.1 });
    const visor = new THREE.Mesh(visorGeom, visorMat);
    visor.position.set(0, 0.02, 0.2);
    headGroup.add(visor);
    group.add(headGroup);
    playerPartsRef.current.head = headGroup;

    const hipGroup = new THREE.Group();
    hipGroup.position.y = 0.75;
    const hipGeom = new THREE.BoxGeometry(0.4, 0.2, 0.3);
    const hip = new THREE.Mesh(hipGeom, armorMat);
    hipGroup.add(hip);
    group.add(hipGroup);

    const leftUpperLeg = new THREE.Group();
    leftUpperLeg.position.set(-0.15, 0.65, 0);
    const lUpperLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.4, 8), armorMat);
    lUpperLegMesh.position.y = -0.2;
    lUpperLegMesh.castShadow = true;
    leftUpperLeg.add(lUpperLegMesh);
    const leftLowerLeg = new THREE.Group();
    leftLowerLeg.position.y = -0.4;
    const lLowerLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.35, 8), armorMat);
    lLowerLegMesh.position.y = -0.175;
    lLowerLegMesh.castShadow = true;
    leftLowerLeg.add(lLowerLegMesh);
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.2), armorTrimMat);
    leftBoot.position.set(0, -0.4, 0.04);
    leftLowerLeg.add(leftBoot);
    leftUpperLeg.add(leftLowerLeg);
    group.add(leftUpperLeg);
    playerPartsRef.current.leftUpperLeg = leftUpperLeg;
    playerPartsRef.current.leftLowerLeg = leftLowerLeg;

    const rightUpperLeg = new THREE.Group();
    rightUpperLeg.position.set(0.15, 0.65, 0);
    const rUpperLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.4, 8), armorMat);
    rUpperLegMesh.position.y = -0.2;
    rUpperLegMesh.castShadow = true;
    rightUpperLeg.add(rUpperLegMesh);
    const rightLowerLeg = new THREE.Group();
    rightLowerLeg.position.y = -0.4;
    const rLowerLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.35, 8), armorMat);
    rLowerLegMesh.position.y = -0.175;
    rLowerLegMesh.castShadow = true;
    rightLowerLeg.add(rLowerLegMesh);
    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.2), armorTrimMat);
    rightBoot.position.set(0, -0.4, 0.04);
    rightLowerLeg.add(rightBoot);
    rightUpperLeg.add(rightLowerLeg);
    group.add(rightUpperLeg);
    playerPartsRef.current.rightUpperLeg = rightUpperLeg;
    playerPartsRef.current.rightLowerLeg = rightLowerLeg;

    const cape = new THREE.Group();
    cape.position.set(0, 1.45, -0.2);
    const capeMat = new THREE.MeshStandardMaterial({ color: 0x220033, side: THREE.DoubleSide });
    const capeGeom = new THREE.PlaneGeometry(0.5, 0.9);
    const capeMesh = new THREE.Mesh(capeGeom, capeMat);
    capeMesh.position.y = -0.45;
    cape.add(capeMesh);
    group.add(cape);
    playerPartsRef.current.cape = cape;

    return group;
  }, []);

  const createSkeletonEnemy = useCallback((scene: THREE.Scene, pos: THREE.Vector3): EnemyUnit => {
    const group = new THREE.Group();
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xccccaa, roughness: 0.6 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 6), boneMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), boneMat);
    skull.position.y = 1.55;
    skull.castShadow = true;
    group.add(skull);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.0 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    leftEye.position.set(-0.07, 1.58, 0.14);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    rightEye.position.set(0.07, 1.58, 0.14);
    group.add(rightEye);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.2, 1.3, 0);
    const lArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), boneMat);
    lArmMesh.position.y = -0.25;
    leftArm.add(lArmMesh);
    group.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.2, 1.3, 0);
    const rArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), boneMat);
    rArmMesh.position.y = -0.25;
    rightArm.add(rArmMesh);
    group.add(rightArm);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.1, 0.55, 0);
    const lLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.55, 4), boneMat);
    lLegMesh.position.y = -0.275;
    leftLeg.add(lLegMesh);
    group.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.1, 0.55, 0);
    const rLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.55, 4), boneMat);
    rLegMesh.position.y = -0.275;
    rightLeg.add(rLegMesh);
    group.add(rightLeg);

    group.position.copy(pos);
    scene.add(group);

    return {
      mesh: group, health: 150, maxHealth: 150, type: 'skeleton',
      position: pos.clone(), speed: 3.5, attackCooldown: 0, isDying: false, deathTimer: 0,
      hitFlashTimer: 0, originalEmissives: new Map(),
      parts: { leftArm, rightArm, leftLeg, rightLeg, body }
    };
  }, []);

  const createDemonEnemy = useCallback((scene: THREE.Scene, pos: THREE.Vector3): EnemyUnit => {
    const group = new THREE.Group();
    const demonMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0x330000, emissiveIntensity: 0.4, roughness: 0.5 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), demonMat);
    body.position.y = 1.2;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), demonMat);
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5 });
    const leftHorn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), hornMat);
    leftHorn.position.set(-0.15, 2.05, 0);
    leftHorn.rotation.z = 0.3;
    group.add(leftHorn);
    const rightHorn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), hornMat);
    rightHorn.position.set(0.15, 2.05, 0);
    rightHorn.rotation.z = -0.3;
    group.add(rightHorn);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.5, 1.3, 0);
    const lArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.6, 8), demonMat);
    lArmMesh.position.y = -0.3;
    leftArm.add(lArmMesh);
    group.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.5, 1.3, 0);
    const rArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.6, 8), demonMat);
    rArmMesh.position.y = -0.3;
    rightArm.add(rArmMesh);
    group.add(rightArm);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.2, 0.65, 0);
    const lLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.65, 8), demonMat);
    lLegMesh.position.y = -0.325;
    leftLeg.add(lLegMesh);
    group.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.2, 0.65, 0);
    const rLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.65, 8), demonMat);
    rLegMesh.position.y = -0.325;
    rightLeg.add(rLegMesh);
    group.add(rightLeg);

    group.position.copy(pos);
    scene.add(group);

    return {
      mesh: group, health: 300, maxHealth: 300, type: 'demon',
      position: pos.clone(), speed: 2.0, attackCooldown: 0, isDying: false, deathTimer: 0,
      hitFlashTimer: 0, originalEmissives: new Map(),
      parts: { leftArm, rightArm, leftLeg, rightLeg, body }
    };
  }, []);

  const createWraithEnemy = useCallback((scene: THREE.Scene, pos: THREE.Vector3): EnemyUnit => {
    const group = new THREE.Group();
    const wraithMat = new THREE.MeshPhysicalMaterial({
      color: 0x6644aa, transmission: 0.6, thickness: 0.5,
      roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.7
    });

    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), wraithMat);
    bodyMesh.position.y = 1.5;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    const innerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xaa66ff, emissive: 0x8844cc, emissiveIntensity: 1.0 })
    );
    innerGlow.position.y = 1.5;
    group.add(innerGlow);

    const tailGeom = new THREE.ConeGeometry(0.3, 0.8, 8);
    const tail = new THREE.Mesh(tailGeom, wraithMat);
    tail.position.y = 0.9;
    tail.rotation.x = Math.PI;
    group.add(tail);

    group.position.copy(pos);
    scene.add(group);

    return {
      mesh: group, health: 100, maxHealth: 100, type: 'wraith',
      position: pos.clone(), speed: 4.0, attackCooldown: 0, isDying: false, deathTimer: 0,
      hitFlashTimer: 0, originalEmissives: new Map(),
      parts: { body: bodyMesh }
    };
  }, []);

  const spawnParticleBurst = useCallback((scene: THREE.Scene, pos: THREE.Vector3, color: number, count: number, type: Particle['type']) => {
    for (let i = 0; i < count; i++) {
      const geom = new THREE.SphereGeometry(0.06, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(pos);
      scene.add(mesh);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 6
      );
      particlesRef.current.push({ mesh, velocity: vel, lifetime: 1.0, maxLifetime: 1.0, type });
    }
  }, []);

  const spawnXpOrb = useCallback((scene: THREE.Scene, pos: THREE.Vector3) => {
    const geom = new THREE.SphereGeometry(0.12, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 1.0 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);
    mesh.position.y += 0.5;
    scene.add(mesh);
    particlesRef.current.push({
      mesh, velocity: new THREE.Vector3(0, 2, 0), lifetime: 3.0, maxLifetime: 3.0,
      type: 'xp', targetPos: playerPosRef.current
    });
  }, []);

  const spawnGroundRing = useCallback((scene: THREE.Scene, pos: THREE.Vector3, color: number) => {
    const geom = new THREE.TorusGeometry(0.3, 0.05, 8, 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);
    mesh.position.y = 0.05;
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    groundRingsRef.current.push({ mesh, lifetime: 0.8, maxLifetime: 0.8 });
  }, []);

  const createArena = useCallback((scene: THREE.Scene) => {
    const groundGeom = new THREE.CircleGeometry(30, 64);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3040, roughness: 0.8, metalness: 0.2 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    const lavaGeom = new THREE.RingGeometry(30, 50, 64);
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff6622 });
    const lava = new THREE.Mesh(lavaGeom, lavaMat);
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = -0.1;
    scene.add(lava);
    
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const pillarGeom = new THREE.CylinderGeometry(1, 1.2, 4, 8);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
      const pillar = new THREE.Mesh(pillarGeom, pillarMat);
      pillar.position.set(Math.cos(angle) * 25, 2, Math.sin(angle) * 25);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      scene.add(pillar);
    }
  }, []);

  useEffect(() => {
    if (gameState !== 'playing' || !containerRef.current || gameInitializedRef.current) return;
    
    gameInitializedRef.current = true;
    const container = containerRef.current;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1020);
    scene.fog = new THREE.Fog(0x1a1020, 30, 80);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(0, 15, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    const ambientLight = new THREE.AmbientLight(0x8888aa, 1.2);
    scene.add(ambientLight);
    const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x443322, 0.8);
    scene.add(hemiLight);
    const sunLight = new THREE.DirectionalLight(0xff8844, 2.0);
    sunLight.position.set(10, 30, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -40;
    sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 40;
    sunLight.shadow.camera.bottom = -40;
    scene.add(sunLight);
    const fillLight = new THREE.PointLight(0x4466ff, 1.0, 60);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);
    const lavaLight = new THREE.PointLight(0xff4400, 1.5, 40);
    lavaLight.position.set(0, 2, 0);
    scene.add(lavaLight);
    
    createArena(scene);
    
    const player = createPlayerModel();
    player.position.set(-15, 0, 0);
    playerPosRef.current.copy(player.position);
    scene.add(player);
    playerRef.current = player;
    
    if (currentWeapon) {
      const weaponModel = createWeaponModel(currentWeapon);
      weaponModel.position.set(0.5, 1.0, 0.3);
      weaponModel.scale.set(0.5, 0.5, 0.5);
      weaponModel.name = 'weapon';
      player.add(weaponModel);
      weaponGroupRef.current = weaponModel;
    }
    
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'Digit1' && selectedWeaponsRef.current.primary) {
        const newWeapon = selectedWeaponsRef.current.primary;
        currentWeaponRef.current = newWeapon;
        setCurrentWeapon(newWeapon);
        if (playerRef.current) {
          const old = playerRef.current.getObjectByName('weapon');
          if (old) playerRef.current.remove(old);
          const wm = createWeaponModel(newWeapon);
          wm.position.set(0.5, 1.0, 0.3);
          wm.scale.set(0.5, 0.5, 0.5);
          wm.name = 'weapon';
          playerRef.current.add(wm);
          weaponGroupRef.current = wm;
        }
      }
      if (e.code === 'Digit2' && selectedWeaponsRef.current.secondary) {
        const newWeapon = selectedWeaponsRef.current.secondary;
        currentWeaponRef.current = newWeapon;
        setCurrentWeapon(newWeapon);
        if (playerRef.current) {
          const old = playerRef.current.getObjectByName('weapon');
          if (old) playerRef.current.remove(old);
          const wm = createWeaponModel(newWeapon);
          wm.position.set(0.5, 1.0, 0.3);
          wm.scale.set(0.5, 0.5, 0.5);
          wm.name = 'weapon';
          playerRef.current.add(wm);
          weaponGroupRef.current = wm;
        }
      }
      if (['KeyQ', 'KeyE', 'KeyR', 'KeyF'].includes(e.code) && playerRef.current && sceneRef.current) {
        const abilityColors: Record<string, number> = {
          'KeyQ': 0x00ffff, 'KeyE': 0xff8800, 'KeyR': 0xff00ff, 'KeyF': 0xffff00
        };
        const col = abilityColors[e.code] || 0xffffff;
        const castPos = playerRef.current.position.clone();
        castPos.y += 1;
        spawnParticleBurst(sceneRef.current, castPos, col, 35, 'ability');
        spawnGroundRing(sceneRef.current, playerRef.current.position.clone(), col);
        cameraShakeRef.current = { active: true, timer: 0.2, intensity: 0.3 };
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const onMouseDown = () => {
      mouseRef.current.down = true;
      if (!attackAnimRef.current.active) {
        attackAnimRef.current = { active: true, timer: 0.3 };
        if (playerRef.current && sceneRef.current) {
          const attackPos = playerRef.current.position.clone();
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerRef.current.quaternion);
          attackPos.add(forward.multiplyScalar(2));
          attackPos.y += 1;

          enemiesRef.current.forEach(enemy => {
            if (enemy.isDying) return;
            const dist = enemy.mesh.position.distanceTo(playerRef.current!.position);
            if (dist < 3.5) {
              const dmg = 50 + Math.random() * 30;
              enemy.health -= dmg;
              enemy.hitFlashTimer = 0.1;
              enemy.originalEmissives.clear();
              enemy.mesh.traverse((child) => {
                if (child instanceof THREE.Mesh && child.material) {
                  const mat = child.material as THREE.MeshStandardMaterial;
                  if (mat.emissive) {
                    enemy.originalEmissives.set(child, mat.emissive.clone());
                    mat.emissive.set(0xffffff);
                    mat.emissiveIntensity = 1.0;
                  }
                }
              });
            }
          });
        }
      }
    };
    const onMouseUp = () => { mouseRef.current.down = false; };
    
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    let elapsedTime = 0;
    
    const animate = () => {
      const delta = Math.min(clockRef.current.getDelta(), 0.05);
      elapsedTime += delta;
      const keys = keysRef.current;
      
      const moveSpeed = 8 * delta;
      const moveDir = new THREE.Vector3();
      if (keys['KeyW'] || keys['ArrowUp']) moveDir.z -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) moveDir.z += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) moveDir.x -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) moveDir.x += 1;
      
      const isMoving = moveDir.length() > 0;
      if (isMoving) {
        moveDir.normalize().multiplyScalar(moveSpeed);
        playerPosRef.current.add(moveDir);
        const maxDist = 28;
        if (playerPosRef.current.length() > maxDist) {
          playerPosRef.current.normalize().multiplyScalar(maxDist);
        }
        playerRotRef.current = Math.atan2(moveDir.x, moveDir.z);
      }
      
      if (playerRef.current) {
        playerRef.current.position.lerp(playerPosRef.current, 0.15);
        playerRef.current.rotation.y = playerRotRef.current;

        const parts = playerPartsRef.current;
        if (isMoving) {
          const walkSpeed = 8;
          const walkAmp = 0.5;
          if (parts.leftUpperArm) parts.leftUpperArm.rotation.x = Math.sin(elapsedTime * walkSpeed) * walkAmp;
          if (parts.rightUpperArm) parts.rightUpperArm.rotation.x = -Math.sin(elapsedTime * walkSpeed) * walkAmp;
          if (parts.leftForearm) parts.leftForearm.rotation.x = -Math.abs(Math.sin(elapsedTime * walkSpeed)) * 0.3;
          if (parts.rightForearm) parts.rightForearm.rotation.x = -Math.abs(Math.sin(elapsedTime * walkSpeed)) * 0.3;
          if (parts.leftUpperLeg) parts.leftUpperLeg.rotation.x = -Math.sin(elapsedTime * walkSpeed) * walkAmp;
          if (parts.rightUpperLeg) parts.rightUpperLeg.rotation.x = Math.sin(elapsedTime * walkSpeed) * walkAmp;
          if (parts.leftLowerLeg) parts.leftLowerLeg.rotation.x = Math.abs(Math.sin(elapsedTime * walkSpeed)) * 0.4;
          if (parts.rightLowerLeg) parts.rightLowerLeg.rotation.x = Math.abs(Math.sin(elapsedTime * walkSpeed)) * 0.4;
          if (parts.cape) parts.cape.rotation.x = Math.sin(elapsedTime * walkSpeed * 0.5) * 0.15;
        } else {
          const idleSpeed = 2;
          const idleBob = Math.sin(elapsedTime * idleSpeed) * 0.03;
          if (parts.torso) parts.torso.position.y = 1.2 + idleBob;
          if (parts.head) parts.head.position.y = 1.65 + idleBob;
          if (parts.leftUpperArm) parts.leftUpperArm.rotation.x *= 0.9;
          if (parts.rightUpperArm) parts.rightUpperArm.rotation.x *= 0.9;
          if (parts.leftUpperLeg) parts.leftUpperLeg.rotation.x *= 0.9;
          if (parts.rightUpperLeg) parts.rightUpperLeg.rotation.x *= 0.9;
          if (parts.leftLowerLeg) parts.leftLowerLeg.rotation.x *= 0.9;
          if (parts.rightLowerLeg) parts.rightLowerLeg.rotation.x *= 0.9;
          if (parts.cape) parts.cape.rotation.x = Math.sin(elapsedTime * 1.5) * 0.05;
        }

        if (attackAnimRef.current.active) {
          attackAnimRef.current.timer -= delta;
          const progress = 1 - (attackAnimRef.current.timer / 0.3);
          if (parts.rightUpperArm) {
            parts.rightUpperArm.rotation.x = progress < 0.5
              ? -progress * 2 * 1.5
              : -(1 - (progress - 0.5) * 2) * 1.5;
          }
          if (attackAnimRef.current.timer <= 0) {
            attackAnimRef.current.active = false;
          }
        }
      }
      
      if (camera && playerRef.current) {
        const targetCamPos = new THREE.Vector3(
          playerRef.current.position.x,
          12,
          playerRef.current.position.z + 15
        );
        camera.position.lerp(targetCamPos, 0.05);
        camera.lookAt(playerRef.current.position);

        if (cameraShakeRef.current.active) {
          cameraShakeRef.current.timer -= delta;
          const intensity = cameraShakeRef.current.intensity;
          camera.position.x += (Math.random() - 0.5) * intensity;
          camera.position.y += (Math.random() - 0.5) * intensity;
          if (cameraShakeRef.current.timer <= 0) {
            cameraShakeRef.current.active = false;
          }
        }
      }

      spawnTimerRef.current -= delta;
      if (spawnTimerRef.current <= 0) {
        spawnTimerRef.current = 3 + Math.random() * 2;
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 5;
        const spawnPos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
        const typeRoll = Math.random();
        if (typeRoll < 0.4) {
          enemiesRef.current.push(createSkeletonEnemy(scene, spawnPos));
        } else if (typeRoll < 0.7) {
          enemiesRef.current.push(createDemonEnemy(scene, spawnPos));
        } else {
          enemiesRef.current.push(createWraithEnemy(scene, spawnPos));
        }
      }

      for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
        const enemy = enemiesRef.current[i];

        if (enemy.isDying) {
          enemy.deathTimer -= delta;
          const s = Math.max(0, enemy.deathTimer / 0.5);
          enemy.mesh.scale.set(s, s, s);
          if (enemy.deathTimer <= 0) {
            scene.remove(enemy.mesh);
            enemiesRef.current.splice(i, 1);
          }
          continue;
        }

        if (enemy.hitFlashTimer > 0) {
          enemy.hitFlashTimer -= delta;
          if (enemy.hitFlashTimer <= 0) {
            enemy.mesh.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material) {
                const mat = child.material as THREE.MeshStandardMaterial;
                const orig = enemy.originalEmissives.get(child);
                if (orig && mat.emissive) {
                  mat.emissive.copy(orig);
                  mat.emissiveIntensity = mat === child.material ? 0.4 : 0;
                }
              }
            });
          }
        }

        if (enemy.health <= 0) {
          enemy.isDying = true;
          enemy.deathTimer = 0.5;
          const deathColor = enemy.type === 'skeleton' ? 0xccccaa : enemy.type === 'demon' ? 0xff3300 : 0xaa66ff;
          spawnParticleBurst(scene, enemy.mesh.position.clone().setY(1), deathColor, 20, 'death');
          spawnXpOrb(scene, enemy.mesh.position.clone());
          killsRef.current += 1;
          setKills(killsRef.current);
          experienceRef.current += 25;
          if (experienceRef.current >= levelRef.current * 100) {
            experienceRef.current -= levelRef.current * 100;
            levelRef.current += 1;
            setLevel(levelRef.current);
          }
          setExperience(experienceRef.current);
          continue;
        }

        if (playerRef.current) {
          const toPlayer = new THREE.Vector3().subVectors(playerRef.current.position, enemy.mesh.position);
          toPlayer.y = 0;
          const dist = toPlayer.length();

          if (dist > 0.1) {
            enemy.mesh.lookAt(new THREE.Vector3(playerRef.current.position.x, enemy.mesh.position.y, playerRef.current.position.z));
          }

          if (dist > 2) {
            toPlayer.normalize().multiplyScalar(enemy.speed * delta);
            enemy.mesh.position.add(toPlayer);
            enemy.position.copy(enemy.mesh.position);

            const walkFreq = enemy.speed * 2;
            if (enemy.parts.leftArm) enemy.parts.leftArm.rotation.x = Math.sin(elapsedTime * walkFreq) * 0.4;
            if (enemy.parts.rightArm) enemy.parts.rightArm.rotation.x = -Math.sin(elapsedTime * walkFreq) * 0.4;
            if (enemy.parts.leftLeg) enemy.parts.leftLeg.rotation.x = -Math.sin(elapsedTime * walkFreq) * 0.4;
            if (enemy.parts.rightLeg) enemy.parts.rightLeg.rotation.x = Math.sin(elapsedTime * walkFreq) * 0.4;
          } else {
            enemy.attackCooldown -= delta;
            if (enemy.attackCooldown <= 0) {
              enemy.attackCooldown = enemy.type === 'demon' ? 1.5 : enemy.type === 'wraith' ? 2.0 : 1.0;
              const dmg = enemy.type === 'demon' ? 40 : enemy.type === 'wraith' ? 25 : 20;
              playerHealthRef.current = Math.max(0, playerHealthRef.current - dmg);
              setPlayerHealth(playerHealthRef.current);

              if (enemy.type === 'demon') {
                spawnGroundRing(scene, enemy.mesh.position.clone(), 0xff3300);
              }

              if (enemy.type === 'wraith') {
                const boltGeom = new THREE.SphereGeometry(0.1, 6, 6);
                const boltMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff });
                const bolt = new THREE.Mesh(boltGeom, boltMat);
                bolt.position.copy(enemy.mesh.position);
                bolt.position.y = 1.5;
                scene.add(bolt);
                const dir = new THREE.Vector3().subVectors(playerRef.current.position, bolt.position).normalize().multiplyScalar(12);
                projectilesRef.current.push({ mesh: bolt, velocity: dir, damage: 25, team: 'enemy', type: 'magic_bolt', lifetime: 3 });
              }

              if (enemy.parts.rightArm) {
                enemy.parts.rightArm.rotation.x = -1.2;
                setTimeout(() => { if (enemy.parts.rightArm) enemy.parts.rightArm.rotation.x = 0; }, 200);
              }
            }
          }

          if (enemy.type === 'wraith') {
            enemy.mesh.position.y = Math.sin(elapsedTime * 2) * 0.2;
            if (Math.random() < 0.1) {
              const trailGeom = new THREE.SphereGeometry(0.05, 4, 4);
              const trailMat = new THREE.MeshBasicMaterial({ color: 0x8844cc, transparent: true, opacity: 0.6 });
              const trailMesh = new THREE.Mesh(trailGeom, trailMat);
              trailMesh.position.copy(enemy.mesh.position);
              trailMesh.position.y += 1.0 + Math.random() * 0.5;
              scene.add(trailMesh);
              particlesRef.current.push({
                mesh: trailMesh, velocity: new THREE.Vector3(0, 0.5, 0),
                lifetime: 0.5, maxLifetime: 0.5, type: 'wraith_trail'
              });
            }
          }
        }
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.lifetime -= delta;
        p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
        p.velocity.y -= 6 * delta;
        const alpha = Math.max(0, p.lifetime / p.maxLifetime);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
        p.mesh.scale.setScalar(alpha);

        if (p.type === 'xp' && p.targetPos && p.lifetime < p.maxLifetime * 0.5) {
          const toTarget = new THREE.Vector3().subVectors(p.targetPos, p.mesh.position);
          p.velocity.copy(toTarget.normalize().multiplyScalar(8));
          p.velocity.y += 2;
        }

        if (p.lifetime <= 0) {
          scene.remove(p.mesh);
          particlesRef.current.splice(i, 1);
        }
      }

      for (let i = groundRingsRef.current.length - 1; i >= 0; i--) {
        const ring = groundRingsRef.current[i];
        ring.lifetime -= delta;
        const progress = 1 - (ring.lifetime / ring.maxLifetime);
        const s = 1 + progress * 5;
        ring.mesh.scale.set(s, s, 1);
        (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
        if (ring.lifetime <= 0) {
          scene.remove(ring.mesh);
          groundRingsRef.current.splice(i, 1);
        }
      }

      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const proj = projectilesRef.current[i];
        proj.mesh.position.add(proj.velocity.clone().multiplyScalar(delta));
        proj.lifetime -= delta;
        if (proj.lifetime <= 0 || proj.mesh.position.length() > 50) {
          scene.remove(proj.mesh);
          projectilesRef.current.splice(i, 1);
        }
      }
      
      renderer.render(scene, camera);
      gameLoopIdRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      if (gameLoopIdRef.current) cancelAnimationFrame(gameLoopIdRef.current);
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      gameInitializedRef.current = false;
      enemiesRef.current = [];
      particlesRef.current = [];
      groundRingsRef.current = [];
      projectilesRef.current = [];
    };
  }, [gameState, currentWeapon, createArena, createPlayerModel, createWeaponModel, createSkeletonEnemy, createDemonEnemy, createWraithEnemy, spawnParticleBurst, spawnXpOrb, spawnGroundRing]);

  const getCurrentWeaponData = useCallback(() => {
    return WEAPONS.find(w => w.type === currentWeapon);
  }, [currentWeapon]);

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white">
        <div className="absolute top-4 left-4 z-10">
          <Link href="/super-engine">
            <Button variant="outline" className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-black">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
        
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <h1 className="text-6xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-purple-500">
            🌋 AVERNUS
          </h1>
          <p className="text-xl text-gray-300 mb-8">1v1 PVP 3D Action Combat</p>
          
          <div className="bg-gray-900/80 p-6 rounded-xl border border-purple-500/50 max-w-4xl w-full">
            <h2 className="text-xl font-semibold text-center text-purple-400 mb-4">
              SELECT 2 WEAPONS
            </h2>
            <p className="text-center text-gray-400 text-sm mb-6">
              Primary (1) | Secondary (2)
            </p>
            
            <div className="grid grid-cols-5 gap-3 mb-6">
              {WEAPONS.map(weapon => {
                const isPrimary = selectedWeapons.primary === weapon.type;
                const isSecondary = selectedWeapons.secondary === weapon.type;
                const isSelected = isPrimary || isSecondary;
                const canSelect = !isSelected && !selectedWeapons.primary || !isSelected && !selectedWeapons.secondary || isSelected;
                
                return (
                  <div
                    key={weapon.type}
                    onClick={() => handleWeaponSelect(weapon.type)}
                    className={`
                      p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                      ${isSelected 
                        ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/30' 
                        : canSelect 
                          ? 'border-gray-600 bg-gray-800/50 hover:border-gray-400' 
                          : 'border-gray-700 bg-gray-900/50 opacity-50'
                      }
                    `}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">{weapon.icon}</div>
                      <h3 className="font-bold text-sm">{weapon.name}</h3>
                      <p className="text-xs text-gray-400">{weapon.subclass}</p>
                      {isSelected && (
                        <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${isPrimary ? 'bg-blue-600' : 'bg-orange-600'}`}>
                          {isPrimary ? 'Primary' : 'Secondary'}
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-3 flex justify-center gap-1">
                      {weapon.abilities.map(ability => (
                        <div
                          key={ability.key}
                          className="w-6 h-6 rounded border border-gray-600 bg-gray-700 flex items-center justify-center text-xs"
                          title={`${ability.key}: ${ability.name}`}
                        >
                          {ability.key}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-center">
              <Button
                onClick={startGame}
                disabled={!selectedWeapons.primary || !selectedWeapons.secondary}
                className={`px-8 py-3 text-lg font-bold ${
                  selectedWeapons.primary && selectedWeapons.secondary
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700'
                    : 'bg-gray-600 cursor-not-allowed'
                }`}
              >
                ENTER AVERNUS
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" data-testid="game-canvas" />
      
      <div className="absolute top-4 left-4 z-10">
        <Link href="/super-engine">
          <Button variant="outline" size="sm" className="border-white/50 text-white hover:bg-white/20 bg-black/60 backdrop-blur-sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Exit
          </Button>
        </Link>
      </div>
      
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2">
        <div className="text-center">
          <div className="text-sm text-yellow-300 font-semibold">Level {level}</div>
          <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-yellow-500"
              style={{ width: `${(experience / (level * 100)) * 100}%` }}
            />
          </div>
        </div>
        <div className="text-white font-bold">Kills: {kills}</div>
      </div>
      
      <div className="absolute bottom-20 left-4 z-10 space-y-2 bg-black/60 backdrop-blur-sm rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-red-400 text-sm font-semibold w-12">HP</span>
          <div className="w-48 h-5 bg-gray-700 rounded overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-600 to-red-400"
              style={{ width: `${(playerHealth / maxHealth) * 100}%` }}
            />
          </div>
          <span className="text-white text-sm font-medium">{playerHealth}/{maxHealth}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 text-sm font-semibold w-12">Shield</span>
          <div className="w-48 h-4 bg-gray-700 rounded overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400"
              style={{ width: `${(playerShield / maxShield) * 100}%` }}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-purple-400 text-sm font-semibold w-12">
            {getCurrentWeaponData()?.resourceType.toUpperCase()}
          </span>
          <div className="w-48 h-4 bg-gray-700 rounded overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-purple-400"
              style={{ width: `${(resource / maxResource) * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2">
        {selectedWeapons.primary && (
          <button
            onClick={() => setCurrentWeapon(selectedWeapons.primary)}
            className={`px-3 py-2 rounded border-2 cursor-pointer transition-all ${currentWeapon === selectedWeapons.primary ? 'border-blue-400 bg-blue-500/30 shadow-lg shadow-blue-500/30' : 'border-gray-500 bg-gray-800/60 hover:border-gray-400'}`}
          >
            <span className="text-xs text-gray-300 block">1</span>
            <span className="text-2xl">{WEAPONS.find(w => w.type === selectedWeapons.primary)?.icon}</span>
          </button>
        )}
        {selectedWeapons.secondary && (
          <button
            onClick={() => setCurrentWeapon(selectedWeapons.secondary)}
            className={`px-3 py-2 rounded border-2 cursor-pointer transition-all ${currentWeapon === selectedWeapons.secondary ? 'border-orange-400 bg-orange-500/30 shadow-lg shadow-orange-500/30' : 'border-gray-500 bg-gray-800/60 hover:border-gray-400'}`}
          >
            <span className="text-xs text-gray-300 block">2</span>
            <span className="text-2xl">{WEAPONS.find(w => w.type === selectedWeapons.secondary)?.icon}</span>
          </button>
        )}
        
        <div className="flex gap-2 ml-3">
          {getCurrentWeaponData()?.abilities.map(ability => (
            <div
              key={ability.key}
              className={`w-12 h-12 rounded border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${
                ability.unlocked ? 'border-purple-400 bg-purple-500/30 hover:bg-purple-500/50' : 'border-gray-600 bg-gray-800/50 opacity-40'
              }`}
              title={ability.description}
            >
              <span className="text-xs font-bold text-white">{ability.key}</span>
              <span className="text-[10px] text-gray-300 truncate w-full text-center">{ability.name}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="absolute bottom-4 right-4 z-10 text-right text-white text-sm bg-black/60 backdrop-blur-sm rounded-lg p-3">
        <div className="font-medium text-gray-200">WASD - Move</div>
        <div className="font-medium text-gray-200">Mouse - Aim</div>
        <div className="font-medium text-gray-200">Click - Attack</div>
        <div className="font-medium text-gray-200">Q/E/R/F - Abilities</div>
        <div className="font-medium text-gray-200">1/2 - Switch Weapon</div>
      </div>
    </div>
  );
}
