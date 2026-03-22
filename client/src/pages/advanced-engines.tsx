import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Download, Play, Settings, Cpu, Zap, Globe, Code, Brain, Eye, Smartphone } from "lucide-react";
import { Link, useLocation } from "wouter";

interface AdvancedEngine {
  id: string;
  name: string;
  category: string;
  description: string;
  features: string[];
  platforms: string[];
  complexity: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  version: string;
  size: string;
  price: number;
  rating: number;
  downloads: number;
  thumbnail: string;
  status: 'available' | 'installing' | 'installed' | 'updating';
  installProgress?: number;
  capabilities: {
    ai: boolean;
    vr: boolean;
    multiplayer: boolean;
    crossPlatform: boolean;
    realTime: boolean;
    cloudSync: boolean;
  };
}

export default function AdvancedEngines() {
  const [engines, setEngines] = useState<AdvancedEngine[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [installingEngines, setInstallingEngines] = useState<Set<string>>(new Set());

  useEffect(() => {
    const advancedEngineData: AdvancedEngine[] = [
      {
        id: 'unity3d',
        name: 'Unity 3D Professional',
        category: 'Professional 3D',
        description: 'Industry-standard 3D game engine with advanced rendering, physics, and cross-platform deployment.',
        features: ['C# Scripting', 'Visual Scripting', 'Advanced Rendering', 'Asset Store', 'Analytics'],
        platforms: ['Windows', 'Mac', 'Linux', 'iOS', 'Android', 'WebGL', 'Console'],
        complexity: 'Advanced',
        version: '2023.3.21f1',
        size: '4.2 GB',
        price: 0,
        rating: 4.8,
        downloads: 15847392,
        thumbnail: '/api/placeholder/400/300',
        status: 'available',
        capabilities: {
          ai: true,
          vr: true,
          multiplayer: true,
          crossPlatform: true,
          realTime: true,
          cloudSync: true
        }
      },
      {
        id: 'unreal5',
        name: 'Unreal Engine 5',
        category: 'AAA Development',
        description: 'Next-generation real-time 3D creation platform with Nanite virtualized geometry and Lumen lighting.',
        features: ['Blueprint Visual Scripting', 'C++', 'Nanite', 'Lumen', 'MetaHuman', 'World Partition'],
        platforms: ['Windows', 'Mac', 'Linux', 'iOS', 'Android', 'PlayStation', 'Xbox', 'Nintendo Switch'],
        complexity: 'Expert',
        version: '5.3.2',
        size: '8.7 GB',
        price: 0,
        rating: 4.9,
        downloads: 8432156,
        thumbnail: '/api/placeholder/400/300',
        status: 'available',
        capabilities: {
          ai: true,
          vr: true,
          multiplayer: true,
          crossPlatform: true,
          realTime: true,
          cloudSync: true
        }
      },
      {
        id: 'godot4',
        name: 'Godot Engine 4',
        category: 'Open Source',
        description: 'Lightweight, open-source game engine with unique scene system and GDScript programming language.',
        features: ['GDScript', 'C#', 'Visual Scripting', 'Scene System', 'Node-based Architecture'],
        platforms: ['Windows', 'Mac', 'Linux', 'iOS', 'Android', 'Web'],
        complexity: 'Intermediate',
        version: '4.2.1',
        size: '156 MB',
        price: 0,
        rating: 4.7,
        downloads: 3241876,
        thumbnail: '/api/placeholder/400/300',
        status: 'available',
        capabilities: {
          ai: false,
          vr: true,
          multiplayer: true,
          crossPlatform: true,
          realTime: true,
          cloudSync: false
        }
      },
      {
        id: 'defold',
        name: 'Defold Engine',
        category: '2D Mobile',
        description: 'King\'s professional 2D game engine optimized for mobile development with Lua scripting.',
        features: ['Lua Scripting', 'Component System', 'Live Reload', 'Native Extensions'],
        platforms: ['iOS', 'Android', 'Web', 'Desktop'],
        complexity: 'Intermediate',
        version: '1.6.4',
        size: '234 MB',
        price: 0,
        rating: 4.5,
        downloads: 892456,
        thumbnail: '/api/placeholder/400/300',
        status: 'available',
        capabilities: {
          ai: false,
          vr: false,
          multiplayer: true,
          crossPlatform: true,
          realTime: true,
          cloudSync: true
        }
      },
      {
        id: 'cocos2d',
        name: 'Cocos2d-x',
        category: '2D Cross-Platform',
        description: 'Mature 2D game framework with C++ core and JavaScript/Lua bindings for cross-platform development.',
        features: ['C++', 'JavaScript', 'Lua', 'Physics', 'UI System', 'Animation'],
        platforms: ['iOS', 'Android', 'Windows', 'Mac', 'Web'],
        complexity: 'Advanced',
        version: '4.0.1',
        size: '512 MB',
        price: 0,
        rating: 4.3,
        downloads: 1234567,
        thumbnail: '/api/placeholder/400/300',
        status: 'available',
        capabilities: {
          ai: false,
          vr: false,
          multiplayer: true,
          crossPlatform: true,
          realTime: true,
          cloudSync: false
        }
      },
      {
        id: 'solar2d',
        name: 'Solar2D',
        category: 'Rapid Prototyping',
        description: 'Formerly Corona SDK, lightweight 2D engine perfect for rapid mobile game prototyping.',
        features: ['Lua Programming', 'Live Builds', 'Physics', 'Native APIs', 'Plugins'],
        platforms: ['iOS', 'Android', 'Desktop', 'Apple TV'],
        complexity: 'Beginner',
        version: '2024.3697',
        size: '178 MB',
        price: 0,
        rating: 4.4,
        downloads: 567891,
        thumbnail: '/api/placeholder/400/300',
        status: 'available',
        capabilities: {
          ai: false,
          vr: false,
          multiplayer: false,
          crossPlatform: true,
          realTime: true,
          cloudSync: false
        }
      },
      {
        id: 'armory3d',
        name: 'Armory 3D',
        category: 'Blender Integration',
        description: '3D game engine integrated with Blender, featuring visual scripting and real-time rendering.',
        features: ['Visual Scripting', 'Haxe Programming', 'Blender Integration', 'PBR Rendering'],
        platforms: ['Windows', 'Mac', 'Linux', 'Web', 'Mobile'],
        complexity: 'Advanced',
        version: '2024.1',
        size: '345 MB',
        price: 0,
        rating: 4.2,
        downloads: 234567,
        thumbnail: '/api/placeholder/400/300',
        status: 'available',
        capabilities: {
          ai: false,
          vr: false,
          multiplayer: false,
          crossPlatform: true,
          realTime: true,
          cloudSync: false
        }
      },
      {
        id: 'flax',
        name: 'Flax Engine',
        category: 'Modern 3D',
        description: 'Modern C++ and C# game engine with advanced graphics and visual scripting capabilities.',
        features: ['C# Scripting', 'Visual Scripts', 'Modern Renderer', 'Live Coding', 'Asset Pipeline'],
        platforms: ['Windows', 'Linux', 'Mac'],
        complexity: 'Advanced',
        version: '1.7',
        size: '1.2 GB',
        price: 0,
        rating: 4.6,
        downloads: 123456,
        thumbnail: '/api/placeholder/400/300',
        status: 'available',
        capabilities: {
          ai: false,
          vr: true,
          multiplayer: true,
          crossPlatform: true,
          realTime: true,
          cloudSync: false
        }
      }
    ];

    setEngines(advancedEngineData);
  }, []);

  const filteredEngines = engines.filter(engine => 
    selectedCategory === 'all' || engine.category === selectedCategory
  );

  const categories = ['all', ...Array.from(new Set(engines.map(engine => engine.category)))];

  const installEngine = async (engineId: string) => {
    setInstallingEngines(prev => new Set([...Array.from(prev), engineId]));
    
    setEngines(prev => prev.map(engine => 
      engine.id === engineId 
        ? { ...engine, status: 'installing', installProgress: 0 }
        : engine
    ));

    // Simulate installation progress
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setEngines(prev => prev.map(engine => 
        engine.id === engineId 
          ? { ...engine, installProgress: progress }
          : engine
      ));
    }

    setEngines(prev => prev.map(engine => 
      engine.id === engineId 
        ? { ...engine, status: 'installed', installProgress: undefined }
        : engine
    ));

    setInstallingEngines(prev => {
      const newSet = new Set(prev);
      newSet.delete(engineId);
      return newSet;
    });
  };

  const [, navigate] = useLocation();

  const launchEngine = (engineId: string) => {
    console.log(`Launching advanced engine: ${engineId}`);
    
    // Map advanced engines to their in-browser pages
    const engineRoutes: { [key: string]: string } = {
      'unity3d': '/yahaha-3d-world',
      'unreal5': '/yahaha-3d-world',
      'godot4': '/avernus-3d',
      'defold': '/puzzle-platformer',
      'cocos2d': '/puzzle-platformer',
      'solar2d': '/puzzle-platformer',
      'armory3d': '/yahaha-3d-world',
      'phaser': '/tower-defense',
      'love2d': '/puzzle-platformer',
      'raylib': '/avernus-3d'
    };

    const route = engineRoutes[engineId] || '/super-engine';
    navigate(route);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/super-engine">
            <Button variant="outline" className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-black">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Super Engine
            </Button>
          </Link>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
              Advanced Game Engines
            </h1>
            <p className="text-gray-400">Professional and industry-standard development tools</p>
          </div>
          
          <div className="text-right">
            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
              {engines.filter(e => e.status === 'installed').length} Installed
            </Badge>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category 
                  ? "bg-orange-500 hover:bg-orange-600" 
                  : "border-gray-600 text-gray-300 hover:border-orange-400"
                }
              >
                {category === 'all' ? 'All Engines' : category}
              </Button>
            ))}
          </div>
        </div>

        {/* Engines Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEngines.map((engine) => (
            <Card key={engine.id} className="bg-gray-800/50 border-gray-700 hover:border-orange-500 transition-all duration-300 group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg mb-1">{engine.name}</CardTitle>
                    <p className="text-sm text-gray-400">{engine.category}</p>
                  </div>
                  <Badge className={`ml-2 ${
                    engine.complexity === 'Beginner' ? 'bg-green-500' :
                    engine.complexity === 'Intermediate' ? 'bg-orange-500' :
                    engine.complexity === 'Advanced' ? 'bg-red-500' :
                    'bg-purple-500'
                  }`}>
                    {engine.complexity}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Engine Preview */}
                <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <div className="text-4xl opacity-50">
                    {engine.category.includes('3D') ? '🎮' :
                     engine.category.includes('2D') ? '🎨' :
                     engine.category.includes('VR') ? '🥽' :
                     engine.category.includes('Mobile') ? '📱' : '⚡'}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-black/50 text-white text-xs">
                      v{engine.version}
                    </Badge>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-300 line-clamp-3">{engine.description}</p>

                {/* Capabilities */}
                <div className="flex flex-wrap gap-1">
                  {engine.capabilities.ai && (
                    <Badge variant="outline" className="border-purple-500 text-purple-400 text-xs">
                      <Brain className="w-3 h-3 mr-1" />
                      AI
                    </Badge>
                  )}
                  {engine.capabilities.vr && (
                    <Badge variant="outline" className="border-blue-500 text-blue-400 text-xs">
                      <Eye className="w-3 h-3 mr-1" />
                      VR
                    </Badge>
                  )}
                  {engine.capabilities.multiplayer && (
                    <Badge variant="outline" className="border-green-500 text-green-400 text-xs">
                      <Globe className="w-3 h-3 mr-1" />
                      MP
                    </Badge>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <div className="text-xs text-gray-400">Key Features:</div>
                  <div className="flex flex-wrap gap-1">
                    {engine.features.slice(0, 3).map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs border-gray-600 text-gray-400">
                        {feature}
                      </Badge>
                    ))}
                    {engine.features.length > 3 && (
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                        +{engine.features.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{engine.size}</span>
                  <span>{(engine.downloads / 1000000).toFixed(1)}M downloads</span>
                </div>

                {/* Installation Progress */}
                {engine.status === 'installing' && engine.installProgress !== undefined && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-400">Installing...</span>
                      <span className="text-orange-400">{engine.installProgress}%</span>
                    </div>
                    <Progress value={engine.installProgress} className="h-2" />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  {engine.status === 'installed' ? (
                    <>
                      <Button 
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => launchEngine(engine.id)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Launch
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-gray-600 text-gray-400 hover:border-orange-400"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    </>
                  ) : engine.status === 'installing' ? (
                    <Button className="flex-1" disabled>
                      <Cpu className="w-4 h-4 mr-2 animate-spin" />
                      Installing...
                    </Button>
                  ) : (
                    <Button 
                      className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                      onClick={() => installEngine(engine.id)}
                      disabled={installingEngines.has(engine.id)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {engine.price > 0 ? `$${engine.price}` : 'Install'}
                    </Button>
                  )}
                </div>

                {/* Platform Support */}
                <div className="text-xs text-gray-500">
                  Platforms: {engine.platforms.slice(0, 3).join(', ')}
                  {engine.platforms.length > 3 && ` +${engine.platforms.length - 3} more`}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-orange-900/30 to-red-900/20 border-orange-500/30">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-orange-400 mb-2">
                {engines.length}
              </div>
              <div className="text-gray-300">Advanced Engines</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 border-blue-500/30">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">
                {engines.filter(e => e.capabilities.vr).length}
              </div>
              <div className="text-gray-300">VR Compatible</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-900/30 to-teal-900/20 border-green-500/30">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">
                {engines.filter(e => e.price === 0).length}
              </div>
              <div className="text-gray-300">Free Engines</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 border-purple-500/30">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-purple-400 mb-2">
                {engines.filter(e => e.capabilities.ai).length}
              </div>
              <div className="text-gray-300">AI Enhanced</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}