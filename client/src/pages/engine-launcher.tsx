import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Play, Settings, Folder, Download, Cpu, Monitor, Code, Zap, Users, Globe, Video, MessageCircle, GitBranch } from "lucide-react";
import { Link, useLocation } from "wouter";
import EnhancedProjectGrid from "@/components/enhanced-project-grid";

interface Engine {
  id: string;
  name: string;
  status: 'installed' | 'downloading' | 'not_installed' | 'updating';
  version: string;
  description: string;
  icon: string;
  category: string;
  platforms: string[];
  features: string[];
  projectCount: number;
  lastUsed?: string;
  installProgress?: number;
}

interface Project {
  id: string;
  name: string;
  engine: string;
  type: string;
  lastModified: string;
  size: string;
  thumbnail: string;
  status: 'ready' | 'building' | 'error';
}

export default function EngineLauncher() {
  const [engines, setEngines] = useState<Engine[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState('engines');
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);

  useEffect(() => {
    // Initialize engines data
    const engineData: Engine[] = [
      {
        id: 'construct3',
        name: 'Construct 3',
        status: 'installed',
        version: '2024.1',
        description: 'Web-based 2D game engine with visual scripting',
        icon: '🎮',
        category: '2D Engine',
        platforms: ['Web', 'Mobile', 'Desktop'],
        features: ['Drag & Drop', 'Visual Scripting', 'Physics', 'Multiplayer'],
        projectCount: 12,
        lastUsed: '2024-01-15'
      },
      {
        id: 'buildbox',
        name: 'Buildbox',
        status: 'installed',
        version: '3.8.2',
        description: 'No-code 2D/3D game development platform',
        icon: '🏗️',
        category: '3D Engine',
        platforms: ['Mobile', 'Desktop', 'Console'],
        features: ['3D Support', 'Animation Tools', 'Effects', 'Publishing'],
        projectCount: 8,
        lastUsed: '2024-01-14'
      },
      {
        id: 'gdevelop',
        name: 'GDevelop',
        status: 'installed',
        version: '5.3.196',
        description: 'Open-source game engine with visual scripting',
        icon: '⚡',
        category: 'Visual Script',
        platforms: ['Web', 'Mobile', 'Desktop', 'Console'],
        features: ['Open Source', 'Visual Events', 'Extensions', 'Live Preview'],
        projectCount: 15,
        lastUsed: '2024-01-16'
      },
      {
        id: 'stencyl',
        name: 'Stencyl',
        status: 'installed',
        version: '4.1.4',
        description: 'Block-based game development with powerful physics',
        icon: '🧩',
        category: 'Physics Engine',
        platforms: ['Web', 'Mobile', 'Desktop'],
        features: ['Block Coding', 'Physics Engine', 'Tile Editor', 'Behaviors'],
        projectCount: 6,
        lastUsed: '2024-01-13'
      },
      {
        id: 'yahaha',
        name: 'Yahaha Studios',
        status: 'installed',
        version: '1.2.0',
        description: 'Social 3D game creation platform',
        icon: '🌟',
        category: '3D Social',
        platforms: ['Mobile', 'Web', 'VR'],
        features: ['3D Creation', 'Social Features', 'VR Support', 'Collaboration'],
        projectCount: 4,
        lastUsed: '2024-01-12'
      },
      {
        id: 'rpgmaker',
        name: 'RPG Maker',
        status: 'installed',
        version: 'MZ 1.8.0',
        description: 'Classic RPG development suite',
        icon: '⚔️',
        category: 'RPG Engine',
        platforms: ['PC', 'Console', 'Mobile'],
        features: ['RPG Templates', 'Database Editor', 'Event System', 'Plugin Support'],
        projectCount: 3,
        lastUsed: '2024-01-10'
      },
      {
        id: 'gamefroot',
        name: 'Gamefroot',
        status: 'downloading',
        version: '2.1.0',
        description: 'Cloud-based 2D game development',
        icon: '☁️',
        category: 'Cloud Engine',
        platforms: ['Web', 'Mobile'],
        features: ['Cloud Based', 'Real-time Collaboration', 'Asset Library', 'Easy Publishing'],
        projectCount: 0,
        installProgress: 67
      },
      {
        id: 'decay',
        name: 'Decay Survival',
        status: 'installed',
        version: '1.0.0',
        description: 'Intense survival shooter with waves of zombies',
        icon: '🧟',
        category: 'FPS Shooter',
        platforms: ['Web', 'Desktop'],
        features: ['First-Person', 'Wave Combat', 'Survival', 'Pickups'],
        projectCount: 1,
        lastUsed: '2024-12-10'
      },
      {
        id: 'overdrive',
        name: 'Overdrive Racing',
        status: 'installed',
        version: '1.0.0',
        description: 'Adrenaline-pumping racing with dynamic obstacles',
        icon: '🏎️',
        category: 'Racing',
        platforms: ['Web', 'Desktop', 'Mobile'],
        features: ['3D Racing', 'Obstacles', 'Physics', 'Endless Mode'],
        projectCount: 1,
        lastUsed: '2024-12-10'
      },
      {
        id: 'avernus',
        name: 'Avernus Arena',
        status: 'installed',
        version: '1.0.0',
        description: 'PVP combat arena with weapons and abilities',
        icon: '⚔️',
        category: 'Action Arena',
        platforms: ['Web', 'Desktop'],
        features: ['Weapons', 'Abilities', 'Wave Combat', 'Leveling'],
        projectCount: 1,
        lastUsed: '2024-12-10'
      }
    ];

    setEngines(engineData);

    // Initialize projects data
    const projectData: Project[] = [
      {
        id: '1',
        name: 'Pixel Adventure',
        engine: 'construct3',
        type: '2D Platformer',
        lastModified: '2024-01-15',
        size: '45.2 MB',
        thumbnail: '/api/placeholder/200/150',
        status: 'ready'
      },
      {
        id: '2',
        name: 'Space Explorer 3D',
        engine: 'buildbox',
        type: '3D Action',
        lastModified: '2024-01-14',
        size: '128.5 MB',
        thumbnail: '/api/placeholder/200/150',
        status: 'ready'
      },
      {
        id: '3',
        name: 'Tower Defense Pro',
        engine: 'gdevelop',
        type: 'Strategy',
        lastModified: '2024-01-16',
        size: '67.8 MB',
        thumbnail: '/api/placeholder/200/150',
        status: 'building'
      },
      {
        id: '4',
        name: 'Crystal Quest RPG',
        engine: 'rpgmaker',
        type: 'RPG',
        lastModified: '2024-01-10',
        size: '234.7 MB',
        thumbnail: '/api/placeholder/200/150',
        status: 'ready'
      }
    ];

    setProjects(projectData);
  }, []);

  const [, navigate] = useLocation();

  const launchEngine = async (engineId: string) => {
    console.log(`Launching ${engineId}...`);
    
    // Map engines to their in-browser pages
    const engineRoutes: { [key: string]: string } = {
      'construct3': '/puzzle-platformer',
      'buildbox': '/multiplayer-racing',
      'gdevelop': '/puzzle-platformer',
      'stencyl': '/tower-defense',
      'rpgmaker': '/rpg-maker-studio',
      'yahaha': '/yahaha-3d-world',
      'gamefroot': '/puzzle-platformer',
      'decay': '/decay-survival',
      'overdrive': '/overdrive-racing',
      'avernus': '/avernus-3d'
    };

    const route = engineRoutes[engineId];
    if (route) {
      navigate(route);
    }
  };

  const openProject = (projectId: string) => {
    console.log(`Opening project ${projectId}...`);
    
    // Find the project and navigate to its engine page
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const engineRoutes: { [key: string]: string } = {
      'construct3': '/puzzle-platformer',
      'buildbox': '/multiplayer-racing',
      'gdevelop': '/puzzle-platformer',
      'stencyl': '/tower-defense',
      'rpgmaker': '/rpg-maker-studio',
      'yahaha': '/yahaha-3d-world'
    };

    const route = engineRoutes[project.engine] || '/super-engine';
    navigate(route);
  };

  const createNewProject = (engineId: string) => {
    console.log(`Creating new project with ${engineId}...`);
    // In a real implementation, this would create a new project
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
              Engine Launcher
            </h1>
            <p className="text-gray-400">Unified game development workspace</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge className="bg-green-500 text-white">
              {engines.filter(e => e.status === 'installed').length} Engines Ready
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 bg-gray-800/50 mb-8">
            <TabsTrigger value="engines" className="data-[state=active]:bg-orange-500">
              <Cpu className="w-4 h-4 mr-2" />
              Engines
            </TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-orange-500">
              <Folder className="w-4 h-4 mr-2" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="advanced" className="data-[state=active]:bg-orange-500">
              <Settings className="w-4 h-4 mr-2" />
              Advanced
            </TabsTrigger>
            <TabsTrigger value="collaboration" className="data-[state=active]:bg-orange-500">
              <Users className="w-4 h-4 mr-2" />
              Team
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-orange-500">
              <Globe className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="engines">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {engines.map((engine) => (
                <Card key={engine.id} className="bg-gray-800/50 border-gray-700 hover:border-orange-500 transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{engine.icon}</div>
                        <div>
                          <CardTitle className="text-white">{engine.name}</CardTitle>
                          <p className="text-sm text-gray-400">v{engine.version}</p>
                        </div>
                      </div>
                      <Badge className={
                        engine.status === 'installed' ? 'bg-green-500' :
                        engine.status === 'downloading' ? 'bg-orange-500' :
                        engine.status === 'updating' ? 'bg-blue-500' :
                        'bg-gray-500'
                      }>
                        {engine.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-gray-300 text-sm">{engine.description}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {engine.features.slice(0, 3).map((feature) => (
                        <Badge key={feature} variant="outline" className="border-gray-600 text-gray-400 text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>

                    {engine.status === 'downloading' && engine.installProgress && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Installing...</span>
                          <span className="text-orange-400">{engine.installProgress}%</span>
                        </div>
                        <Progress value={engine.installProgress} className="h-2" />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>{engine.projectCount} projects</span>
                      {engine.lastUsed && <span>Last used: {engine.lastUsed}</span>}
                    </div>

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
                            className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-black"
                            onClick={() => createNewProject(engine.id)}
                          >
                            <Code className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button className="flex-1" disabled>
                          <Download className="w-4 h-4 mr-2" />
                          {engine.status === 'downloading' ? 'Installing...' : 'Install'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Recent Projects</h2>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  <Code className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {projects.map((project) => (
                  <Card key={project.id} className="bg-gray-800/50 border-gray-700 hover:border-orange-500 transition-all duration-300 cursor-pointer">
                    <CardContent className="p-4">
                      <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                        <div className="text-6xl opacity-50">🎮</div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-white truncate">{project.name}</h3>
                          <Badge className={
                            project.status === 'ready' ? 'bg-green-500' :
                            project.status === 'building' ? 'bg-orange-500' :
                            'bg-red-500'
                          }>
                            {project.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm text-gray-400">
                          <span>{project.type}</span>
                          <span>{project.size}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <div className="text-xs text-gray-500">
                            {engines.find(e => e.id === project.engine)?.icon}
                          </div>
                          <span className="text-xs text-gray-500">
                            {engines.find(e => e.id === project.engine)?.name}
                          </span>
                        </div>
                        
                        <p className="text-xs text-gray-500">Modified: {project.lastModified}</p>
                        
                        <Button 
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white mt-3"
                          onClick={() => openProject(project.id)}
                          disabled={project.status !== 'ready'}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {project.status === 'building' ? 'Building...' : 'Open'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Advanced Game Engines</h2>
                <Link href="/advanced-engines">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                    <Code className="w-4 h-4 mr-2" />
                    View All Advanced Engines
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {['Unity 3D', 'Unreal Engine 5', 'Godot 4'].map((engine, index) => (
                  <Card key={engine} className="bg-gray-800/50 border-gray-700 hover:border-orange-500 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-white font-semibold">{engine}</h3>
                        <Badge className="bg-purple-500 text-white">Professional</Badge>
                      </div>
                      <p className="text-gray-400 text-sm mb-4">
                        {index === 0 && "Industry-standard 3D game engine with C# scripting"}
                        {index === 1 && "Next-gen real-time 3D creation with Nanite and Lumen"}
                        {index === 2 && "Open-source engine with unique scene system"}
                      </p>
                      <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white">
                        Install Professional Engine
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="collaboration">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Team Collaboration</h2>
                <Link href="/collaboration-hub">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                    <Users className="w-4 h-4 mr-2" />
                    Open Collaboration Hub
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Active Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                        <div>
                          <p className="text-white font-medium">Pixel Adventure RPG</p>
                          <p className="text-sm text-gray-400">3 collaborators online</p>
                        </div>
                        <Badge className="bg-green-500 text-white">Active</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                        <div>
                          <p className="text-white font-medium">Space Shooter 3D</p>
                          <p className="text-sm text-gray-400">2 collaborators online</p>
                        </div>
                        <Badge className="bg-green-500 text-white">Active</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Team Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Video className="w-5 h-5 text-orange-400" />
                        <div>
                          <p className="text-white">Video Conferencing</p>
                          <p className="text-sm text-gray-400">Built-in voice and video calls</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <MessageCircle className="w-5 h-5 text-orange-400" />
                        <div>
                          <p className="text-white">Real-time Chat</p>
                          <p className="text-sm text-gray-400">Team communication and code sharing</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <GitBranch className="w-5 h-5 text-orange-400" />
                        <div>
                          <p className="text-white">Version Control</p>
                          <p className="text-sm text-gray-400">Track changes and collaborate safely</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Project Analytics</h2>
                <Link href="/analytics-dashboard">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                    <Globe className="w-4 h-4 mr-2" />
                    View Full Analytics
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="bg-gradient-to-br from-orange-900/30 to-red-900/20 border-orange-500/30">
                  <CardContent className="p-6 text-center">
                    <div className="text-3xl font-bold text-orange-400 mb-2">48</div>
                    <div className="text-gray-300">Total Projects</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 border-blue-500/30">
                  <CardContent className="p-6 text-center">
                    <div className="text-3xl font-bold text-blue-400 mb-2">889</div>
                    <div className="text-gray-300">Active Users</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-900/30 to-teal-900/20 border-green-500/30">
                  <CardContent className="p-6 text-center">
                    <div className="text-3xl font-bold text-green-400 mb-2">15.8K</div>
                    <div className="text-gray-300">Downloads</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 border-purple-500/30">
                  <CardContent className="p-6 text-center">
                    <div className="text-3xl font-bold text-purple-400 mb-2">69s</div>
                    <div className="text-gray-300">Avg Build Time</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Engine Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {['GDevelop', 'Construct3', 'Buildbox', 'Stencyl'].map((engine, index) => (
                        <div key={engine} className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-300">{engine}</span>
                            <span className="text-orange-400">{[92, 88, 85, 82][index]}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${[92, 88, 85, 82][index]}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Platform Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { platform: 'Web', percentage: 45 },
                        { platform: 'Android', percentage: 29 },
                        { platform: 'iOS', percentage: 17 },
                        { platform: 'Desktop', percentage: 9 }
                      ].map((item) => (
                        <div key={item.platform} className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-300">{item.platform}</span>
                            <span className="text-orange-400">{item.percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${item.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}