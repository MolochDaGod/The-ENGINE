import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Settings, Share, Gamepad2, Zap, Trophy } from "lucide-react";
import { Link } from "wouter";

interface Project {
  id: string;
  name: string;
  engine: string;
  type: string;
  lastModified: string;
  size: string;
  thumbnail: string;
  status: 'ready' | 'building' | 'error';
  enhanced?: boolean;
  playable?: boolean;
  route?: string;
}

interface EnhancedProjectGridProps {
  projects: Project[];
}

const enhancedProjects: Project[] = [
  {
    id: 'tower-defense',
    name: 'Tower Defense',
    engine: 'Super Engine',
    type: 'Strategy',
    lastModified: '30 minutes ago',
    size: '67MB',
    thumbnail: '',
    status: 'ready',
    enhanced: true,
    playable: true,
    route: '/tower-defense'
  },
  {
    id: 'yahaha-3d-world',
    name: 'Yahaha 3D World',
    engine: 'Yahaha Studio',
    type: '3D World',
    lastModified: '15 minutes ago',
    size: '124MB',
    thumbnail: '',
    status: 'ready',
    enhanced: true,
    playable: true,
    route: '/yahaha-3d-world'
  },
  {
    id: 'multiplayer-racing',
    name: 'Racing Championship',
    engine: 'Unity',
    type: 'Racing',
    lastModified: '45 minutes ago',
    size: '98MB',
    thumbnail: '',
    status: 'ready',
    enhanced: true,
    playable: true,
    route: '/multiplayer-racing'
  },
  {
    id: 'puzzle-platformer',
    name: 'Crystal Quest',
    engine: 'Godot',
    type: 'Platformer',
    lastModified: '1 hour ago',
    size: '76MB',
    thumbnail: '',
    status: 'ready',
    enhanced: true,
    playable: true,
    route: '/puzzle-platformer'
  },
  {
    id: 'rpg-studio',
    name: 'Fantasy RPG Studio',
    engine: 'RPG Maker',
    type: 'RPG',
    lastModified: '2 hours ago',
    size: '145MB',
    thumbnail: '',
    status: 'ready',
    enhanced: true,
    playable: true,
    route: '/rpg-maker-studio'
  },
  {
    id: 'avernus-3d',
    name: 'Avernus 3D PVP',
    engine: 'Three.js + ECS',
    type: 'Action',
    lastModified: '1 hour ago',
    size: '128MB',
    thumbnail: '',
    status: 'ready',
    enhanced: true,
    playable: true,
    route: '/avernus-3d'
  },
  {
    id: 'space-shooter',
    name: 'Space Shooter 3D',
    engine: 'Construct3',
    type: 'Arcade',
    lastModified: '1 day ago',
    size: '32MB',
    thumbnail: '',
    status: 'ready',
    enhanced: false,
    playable: false
  },
  {
    id: 'puzzle-quest',
    name: 'Puzzle Quest Builder',
    engine: 'Buildbox',
    type: 'Puzzle',
    lastModified: '3 days ago',
    size: '28MB',
    thumbnail: '',
    status: 'building',
    enhanced: false,
    playable: false
  }
];

export default function EnhancedProjectGrid({ projects = enhancedProjects }: EnhancedProjectGridProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <div className="w-3 h-3 bg-green-500 rounded-full" />;
      case 'building':
        return <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />;
      case 'error':
        return <div className="w-3 h-3 bg-red-500 rounded-full" />;
      default:
        return <div className="w-3 h-3 bg-gray-500 rounded-full" />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <Card 
          key={project.id} 
          className={`bg-gray-800/50 border-gray-700 hover:border-orange-500 transition-all duration-300 ${
            project.enhanced ? 'ring-1 ring-orange-500/30' : ''
          }`}
        >
          <CardContent className="p-4">
            {/* Project Thumbnail */}
            <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
              {project.enhanced && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                    <Zap className="w-3 h-3 mr-1" />
                    Enhanced
                  </Badge>
                </div>
              )}
              {project.playable && (
                <div className="absolute top-2 left-2">
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <Gamepad2 className="w-3 h-3 mr-1" />
                    Playable
                  </Badge>
                </div>
              )}
              
              <div className="text-center">
                {project.enhanced ? (
                  <Trophy className="w-16 h-16 text-orange-400 mb-2" />
                ) : (
                  <Gamepad2 className="w-12 h-12 text-gray-500" />
                )}
                {project.enhanced && (
                  <div className="text-xs text-orange-400 font-medium">Super Engine</div>
                )}
              </div>
            </div>

            {/* Project Info */}
            <div className="space-y-3">
              <div>
                <h3 className="text-white font-semibold mb-1">{project.name}</h3>
                <div className="flex items-center justify-between">
                  <Badge className={`${
                    project.enhanced 
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                      : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}>
                    {project.type}
                  </Badge>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(project.status)}
                    <span className="text-xs text-gray-500 capitalize">{project.status}</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Engine:</span>
                  <span className="text-white">{project.engine}</span>
                </div>
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span className="text-white">{project.size}</span>
                </div>
                <div className="flex justify-between">
                  <span>Modified:</span>
                  <span className="text-white">{project.lastModified}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {project.playable && project.route ? (
                  <Link href={project.route}>
                    <Button 
                      className={`w-full ${
                        project.enhanced 
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600' 
                          : 'bg-orange-500 hover:bg-orange-600'
                      } text-white`} 
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {project.enhanced ? 'Play Enhanced' : 'Play Game'}
                    </Button>
                  </Link>
                ) : project.status === 'ready' ? (
                  <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" size="sm">
                    <Play className="w-4 h-4 mr-2" />
                    Launch Project
                  </Button>
                ) : project.status === 'building' ? (
                  <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white" size="sm" disabled>
                    <div className="w-4 h-4 mr-2 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Building...
                  </Button>
                ) : (
                  <Button className="w-full bg-gray-600 text-gray-300" size="sm" disabled>
                    <Play className="w-4 h-4 mr-2" />
                    Unavailable
                  </Button>
                )}

                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Share className="w-3 h-3 mr-1" />
                    Share
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}