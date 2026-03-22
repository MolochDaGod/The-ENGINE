import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play } from "lucide-react";
import { Link } from "wouter";
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationMixer, AnimationAction } from 'three';

interface ZombieEnemy {
  mesh: THREE.Group;
  health: number;
  maxHealth: number;
  speed: number;
  type: 'normal' | 'fast' | 'tank' | 'runner';
  dead: boolean;
  mixer?: AnimationMixer;
  walkAction?: AnimationAction;
  attackAction?: AnimationAction;
  hitTime: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  light: THREE.PointLight;
  damage: number;
}

interface BloodSplat {
  mesh: THREE.Mesh;
  lifetime: number;
}

interface KillFeedEntry {
  weapon: string;
  enemyType: string;
  timestamp: number;
}

interface Weapon {
  name: string;
  damage: number;
  fireRate: number;
  spread: number;
  ammo: number;
  maxAmmo: number;
  reloadTime: number;
  automatic: boolean;
  pellets: number;
}

const WEAPONS: { [key: string]: Weapon } = {
  knife: { name: 'Knife', damage: 50, fireRate: 500, spread: 0, ammo: Infinity, maxAmmo: Infinity, reloadTime: 0, automatic: false, pellets: 1 },
  pistol: { name: 'USP-S', damage: 25, fireRate: 200, spread: 0.02, ammo: 12, maxAmmo: 12, reloadTime: 2200, automatic: false, pellets: 1 },
  rifle: { name: 'AK-47', damage: 30, fireRate: 100, spread: 0.04, ammo: 30, maxAmmo: 30, reloadTime: 2500, automatic: true, pellets: 1 },
  shotgun: { name: 'Nova', damage: 15, fireRate: 800, spread: 0.15, ammo: 8, maxAmmo: 8, reloadTime: 3000, automatic: false, pellets: 8 },
};

