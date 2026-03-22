import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  Upload, 
  Download, 
  RotateCcw, 
  Move, 
  Maximize2, 
  RotateCw,
  Sun,
  Moon,
  Box,
  Cylinder,
  Circle,
  Layers,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  Settings,
  Palette
} from "lucide-react";
import { Link } from "wouter";
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

interface SceneObject {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'camera' | 'group' | 'imported';
  object: THREE.Object3D;
  visible: boolean;
}

interface MaterialSettings {
  color: string;
  metalness: number;
  roughness: number;
  emissive: string;
  emissiveIntensity: number;
  wireframe: boolean;
}

export default function GrudgeEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [gridVisible, setGridVisible] = useState(true);
  const [lightingMode, setLightingMode] = useState<'day' | 'night'>('day');
  const [activePanel, setActivePanel] = useState('scene');
  const [materialSettings, setMaterialSettings] = useState<MaterialSettings>({
    color: '#ff6b35',
    metalness: 0.5,
    roughness: 0.5,
    emissive: '#000000',
    emissiveIntensity: 0,
    wireframe: false
  });

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const objectsMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addObjectToScene = useCallback((name: string, type: SceneObject['type'], object: THREE.Object3D) => {
    const id = generateId();
    objectsMapRef.current.set(id, object);
    sceneRef.current?.add(object);
    
    setSceneObjects(prev => [...prev, {
      id,
      name,
      type,
      object,
      visible: true
    }]);
    
    return id;
  }, []);

  const removeObject = useCallback((id: string) => {
    const object = objectsMapRef.current.get(id);
    if (object && sceneRef.current) {
      sceneRef.current.remove(object);
      objectsMapRef.current.delete(id);
      setSceneObjects(prev => prev.filter(o => o.id !== id));
      if (selectedObjectId === id) {
        setSelectedObjectId(null);
        transformControlsRef.current?.detach();
      }
    }
  }, [selectedObjectId]);

  const duplicateObject = useCallback((id: string) => {
    const sourceObj = sceneObjects.find(o => o.id === id);
    if (!sourceObj) return;
    
    const clone = sourceObj.object.clone();
    clone.position.x += 2;
    addObjectToScene(`${sourceObj.name} (copy)`, sourceObj.type, clone);
  }, [sceneObjects, addObjectToScene]);

  const selectObject = useCallback((id: string | null) => {
    setSelectedObjectId(id);
    if (id && transformControlsRef.current) {
      const object = objectsMapRef.current.get(id);
      if (object) {
        transformControlsRef.current.attach(object);
        
        if ((object as THREE.Mesh).material) {
          const mat = (object as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat.color) {
            setMaterialSettings({
              color: '#' + mat.color.getHexString(),
              metalness: mat.metalness || 0.5,
              roughness: mat.roughness || 0.5,
              emissive: mat.emissive ? '#' + mat.emissive.getHexString() : '#000000',
              emissiveIntensity: mat.emissiveIntensity || 0,
              wireframe: mat.wireframe || false
            });
          }
        }
      }
    } else {
      transformControlsRef.current?.detach();
    }
  }, []);

  const toggleVisibility = useCallback((id: string) => {
    const object = objectsMapRef.current.get(id);
    if (object) {
      object.visible = !object.visible;
      setSceneObjects(prev => prev.map(o => 
        o.id === id ? { ...o, visible: object.visible } : o
      ));
    }
  }, []);

  const addPrimitive = useCallback((type: 'box' | 'sphere' | 'cylinder' | 'plane' | 'cone' | 'torus') => {
    let geometry: THREE.BufferGeometry;
    let name: string;
    
    switch (type) {
      case 'box':
        geometry = new THREE.BoxGeometry(1, 1, 1);
        name = 'Cube';
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.5, 32, 32);
        name = 'Sphere';
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
        name = 'Cylinder';
        break;
      case 'plane':
        geometry = new THREE.PlaneGeometry(2, 2);
        name = 'Plane';
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(0.5, 1, 32);
        name = 'Cone';
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 48);
        name = 'Torus';
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
        name = 'Cube';
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: parseInt(materialSettings.color.slice(1), 16),
      metalness: materialSettings.metalness,
      roughness: materialSettings.roughness
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = 0.5;
    
    const id = addObjectToScene(name, 'mesh', mesh);
    selectObject(id);
  }, [addObjectToScene, selectObject, materialSettings]);

  const handleFileImport = useCallback(async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const url = URL.createObjectURL(file);
    
    try {
      let object: THREE.Object3D | null = null;
      
      if (extension === 'glb' || extension === 'gltf') {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);
        object = gltf.scene;
      } else if (extension === 'obj') {
        const loader = new OBJLoader();
        object = await loader.loadAsync(url);
      } else if (extension === 'fbx') {
        const loader = new FBXLoader();
        object = await loader.loadAsync(url);
        object.scale.setScalar(0.01);
      }
      
      if (object) {
        object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        object.position.sub(center);
        object.position.y = 0;
        
        const id = addObjectToScene(file.name, 'imported', object);
        selectObject(id);
      }
    } catch (error) {
      console.error('Failed to load model:', error);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [addObjectToScene, selectObject]);

  const exportScene = useCallback(async (format: 'gltf' | 'glb' | 'obj') => {
    if (!sceneRef.current) return;
    
    const exportGroup = new THREE.Group();
    sceneObjects.forEach(obj => {
      if (obj.type === 'mesh' || obj.type === 'imported' || obj.type === 'group') {
        exportGroup.add(obj.object.clone());
      }
    });
    
    if (format === 'gltf' || format === 'glb') {
      const exporter = new GLTFExporter();
      const options = { binary: format === 'glb' };
      
      exporter.parse(exportGroup, (result) => {
        let blob: Blob;
        let filename: string;
        
        if (result instanceof ArrayBuffer) {
          blob = new Blob([result], { type: 'application/octet-stream' });
          filename = 'scene.glb';
        } else {
          blob = new Blob([JSON.stringify(result)], { type: 'application/json' });
          filename = 'scene.gltf';
        }
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }, (error) => { console.error('Export error:', error); }, options);
    } else if (format === 'obj') {
      const exporter = new OBJExporter();
      const result = exporter.parse(exportGroup);
      const blob = new Blob([result], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scene.obj';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [sceneObjects]);

  const applyMaterial = useCallback(() => {
    if (!selectedObjectId) return;
    
    const object = objectsMapRef.current.get(selectedObjectId);
    if (!object) return;
    
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.color.set(materialSettings.color);
          mat.metalness = materialSettings.metalness;
          mat.roughness = materialSettings.roughness;
          mat.emissive.set(materialSettings.emissive);
          mat.emissiveIntensity = materialSettings.emissiveIntensity;
          mat.wireframe = materialSettings.wireframe;
          mat.needsUpdate = true;
        }
      }
    });
  }, [selectedObjectId, materialSettings]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControlsRef.current = orbitControls;
    
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value;
    });
    scene.add(transformControls as unknown as THREE.Object3D);
    transformControlsRef.current = transformControls;
    
    const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(grid);
    gridRef.current = grid;
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);
    directionalLightRef.current = directionalLight;
    
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    setLoadProgress(100);
    setIsLoading(false);
    
    const animate = () => {
      requestAnimationFrame(animate);
      orbitControls.update();
      renderer.render(scene, camera);
    };
    animate();
    
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'g') setTransformMode('translate');
      if (e.key === 'r') setTransformMode('rotate');
      if (e.key === 's') setTransformMode('scale');
      if (e.key === 'Delete' && selectedObjectId) {
        removeObject(selectedObjectId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [removeObject, selectedObjectId]);

  useEffect(() => {
    if (transformControlsRef.current) {
      transformControlsRef.current.setMode(transformMode);
    }
  }, [transformMode]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.visible = gridVisible;
    }
  }, [gridVisible]);

  useEffect(() => {
    if (ambientLightRef.current && directionalLightRef.current) {
      if (lightingMode === 'day') {
        ambientLightRef.current.intensity = 0.4;
        directionalLightRef.current.intensity = 1;
        if (sceneRef.current) {
          sceneRef.current.background = new THREE.Color(0x87CEEB);
        }
      } else {
        ambientLightRef.current.intensity = 0.1;
        directionalLightRef.current.intensity = 0.3;
        if (sceneRef.current) {
          sceneRef.current.background = new THREE.Color(0x0a0a1a);
        }
      }
    }
  }, [lightingMode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['glb', 'gltf', 'obj', 'fbx'].includes(ext || '')) {
        handleFileImport(file);
      }
    });
  }, [handleFileImport]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-gray-800/90 border-b border-gray-700 p-3">
        <div className="flex items-center justify-between max-w-full">
          <div className="flex items-center space-x-4">
            <Link href="/super-engine">
              <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                Grudge Editor
              </h1>
              <p className="text-xs text-gray-400">3D Object Editor for Three.js, Needle, React & Node.js</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge className="bg-green-500/20 text-green-400">Ready</Badge>
            
            <div className="flex items-center space-x-1 bg-gray-700 rounded-lg p-1">
              <Button 
                variant={transformMode === 'translate' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTransformMode('translate')}
                className="h-8 px-2"
                data-testid="button-translate"
              >
                <Move className="w-4 h-4" />
              </Button>
              <Button 
                variant={transformMode === 'rotate' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTransformMode('rotate')}
                className="h-8 px-2"
                data-testid="button-rotate"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button 
                variant={transformMode === 'scale' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTransformMode('scale')}
                className="h-8 px-2"
                data-testid="button-scale"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setGridVisible(!gridVisible)}
              className={gridVisible ? 'text-orange-400' : 'text-gray-400'}
              data-testid="button-toggle-grid"
            >
              <Layers className="w-4 h-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLightingMode(lightingMode === 'day' ? 'night' : 'day')}
              data-testid="button-toggle-lighting"
            >
              {lightingMode === 'day' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
          <Tabs value={activePanel} onValueChange={setActivePanel} className="flex-1 flex flex-col">
            <TabsList className="w-full grid grid-cols-3 bg-gray-700/50 rounded-none">
              <TabsTrigger value="scene" className="text-xs data-[state=active]:bg-orange-500">Scene</TabsTrigger>
              <TabsTrigger value="add" className="text-xs data-[state=active]:bg-orange-500">Add</TabsTrigger>
              <TabsTrigger value="material" className="text-xs data-[state=active]:bg-orange-500">Material</TabsTrigger>
            </TabsList>
            
            <TabsContent value="scene" className="flex-1 overflow-auto p-2 space-y-2">
              <div className="text-xs text-gray-400 uppercase mb-2">Scene Objects</div>
              {sceneObjects.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No objects yet</p>
              ) : (
                sceneObjects.map(obj => (
                  <div 
                    key={obj.id}
                    className={`p-2 rounded cursor-pointer flex items-center justify-between ${
                      selectedObjectId === obj.id ? 'bg-orange-500/30 border border-orange-500' : 'bg-gray-700/50 hover:bg-gray-700'
                    }`}
                    onClick={() => selectObject(obj.id)}
                    data-testid={`scene-object-${obj.id}`}
                  >
                    <div className="flex items-center space-x-2">
                      <Box className="w-3 h-3 text-gray-400" />
                      <span className="text-sm truncate">{obj.name}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleVisibility(obj.id); }}
                        className="p-1 hover:bg-gray-600 rounded"
                        data-testid={`toggle-visibility-${obj.id}`}
                      >
                        {obj.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-gray-500" />}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); duplicateObject(obj.id); }}
                        className="p-1 hover:bg-gray-600 rounded"
                        data-testid={`duplicate-${obj.id}`}
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeObject(obj.id); }}
                        className="p-1 hover:bg-red-600 rounded"
                        data-testid={`delete-${obj.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
            
            <TabsContent value="add" className="flex-1 overflow-auto p-2 space-y-3">
              <div className="text-xs text-gray-400 uppercase mb-2">Primitives</div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => addPrimitive('box')} className="h-16 flex-col" data-testid="add-cube">
                  <Box className="w-5 h-5 mb-1" />
                  <span className="text-xs">Cube</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => addPrimitive('sphere')} className="h-16 flex-col" data-testid="add-sphere">
                  <Circle className="w-5 h-5 mb-1" />
                  <span className="text-xs">Sphere</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => addPrimitive('cylinder')} className="h-16 flex-col" data-testid="add-cylinder">
                  <Cylinder className="w-5 h-5 mb-1" />
                  <span className="text-xs">Cylinder</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => addPrimitive('plane')} className="h-16 flex-col" data-testid="add-plane">
                  <Layers className="w-5 h-5 mb-1" />
                  <span className="text-xs">Plane</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => addPrimitive('cone')} className="h-16 flex-col" data-testid="add-cone">
                  <Box className="w-5 h-5 mb-1" />
                  <span className="text-xs">Cone</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => addPrimitive('torus')} className="h-16 flex-col" data-testid="add-torus">
                  <Circle className="w-5 h-5 mb-1" />
                  <span className="text-xs">Torus</span>
                </Button>
              </div>
              
              <div className="text-xs text-gray-400 uppercase mt-4 mb-2">Import</div>
              <label className="block">
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-orange-500 transition-colors">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                  <p className="text-xs text-gray-400">Drop or click to import</p>
                  <p className="text-xs text-gray-500 mt-1">GLB, GLTF, OBJ, FBX</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".glb,.gltf,.obj,.fbx"
                  onChange={(e) => e.target.files?.[0] && handleFileImport(e.target.files[0])}
                  data-testid="input-file-import"
                />
              </label>
            </TabsContent>
            
            <TabsContent value="material" className="flex-1 overflow-auto p-2 space-y-3">
              <div className="text-xs text-gray-400 uppercase mb-2">Material Properties</div>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-gray-400">Color</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <input 
                      type="color" 
                      value={materialSettings.color}
                      onChange={(e) => setMaterialSettings(prev => ({ ...prev, color: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer"
                      data-testid="input-color"
                    />
                    <Input 
                      value={materialSettings.color}
                      onChange={(e) => setMaterialSettings(prev => ({ ...prev, color: e.target.value }))}
                      className="flex-1 h-8 text-xs bg-gray-700 border-gray-600"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs text-gray-400">Metalness: {materialSettings.metalness.toFixed(2)}</Label>
                  <Slider
                    value={[materialSettings.metalness]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={([v]) => setMaterialSettings(prev => ({ ...prev, metalness: v }))}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-xs text-gray-400">Roughness: {materialSettings.roughness.toFixed(2)}</Label>
                  <Slider
                    value={[materialSettings.roughness]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={([v]) => setMaterialSettings(prev => ({ ...prev, roughness: v }))}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-xs text-gray-400">Emissive</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <input 
                      type="color" 
                      value={materialSettings.emissive}
                      onChange={(e) => setMaterialSettings(prev => ({ ...prev, emissive: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                    <Slider
                      value={[materialSettings.emissiveIntensity]}
                      min={0}
                      max={2}
                      step={0.1}
                      onValueChange={([v]) => setMaterialSettings(prev => ({ ...prev, emissiveIntensity: v }))}
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox"
                    checked={materialSettings.wireframe}
                    onChange={(e) => setMaterialSettings(prev => ({ ...prev, wireframe: e.target.checked }))}
                    className="rounded"
                  />
                  <Label className="text-xs text-gray-400">Wireframe</Label>
                </div>
                
                <Button 
                  onClick={applyMaterial}
                  disabled={!selectedObjectId}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  data-testid="button-apply-material"
                >
                  <Palette className="w-4 h-4 mr-2" />
                  Apply Material
                </Button>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="p-2 border-t border-gray-700 space-y-2">
            <div className="text-xs text-gray-400 uppercase">Export</div>
            <div className="grid grid-cols-3 gap-1">
              <Button variant="outline" size="sm" onClick={() => exportScene('glb')} className="text-xs" data-testid="export-glb">
                GLB
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportScene('gltf')} className="text-xs" data-testid="export-gltf">
                GLTF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportScene('obj')} className="text-xs" data-testid="export-obj">
                OBJ
              </Button>
            </div>
          </div>
        </div>
        
        <div 
          ref={containerRef} 
          className="flex-1 relative"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {isLoading && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-300 mb-2">Initializing Grudge Editor...</p>
                <div className="w-64 bg-gray-700 rounded-full h-2 mx-auto">
                  <div 
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${loadProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {selectedObjectId && (
          <div className="w-56 bg-gray-800 border-l border-gray-700 p-3 space-y-3">
            <div className="text-xs text-gray-400 uppercase">Transform</div>
            {(() => {
              const obj = objectsMapRef.current.get(selectedObjectId);
              if (!obj) return null;
              return (
                <div className="space-y-2 text-xs">
                  <div>
                    <Label className="text-gray-500">Position</Label>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      <Input value={obj.position.x.toFixed(2)} readOnly className="h-6 text-xs bg-gray-700 border-gray-600 text-center" />
                      <Input value={obj.position.y.toFixed(2)} readOnly className="h-6 text-xs bg-gray-700 border-gray-600 text-center" />
                      <Input value={obj.position.z.toFixed(2)} readOnly className="h-6 text-xs bg-gray-700 border-gray-600 text-center" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-500">Rotation (deg)</Label>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      <Input value={(obj.rotation.x * 180 / Math.PI).toFixed(1)} readOnly className="h-6 text-xs bg-gray-700 border-gray-600 text-center" />
                      <Input value={(obj.rotation.y * 180 / Math.PI).toFixed(1)} readOnly className="h-6 text-xs bg-gray-700 border-gray-600 text-center" />
                      <Input value={(obj.rotation.z * 180 / Math.PI).toFixed(1)} readOnly className="h-6 text-xs bg-gray-700 border-gray-600 text-center" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-500">Scale</Label>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      <Input value={obj.scale.x.toFixed(2)} readOnly className="h-6 text-xs bg-gray-700 border-gray-600 text-center" />
                      <Input value={obj.scale.y.toFixed(2)} readOnly className="h-6 text-xs bg-gray-700 border-gray-600 text-center" />
                      <Input value={obj.scale.z.toFixed(2)} readOnly className="h-6 text-xs bg-gray-700 border-gray-600 text-center" />
                    </div>
                  </div>
                </div>
              );
            })()}
            
            <div className="text-xs text-gray-400 mt-4">Shortcuts</div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>G - Move</p>
              <p>R - Rotate</p>
              <p>S - Scale</p>
              <p>Delete - Remove</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
