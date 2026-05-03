import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSET_URLS } from './avernus/assets';
import { WEAPONS, ARENA_LAYOUT, type WeaponType, type WeaponData, type CoverType } from './avernus/weapons';

// ═══ TYPES ═══
interface EnemyUnit {
  mesh: THREE.Group; health: number; maxHealth: number;
  type: 'soldier' | 'hazmat' | 'enemy';
  position: THREE.Vector3; speed: number; attackCooldown: number;
  isDying: boolean; deathTimer: number; hitFlashTimer: number;
  originalEmissives: Map<THREE.Mesh, THREE.Color>;
}
interface Particle {
  mesh: THREE.Mesh; velocity: THREE.Vector3;
  lifetime: number; maxLifetime: number;
  type: 'ability' | 'death' | 'xp' | 'muzzle' | 'tracer' | 'explosion';
  targetPos?: THREE.Vector3;
}
interface GroundRing { mesh: THREE.Mesh; lifetime: number; maxLifetime: number; }
interface Projectile {
  mesh: THREE.Object3D; velocity: THREE.Vector3;
  damage: number; team: 'player' | 'enemy'; type: string; lifetime: number;
}
interface CoverObject {
  mesh: THREE.Group; health: number; maxHealth: number;
  type: CoverType; bounds: THREE.Box3; active: boolean;
  origPos: THREE.Vector3;
}

// ═══ MODEL LOADER (cached) ═══
const modelCache = new Map<string, THREE.Group>();
const gltfLoader = new GLTFLoader();

async function loadModel(url: string): Promise<THREE.Group> {
  const cached = modelCache.get(url);
  if (cached) return cached.clone();
  return new Promise((resolve) => {
    gltfLoader.load(url, (gltf) => {
      gltf.scene.traverse((c: any) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      modelCache.set(url, gltf.scene);
      resolve(gltf.scene.clone());
    }, undefined, () => {
      const fb = new THREE.Group();
      fb.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xff00ff })));
      resolve(fb);
    });
  });
}