export default function DecaySurvival() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [health, setHealth] = useState(100);
  const [armor, setArmor] = useState(100);
  const [currentWeapon, setCurrentWeapon] = useState<string>('rifle');
  const [ammo, setAmmo] = useState(WEAPONS.rifle.ammo);
  const [reserveAmmo, setReserveAmmo] = useState(90);
  const [kills, setKills] = useState(0);
  const [wave, setWave] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [money, setMoney] = useState(800);
  const [showBuyMenu, setShowBuyMenu] = useState(false);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [hitMarker, setHitMarker] = useState(false);
  const [damageIndicator, setDamageIndicator] = useState<'left' | 'right' | 'front' | 'back' | null>(null);
  
  const currentWeaponRef = useRef(currentWeapon);
  const ammoRef = useRef(ammo);
  const reserveAmmoRef = useRef(reserveAmmo);
  const isReloadingRef = useRef(isReloading);
  const armorRef = useRef(armor);
  const waveRef = useRef(wave);
  const gameOverRef = useRef(gameOver);

  currentWeaponRef.current = currentWeapon;
  ammoRef.current = ammo;
  reserveAmmoRef.current = reserveAmmo;
  isReloadingRef.current = isReloading;
  armorRef.current = armor;
  waveRef.current = wave;
  gameOverRef.current = gameOver;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const weaponRef = useRef<THREE.Group | null>(null);
  const enemiesRef = useRef<ZombieEnemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const bloodSplatsRef = useRef<BloodSplat[]>([]);
  const treesRef = useRef<THREE.Group[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const velocityRef = useRef(new THREE.Vector3());
  const canShootRef = useRef(true);
  const waveTimerRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const zombieModelRef = useRef<THREE.Group | null>(null);
  const zombieAnimationsRef = useRef<THREE.AnimationClip[]>([]);
  const mouseDownRef = useRef(false);
  const eulerRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const hasClickedOnceRef = useRef(false);

  const createBloodSplat = useCallback((scene: THREE.Scene, position: THREE.Vector3) => {
    const splatGeometry = new THREE.CircleGeometry(0.3 + Math.random() * 0.3, 8);
    const splatMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x8B0000,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const splat = new THREE.Mesh(splatGeometry, splatMaterial);
    splat.position.copy(position);
    splat.position.y = 0.02;
    splat.rotation.x = -Math.PI / 2;
    splat.rotation.z = Math.random() * Math.PI * 2;
    scene.add(splat);
    
    bloodSplatsRef.current.push({ mesh: splat, lifetime: 10 });
  }, []);

  const createZombie = useCallback((scene: THREE.Scene, playerPos: THREE.Vector3, waveNum: number) => {
    const types: ('normal' | 'fast' | 'tank' | 'runner')[] = ['normal', 'fast', 'tank', 'runner'];
    const type = types[Math.floor(Math.random() * Math.min(waveNum, types.length))];
    
    const colors = {
      normal: 0x228B22,
      fast: 0xFF4500,
      tank: 0x8B0000,
      runner: 0x9400D3
    };
    
    const stats = {
      normal: { health: 100, speed: 0.06, scale: 1.0 },
      fast: { health: 50, speed: 0.12, scale: 0.85 },
      tank: { health: 250, speed: 0.03, scale: 1.5 },
      runner: { health: 75, speed: 0.18, scale: 0.9 }
    };

    let zombie: THREE.Group;
    let mixer: AnimationMixer | undefined;
    let walkAction: AnimationAction | undefined;

    if (zombieModelRef.current) {
      zombie = zombieModelRef.current.clone();
      mixer = new AnimationMixer(zombie);
      
      if (zombieAnimationsRef.current.length > 0) {
        const walkClip = zombieAnimationsRef.current.find(c => 
          c.name.toLowerCase().includes('walk') || 
          c.name.toLowerCase().includes('run') ||
          c.name.toLowerCase().includes('idle')
        ) || zombieAnimationsRef.current[0];
        
        if (walkClip) {
          walkAction = mixer.clipAction(walkClip);
          walkAction.play();
        }
      }

      zombie.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const newMaterial = (mesh.material as THREE.MeshStandardMaterial).clone();
          newMaterial.color.setHex(colors[type]);
          mesh.material = newMaterial;
          mesh.castShadow = true;
        }
      });
    } else {
      zombie = new THREE.Group();
      
      const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.2, 8, 16);
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: colors[type], roughness: 0.8 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.y = 1;
      body.castShadow = true;
      zombie.add(body);

      const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      const headMaterial = new THREE.MeshStandardMaterial({ color: 0x90EE90, roughness: 0.6 });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = 2;
      head.castShadow = true;
      zombie.add(head);

      const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
      const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-0.12, 2.05, 0.22);
      zombie.add(leftEye);
      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.12, 2.05, 0.22);
      zombie.add(rightEye);

      const armGeometry = new THREE.CapsuleGeometry(0.12, 0.8, 4, 8);
      const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
      leftArm.position.set(-0.6, 1.2, 0);
      leftArm.rotation.z = 0.3;
      leftArm.rotation.x = -0.5;
      zombie.add(leftArm);
      const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
      rightArm.position.set(0.6, 1.2, 0);
      rightArm.rotation.z = -0.3;
      rightArm.rotation.x = -0.5;
      zombie.add(rightArm);
    }

    zombie.scale.setScalar(stats[type].scale);

    const angle = Math.random() * Math.PI * 2;
    const distance = 25 + Math.random() * 25;
    zombie.position.set(
      playerPos.x + Math.cos(angle) * distance,
      0,
      playerPos.z + Math.sin(angle) * distance
    );

    scene.add(zombie);

    return {
      mesh: zombie,
      health: stats[type].health,
      maxHealth: stats[type].health,
      speed: stats[type].speed,
      type,
      dead: false,
      mixer,
      walkAction,
      hitTime: 0
    };
  }, []);

  const createWeapon = useCallback((camera: THREE.Camera, weaponType: string) => {
    const weapon = new THREE.Group();
    const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.9, roughness: 0.2 });
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x5c4033, metalness: 0.1, roughness: 0.8 });

    if (weaponType === 'knife') {
      const bladeGeometry = new THREE.BoxGeometry(0.02, 0.15, 0.02);
      const blade = new THREE.Mesh(bladeGeometry, new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1 }));
      blade.position.z = -0.15;
      weapon.add(blade);
      const handleGeometry = new THREE.BoxGeometry(0.03, 0.08, 0.02);
      const handle = new THREE.Mesh(handleGeometry, woodMaterial);
      handle.position.z = -0.05;
      weapon.add(handle);
      weapon.position.set(0.25, -0.15, -0.3);
    } else if (weaponType === 'pistol') {
      const slideGeometry = new THREE.BoxGeometry(0.04, 0.06, 0.2);
      const slide = new THREE.Mesh(slideGeometry, gunMaterial);
      weapon.add(slide);
      const gripGeometry = new THREE.BoxGeometry(0.035, 0.1, 0.04);
      const grip = new THREE.Mesh(gripGeometry, gunMaterial);
      grip.position.set(0, -0.07, 0.06);
      weapon.add(grip);
      weapon.position.set(0.2, -0.2, -0.35);
    } else if (weaponType === 'rifle') {
      const bodyGeometry = new THREE.BoxGeometry(0.06, 0.08, 0.7);
      const body = new THREE.Mesh(bodyGeometry, gunMaterial);
      weapon.add(body);
      const barrelGeometry = new THREE.CylinderGeometry(0.015, 0.02, 0.25, 8);
      const barrel = new THREE.Mesh(barrelGeometry, gunMaterial);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.01, -0.45);
      weapon.add(barrel);
      const stockGeometry = new THREE.BoxGeometry(0.05, 0.12, 0.18);
      const stock = new THREE.Mesh(stockGeometry, woodMaterial);
      stock.position.set(0, -0.01, 0.4);
      weapon.add(stock);
      const magGeometry = new THREE.BoxGeometry(0.035, 0.12, 0.05);
      const mag = new THREE.Mesh(magGeometry, new THREE.MeshStandardMaterial({ color: 0x444444 }));
      mag.position.set(0, -0.1, -0.05);
      weapon.add(mag);
      weapon.position.set(0.25, -0.22, -0.45);
    } else if (weaponType === 'shotgun') {
      const bodyGeometry = new THREE.BoxGeometry(0.05, 0.07, 0.6);
      const body = new THREE.Mesh(bodyGeometry, gunMaterial);
      weapon.add(body);
      const barrelGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8);
      const barrel = new THREE.Mesh(barrelGeometry, gunMaterial);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.45);
      weapon.add(barrel);
      const pumpGeometry = new THREE.BoxGeometry(0.045, 0.05, 0.15);
      const pump = new THREE.Mesh(pumpGeometry, woodMaterial);
      pump.position.set(0, -0.04, -0.2);
      weapon.add(pump);
      const stockGeometry = new THREE.BoxGeometry(0.04, 0.1, 0.2);
      const stock = new THREE.Mesh(stockGeometry, woodMaterial);
      stock.position.set(0, -0.02, 0.35);
      weapon.add(stock);
      weapon.position.set(0.25, -0.2, -0.4);
    }

    weapon.rotation.set(0, 0, 0.03);
    camera.add(weapon);
    return weapon;
  }, []);

  const addKillFeed = useCallback((weaponName: string, enemyType: string) => {
    setKillFeed(prev => {
      const newFeed = [...prev, { weapon: weaponName, enemyType, timestamp: Date.now() }];
      return newFeed.slice(-5);
    });
  }, []);

  useEffect(() => {
    if (!gameStarted || !containerRef.current) return;

    const container = containerRef.current;
    
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.015);
    scene.background = new THREE.Color(0x121225);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.7, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0x404060, 0.8);
    scene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(0x8888cc, 1.2);
    moonLight.position.set(50, 100, 50);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    scene.add(moonLight);

    const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2a1a, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const loader = new GLTFLoader();
    loader.load(
      '/attached_assets/Animated_Zombie_1765371575216.glb',
      (gltf) => {
        zombieModelRef.current = gltf.scene;
        zombieAnimationsRef.current = gltf.animations;
      },
      undefined,
      () => {}
    );

    for (let i = 0; i < 40; i++) {
      const treeGroup = new THREE.Group();
      const trunkGeometry = new THREE.CylinderGeometry(0.25, 0.35, 3, 8);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2818 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 1.5;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const foliageGeometry = new THREE.ConeGeometry(1.8, 4, 8);
      const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x0a2a0a });
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.y = 5;
      foliage.castShadow = true;
      treeGroup.add(foliage);

      const angle = Math.random() * Math.PI * 2;
      const radius = 15 + Math.random() * 75;
      treeGroup.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      treeGroup.scale.setScalar(0.6 + Math.random() * 0.6);
      
      scene.add(treeGroup);
      treesRef.current.push(treeGroup);
    }

    const weapon = createWeapon(camera, currentWeaponRef.current);
    weaponRef.current = weapon;
    scene.add(camera);

    for (let i = 0; i < 5; i++) {
      enemiesRef.current.push(createZombie(scene, camera.position, 1));
    }

    const euler = eulerRef.current;
    const PI_2 = Math.PI / 2;

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= event.movementX * 0.002;
      euler.x -= event.movementY * 0.002;
      euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
      camera.quaternion.setFromEuler(euler);
    };

    const shootGun = () => {
      const weaponType = currentWeaponRef.current;
      const wpn = WEAPONS[weaponType];
      const currentAmmoVal = ammoRef.current;
      if (currentAmmoVal <= 0 || !canShootRef.current) return;
      
      canShootRef.current = false;
      setTimeout(() => { canShootRef.current = true; }, wpn.fireRate);

      for (let p = 0; p < wpn.pellets; p++) {
        const bulletGeometry = new THREE.SphereGeometry(0.03, 6, 6);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion);
        direction.x += (Math.random() - 0.5) * wpn.spread;
        direction.y += (Math.random() - 0.5) * wpn.spread;
        direction.normalize();
        bullet.position.copy(camera.position);
        bullet.position.add(direction.clone().multiplyScalar(0.5));
        const bulletLight = new THREE.PointLight(0xffaa00, 0.3, 2);
        bulletLight.position.copy(bullet.position);
        scene.add(bulletLight);
        scene.add(bullet);
        projectilesRef.current.push({
          mesh: bullet,
          velocity: direction.multiplyScalar(3),
          light: bulletLight,
          damage: wpn.damage
        });
      }

      if (weaponRef.current) {
        const recoilZ = weaponType === 'shotgun' ? 0.08 : weaponType === 'rifle' ? 0.04 : 0.03;
        const recoilX = weaponType === 'shotgun' ? -0.06 : weaponType === 'rifle' ? -0.025 : -0.02;
        weaponRef.current.position.z += recoilZ;
        weaponRef.current.rotation.x += recoilX;
        setTimeout(() => {
          if (weaponRef.current) {
            weaponRef.current.position.z -= recoilZ;
            weaponRef.current.rotation.x -= recoilX;
          }
        }, 50);
      }

      setAmmo(prev => Math.max(0, prev - 1));
    };

    const onMouseDown = () => {
      mouseDownRef.current = true;
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
        hasClickedOnceRef.current = true;
        return;
      }
      
      const weaponType = currentWeaponRef.current;
      if (weaponType === 'knife') {
        for (const enemy of enemiesRef.current) {
          if (enemy.dead) continue;
          const dist = camera.position.distanceTo(enemy.mesh.position);
          if (dist < 3) {
            enemy.health -= WEAPONS.knife.damage;
            enemy.hitTime = Date.now();
            setHitMarker(true);
            setTimeout(() => setHitMarker(false), 100);
            createBloodSplat(scene, enemy.mesh.position);
            
            if (enemy.health <= 0) {
              enemy.dead = true;
              setKills(prev => prev + 1);
              setScore(prev => prev + 50);
              setMoney(prev => prev + 150);
              addKillFeed('Knife', enemy.type);
              enemy.mesh.rotation.x = Math.PI / 2;
              enemy.mesh.position.y = 0.4;
              setTimeout(() => {
                scene.remove(enemy.mesh);
                const idx = enemiesRef.current.indexOf(enemy);
                if (idx > -1) enemiesRef.current.splice(idx, 1);
              }, 800);
            }
            break;
          }
        }
        return;
      }
      
      if (!isReloadingRef.current) {
        shootGun();
      }
    };

    const onMouseUp = () => {
      mouseDownRef.current = false;
    };

    const switchWeapon = (weaponType: string) => {
      if (weaponType === currentWeaponRef.current) return;
      if (weaponRef.current) {
        camera.remove(weaponRef.current);
      }
      const newWeapon = createWeapon(camera, weaponType);
      weaponRef.current = newWeapon;
      currentWeaponRef.current = weaponType;
      setCurrentWeapon(weaponType);
      setAmmo(WEAPONS[weaponType].ammo);
      setIsReloading(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      keysRef.current[event.code] = true;
      
      if (event.code === 'KeyR' && !isReloadingRef.current) {
        const curWpn = currentWeaponRef.current;
        if (curWpn === 'knife') return;
        const curAmmo = ammoRef.current;
        const maxAmmo = WEAPONS[curWpn].maxAmmo;
        if (curAmmo >= maxAmmo) return;
        const neededAmmo = maxAmmo - curAmmo;
        const availableAmmo = Math.min(neededAmmo, reserveAmmoRef.current);
        if (availableAmmo > 0) {
          isReloadingRef.current = true;
          setIsReloading(true);
          setTimeout(() => {
            setAmmo(prev => prev + availableAmmo);
            ammoRef.current += availableAmmo;
            setReserveAmmo(prev => prev - availableAmmo);
            reserveAmmoRef.current -= availableAmmo;
            isReloadingRef.current = false;
            setIsReloading(false);
          }, WEAPONS[curWpn].reloadTime);
        }
      }

      if (event.code === 'KeyB') {
        setShowBuyMenu(prev => !prev);
      }

      if (event.code === 'Digit1') switchWeapon('rifle');
      if (event.code === 'Digit2') switchWeapon('pistol');
      if (event.code === 'Digit3') switchWeapon('shotgun');
      if (event.code === 'Digit4') switchWeapon('knife');
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current[event.code] = false;
    };

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === renderer.domElement;
      setIsLocked(locked);
    };

    document.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    const clock = new THREE.Clock();
    let animationId: number;
    let disposed = false;

    const animate = () => {
      if (disposed || gameOverRef.current) return;
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (WEAPONS[currentWeaponRef.current].automatic && mouseDownRef.current && !isReloadingRef.current && ammoRef.current > 0) {
        shootGun();
      }

      const moveSpeed = 7;
      const direction = new THREE.Vector3();
      
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      forward.y = 0;
      forward.normalize();
      
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      right.y = 0;
      right.normalize();

      if (keysRef.current['KeyW']) direction.add(forward);
      if (keysRef.current['KeyS']) direction.sub(forward);
      if (keysRef.current['KeyA']) direction.sub(right);
      if (keysRef.current['KeyD']) direction.add(right);
      
      if (direction.length() > 0) {
        direction.normalize();
        velocityRef.current.lerp(direction.multiplyScalar(moveSpeed), 0.12);
      } else {
        velocityRef.current.lerp(new THREE.Vector3(), 0.12);
      }
      
      const newPos = camera.position.clone().add(velocityRef.current.clone().multiplyScalar(delta));
      
      let blocked = false;
      for (const tree of treesRef.current) {
        const dx = newPos.x - tree.position.x;
        const dz = newPos.z - tree.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < 1.5) { blocked = true; break; }
      }
      if (!blocked) camera.position.copy(newPos);

      const bounds = 95;
      camera.position.x = Math.max(-bounds, Math.min(bounds, camera.position.x));
      camera.position.z = Math.max(-bounds, Math.min(bounds, camera.position.z));

      if (weaponRef.current && direction.length() > 0) {
        const bobTime = clock.elapsedTime * 10;
        const baseY = currentWeaponRef.current === 'knife' ? -0.15 : -0.22;
        weaponRef.current.position.y = baseY + Math.sin(bobTime) * 0.008;
      }

      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const projectile = projectilesRef.current[i];
        projectile.mesh.position.add(projectile.velocity);
        projectile.light.position.copy(projectile.mesh.position);

        if (projectile.mesh.position.distanceTo(camera.position) > 100) {
          scene.remove(projectile.mesh);
          scene.remove(projectile.light);
          projectilesRef.current.splice(i, 1);
          continue;
        }

        for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
          const enemy = enemiesRef.current[j];
          if (enemy.dead) continue;
          
          const dist = projectile.mesh.position.distanceTo(enemy.mesh.position);
          if (dist < 1.8) {
            enemy.health -= projectile.damage;
            enemy.hitTime = Date.now();
            
            scene.remove(projectile.mesh);
            scene.remove(projectile.light);
            projectilesRef.current.splice(i, 1);

            createBloodSplat(scene, enemy.mesh.position.clone());
            
            setHitMarker(true);
            setTimeout(() => setHitMarker(false), 100);

            if (enemy.health <= 0) {
              enemy.dead = true;
              const points = enemy.type === 'tank' ? 50 : enemy.type === 'runner' ? 35 : enemy.type === 'fast' ? 25 : 15;
              const reward = enemy.type === 'tank' ? 150 : enemy.type === 'runner' ? 100 : 75;
              setKills(prev => prev + 1);
              setScore(prev => prev + points);
              setMoney(prev => prev + reward);
              addKillFeed(WEAPONS[currentWeaponRef.current].name, enemy.type);
              
              enemy.mesh.rotation.x = Math.PI / 2;
              enemy.mesh.position.y = 0.4;

              setTimeout(() => {
                scene.remove(enemy.mesh);
                const idx = enemiesRef.current.indexOf(enemy);
                if (idx > -1) enemiesRef.current.splice(idx, 1);
              }, 800);
            }
            break;
          }
        }
      }

      for (const enemy of enemiesRef.current) {
        if (enemy.dead) continue;

        if (enemy.mixer) enemy.mixer.update(delta);

        const hitFlash = Date.now() - enemy.hitTime < 100;
        enemy.mesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (hitFlash) {
              mat.emissive = new THREE.Color(0xff0000);
              mat.emissiveIntensity = 0.5;
            } else {
              mat.emissiveIntensity = 0;
            }
          }
        });

        const toPlayer = new THREE.Vector3();
        toPlayer.subVectors(camera.position, enemy.mesh.position);
        toPlayer.y = 0;
        const distance = toPlayer.length();

        if (distance > 2) {
          toPlayer.normalize();
          const newEnemyPos = enemy.mesh.position.clone().add(toPlayer.multiplyScalar(enemy.speed));
          
          let enemyBlocked = false;
          for (const tree of treesRef.current) {
            const dx = newEnemyPos.x - tree.position.x;
            const dz = newEnemyPos.z - tree.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < 1.2) { enemyBlocked = true; break; }
          }
          if (!enemyBlocked) enemy.mesh.position.copy(newEnemyPos);
          
          enemy.mesh.lookAt(camera.position.x, enemy.mesh.position.y, camera.position.z);
        }

        if (distance < 2.2) {
          const enemyDir = new THREE.Vector3();
          enemyDir.subVectors(enemy.mesh.position, camera.position);
          const angle = Math.atan2(enemyDir.x, enemyDir.z);
          const cameraAngle = euler.y;
          const relAngle = angle - cameraAngle;
          
          if (Math.abs(relAngle) < Math.PI / 4) setDamageIndicator('front');
          else if (relAngle > Math.PI * 3/4 || relAngle < -Math.PI * 3/4) setDamageIndicator('back');
          else if (relAngle > 0) setDamageIndicator('right');
          else setDamageIndicator('left');
          
          setTimeout(() => setDamageIndicator(null), 200);

          const damage = enemy.type === 'tank' ? 0.4 : enemy.type === 'fast' ? 0.25 : 0.3;
          const currentArmor = armorRef.current;
          
          if (currentArmor > 0) {
            setArmor(prev => {
              const v = Math.max(0, prev - damage * 0.6);
              armorRef.current = v;
              return v;
            });
            setHealth(prev => {
              const newHealth = Math.max(0, prev - damage * 0.4);
              if (newHealth <= 0) {
                gameOverRef.current = true;
                setGameOver(true);
              }
              return newHealth;
            });
          } else {
            setHealth(prev => {
              const newHealth = Math.max(0, prev - damage);
              if (newHealth <= 0) {
                gameOverRef.current = true;
                setGameOver(true);
              }
              return newHealth;
            });
          }
        }

        if (!zombieModelRef.current) {
          const bobTime = clock.elapsedTime * 6;
          enemy.mesh.children.forEach((child: THREE.Object3D, idx: number) => {
            if (idx === 4 || idx === 5) {
              child.rotation.x = -0.5 + Math.sin(bobTime + idx) * 0.2;
            }
          });
        }
      }

      for (let i = bloodSplatsRef.current.length - 1; i >= 0; i--) {
        const splat = bloodSplatsRef.current[i];
        splat.lifetime -= delta;
        if (splat.lifetime <= 0) {
          scene.remove(splat.mesh);
          bloodSplatsRef.current.splice(i, 1);
        } else if (splat.lifetime < 2) {
          (splat.mesh.material as THREE.MeshBasicMaterial).opacity = splat.lifetime / 2;
        }
      }

      spawnTimerRef.current += delta;
      const currentWave = waveRef.current;
      const spawnInterval = Math.max(1.5, 4 - currentWave * 0.25);
      if (spawnTimerRef.current > spawnInterval && enemiesRef.current.filter(e => !e.dead).length < 12 + currentWave * 3) {
        enemiesRef.current.push(createZombie(scene, camera.position, currentWave));
        spawnTimerRef.current = 0;
      }

      waveTimerRef.current += delta;
      if (waveTimerRef.current > 40) {
        const nextWave = currentWave + 1;
        waveRef.current = nextWave;
        setWave(nextWave);
        setMoney(prev => prev + 500);
        waveTimerRef.current = 0;
        for (let i = 0; i < 2 + currentWave; i++) {
          enemiesRef.current.push(createZombie(scene, camera.position, nextWave));
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      document.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('resize', handleResize);
      
      if (document.pointerLockElement) document.exitPointerLock();
      
      container.removeChild(renderer.domElement);
      renderer.dispose();
      
      enemiesRef.current = [];
      projectilesRef.current = [];
      bloodSplatsRef.current = [];
      treesRef.current = [];
    };
  }, [gameStarted, createZombie, createWeapon, createBloodSplat, addKillFeed]);

  useEffect(() => {
    const interval = setInterval(() => {
      setKillFeed(prev => prev.filter(k => Date.now() - k.timestamp < 5000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-2xl mx-auto p-8">
          <Link href="/super-engine">
            <Button variant="outline" className="absolute top-4 left-4 border-red-400 text-red-400 hover:bg-red-400 hover:text-black">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-4">
            DECAY
          </h1>
          <p className="text-xl text-gray-300 mb-2">Tactical Zombie Survival</p>
          <p className="text-gray-400 mb-8">
            A tactical 3D survival shooter. Switch between weapons, buy upgrades, and survive waves of the undead.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8 text-left bg-gray-800/50 p-6 rounded-lg">
            <div>
              <h3 className="text-red-400 font-bold mb-2">Controls</h3>
              <p className="text-gray-300 text-sm">W/A/S/D - Move</p>
              <p className="text-gray-300 text-sm">Mouse - Aim</p>
              <p className="text-gray-300 text-sm">Click - Fire</p>
              <p className="text-gray-300 text-sm">R - Reload</p>
              <p className="text-gray-300 text-sm">B - Buy Menu</p>
            </div>
            <div>
              <h3 className="text-red-400 font-bold mb-2">Weapons</h3>
              <p className="text-yellow-400 text-sm">1 - AK-47 (Rifle)</p>
              <p className="text-yellow-400 text-sm">2 - USP-S (Pistol)</p>
              <p className="text-yellow-400 text-sm">3 - Nova (Shotgun)</p>
              <p className="text-yellow-400 text-sm">4 - Knife</p>
            </div>
          </div>

          <Button 
            onClick={() => setGameStarted(true)}
            className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-12 py-6 text-xl"
          >
            <Play className="w-6 h-6 mr-2" />
            Start Game
          </Button>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-gray-900 flex items-center justify-center">
        <div className="text-center bg-gray-800/90 p-12 rounded-xl border border-red-500/30">
          <h1 className="text-5xl font-bold text-red-500 mb-4">GAME OVER</h1>
          <div className="text-2xl text-white mb-2">Score: {score}</div>
          <div className="text-xl text-gray-300 mb-2">Kills: {kills}</div>
          <div className="text-xl text-gray-300 mb-8">Wave Reached: {wave}</div>
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={() => {
                gameOverRef.current = false;
                setGameOver(false);
                setGameStarted(false);
                setHealth(100);
                setArmor(100);
                armorRef.current = 100;
                setAmmo(WEAPONS.rifle.ammo);
                ammoRef.current = WEAPONS.rifle.ammo;
                setReserveAmmo(90);
                reserveAmmoRef.current = 90;
                setKills(0);
                setWave(1);
                waveRef.current = 1;
                setScore(0);
                setMoney(800);
                currentWeaponRef.current = 'rifle';
                setCurrentWeapon('rifle');
                isReloadingRef.current = false;
                setIsReloading(false);
                waveTimerRef.current = 0;
                spawnTimerRef.current = 0;
                hasClickedOnceRef.current = false;
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Play Again
            </Button>
            <Link href="/super-engine">
              <Button variant="outline" className="border-gray-400 text-gray-400">
                Exit
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none">
      <div ref={containerRef} className="absolute inset-0" />
      
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg width="32" height="32" viewBox="0 0 32 32">
          <line x1="0" y1="16" x2="12" y2="16" stroke={hitMarker ? "#ff0" : "#0f0"} strokeWidth="2"/>
          <line x1="20" y1="16" x2="32" y2="16" stroke={hitMarker ? "#ff0" : "#0f0"} strokeWidth="2"/>
          <line x1="16" y1="0" x2="16" y2="12" stroke={hitMarker ? "#ff0" : "#0f0"} strokeWidth="2"/>
          <line x1="16" y1="20" x2="16" y2="32" stroke={hitMarker ? "#ff0" : "#0f0"} strokeWidth="2"/>
          {hitMarker && (
            <>
              <line x1="10" y1="10" x2="14" y2="14" stroke="#ff0" strokeWidth="2"/>
              <line x1="22" y1="10" x2="18" y2="14" stroke="#ff0" strokeWidth="2"/>
              <line x1="10" y1="22" x2="14" y2="18" stroke="#ff0" strokeWidth="2"/>
              <line x1="22" y1="22" x2="18" y2="18" stroke="#ff0" strokeWidth="2"/>
            </>
          )}
        </svg>
      </div>

      {damageIndicator === 'left' && <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-red-500/50 to-transparent pointer-events-none" />}
      {damageIndicator === 'right' && <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-red-500/50 to-transparent pointer-events-none" />}
      {damageIndicator === 'front' && <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-red-500/50 to-transparent pointer-events-none" />}
      {damageIndicator === 'back' && <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-red-500/50 to-transparent pointer-events-none" />}

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-8 pointer-events-none">
        <div className="bg-black/70 px-6 py-2 rounded text-center">
          <div className="text-orange-400 text-xs font-mono">WAVE</div>
          <div className="text-white text-2xl font-bold">{wave}</div>
        </div>
        <div className="bg-black/70 px-6 py-2 rounded text-center">
          <div className="text-gray-400 text-xs font-mono">SCORE</div>
          <div className="text-white text-xl font-bold">{score}</div>
        </div>
      </div>

      <div className="absolute top-4 right-4 space-y-1 pointer-events-none">
        {killFeed.map((entry, idx) => (
          <div key={idx} className="bg-black/70 px-3 py-1 rounded text-sm flex items-center gap-2 animate-pulse">
            <span className="text-yellow-400">You</span>
            <span className="text-gray-400">[{entry.weapon}]</span>
            <span className="text-red-400">{entry.enemyType}</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 flex items-end gap-4 pointer-events-none">
        <div className="bg-black/80 rounded p-3 min-w-[180px]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center text-white text-xs font-bold">+</div>
            <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-all" style={{ width: `${health}%` }} />
            </div>
            <span className="text-white font-mono text-lg w-8">{Math.floor(health)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2L3 7v6l7 5 7-5V7l-7-5z"/>
              </svg>
            </div>
            <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-700 to-blue-500 transition-all" style={{ width: `${armor}%` }} />
            </div>
            <span className="text-white font-mono text-lg w-8">{Math.floor(armor)}</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 pointer-events-none">
        <div className="bg-black/80 rounded p-3 text-right">
          <div className="text-gray-400 text-xs mb-1">{WEAPONS[currentWeapon].name}</div>
          <div className="flex items-baseline gap-1 justify-end">
            <span className={`text-4xl font-bold ${isReloading ? 'text-yellow-400 animate-pulse' : ammo <= 5 ? 'text-red-400' : 'text-white'}`}>
              {currentWeapon === 'knife' ? '∞' : ammo}
            </span>
            {currentWeapon !== 'knife' && (
              <>
                <span className="text-gray-500 text-2xl">/</span>
                <span className="text-gray-400 text-xl">{reserveAmmo}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1 pointer-events-none">
        {['rifle', 'pistol', 'shotgun', 'knife'].map((w, idx) => (
          <div 
            key={w}
            className={`w-16 h-12 rounded flex flex-col items-center justify-center text-xs ${currentWeapon === w ? 'bg-yellow-500/30 border border-yellow-400' : 'bg-black/50 border border-gray-700'}`}
          >
            <span className="text-gray-400">{idx + 1}</span>
            <span className={currentWeapon === w ? 'text-yellow-400' : 'text-gray-500'}>{WEAPONS[w].name.split('-')[0]}</span>
          </div>
        ))}
      </div>

      <div className="absolute top-20 left-4 pointer-events-none">
        <div className="bg-black/60 px-3 py-1 rounded">
          <span className="text-green-400 font-mono text-xl">${money}</span>
        </div>
      </div>

      <div className="absolute top-20 right-4 pointer-events-none">
        <div className="bg-black/60 px-3 py-1 rounded flex items-center gap-2">
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
          </svg>
          <span className="text-white font-mono">{kills}</span>
        </div>
      </div>

      {showBuyMenu && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4 text-center">BUY MENU</h2>
            <div className="space-y-2">
              <button 
                onClick={() => { if (money >= 100) { setArmor(prev => { const v = Math.min(100, prev + 25); armorRef.current = v; return v; }); setMoney(prev => prev - 100); }}}
                className={`w-full p-3 rounded flex justify-between ${money >= 100 ? 'bg-blue-900 hover:bg-blue-800' : 'bg-gray-800 opacity-50'}`}
              >
                <span className="text-white">Armor +25</span>
                <span className="text-green-400">$100</span>
              </button>
              <button 
                onClick={() => { if (money >= 200) { setReserveAmmo(prev => { const v = prev + 30; reserveAmmoRef.current = v; return v; }); setMoney(prev => prev - 200); }}}
                className={`w-full p-3 rounded flex justify-between ${money >= 200 ? 'bg-yellow-900 hover:bg-yellow-800' : 'bg-gray-800 opacity-50'}`}
              >
                <span className="text-white">Ammo +30</span>
                <span className="text-green-400">$200</span>
              </button>
              <button 
                onClick={() => { if (money >= 500) { setHealth(100); setMoney(prev => prev - 500); }}}
                className={`w-full p-3 rounded flex justify-between ${money >= 500 ? 'bg-red-900 hover:bg-red-800' : 'bg-gray-800 opacity-50'}`}
              >
                <span className="text-white">Full Health</span>
                <span className="text-green-400">$500</span>
              </button>
            </div>
            <p className="text-gray-500 text-sm text-center mt-4">Press B to close</p>
          </div>
        </div>
      )}

      {isReloading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-8 pointer-events-none">
          <div className="text-yellow-400 text-sm font-mono animate-pulse">RELOADING...</div>
        </div>
      )}

      {!isLocked && !showBuyMenu && (
        <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 pointer-events-none">
          <div className="text-white/60 text-sm bg-black/40 px-4 py-2 rounded animate-pulse">
            Click anywhere to aim
          </div>
        </div>
      )}

      <div className="absolute bottom-20 left-4 text-gray-500 text-xs pointer-events-none">
        ESC unlock | R reload | B buy menu | 1-4 weapons
      </div>
    </div>
  );
}
