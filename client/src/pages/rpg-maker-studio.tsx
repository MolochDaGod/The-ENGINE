import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Play, 
  Download, 
  Save, 
  Share2, 
  Users, 
  Palette, 
  Music, 
  Map, 
  Sword,
  Heart,
  Zap,
  Crown,
  Shield,
  Star
} from "lucide-react";
import { Link } from "wouter";

interface RPGCharacter {
  id: string;
  name: string;
  class: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  skills: string[];
  equipment: {
    weapon: string;
    armor: string;
    accessory: string;
  };
}

interface RPGProject {
  id: string;
  name: string;
  genre: string;
  lastModified: string;
  playtime: string;
  maps: number;
  characters: number;
  events: number;
  thumbnail: string;
  status: 'development' | 'testing' | 'complete';
}

const sampleCharacters: RPGCharacter[] = [
  {
    id: 'hero',
    name: 'Alex',
    class: 'Knight',
    level: 15,
    hp: 450,
    maxHp: 450,
    mp: 120,
    maxMp: 120,
    attack: 85,
    defense: 92,
    speed: 65,
    skills: ['Slash', 'Guard', 'Heal', 'Power Strike'],
    equipment: {
      weapon: 'Steel Sword',
      armor: 'Chain Mail',
      accessory: 'Power Ring'
    }
  },
  {
    id: 'mage',
    name: 'Luna',
    class: 'Mage',
    level: 12,
    hp: 280,
    maxHp: 280,
    mp: 350,
    maxMp: 350,
    attack: 45,
    defense: 35,
    speed: 88,
    skills: ['Fireball', 'Ice Shard', 'Lightning', 'Heal All'],
    equipment: {
      weapon: 'Magic Staff',
      armor: 'Mystic Robe',
      accessory: 'Mana Crystal'
    }
  }
];

const rpgProjects: RPGProject[] = [
  {
    id: 'fantasy-quest',
    name: 'Fantasy Quest Chronicles',
    genre: 'Fantasy RPG',
    lastModified: '2 hours ago',
    playtime: '25-30 hours',
    maps: 45,
    characters: 12,
    events: 287,
    thumbnail: '',
    status: 'development'
  },
  {
    id: 'cyber-adventure',
    name: 'Cyberpunk Adventure',
    genre: 'Sci-Fi RPG',
    lastModified: '1 day ago',
    playtime: '15-20 hours',
    maps: 28,
    characters: 8,
    events: 156,
    thumbnail: '',
    status: 'testing'
  }
];

