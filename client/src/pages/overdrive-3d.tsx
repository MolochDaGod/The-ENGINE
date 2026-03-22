import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

interface Obstacle {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  type: 'barrel' | 'crate' | 'rock';
}

export default function Overdrive3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [health, setHealth] = useState(100);
  const [distance, setDistance] = useState(0);
  const [topSpeed, setTopSpeed] = useState(0);
  const [obstaclesDodged, setObstaclesDodged] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldRef = useRef<CANNON.World | null>(null);
  const vehicleRef = useRef<CANNON.RaycastVehicle | null>(null);
  const carMeshRef = useRef<THREE.Group | null>(null);
  const wheelMeshesRef = useRef<THREE.Mesh[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const clockRef = useRef(new THREE.Clock());
  const healthRef = useRef(100);
  const lastDamageRef = useRef(0);
  const distanceRef = useRef(0);

  const createVehicle = useCallback((world: CANNON.World, scene: THREE.Scene) => {
    const chassisShape = new CANNON.Box(new CANNON.Vec3(0.9, 0.4, 2));
    const chassisBody = new CANNON.Body({
      mass: 1500,
      position: new CANNON.Vec3(0, 2, 0),
      shape: chassisShape,
      angularDamping: 0.4,
      linearDamping: 0.1
    });

    const vehicle = new CANNON.RaycastVehicle({
      chassisBody,
      indexRightAxis: 0,
      indexForwardAxis: 2,
      indexUpAxis: 1
    });

    const wheelOptions = {
      radius: 0.35,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 30,
      suspensionRestLength: 0.4,
      frictionSlip: 1.5,
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      maxSuspensionForce: 100000,
      rollInfluence: 0.01,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 0, 0),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true
    };

    const wheelPositions = [
      new CANNON.Vec3(-0.85, -0.3, 1.2),
      new CANNON.Vec3(0.85, -0.3, 1.2),
      new CANNON.Vec3(-0.85, -0.3, -1.2),
      new CANNON.Vec3(0.85, -0.3, -1.2)
    ];

    wheelPositions.forEach(pos => {
      wheelOptions.chassisConnectionPointLocal = pos;
      vehicle.addWheel(wheelOptions);
    });

    vehicle.addToWorld(world);

    const carGroup = new THREE.Group();
    
    const bodyGeometry = new THREE.BoxGeometry(1.8, 0.6, 4);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xff3333,
      metalness: 0.8,
      roughness: 0.2
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.castShadow = true;
    carGroup.add(bodyMesh);

    const roofGeometry = new THREE.BoxGeometry(1.4, 0.5, 1.8);
    const roofMesh = new THREE.Mesh(roofGeometry, bodyMaterial);
    roofMesh.position.set(0, 0.5, -0.3);
    roofMesh.castShadow = true;
    carGroup.add(roofMesh);

    const hoodGeometry = new THREE.BoxGeometry(1.6, 0.3, 1.2);
    const hoodMesh = new THREE.Mesh(hoodGeometry, bodyMaterial);
    hoodMesh.position.set(0, 0.15, 1.3);
    hoodMesh.castShadow = true;
    carGroup.add(hoodMesh);

    const headlightGeometry = new THREE.CircleGeometry(0.15, 16);
    const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    leftHeadlight.position.set(-0.5, 0, 2.01);
    carGroup.add(leftHeadlight);
    const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    rightHeadlight.position.set(0.5, 0, 2.01);
    carGroup.add(rightHeadlight);

    const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 24);
    wheelGeometry.rotateZ(Math.PI / 2);
    const wheelMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x222222,
      metalness: 0.3,
      roughness: 0.8
    });

    const wheels: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheelMesh.castShadow = true;
      scene.add(wheelMesh);
      wheels.push(wheelMesh);
    }
    
    scene.add(carGroup);
    carMeshRef.current = carGroup;
    wheelMeshesRef.current = wheels;

    return vehicle;
  }, []);

  const createObstacle = useCallback((world: CANNON.World, scene: THREE.Scene, z: number) => {
    const types: ('barrel' | 'crate' | 'rock')[] = ['barrel', 'crate', 'rock'];
    const type = types[Math.floor(Math.random() * types.length)];
    const lane = (Math.floor(Math.random() * 3) - 1) * 4;

    let geometry: THREE.BufferGeometry;
    let shape: CANNON.Shape;
    let color: number;
    let scale = 1;

    switch (type) {
      case 'barrel':
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16);
        shape = new CANNON.Cylinder(0.5, 0.5, 1.2, 16);
        color = 0xcc4400;
        break;
      case 'crate':
        geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        shape = new CANNON.Box(new CANNON.Vec3(0.6, 0.6, 0.6));
        color = 0x8B4513;
        break;
      case 'rock':
        geometry = new THREE.DodecahedronGeometry(0.8);
        shape = new CANNON.Sphere(0.8);
        color = 0x666666;
        scale = 0.8 + Math.random() * 0.5;
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
        shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
        color = 0xff0000;
    }

    const material = new THREE.MeshStandardMaterial({ 
      color,
      roughness: 0.7,
      metalness: 0.3
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const body = new CANNON.Body({
      mass: 50,
      position: new CANNON.Vec3(lane, 1, z),
      shape
    });

    world.addBody(body);
    scene.add(mesh);

    return { mesh, body, type };
  }, []);

  useEffect(() => {
    if (!gameStarted || !containerRef.current || gameOver) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0xb4c4de, 0.008);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, -10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.defaultContactMaterial.friction = 0.5;
    worldRef.current = world;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff2b1, 1.5);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    scene.add(sunLight);

    const groundGeometry = new THREE.PlaneGeometry(100, 1000, 20, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3a4a3a,
      roughness: 0.9
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.z = 400;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane()
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    const roadGeometry = new THREE.PlaneGeometry(14, 1000);
    const roadMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x333333,
      roughness: 0.85
    });
    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.y = 0.01;
    roadMesh.position.z = 400;
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    for (let z = 0; z < 1000; z += 15) {
      const lineGeometry = new THREE.PlaneGeometry(0.2, 8);
      const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const lineMesh = new THREE.Mesh(lineGeometry, lineMaterial);
      lineMesh.rotation.x = -Math.PI / 2;
      lineMesh.position.set(0, 0.02, z);
      scene.add(lineMesh);
    }

    const vehicle = createVehicle(world, scene);
    vehicleRef.current = vehicle;

    for (let z = 50; z < 800; z += 30 + Math.random() * 20) {
      obstaclesRef.current.push(createObstacle(world, scene, z));
    }

    setLoading(false);
    setLoadProgress(100);

    const onKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    let animationId: number;
    const maxSteer = 0.4;
    const maxForce = 2000;
    const brakeForce = 50;

    const animate = () => {
      const delta = clockRef.current.getDelta();
      world.step(1/60, delta, 3);

      let engineForce = 0;
      let steering = 0;
      let brake = 0;

      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) {
        engineForce = maxForce;
      }
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) {
        engineForce = -maxForce * 0.5;
        brake = brakeForce;
      }
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) {
        steering = maxSteer;
      }
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) {
        steering = -maxSteer;
      }

      vehicle.applyEngineForce(engineForce, 2);
      vehicle.applyEngineForce(engineForce, 3);
      vehicle.setSteeringValue(steering, 0);
      vehicle.setSteeringValue(steering, 1);
      vehicle.setBrake(brake, 0);
      vehicle.setBrake(brake, 1);
      vehicle.setBrake(brake, 2);
      vehicle.setBrake(brake, 3);

      if (carMeshRef.current) {
        const chassisBody = vehicle.chassisBody;
        carMeshRef.current.position.copy(chassisBody.position as unknown as THREE.Vector3);
        carMeshRef.current.quaternion.copy(chassisBody.quaternion as unknown as THREE.Quaternion);
      }

      for (let i = 0; i < 4; i++) {
        vehicle.updateWheelTransform(i);
        const t = vehicle.wheelInfos[i].worldTransform;
        wheelMeshesRef.current[i].position.copy(t.position as unknown as THREE.Vector3);
        wheelMeshesRef.current[i].quaternion.copy(t.quaternion as unknown as THREE.Quaternion);
      }

      const chassisBody = vehicle.chassisBody;
      const velocity = chassisBody.velocity.length();
      const speedKmh = Math.abs(velocity * 3.6);
      setSpeed(Math.round(speedKmh));
      if (speedKmh > topSpeed) setTopSpeed(Math.round(speedKmh));

      distanceRef.current += velocity * delta * 0.01;
      setDistance(Math.round(distanceRef.current));

      const targetCamPos = new THREE.Vector3(
        chassisBody.position.x,
        chassisBody.position.y + 4 + speedKmh * 0.02,
        chassisBody.position.z - 8 - speedKmh * 0.03
      );
      camera.position.lerp(targetCamPos, 0.08);
      camera.lookAt(
        chassisBody.position.x,
        chassisBody.position.y + 1,
        chassisBody.position.z + 10
      );

      sunLight.position.set(
        chassisBody.position.x + 30,
        100,
        chassisBody.position.z + 30
      );
      sunLight.target.position.copy(chassisBody.position as unknown as THREE.Vector3);

      for (const obstacle of obstaclesRef.current) {
        obstacle.mesh.position.copy(obstacle.body.position as unknown as THREE.Vector3);
        obstacle.mesh.quaternion.copy(obstacle.body.quaternion as unknown as THREE.Quaternion);

        const dx = chassisBody.position.x - obstacle.body.position.x;
        const dz = chassisBody.position.z - obstacle.body.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 2.5 && Date.now() - lastDamageRef.current > 500) {
          healthRef.current -= 15;
          lastDamageRef.current = Date.now();
          setHealth(healthRef.current);
          
          if (healthRef.current <= 0) {
            setGameOver(true);
            return;
          }
        }

        if (obstacle.body.position.z < chassisBody.position.z - 20) {
          setObstaclesDodged(prev => prev + 1);
          obstacle.body.position.z = chassisBody.position.z + 200 + Math.random() * 100;
          obstacle.body.position.x = (Math.floor(Math.random() * 3) - 1) * 4;
          obstacle.body.velocity.set(0, 0, 0);
          obstacle.body.angularVelocity.set(0, 0, 0);
        }
      }

      if (chassisBody.position.x < -7 || chassisBody.position.x > 7) {
        chassisBody.position.x = Math.max(-6.5, Math.min(6.5, chassisBody.position.x));
      }

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', handleResize);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [gameStarted, gameOver, createVehicle, createObstacle, topSpeed]);

  const resetGame = () => {
    setGameOver(false);
    setGameStarted(false);
    setHealth(100);
    setSpeed(0);
    setDistance(0);
    setTopSpeed(0);
    setObstaclesDodged(0);
    healthRef.current = 100;
    distanceRef.current = 0;
    lastDamageRef.current = 0;
    obstaclesRef.current = [];
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-900 to-yellow-900 flex items-center justify-center">
        <div className="text-center max-w-2xl mx-auto p-8">
          <Link href="/super-engine">
            <Button variant="outline" className="absolute top-4 left-4 border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-black" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400 mb-4">
            OVERDRIVE
          </h1>
          <p className="text-xl text-gray-200 mb-2">3D Racing with Physics</p>
          <p className="text-gray-300 mb-8">
            Experience realistic vehicle physics powered by Cannon.js and Three.js.
            Dodge obstacles, maintain speed, and survive as long as possible.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8 text-left bg-black/30 p-6 rounded-lg">
            <div>
              <h3 className="text-orange-400 font-bold mb-2">Controls</h3>
              <p className="text-gray-300 text-sm">W / Up Arrow - Accelerate</p>
              <p className="text-gray-300 text-sm">S / Down Arrow - Brake/Reverse</p>
              <p className="text-gray-300 text-sm">A / Left Arrow - Steer Left</p>
              <p className="text-gray-300 text-sm">D / Right Arrow - Steer Right</p>
            </div>
            <div>
              <h3 className="text-orange-400 font-bold mb-2">Obstacles</h3>
              <p className="text-orange-300 text-sm">Barrels - Explosive danger</p>
              <p className="text-yellow-700 text-sm">Crates - Heavy impact</p>
              <p className="text-gray-400 text-sm">Rocks - Natural hazards</p>
            </div>
          </div>

          <Button 
            onClick={() => setGameStarted(true)}
            className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-black font-bold px-12 py-6 text-xl"
            data-testid="button-start-game"
          >
            <Play className="w-6 h-6 mr-2" />
            Start Racing
          </Button>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-gray-900 flex items-center justify-center">
        <div className="text-center bg-black/80 p-12 rounded-xl border border-red-500/30">
          <h1 className="text-5xl font-bold text-red-500 mb-6">WRECKED!</h1>
          
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <div className="text-3xl font-bold text-orange-400">{distance}m</div>
              <div className="text-gray-400 text-sm">Distance</div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <div className="text-3xl font-bold text-yellow-400">{topSpeed} km/h</div>
              <div className="text-gray-400 text-sm">Top Speed</div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <div className="text-3xl font-bold text-green-400">{obstaclesDodged}</div>
              <div className="text-gray-400 text-sm">Dodged</div>
            </div>
          </div>
          
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={resetGame}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="button-play-again"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Race Again
            </Button>
            <Link href="/super-engine">
              <Button variant="outline" className="border-gray-500 text-gray-400" data-testid="button-exit">
                Exit
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <div ref={containerRef} className="absolute inset-0" />

      {loading && (
        <div className="absolute inset-0 bg-black flex items-center justify-center z-50">
          <div className="text-center">
            <h2 className="text-2xl text-orange-400 mb-4">Loading Overdrive...</h2>
            <div className="w-64 h-2 bg-gray-700 rounded-full">
              <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${loadProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Speedometer */}
      <div className="absolute bottom-8 left-8">
        <div className="bg-black/70 rounded-full w-40 h-40 flex items-center justify-center border-4 border-orange-500">
          <div className="text-center">
            <div className="text-4xl font-bold text-white">{speed}</div>
            <div className="text-orange-400 text-sm">km/h</div>
          </div>
        </div>
      </div>

      {/* Health Bar */}
      <div className="absolute top-4 left-4 right-4">
        <div className="max-w-md mx-auto">
          <div className="bg-black/60 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-400 text-sm">DAMAGE</span>
              <span className={`text-sm font-bold ${health > 50 ? 'text-green-400' : health > 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                {health}%
              </span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${health > 50 ? 'bg-green-500' : health > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${health}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 space-y-2">
        <div className="bg-black/60 px-4 py-2 rounded text-right">
          <div className="text-orange-400 text-xs">DISTANCE</div>
          <div className="text-white text-xl font-bold">{distance}m</div>
        </div>
        <div className="bg-black/60 px-4 py-2 rounded text-right">
          <div className="text-yellow-400 text-xs">TOP SPEED</div>
          <div className="text-white text-xl font-bold">{topSpeed} km/h</div>
        </div>
        <div className="bg-black/60 px-4 py-2 rounded text-right">
          <div className="text-green-400 text-xs">DODGED</div>
          <div className="text-white text-xl font-bold">{obstaclesDodged}</div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 bg-black/60 px-4 py-2 rounded">
        <div className="text-gray-400 text-xs text-center">
          WASD / Arrows to drive
        </div>
      </div>
    </div>
  );
}