// ═══ MAIN COMPONENT ═══
export default function Avernus3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const loopRef = useRef<number | null>(null);

  const [gameState, setGameState] = useState<'menu' | 'loading' | 'playing' | 'gameover'>('menu');
  const [loadPct, setLoadPct] = useState(0);
  const [selWeapons, setSelWeapons] = useState<{ primary: WeaponType | null; secondary: WeaponType | null }>({ primary: null, secondary: null });
  const [curWeapon, setCurWeapon] = useState<WeaponType | null>(null);
  const [hp, setHp] = useState(1000);
  const [shield, setShield] = useState(100);
  const [resource, setResource] = useState(100);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [kills, setKills] = useState(0);

  // Refs for game state (avoids stale closure)
  const sceneR = useRef<THREE.Scene | null>(null);
  const camR = useRef<THREE.PerspectiveCamera | null>(null);
  const rendR = useRef<THREE.WebGLRenderer | null>(null);
  const playerR = useRef<THREE.Group | null>(null);
  const weaponR = useRef<THREE.Group | null>(null);
  const enemies = useRef<EnemyUnit[]>([]);
  const particles = useRef<Particle[]>([]);
  const rings = useRef<GroundRing[]>([]);
  const projs = useRef<Projectile[]>([]);
  const covers = useRef<CoverObject[]>([]);
  const clock = useRef(new THREE.Clock());
  const keys = useRef<Record<string, boolean>>({});
  const mouse = useRef({ x: 0, y: 0, down: false });
  const atkAnim = useRef({ active: false, timer: 0 });
  const camShake = useRef({ active: false, timer: 0, intensity: 0 });
  const spawnT = useRef(0);
  const curWpnR = useRef<WeaponType | null>(null);
  const selWpnR = useRef(selWeapons);
  const pPos = useRef(new THREE.Vector3());
  const pRot = useRef(0);
  const gsR = useRef(gameState);
  const hpR = useRef(1000);
  const killsR = useRef(0);
  const xpR = useRef(0);
  const lvlR = useRef(1);

  // ═══ PARTICLE HELPERS ═══
  const burst = useCallback((scene: THREE.Scene, pos: THREE.Vector3, col: number, n: number, type: Particle['type']) => {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(type === 'muzzle' ? 0.04 : 0.06, 4, 4), new THREE.MeshBasicMaterial({ color: col, transparent: true }));
      m.position.copy(pos); scene.add(m);
      const s = type === 'muzzle' ? 3 : 6;
      const v = new THREE.Vector3((Math.random() - 0.5) * s, Math.random() * s * 0.7 + 1, (Math.random() - 0.5) * s);
      const lt = type === 'muzzle' ? 0.2 : 1.0;
      particles.current.push({ mesh: m, velocity: v, lifetime: lt, maxLifetime: lt, type });
    }
  }, []);

  const xpOrb = useCallback((scene: THREE.Scene, pos: THREE.Vector3) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 1 }));
    m.position.copy(pos); m.position.y += 0.5; scene.add(m);
    particles.current.push({ mesh: m, velocity: new THREE.Vector3(0, 2, 0), lifetime: 3, maxLifetime: 3, type: 'xp', targetPos: pPos.current });
  }, []);

  const gndRing = useCallback((scene: THREE.Scene, pos: THREE.Vector3, col: number) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true }));
    m.position.copy(pos); m.position.y = 0.05; m.rotation.x = -Math.PI / 2; scene.add(m);
    rings.current.push({ mesh: m, lifetime: 0.8, maxLifetime: 0.8 });
  }, []);

  const muzzleFlash = useCallback((scene: THREE.Scene, pos: THREE.Vector3, dir: THREE.Vector3, col: number) => {
    const fl = new THREE.PointLight(col, 3, 8); fl.position.copy(pos); scene.add(fl);
    setTimeout(() => scene.remove(fl), 80);
    burst(scene, pos, col, 6, 'muzzle');
    const tg = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4); tg.rotateX(Math.PI / 2);
    const tm = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: col }));
    tm.position.copy(pos); scene.add(tm);
    projs.current.push({ mesh: tm, velocity: dir.clone().normalize().multiplyScalar(40), damage: 50 + Math.random() * 30, team: 'player', type: 'tracer', lifetime: 2 });
  }, [burst]);

  // ═══ WEAPON SELECT ═══
  const handleWeaponSelect = useCallback((w: WeaponType) => {
    setSelWeapons(prev => {
      if (prev.primary === w) return { ...prev, primary: null };
      if (prev.secondary === w) return { ...prev, secondary: null };
      if (!prev.primary) return { ...prev, primary: w };
      if (!prev.secondary) return { ...prev, secondary: w };
      return prev;
    });
  }, []);

  const startGame = useCallback(() => {
    if (!selWeapons.primary || !selWeapons.secondary) return;
    setCurWeapon(selWeapons.primary); curWpnR.current = selWeapons.primary;
    selWpnR.current = selWeapons;
    setGameState('loading'); gsR.current = 'loading';
    setHp(1000); hpR.current = 1000; setShield(100); setResource(100);
    setLevel(1); lvlR.current = 1; setXp(0); xpR.current = 0;
    setKills(0); killsR.current = 0;
  }, [selWeapons]);

  // ═══ GAME INIT ═══
  useEffect(() => {
    if (gameState !== 'loading' || !containerRef.current || initRef.current) return;
    initRef.current = true;
    const container = containerRef.current;

    // Gather URLs to preload
    const urls: string[] = [ASSET_URLS.characters.soldier, ASSET_URLS.characters.enemy, ASSET_URLS.characters.hazmat];
    const pw = WEAPONS.find(w => w.type === selWpnR.current.primary);
    const sw = WEAPONS.find(w => w.type === selWpnR.current.secondary);
    if (pw) { urls.push((ASSET_URLS.guns as any)[pw.gunModel]); if (pw.gunModelAlt) urls.push((ASSET_URLS.guns as any)[pw.gunModelAlt]); }
    if (sw) { urls.push((ASSET_URLS.guns as any)[sw.gunModel]); if (sw.gunModelAlt) urls.push((ASSET_URLS.guns as any)[sw.gunModelAlt]); }
    const envSet = new Set(ARENA_LAYOUT.map(p => p.asset));
    envSet.forEach(a => { const u = (ASSET_URLS.environment as any)[a]; if (u) urls.push(u); });

    let loaded = 0;
    const total = urls.length;

    (async () => {
      // Preload all
      for (const u of urls) { try { await loadModel(u); } catch {} loaded++; setLoadPct(Math.round(loaded / total * 100)); }
      setGameState('playing'); gsR.current = 'playing';

      // ═══ BUILD SCENE ═══
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1020);
      scene.fog = new THREE.FogExp2(0x1a1020, 0.012);
      sceneR.current = scene;

      const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
      camera.position.set(0, 15, 20); camera.lookAt(0, 0, 0);
      camR.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.8;
      container.appendChild(renderer.domElement); rendR.current = renderer;

      // Lighting
      scene.add(new THREE.AmbientLight(0x8888aa, 1.0));
      scene.add(new THREE.HemisphereLight(0xffeedd, 0x443322, 0.6));
      const sun = new THREE.DirectionalLight(0xff8844, 2.0);
      sun.position.set(10, 30, 10); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 100;
      sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
      sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
      scene.add(sun);
      const fill = new THREE.PointLight(0x4466ff, 1.0, 60);
      fill.position.set(-10, 10, -10); scene.add(fill);

      // Ground
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60, 32, 32), new THREE.MeshStandardMaterial({ color: 0x3a3040, roughness: 0.85, metalness: 0.15 }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      const lava = new THREE.Mesh(new THREE.RingGeometry(30, 60, 64), new THREE.MeshBasicMaterial({ color: 0xff6622 }));
      lava.rotation.x = -Math.PI / 2; lava.position.y = -0.1; scene.add(lava);
      const grid = new THREE.GridHelper(60, 30, 0x444444, 0x333333);
      grid.position.y = 0.01; (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.15;
      scene.add(grid);

      // Place arena objects
      for (const pl of ARENA_LAYOUT) {
        const u = (ASSET_URLS.environment as any)[pl.asset]; if (!u) continue;
        try {
          const m = await loadModel(u);
          m.position.set(...pl.pos);
          if (pl.rot) m.rotation.y = pl.rot;
          if (pl.scale) m.scale.setScalar(pl.scale);
          scene.add(m);
          if (pl.coverType) {
            const b = new THREE.Box3().setFromObject(m);
            covers.current.push({ mesh: m, health: pl.health || 100, maxHealth: pl.health || 100, type: pl.coverType, bounds: b, active: true, origPos: new THREE.Vector3(...pl.pos) });
          }
        } catch {}
      }
      // Street light point lights
      ARENA_LAYOUT.filter(p => p.asset === 'StreetLight').forEach(p => {
        const l = new THREE.PointLight(0xffcc66, 1.5, 15); l.position.set(p.pos[0], 5, p.pos[2]); l.castShadow = true; scene.add(l);
      });

      // Player
      const player = await loadModel(ASSET_URLS.characters.soldier);
      player.scale.setScalar(1.5); player.position.set(0, 0, 0); pPos.current.set(0, 0, 0);
      scene.add(player); playerR.current = player;

      // Attach weapon
      async function attachWeapon(wpnType: WeaponType) {
        if (!playerR.current) return;
        const old = playerR.current.getObjectByName('weapon'); if (old) playerR.current.remove(old);
        const wd = WEAPONS.find(w => w.type === wpnType); if (!wd) return;
        const gu = (ASSET_URLS.guns as any)[wd.gunModel]; if (!gu) return;
        const gm = await loadModel(gu);
        gm.scale.setScalar(1.5); gm.position.set(0.4, 1.2, 0.3); gm.name = 'weapon';
        playerR.current.add(gm); weaponR.current = gm;
      }
      if (curWpnR.current) await attachWeapon(curWpnR.current);

      // Enemy spawner
      async function spawnEnemy(pos: THREE.Vector3) {
        const roll = Math.random();
        const type: EnemyUnit['type'] = roll < 0.5 ? 'enemy' : roll < 0.8 ? 'soldier' : 'hazmat';
        const url = type === 'enemy' ? ASSET_URLS.characters.enemy : type === 'hazmat' ? ASSET_URLS.characters.hazmat : ASSET_URLS.characters.soldier;
        const m = await loadModel(url);
        m.scale.setScalar(type === 'hazmat' ? 1.8 : 1.4); m.position.copy(pos);
        m.traverse((c: any) => { if (c.isMesh) {
          const mt = (c as THREE.Mesh).material = ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).clone();
          if (type === 'hazmat') { mt.emissive = new THREE.Color(0x00ff00); mt.emissiveIntensity = 0.3; }
          else if (type === 'enemy') { mt.emissive = new THREE.Color(0xff0000); mt.emissiveIntensity = 0.2; }
        }});
        scene.add(m);
        enemies.current.push({ mesh: m, health: type === 'hazmat' ? 300 : type === 'enemy' ? 150 : 200,
          maxHealth: type === 'hazmat' ? 300 : type === 'enemy' ? 150 : 200, type, position: pos.clone(),
          speed: type === 'hazmat' ? 2.0 : type === 'enemy' ? 3.5 : 3.0,
          attackCooldown: 0, isDying: false, deathTimer: 0, hitFlashTimer: 0, originalEmissives: new Map() });
      }

      // ═══ INPUT ═══
      const onKD = (e: KeyboardEvent) => {
        keys.current[e.code] = true;
        if (e.code === 'Digit1' && selWpnR.current.primary) { curWpnR.current = selWpnR.current.primary; setCurWeapon(curWpnR.current); attachWeapon(curWpnR.current); }
        if (e.code === 'Digit2' && selWpnR.current.secondary) { curWpnR.current = selWpnR.current.secondary; setCurWeapon(curWpnR.current); attachWeapon(curWpnR.current); }
        if (['KeyQ','KeyE','KeyR','KeyF'].includes(e.code) && playerR.current && sceneR.current) {
          const ac: Record<string,number> = { KeyQ:0x00ffff, KeyE:0xff8800, KeyR:0xff00ff, KeyF:0xffff00 };
          const col = ac[e.code] || 0xffffff;
          const cp = playerR.current.position.clone(); cp.y += 1;
          const wd = WEAPONS.find(w => w.type === curWpnR.current);
          burst(sceneR.current, cp, col, 35, 'ability');
          gndRing(sceneR.current, playerR.current.position.clone(), col);
          camShake.current = { active: true, timer: 0.2, intensity: 0.3 };
          const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(playerR.current.quaternion);
          // Skill prefabs
          if (wd?.attackType === 'ranged' && e.code === 'KeyR') {
            for (let i = -2; i <= 2; i++) { const d = fwd.clone().applyAxisAngle(new THREE.Vector3(0,1,0), i*0.15);
              setTimeout(() => { if (sceneR.current && playerR.current) muzzleFlash(sceneR.current, cp.clone(), d, col); }, i*50+100); }
          }
          if (wd?.attackType === 'magic' && e.code === 'KeyR') {
            const bm = new THREE.Mesh(new THREE.SphereGeometry(0.3,12,12), new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:2}));
            bm.position.copy(cp); sceneR.current.add(bm); bm.add(new THREE.PointLight(col, 2, 10));
            projs.current.push({ mesh: bm, velocity: fwd.clone().multiplyScalar(15), damage: 120, team: 'player', type: 'plasma', lifetime: 3 });
          }
          if (wd?.attackType === 'melee' && e.code === 'KeyE') {
            pPos.current.add(fwd.clone().multiplyScalar(8));
            gndRing(sceneR.current, playerR.current.position.clone(), 0xff4400);
          }
          if (e.code === 'KeyQ' && wd?.type === 'scythe') { hpR.current = Math.min(1000, hpR.current + 60); setHp(hpR.current); }
        }
      };
      const onKU = (e: KeyboardEvent) => { keys.current[e.code] = false; };
      const onMM = (e: MouseEvent) => { mouse.current.x = (e.clientX/window.innerWidth)*2-1; mouse.current.y = -(e.clientY/window.innerHeight)*2+1; };
      const onMD = () => {
        mouse.current.down = true;
        if (!atkAnim.current.active && playerR.current && sceneR.current) {
          atkAnim.current = { active: true, timer: 0.3 };
          const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(playerR.current.quaternion);
          const ap = playerR.current.position.clone(); ap.add(fwd.clone().multiplyScalar(1.5)); ap.y += 1;
          const wd = WEAPONS.find(w => w.type === curWpnR.current);
          if (wd?.attackType === 'ranged' || wd?.attackType === 'magic') {
            muzzleFlash(sceneR.current, ap, fwd, parseInt(wd.color.replace('#',''), 16));
          }
          enemies.current.forEach(en => {
            if (en.isDying) return;
            const dist = en.mesh.position.distanceTo(playerR.current!.position);
            const range = wd?.attackType === 'melee' ? 3.5 : 30;
            if (dist < range) {
              let dmg = 50 + Math.random() * 30;
              if (wd?.attackType === 'ranged') dmg *= 0.8;
              if (wd?.type === 'sabres') {
                const ef = new THREE.Vector3(0,0,-1).applyQuaternion(en.mesh.quaternion);
                const te = new THREE.Vector3().subVectors(en.mesh.position, playerR.current!.position).normalize();
                if (ef.dot(te) > 0.5) dmg = 175;
              }
              en.health -= dmg; en.hitFlashTimer = 0.1; en.originalEmissives.clear();
              en.mesh.traverse((c:any) => { if (c.isMesh) { const mt = c.material as THREE.MeshStandardMaterial;
                if (mt.emissive) { en.originalEmissives.set(c, mt.emissive.clone()); mt.emissive.set(0xffffff); mt.emissiveIntensity = 1; } } });
            }
          });
        }
      };
      const onMU = () => { mouse.current.down = false; };
      document.addEventListener('keydown', onKD); document.addEventListener('keyup', onKU);
      document.addEventListener('mousemove', onMM); document.addEventListener('mousedown', onMD); document.addEventListener('mouseup', onMU);

      // ═══ GAME LOOP ═══
      let et = 0;
      const animate = () => {
        const dt = Math.min(clock.current.getDelta(), 0.05); et += dt;
        const k = keys.current;
        // Movement
        const mv = new THREE.Vector3();
        if (k['KeyW']||k['ArrowUp']) mv.z -= 1; if (k['KeyS']||k['ArrowDown']) mv.z += 1;
        if (k['KeyA']||k['ArrowLeft']) mv.x -= 1; if (k['KeyD']||k['ArrowRight']) mv.x += 1;
        const moving = mv.length() > 0;
        if (moving) { mv.normalize().multiplyScalar(8 * dt); pPos.current.add(mv);
          pPos.current.x = Math.max(-28, Math.min(28, pPos.current.x));
          pPos.current.z = Math.max(-28, Math.min(28, pPos.current.z));
          pRot.current = Math.atan2(mv.x, mv.z); }

        if (playerR.current) {
          playerR.current.position.lerp(pPos.current, 0.15);
          playerR.current.rotation.y = pRot.current;
          playerR.current.position.y = Math.sin(et * (moving ? 10 : 2)) * (moving ? 0.05 : 0.02);
          if (weaponR.current) {
            weaponR.current.rotation.z = Math.sin(et * (moving ? 6 : 1.5)) * (moving ? 0.08 : 0.02);
            if (atkAnim.current.active) {
              atkAnim.current.timer -= dt; const p = 1 - atkAnim.current.timer / 0.3;
              const wd = WEAPONS.find(w => w.type === curWpnR.current);
              weaponR.current.rotation.x = wd?.attackType === 'melee' ? (p < 0.5 ? -p*2*1.5 : -(1-(p-0.5)*2)*1.5) : Math.sin(p * Math.PI) * -0.3;
              if (atkAnim.current.timer <= 0) atkAnim.current.active = false;
            } else { weaponR.current.rotation.x *= 0.9; }
          }
        }

        // Camera
        if (camera && playerR.current) {
          camera.position.lerp(new THREE.Vector3(playerR.current.position.x, 12, playerR.current.position.z + 15), 0.05);
          camera.lookAt(playerR.current.position);
          if (camShake.current.active) { camShake.current.timer -= dt;
            camera.position.x += (Math.random()-0.5) * camShake.current.intensity;
            camera.position.y += (Math.random()-0.5) * camShake.current.intensity;
            if (camShake.current.timer <= 0) camShake.current.active = false; }
        }

        // Spawn enemies
        spawnT.current -= dt;
        if (spawnT.current <= 0) { spawnT.current = 3 + Math.random() * 2;
          const a = Math.random() * Math.PI * 2; const d = 20 + Math.random() * 5;
          spawnEnemy(new THREE.Vector3(Math.cos(a)*d, 0, Math.sin(a)*d)); }

        // Update enemies
        for (let i = enemies.current.length - 1; i >= 0; i--) {
          const en = enemies.current[i];
          if (en.isDying) { en.deathTimer -= dt; en.mesh.scale.setScalar(Math.max(0, en.deathTimer/0.5)*1.5);
            if (en.deathTimer <= 0) { scene.remove(en.mesh); enemies.current.splice(i, 1); } continue; }
          if (en.hitFlashTimer > 0) { en.hitFlashTimer -= dt; if (en.hitFlashTimer <= 0) {
            en.mesh.traverse((c:any) => { if (c.isMesh) { const mt = c.material as THREE.MeshStandardMaterial;
              const o = en.originalEmissives.get(c); if (o && mt.emissive) { mt.emissive.copy(o); mt.emissiveIntensity = 0; } } }); } }
          if (en.health <= 0) { en.isDying = true; en.deathTimer = 0.5;
            burst(scene, en.mesh.position.clone().setY(1), en.type==='hazmat'?0x44ff44:0xff4444, 20, 'death');
            xpOrb(scene, en.mesh.position.clone());
            killsR.current++; setKills(killsR.current); xpR.current += 25;
            if (xpR.current >= lvlR.current * 100) { xpR.current -= lvlR.current * 100; lvlR.current++; setLevel(lvlR.current); }
            setXp(xpR.current); continue; }
          if (playerR.current) {
            const tp = new THREE.Vector3().subVectors(playerR.current.position, en.mesh.position); tp.y = 0; const dist = tp.length();
            if (dist > 0.1) en.mesh.lookAt(new THREE.Vector3(playerR.current.position.x, en.mesh.position.y, playerR.current.position.z));
            if (dist > 2) { tp.normalize().multiplyScalar(en.speed * dt); en.mesh.position.add(tp); en.position.copy(en.mesh.position);
              en.mesh.position.y = Math.sin(et * en.speed * 3) * 0.04; }
            else { en.attackCooldown -= dt; if (en.attackCooldown <= 0) { en.attackCooldown = en.type==='hazmat'?1.5:1.0;
              hpR.current = Math.max(0, hpR.current - (en.type==='hazmat'?40:20)); setHp(hpR.current);
              if (hpR.current <= 0) { setGameState('gameover'); gsR.current = 'gameover'; } } }
          }
        }

        // Particles
        for (let i = particles.current.length - 1; i >= 0; i--) {
          const p = particles.current[i]; p.lifetime -= dt;
          p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
          if (p.type !== 'tracer') p.velocity.y -= 6 * dt;
          const a = Math.max(0, p.lifetime / p.maxLifetime);
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = a; p.mesh.scale.setScalar(a);
          if (p.type === 'xp' && p.targetPos && p.lifetime < p.maxLifetime * 0.5) {
            p.velocity.copy(new THREE.Vector3().subVectors(p.targetPos, p.mesh.position).normalize().multiplyScalar(8)); p.velocity.y += 2; }
          if (p.lifetime <= 0) { scene.remove(p.mesh); particles.current.splice(i, 1); }
        }
        // Rings
        for (let i = rings.current.length - 1; i >= 0; i--) {
          const r = rings.current[i]; r.lifetime -= dt; const pg = 1 - r.lifetime / r.maxLifetime;
          r.mesh.scale.set(1+pg*5, 1+pg*5, 1); (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1-pg;
          if (r.lifetime <= 0) { scene.remove(r.mesh); rings.current.splice(i, 1); }
        }
        // Projectiles + collision
        for (let i = projs.current.length - 1; i >= 0; i--) {
          const pj = projs.current[i]; pj.mesh.position.add(pj.velocity.clone().multiplyScalar(dt)); pj.lifetime -= dt;
          if (pj.team === 'player') { for (const en of enemies.current) { if (en.isDying) continue;
            if (pj.mesh.position.distanceTo(en.mesh.position) < 1.5) { en.health -= pj.damage; en.hitFlashTimer = 0.1;
              burst(scene, pj.mesh.position.clone(), 0xffaa00, 5, 'explosion'); pj.lifetime = 0; break; } } }
          for (const cv of covers.current) { if (!cv.active) continue;
            if (cv.bounds.containsPoint(pj.mesh.position)) {
              if (cv.type === 'explosive') { cv.health = 0; cv.active = false;
                burst(scene, cv.mesh.position.clone().setY(1), 0xff4400, 40, 'explosion');
                gndRing(scene, cv.mesh.position.clone(), 0xff6600);
                camShake.current = { active: true, timer: 0.4, intensity: 0.5 };
                enemies.current.forEach(e => { if (e.mesh.position.distanceTo(cv.mesh.position) < 5) { e.health -= 200; e.hitFlashTimer = 0.2; } });
                if (playerR.current && playerR.current.position.distanceTo(cv.mesh.position) < 5) { hpR.current = Math.max(0, hpR.current-80); setHp(hpR.current); }
                scene.remove(cv.mesh);
              } else if (cv.type === 'breakable') { cv.health -= pj.damage;
                if (cv.health <= 0) { cv.active = false; burst(scene, cv.mesh.position.clone().setY(0.5), 0x8b6914, 15, 'death'); scene.remove(cv.mesh); } }
              pj.lifetime = 0; break; } }
          if (pj.lifetime <= 0 || pj.mesh.position.length() > 50) { scene.remove(pj.mesh); projs.current.splice(i, 1); }
        }
        // Pickup + hazard collision
        for (const cv of covers.current) { if (!cv.active || !playerR.current) continue;
          const d = playerR.current.position.distanceTo(cv.mesh.position);
          if (cv.type === 'pickup' && d < 2) { hpR.current = Math.min(1000, hpR.current+200); setHp(hpR.current); cv.active = false;
            burst(scene, cv.mesh.position.clone(), 0x44ff44, 20, 'ability'); scene.remove(cv.mesh);
            setTimeout(() => { if (!sceneR.current) return; cv.active = true;
              const nm = modelCache.get(ASSET_URLS.environment.Health)?.clone();
              if (nm) { nm.position.copy(cv.origPos); nm.scale.setScalar(2); sceneR.current.add(nm); cv.mesh = nm; } }, 30000); }
          if (cv.type === 'hazard' && d < 1.5) { hpR.current = Math.max(0, hpR.current-50); setHp(hpR.current); cv.active = false;
            burst(scene, cv.mesh.position.clone().setY(0.5), 0xff0000, 15, 'explosion');
            camShake.current = { active: true, timer: 0.2, intensity: 0.4 }; scene.remove(cv.mesh); }
        }

        renderer.render(scene, camera);
        loopRef.current = requestAnimationFrame(animate);
      };
      animate();

      const onResize = () => { if (!container) return; camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); };
      window.addEventListener('resize', onResize);
      return () => {
        document.removeEventListener('keydown', onKD); document.removeEventListener('keyup', onKU);
        document.removeEventListener('mousemove', onMM); document.removeEventListener('mousedown', onMD);
        document.removeEventListener('mouseup', onMU); window.removeEventListener('resize', onResize);
        if (loopRef.current) cancelAnimationFrame(loopRef.current);
        if (rendR.current && container.contains(rendR.current.domElement)) container.removeChild(rendR.current.domElement);
        rendR.current?.dispose(); initRef.current = false;
        enemies.current = []; particles.current = []; rings.current = []; projs.current = []; covers.current = [];
      };
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const curWpnData = useCallback(() => WEAPONS.find(w => w.type === curWeapon), [curWeapon]);

  // ═══ LOADING SCREEN ═══
  if (gameState === 'loading') return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-purple-500">🌋 AVERNUS</h1>
      <p className="text-gray-400 mb-6">Loading arena assets...</p>
      <div className="w-80 h-3 bg-gray-800 rounded-full overflow-hidden border border-purple-500/30">
        <div className="h-full bg-gradient-to-r from-orange-500 to-purple-500 transition-all duration-200" style={{ width: `${loadPct}%` }} />
      </div>
      <p className="text-sm text-gray-500 mt-2">{loadPct}%</p>
    </div>
  );

  // ═══ MENU / GAME OVER ═══
  if (gameState === 'menu' || gameState === 'gameover') return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white">
      <div className="absolute top-4 left-4 z-10">
        <Link href="/super-engine"><Button variant="outline" className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-black"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button></Link>
      </div>
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-6xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-purple-500">🌋 AVERNUS</h1>
        <p className="text-xl text-gray-300 mb-2">Toon Shooter Arena</p>
        {gameState === 'gameover' && <div className="mb-4 text-center"><p className="text-red-400 text-2xl font-bold mb-1">DEFEATED</p><p className="text-gray-400">Level {level} · {kills} Kills</p></div>}
        <div className="bg-gray-900/80 p-6 rounded-xl border border-purple-500/50 max-w-4xl w-full">
          <h2 className="text-xl font-semibold text-center text-purple-400 mb-4">SELECT 2 WEAPONS</h2>
          <p className="text-center text-gray-400 text-sm mb-6">Primary (1) | Secondary (2)</p>
          <div className="grid grid-cols-5 gap-3 mb-6">
            {WEAPONS.map(w => {
              const isPri = selWeapons.primary === w.type; const isSec = selWeapons.secondary === w.type; const isSel = isPri || isSec;
              return (
                <div key={w.type} onClick={() => handleWeaponSelect(w.type)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${isSel ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/30' : 'border-gray-600 bg-gray-800/50 hover:border-gray-400'}`}>
                  <div className="text-center">
                    <div className="text-3xl mb-2">{w.icon}</div>
                    <h3 className="font-bold text-sm">{w.name}</h3>
                    <p className="text-xs text-gray-400">{w.subclass}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{w.gunModel}</p>
                    {isSel && <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${isPri ? 'bg-blue-600' : 'bg-orange-600'}`}>{isPri ? 'Primary' : 'Secondary'}</span>}
                  </div>
                  <div className="mt-3 flex justify-center gap-1">
                    {w.abilities.map(a => <div key={a.key} className="w-6 h-6 rounded border border-gray-600 bg-gray-700 flex items-center justify-center text-xs" title={`${a.key}: ${a.name}`}>{a.key}</div>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center">
            <Button onClick={startGame} disabled={!selWeapons.primary || !selWeapons.secondary}
              className={`px-8 py-3 text-lg font-bold ${selWeapons.primary && selWeapons.secondary ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700' : 'bg-gray-600 cursor-not-allowed'}`}>
              {gameState === 'gameover' ? 'FIGHT AGAIN' : 'ENTER AVERNUS'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══ GAMEPLAY HUD ═══
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-4 left-4 z-10">
        <Link href="/super-engine"><Button variant="outline" size="sm" className="border-white/50 text-white hover:bg-white/20 bg-black/60 backdrop-blur-sm"><ArrowLeft className="w-4 h-4 mr-1" />Exit</Button></Link>
      </div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2">
        <div className="text-center">
          <div className="text-sm text-yellow-300 font-semibold">Level {level}</div>
          <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-yellow-500" style={{ width: `${(xp / (level * 100)) * 100}%` }} /></div>
        </div>
        <div className="text-white font-bold">Kills: {kills}</div>
      </div>
      <div className="absolute bottom-20 left-4 z-10 space-y-2 bg-black/60 backdrop-blur-sm rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-red-400 text-sm font-semibold w-12">HP</span>
          <div className="w-48 h-5 bg-gray-700 rounded overflow-hidden"><div className="h-full bg-gradient-to-r from-red-600 to-red-400" style={{ width: `${(hp / 1000) * 100}%` }} /></div>
          <span className="text-white text-sm font-medium">{hp}/1000</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 text-sm font-semibold w-12">Shield</span>
          <div className="w-48 h-4 bg-gray-700 rounded overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400" style={{ width: `${shield}%` }} /></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-purple-400 text-sm font-semibold w-12">{curWpnData()?.resourceType.toUpperCase()}</span>
          <div className="w-48 h-4 bg-gray-700 rounded overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-600 to-purple-400" style={{ width: `${resource}%` }} /></div>
        </div>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2">
        {selWeapons.primary && <button onClick={() => { curWpnR.current = selWeapons.primary; setCurWeapon(selWeapons.primary); }}
          className={`px-3 py-2 rounded border-2 cursor-pointer transition-all ${curWeapon === selWeapons.primary ? 'border-blue-400 bg-blue-500/30' : 'border-gray-500 bg-gray-800/60'}`}>
          <span className="text-xs text-gray-300 block">1</span><span className="text-2xl">{WEAPONS.find(w => w.type === selWeapons.primary)?.icon}</span></button>}
        {selWeapons.secondary && <button onClick={() => { curWpnR.current = selWeapons.secondary; setCurWeapon(selWeapons.secondary); }}
          className={`px-3 py-2 rounded border-2 cursor-pointer transition-all ${curWeapon === selWeapons.secondary ? 'border-orange-400 bg-orange-500/30' : 'border-gray-500 bg-gray-800/60'}`}>
          <span className="text-xs text-gray-300 block">2</span><span className="text-2xl">{WEAPONS.find(w => w.type === selWeapons.secondary)?.icon}</span></button>}
        <div className="flex gap-2 ml-3">
          {curWpnData()?.abilities.map(a => (
            <div key={a.key} className={`w-12 h-12 rounded border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${a.unlocked ? 'border-purple-400 bg-purple-500/30' : 'border-gray-600 bg-gray-800/50 opacity-40'}`} title={a.description}>
              <span className="text-xs font-bold text-white">{a.key}</span>
              <span className="text-[10px] text-gray-300 truncate w-full text-center">{a.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-4 right-4 z-10 text-right text-white text-sm bg-black/60 backdrop-blur-sm rounded-lg p-3">
        <div className="font-medium text-gray-200">WASD - Move</div>
        <div className="font-medium text-gray-200">Click - Attack</div>
        <div className="font-medium text-gray-200">Q/E/R/F - Abilities</div>
        <div className="font-medium text-gray-200">1/2 - Switch Weapon</div>
      </div>
    </div>
  );
}
