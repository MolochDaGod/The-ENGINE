import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft,
  Play,
  Download,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader,
  FolderOpen,
  Terminal,
  FileText,
  Cpu
} from "lucide-react";
import { Link, useLocation } from "wouter";

interface DetectedEngine {
  id: string;
  name: string;
  status: 'installed' | 'downloading' | 'missing' | 'updating';
  version: string;
  description: string;
  category: string;
  platforms: string[];
  features: string[];
  projectCount: number;
  configFiles?: string[];
  executableFiles?: string[];
  installProgress?: number;
}

interface RealProject {
  id: string;
  name: string;
  engine: string;
  type: string;
  lastModified: string;
  size: string;
  path: string;
  status: 'ready' | 'building' | 'error';
}

export default function RealEngineManager() {
  const [engines, setEngines] = useState<DetectedEngine[]>([]);
  const [projects, setProjects] = useState<RealProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchEngineData = async () => {
    try {
      const response = await fetch('/api/engines/status');
      const data = await response.json();
      
      if (data.success) {
        setEngines(data.engines);
      }
    } catch (error) {
      console.error('Failed to fetch engines:', error);
    }
  };

  const fetchProjectData = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchEngineData(), fetchProjectData()]);
      setLoading(false);
    };
    
    loadData();
  }, []);

  const [, navigate] = useLocation();

  const launchEngine = async (engineId: string) => {
    const engine = engines.find(e => e.id === engineId);
    if (!engine) return;

    // Map engines to their in-browser pages
    const engineRoutes: { [key: string]: string } = {
      'stencyl': '/tower-defense',
      'rpgmaker': '/rpg-maker-studio',
      'java-engine': '/puzzle-platformer',
      'construct3': '/puzzle-platformer',
      'buildbox': '/multiplayer-racing',
      'gdevelop': '/puzzle-platformer',
      'yahaha': '/yahaha-3d-world'
    };

    const route = engineRoutes[engineId] || '/super-engine';
    navigate(route);
  };

  const openProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // Map project engines to their pages
    const engineRoutes: { [key: string]: string } = {
      'stencyl': '/tower-defense',
      'rpgmaker': '/rpg-maker-studio',
      'detected': '/super-engine',
      'construct3': '/puzzle-platformer',
      'buildbox': '/multiplayer-racing',
      'gdevelop': '/puzzle-platformer',
      'yahaha': '/yahaha-3d-world'
    };

    const route = engineRoutes[project.engine] || '/super-engine';
    navigate(route);
  };

  const rescanFiles = async () => {
    setScanning(true);
    await Promise.all([fetchEngineData(), fetchProjectData()]);
    setScanning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'installed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'downloading':
        return <Loader className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'missing':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'updating':
        return <Loader className="w-4 h-4 text-yellow-400 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
          <div className="text-gray-400">Scanning file system for engines and projects...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
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
                Real Engine Manager
              </h1>
              <p className="text-gray-400">Authentic engine detection and project management from file system</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              onClick={rescanFiles}
              disabled={scanning}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {scanning ? (
                <Loader className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FolderOpen className="w-4 h-4 mr-2" />
              )}
              Rescan Files
            </Button>
            
            <Badge className="bg-green-500/20 text-green-400">
              <Cpu className="w-3 h-3 mr-1" />
              {engines.length} Engines
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Detected Engines */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Detected Game Engines
            </h2>
            
            {engines.length === 0 ? (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-gray-400 mb-4">No game engines detected</div>
                  <div className="text-sm text-gray-500">
                    Add engine executables or configuration files to attached_assets directory
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {engines.map((engine) => (
                  <Card key={engine.id} className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white flex items-center">
                          {getStatusIcon(engine.status)}
                          <span className="ml-2">{engine.name}</span>
                        </CardTitle>
                        <Badge className="bg-blue-500/20 text-blue-400">
                          {engine.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="text-sm text-gray-400">
                          {engine.description}
                        </div>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Version: {engine.version}</span>
                          <span>Projects: {engine.projectCount}</span>
                        </div>

                        {engine.configFiles && engine.configFiles.length > 0 && (
                          <div className="text-xs">
                            <div className="text-gray-400 mb-1">Configuration Files:</div>
                            <div className="space-y-1">
                              {engine.configFiles.map((file, index) => (
                                <div key={index} className="flex items-center text-gray-500">
                                  <FileText className="w-3 h-3 mr-1" />
                                  {file}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {engine.executableFiles && engine.executableFiles.length > 0 && (
                          <div className="text-xs">
                            <div className="text-gray-400 mb-1">Executable Files:</div>
                            <div className="space-y-1">
                              {engine.executableFiles.map((file, index) => (
                                <div key={index} className="flex items-center text-gray-500">
                                  <Terminal className="w-3 h-3 mr-1" />
                                  {file}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {engine.status === 'downloading' && engine.installProgress && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Installing...</span>
                              <span className="text-blue-400">{engine.installProgress}%</span>
                            </div>
                            <Progress value={engine.installProgress} className="h-2" />
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <Button
                            onClick={() => launchEngine(engine.id)}
                            disabled={engine.status !== 'installed'}
                            className="bg-green-500 hover:bg-green-600 text-white flex-1"
                            size="sm"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Launch
                          </Button>
                          
                          <Button
                            variant="outline"
                            className="border-gray-600 text-gray-300 hover:bg-gray-700"
                            size="sm"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Real Projects */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <FolderOpen className="w-5 h-5 mr-2" />
              Detected Projects
            </h2>
            
            {projects.length === 0 ? (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-8 text-center">
                  <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-gray-400 mb-4">No projects detected</div>
                  <div className="text-sm text-gray-500">
                    Create project directories or import existing game projects
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <Card key={project.id} className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white">{project.name}</CardTitle>
                        <Badge className={`
                          ${project.status === 'ready' ? 'bg-green-500/20 text-green-400' : ''}
                          ${project.status === 'building' ? 'bg-blue-500/20 text-blue-400' : ''}
                          ${project.status === 'error' ? 'bg-red-500/20 text-red-400' : ''}
                        `}>
                          {project.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                          <div>Engine: {project.engine}</div>
                          <div>Type: {project.type}</div>
                          <div>Size: {project.size}</div>
                          <div>Modified: {new Date(project.lastModified).toLocaleDateString()}</div>
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          Path: {project.path}
                        </div>

                        <div className="flex space-x-2">
                          <Button
                            onClick={() => openProject(project.id)}
                            className="bg-blue-500 hover:bg-blue-600 text-white flex-1"
                            size="sm"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Open Project
                          </Button>
                          
                          <Button
                            variant="outline"
                            className="border-gray-600 text-gray-300 hover:bg-gray-700"
                            size="sm"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{engines.length}</div>
              <div className="text-gray-400 text-sm">Engines Detected</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {engines.filter(e => e.status === 'installed').length}
              </div>
              <div className="text-gray-400 text-sm">Ready to Use</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{projects.length}</div>
              <div className="text-gray-400 text-sm">Projects Found</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {projects.filter(p => p.status === 'ready').length}
              </div>
              <div className="text-gray-400 text-sm">Ready Projects</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}