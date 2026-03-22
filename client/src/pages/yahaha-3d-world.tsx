import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { 
  ArrowLeft,
  Box,
  Move3D,
  Palette,
  Zap,
  Camera,
  Package,
  Play,
  Pause,
  RotateCcw,
  Sun,
  Moon,
  Eye,
  Settings,
  Download,
  Share2
} from "lucide-react";
import { Link } from "wouter";

interface Transform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

interface YahahaObject {
  id: string;
  name: string;
  type: 'cube' | 'sphere' | 'capsule' | 'plane' | 'character' | 'environment';
  transform: Transform;
  material: {
    color: string;
    metallic: number;
    roughness: number;
    emission: number;
  };
  physics: {
    enabled: boolean;
    collider: 'sphere' | 'box' | 'capsule';
    mass: number;
    friction: number;
  };
  visible: boolean;
}

interface Scene3D {
  id: string;
  name: string;
  objects: YahahaObject[];
  lighting: {
    ambient: number;
    directional: { intensity: number; color: string; direction: { x: number; y: number; z: number } };
    point: { intensity: number; color: string; position: { x: number; y: number; z: number } };
  };
  camera: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    fov: number;
  };
}

export default function Yahaha3DWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedObject, setSelectedObject] = useState<YahahaObject | null>(null);
  const [scene, setScene] = useState<Scene3D>({
    id: 'main-scene',
    name: 'Main 3D Scene',
    objects: [
      {
        id: 'ground',
        name: 'Ground Plane',
        type: 'plane',
        transform: {
          position: { x: 0, y: -1, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 10, y: 1, z: 10 }
        },
        material: {
          color: '#4a9eff',
          metallic: 0.2,
          roughness: 0.8,
          emission: 0
        },
        physics: {
          enabled: true,
          collider: 'box',
          mass: 0,
          friction: 0.7
        },
        visible: true
      },
      {
        id: 'player',
        name: 'Player Character',
        type: 'capsule',
        transform: {
          position: { x: 0, y: 1, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        },
        material: {
          color: '#ff6b35',
          metallic: 0.1,
          roughness: 0.4,
          emission: 0.1
        },
        physics: {
          enabled: true,
          collider: 'capsule',
          mass: 1,
          friction: 0.5
        },
        visible: true
      },
      {
        id: 'obstacle1',
        name: 'Obstacle Cube',
        type: 'cube',
        transform: {
          position: { x: 3, y: 0.5, z: 2 },
          rotation: { x: 0, y: 45, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        },
        material: {
          color: '#f7931e',
          metallic: 0.8,
          roughness: 0.2,
          emission: 0
        },
        physics: {
          enabled: true,
          collider: 'box',
          mass: 2,
          friction: 0.6
        },
        visible: true
      },
      {
        id: 'collectible',
        name: 'Collectible Sphere',
        type: 'sphere',
        transform: {
          position: { x: -2, y: 2, z: -3 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 0.8, y: 0.8, z: 0.8 }
        },
        material: {
          color: '#00d2d3',
          metallic: 0.9,
          roughness: 0.1,
          emission: 0.3
        },
        physics: {
          enabled: true,
          collider: 'sphere',
          mass: 0.5,
          friction: 0.3
        },
        visible: true
      }
    ],
    lighting: {
      ambient: 0.3,
      directional: {
        intensity: 0.8,
        color: '#ffffff',
        direction: { x: -0.5, y: -1, z: -0.5 }
      },
      point: {
        intensity: 1.2,
        color: '#ffd700',
        position: { x: 0, y: 5, z: 0 }
      }
    },
    camera: {
      position: { x: 5, y: 3, z: 5 },
      target: { x: 0, y: 0, z: 0 },
      fov: 60
    }
  });

  const [gameTime, setGameTime] = useState(0);

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setGameTime(prev => prev + 0.016); // 60 FPS
        
        // Animate collectible rotation
        setScene(prevScene => ({
          ...prevScene,
          objects: prevScene.objects.map(obj => 
            obj.id === 'collectible' 
              ? {
                  ...obj,
                  transform: {
                    ...obj.transform,
                    rotation: {
                      ...obj.transform.rotation,
                      y: (obj.transform.rotation.y + 2) % 360
                    }
                  }
                }
              : obj
          )
        }));
      }, 16);
      
      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple 3D rendering simulation
    const render3DScene = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw sky gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#1e3a8a');
      gradient.addColorStop(1, '#312e81');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid floor
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 20; i++) {
        const x = (i / 20) * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, canvas.height * 0.7);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i <= 10; i++) {
        const y = canvas.height * 0.7 + (i / 10) * (canvas.height * 0.3);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Render 3D objects (simplified 2D projection)
      scene.objects.forEach(obj => {
        if (!obj.visible) return;

        const screenX = canvas.width/2 + obj.transform.position.x * 40;
        const screenY = canvas.height/2 - obj.transform.position.y * 40 + obj.transform.position.z * 20;
        const size = 30 * obj.transform.scale.x;

        ctx.fillStyle = obj.material.color;
        ctx.shadowColor = obj.material.color;
        ctx.shadowBlur = obj.material.emission * 20;

        switch (obj.type) {
          case 'cube':
            ctx.fillRect(screenX - size/2, screenY - size/2, size, size);
            break;
          case 'sphere':
            ctx.beginPath();
            ctx.arc(screenX, screenY, size/2, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'capsule':
            ctx.fillRect(screenX - size/4, screenY - size/2, size/2, size);
            ctx.beginPath();
            ctx.arc(screenX, screenY - size/2, size/4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(screenX, screenY + size/2, size/4, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'plane':
            ctx.fillRect(screenX - size/2, screenY - 5, size, 10);
            break;
        }

        ctx.shadowBlur = 0;

        // Draw object name
        if (selectedObject?.id === obj.id) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px Arial';
          ctx.fillText(obj.name, screenX - 30, screenY - size/2 - 10);
        }
      });

      // Draw UI elements
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.fillText(`Time: ${gameTime.toFixed(1)}s`, 10, 30);
      ctx.fillText(`Objects: ${scene.objects.length}`, 10, 50);
      ctx.fillText(`Camera: Third Person`, 10, 70);
      
      if (isPlaying) {
        ctx.fillStyle = '#00ff00';
        ctx.fillText('▶ PLAYING', canvas.width - 100, 30);
      } else {
        ctx.fillStyle = '#ffff00';
        ctx.fillText('⏸ PAUSED', canvas.width - 100, 30);
      }
    };

    render3DScene();
    const animationFrame = requestAnimationFrame(render3DScene);

    return () => cancelAnimationFrame(animationFrame);
  }, [scene, selectedObject, gameTime, isPlaying]);

  const addObject = (type: YahahaObject['type']) => {
    const newObject: YahahaObject = {
      id: `object_${Date.now()}`,
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type,
      transform: {
        position: { x: Math.random() * 4 - 2, y: Math.random() * 3 + 1, z: Math.random() * 4 - 2 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      },
      material: {
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        metallic: Math.random() * 0.5,
        roughness: Math.random() * 0.8 + 0.2,
        emission: Math.random() * 0.2
      },
      physics: {
        enabled: true,
        collider: type === 'sphere' ? 'sphere' : type === 'capsule' ? 'capsule' : 'box',
        mass: Math.random() * 2 + 0.5,
        friction: Math.random() * 0.5 + 0.3
      },
      visible: true
    };

    setScene(prev => ({
      ...prev,
      objects: [...prev.objects, newObject]
    }));
  };

  const updateSelectedObject = (property: string, value: any) => {
    if (!selectedObject) return;

    setScene(prev => ({
      ...prev,
      objects: prev.objects.map(obj =>
        obj.id === selectedObject.id
          ? { ...obj, [property]: { ...obj[property as keyof YahahaObject], ...value } }
          : obj
      )
    }));

    setSelectedObject(prev => 
      prev ? { ...prev, [property]: { ...prev[property as keyof YahahaObject], ...value } } : null
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Link href="/super-engine">
              <Button variant="ghost" className="text-gray-300 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Super Engine
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Yahaha 3D World Studio
              </h1>
              <p className="text-gray-400">Professional 3D game world creation with physics and materials</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge className="bg-blue-500/20 text-blue-400">3D Engine</Badge>
            <Link href="/tower-defense">
              <Button variant="outline" className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-black">
                Tower Defense
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 3D Viewport */}
          <div className="lg:col-span-3">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <Camera className="w-5 h-5 mr-2 text-blue-400" />
                    3D Viewport - {scene.name}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={isPlaying ? "bg-yellow-500 hover:bg-yellow-600" : "bg-green-500 hover:bg-green-600"}
                      size="sm"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      onClick={() => {setIsPlaying(false); setGameTime(0);}}
                      variant="outline"
                      className="border-gray-600 text-gray-300"
                      size="sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="w-full bg-black rounded-lg border border-gray-600 cursor-crosshair"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    // Simple object selection based on screen position
                    const clickedObject = scene.objects.find(obj => {
                      const screenX = 400 + obj.transform.position.x * 40;
                      const screenY = 300 - obj.transform.position.y * 40 + obj.transform.position.z * 20;
                      const distance = Math.sqrt((x - screenX) ** 2 + (y - screenY) ** 2);
                      return distance < 30;
                    });
                    setSelectedObject(clickedObject || null);
                  }}
                />
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => addObject('cube')}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      size="sm"
                    >
                      <Box className="w-4 h-4 mr-2" />
                      Add Cube
                    </Button>
                    <Button
                      onClick={() => addObject('sphere')}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      size="sm"
                    >
                      Add Sphere
                    </Button>
                    <Button
                      onClick={() => addObject('capsule')}
                      className="bg-purple-500 hover:bg-purple-600 text-white"
                      size="sm"
                    >
                      Add Capsule
                    </Button>
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    Click objects to select • WASD: Camera • Space: Jump
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Properties Panel */}
          <div className="space-y-4">
            {/* Scene Hierarchy */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">Scene Hierarchy</CardTitle>
              </CardHeader>
              <CardContent className="max-h-40 overflow-y-auto">
                <div className="space-y-1">
                  {scene.objects.map((obj) => (
                    <div
                      key={obj.id}
                      className={`p-2 rounded cursor-pointer transition-colors ${
                        selectedObject?.id === obj.id
                          ? 'bg-blue-500/30 border border-blue-500/50'
                          : 'bg-gray-700/30 hover:bg-gray-600/30'
                      }`}
                      onClick={() => setSelectedObject(obj)}
                    >
                      <div className="flex items-center space-x-2">
                        {obj.type === 'cube' && <Box className="w-4 h-4 text-orange-400" />}
                        {obj.type === 'sphere' && <div className="w-4 h-4 bg-blue-400 rounded-full" />}
                        {obj.type === 'capsule' && <div className="w-4 h-4 bg-purple-400 rounded-full" />}
                        {obj.type === 'plane' && <div className="w-4 h-2 bg-gray-400" />}
                        <span className="text-white text-xs">{obj.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Object Properties */}
            {selectedObject && (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Object Properties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs defaultValue="transform" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-gray-700">
                      <TabsTrigger value="transform" className="text-xs">
                        <Move3D className="w-3 h-3" />
                      </TabsTrigger>
                      <TabsTrigger value="material" className="text-xs">
                        <Palette className="w-3 h-3" />
                      </TabsTrigger>
                      <TabsTrigger value="physics" className="text-xs">
                        <Zap className="w-3 h-3" />
                      </TabsTrigger>
                      <TabsTrigger value="settings" className="text-xs">
                        <Settings className="w-3 h-3" />
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="transform" className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-400">Position X</label>
                        <Slider
                          value={[selectedObject.transform.position.x]}
                          onValueChange={([value]) =>
                            updateSelectedObject('transform', {
                              position: { ...selectedObject.transform.position, x: value }
                            })
                          }
                          min={-10}
                          max={10}
                          step={0.1}
                          className="mt-1"
                        />
                        <span className="text-xs text-white">{selectedObject.transform.position.x.toFixed(1)}</span>
                      </div>
                      
                      <div>
                        <label className="text-xs text-gray-400">Position Y</label>
                        <Slider
                          value={[selectedObject.transform.position.y]}
                          onValueChange={([value]) =>
                            updateSelectedObject('transform', {
                              position: { ...selectedObject.transform.position, y: value }
                            })
                          }
                          min={-5}
                          max={10}
                          step={0.1}
                          className="mt-1"
                        />
                        <span className="text-xs text-white">{selectedObject.transform.position.y.toFixed(1)}</span>
                      </div>

                      <div>
                        <label className="text-xs text-gray-400">Scale</label>
                        <Slider
                          value={[selectedObject.transform.scale.x]}
                          onValueChange={([value]) =>
                            updateSelectedObject('transform', {
                              scale: { x: value, y: value, z: value }
                            })
                          }
                          min={0.1}
                          max={3}
                          step={0.1}
                          className="mt-1"
                        />
                        <span className="text-xs text-white">{selectedObject.transform.scale.x.toFixed(1)}</span>
                      </div>
                    </TabsContent>

                    <TabsContent value="material" className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-400">Metallic</label>
                        <Slider
                          value={[selectedObject.material.metallic]}
                          onValueChange={([value]) =>
                            updateSelectedObject('material', { metallic: value })
                          }
                          min={0}
                          max={1}
                          step={0.1}
                          className="mt-1"
                        />
                        <span className="text-xs text-white">{selectedObject.material.metallic.toFixed(1)}</span>
                      </div>
                      
                      <div>
                        <label className="text-xs text-gray-400">Roughness</label>
                        <Slider
                          value={[selectedObject.material.roughness]}
                          onValueChange={([value]) =>
                            updateSelectedObject('material', { roughness: value })
                          }
                          min={0}
                          max={1}
                          step={0.1}
                          className="mt-1"
                        />
                        <span className="text-xs text-white">{selectedObject.material.roughness.toFixed(1)}</span>
                      </div>

                      <div>
                        <label className="text-xs text-gray-400">Emission</label>
                        <Slider
                          value={[selectedObject.material.emission]}
                          onValueChange={([value]) =>
                            updateSelectedObject('material', { emission: value })
                          }
                          min={0}
                          max={1}
                          step={0.1}
                          className="mt-1"
                        />
                        <span className="text-xs text-white">{selectedObject.material.emission.toFixed(1)}</span>
                      </div>
                    </TabsContent>

                    <TabsContent value="physics" className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-400">Mass</label>
                        <Slider
                          value={[selectedObject.physics.mass]}
                          onValueChange={([value]) =>
                            updateSelectedObject('physics', { mass: value })
                          }
                          min={0}
                          max={10}
                          step={0.1}
                          className="mt-1"
                        />
                        <span className="text-xs text-white">{selectedObject.physics.mass.toFixed(1)} kg</span>
                      </div>
                      
                      <div>
                        <label className="text-xs text-gray-400">Friction</label>
                        <Slider
                          value={[selectedObject.physics.friction]}
                          onValueChange={([value]) =>
                            updateSelectedObject('physics', { friction: value })
                          }
                          min={0}
                          max={1}
                          step={0.1}
                          className="mt-1"
                        />
                        <span className="text-xs text-white">{selectedObject.physics.friction.toFixed(1)}</span>
                      </div>

                      <div className="text-xs text-gray-400">
                        Collider: {selectedObject.physics.collider}
                      </div>
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-3">
                      <Button
                        onClick={() => {
                          setScene(prev => ({
                            ...prev,
                            objects: prev.objects.filter(obj => obj.id !== selectedObject.id)
                          }));
                          setSelectedObject(null);
                        }}
                        className="w-full bg-red-500 hover:bg-red-600 text-white"
                        size="sm"
                      >
                        Delete Object
                      </Button>
                      
                      <Button
                        onClick={() => {
                          const duplicated = { 
                            ...selectedObject, 
                            id: `${selectedObject.id}_copy`,
                            name: `${selectedObject.name} Copy`,
                            transform: {
                              ...selectedObject.transform,
                              position: {
                                ...selectedObject.transform.position,
                                x: selectedObject.transform.position.x + 1
                              }
                            }
                          };
                          setScene(prev => ({
                            ...prev,
                            objects: [...prev.objects, duplicated]
                          }));
                        }}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                        size="sm"
                      >
                        Duplicate
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export Scene
                </Button>
                <Button className="w-full bg-green-500 hover:bg-green-600 text-white" size="sm">
                  <Share2 className="w-4 h-4 mr-2" />
                  Publish Online
                </Button>
                <Link href="/collaboration-hub">
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    Collaborate
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}