export default function RPGMakerStudio() {
  const [selectedCharacter, setSelectedCharacter] = useState<RPGCharacter>(sampleCharacters[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameProgress, setGameProgress] = useState(0);
  const [battleMode, setBattleMode] = useState(false);
  const [enemyHp, setEnemyHp] = useState(100);

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setGameProgress(prev => Math.min(prev + 0.5, 100));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  const startBattle = () => {
    setBattleMode(true);
    setEnemyHp(100);
  };

  const attack = () => {
    const damage = Math.floor(Math.random() * 30) + 20;
    setEnemyHp(prev => Math.max(0, prev - damage));
    
    if (enemyHp - damage <= 0) {
      setBattleMode(false);
      // Award experience
      setSelectedCharacter(prev => ({
        ...prev,
        level: prev.level + 1,
        hp: Math.min(prev.maxHp, prev.hp + 50)
      }));
    }
  };

  const useSkill = (skillName: string) => {
    switch (skillName) {
      case 'Heal':
        setSelectedCharacter(prev => ({
          ...prev,
          hp: Math.min(prev.maxHp, prev.hp + 100),
          mp: prev.mp - 10
        }));
        break;
      case 'Fireball':
        const fireDamage = Math.floor(Math.random() * 50) + 30;
        setEnemyHp(prev => Math.max(0, prev - fireDamage));
        setSelectedCharacter(prev => ({ ...prev, mp: prev.mp - 15 }));
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
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
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                RPG Maker Studio
              </h1>
              <p className="text-gray-400">Create epic role-playing adventures</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge className="bg-purple-500/20 text-purple-400">
              Enhanced Edition
            </Badge>
            <Link href="/avernus-3d">
              <Button variant="outline" className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-black">
                Avernus 3D
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="character" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-gray-800/50">
            <TabsTrigger value="character" className="data-[state=active]:bg-purple-500">
              <Crown className="w-4 h-4 mr-2" />
              Character
            </TabsTrigger>
            <TabsTrigger value="world" className="data-[state=active]:bg-purple-500">
              <Map className="w-4 h-4 mr-2" />
              World
            </TabsTrigger>
            <TabsTrigger value="battle" className="data-[state=active]:bg-purple-500">
              <Sword className="w-4 h-4 mr-2" />
              Battle
            </TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-purple-500">
              <Save className="w-4 h-4 mr-2" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="play" className="data-[state=active]:bg-purple-500">
              <Play className="w-4 h-4 mr-2" />
              Play Test
            </TabsTrigger>
          </TabsList>

          {/* Character Management */}
          <TabsContent value="character">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Crown className="w-5 h-5 mr-2 text-purple-400" />
                      Character Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <Crown className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{selectedCharacter.name}</h3>
                        <p className="text-purple-400">{selectedCharacter.class} - Level {selectedCharacter.level}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-400">Health</span>
                          <span className="text-red-400">{selectedCharacter.hp}/{selectedCharacter.maxHp}</span>
                        </div>
                        <Progress value={(selectedCharacter.hp / selectedCharacter.maxHp) * 100} className="h-3" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-400">Mana</span>
                          <span className="text-blue-400">{selectedCharacter.mp}/{selectedCharacter.maxMp}</span>
                        </div>
                        <Progress value={(selectedCharacter.mp / selectedCharacter.maxMp) * 100} className="h-3" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Sword className="w-4 h-4 text-red-400 mr-1" />
                          <span className="text-gray-400">Attack</span>
                        </div>
                        <div className="text-white font-bold text-lg">{selectedCharacter.attack}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Shield className="w-4 h-4 text-blue-400 mr-1" />
                          <span className="text-gray-400">Defense</span>
                        </div>
                        <div className="text-white font-bold text-lg">{selectedCharacter.defense}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Zap className="w-4 h-4 text-yellow-400 mr-1" />
                          <span className="text-gray-400">Speed</span>
                        </div>
                        <div className="text-white font-bold text-lg">{selectedCharacter.speed}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Equipment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Weapon</span>
                      <span className="text-orange-400">{selectedCharacter.equipment.weapon}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Armor</span>
                      <span className="text-blue-400">{selectedCharacter.equipment.armor}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Accessory</span>
                      <span className="text-purple-400">{selectedCharacter.equipment.accessory}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Skills</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedCharacter.skills.map((skill, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="w-full justify-start border-gray-600 text-gray-300 hover:bg-purple-500/20"
                        onClick={() => useSkill(skill)}
                      >
                        <Star className="w-4 h-4 mr-2" />
                        {skill}
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Battle System */}
          <TabsContent value="battle">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Sword className="w-5 h-5 mr-2 text-red-400" />
                  Battle System Demo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!battleMode ? (
                  <div className="text-center py-8">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center mb-4">
                      <Sword className="w-12 h-12 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Ready for Battle</h3>
                    <p className="text-gray-400 mb-6">Test the enhanced combat system with real-time mechanics</p>
                    <Button 
                      onClick={startBattle}
                      className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white px-8 py-4"
                    >
                      <Sword className="w-5 h-5 mr-2" />
                      Start Battle
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="text-center">
                        <h4 className="text-white font-bold mb-2">{selectedCharacter.name}</h4>
                        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mb-2">
                          <Crown className="w-10 h-10 text-white" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-400">HP</span>
                            <span className="text-red-400">{selectedCharacter.hp}/{selectedCharacter.maxHp}</span>
                          </div>
                          <Progress value={(selectedCharacter.hp / selectedCharacter.maxHp) * 100} className="h-2" />
                        </div>
                      </div>

                      <div className="text-center">
                        <h4 className="text-white font-bold mb-2">Shadow Beast</h4>
                        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-500 to-black rounded-full flex items-center justify-center mb-2">
                          <span className="text-2xl">👹</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-400">HP</span>
                            <span className="text-red-400">{enemyHp}/100</span>
                          </div>
                          <Progress value={enemyHp} className="h-2" />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center space-x-4">
                      <Button 
                        onClick={attack}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        <Sword className="w-4 h-4 mr-2" />
                        Attack
                      </Button>
                      <Button 
                        onClick={() => useSkill('Heal')}
                        className="bg-green-500 hover:bg-green-600 text-white"
                        disabled={selectedCharacter.mp < 10}
                      >
                        <Heart className="w-4 h-4 mr-2" />
                        Heal (10 MP)
                      </Button>
                      <Button 
                        onClick={() => useSkill('Fireball')}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        disabled={selectedCharacter.mp < 15}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Fireball (15 MP)
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects */}
          <TabsContent value="projects">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {rpgProjects.map((project) => (
                <Card key={project.id} className="bg-gray-800/50 border-gray-700 hover:border-purple-500 transition-colors">
                  <CardContent className="p-6">
                    <div className="aspect-video bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-lg mb-4 flex items-center justify-center">
                      <Crown className="w-16 h-16 text-purple-400" />
                    </div>
                    
                    <h3 className="text-white font-bold text-lg mb-2">{project.name}</h3>
                    <p className="text-purple-400 text-sm mb-4">{project.genre}</p>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                      <div>
                        <div className="text-gray-400">Maps</div>
                        <div className="text-white font-bold">{project.maps}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Characters</div>
                        <div className="text-white font-bold">{project.characters}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Events</div>
                        <div className="text-white font-bold">{project.events}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white">
                        <Play className="w-4 h-4 mr-2" />
                        Open Project
                      </Button>
                      <div className="flex space-x-2">
                        <Button variant="outline" className="flex-1 border-gray-600 text-gray-300">
                          <Share2 className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                        <Button variant="outline" className="flex-1 border-gray-600 text-gray-300">
                          <Download className="w-4 h-4 mr-2" />
                          Build
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Play Test */}
          <TabsContent value="play">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Play className="w-5 h-5 mr-2 text-green-400" />
                  Game Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="aspect-video bg-black rounded-lg flex items-center justify-center relative overflow-hidden">
                    {!isPlaying ? (
                      <div className="text-center">
                        <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Play className="w-12 h-12 text-white" />
                        </div>
                        <h3 className="text-white text-xl font-bold mb-2">RPG Demo Ready</h3>
                        <p className="text-gray-400 mb-4">Experience the enhanced RPG mechanics</p>
                        <Button 
                          onClick={() => setIsPlaying(true)}
                          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                        >
                          <Play className="w-5 h-5 mr-2" />
                          Start Demo
                        </Button>
                      </div>
                    ) : (
                      <div className="w-full h-full relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-900 via-blue-900 to-purple-900">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center space-y-4">
                              <div className="text-4xl">🏰</div>
                              <div className="text-white text-xl font-bold">Exploring Ancient Castle</div>
                              <div className="text-purple-300">Quest Progress: {Math.floor(gameProgress)}%</div>
                              <Progress value={gameProgress} className="w-64 mx-auto" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <Button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="bg-purple-500 hover:bg-purple-600 text-white"
                      >
                        {isPlaying ? <span>Pause</span> : <Play className="w-4 h-4 mr-2" />}
                        {isPlaying ? 'Pause' : 'Play'}
                      </Button>
                      <Button 
                        onClick={() => {setIsPlaying(false); setGameProgress(0);}}
                        variant="outline"
                        className="border-gray-600 text-gray-300"
                      >
                        Reset
                      </Button>
                    </div>
                    
                    <div className="text-sm text-gray-400">
                      WASD: Move | Space: Interact | Enter: Menu
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}