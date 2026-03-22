import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft,
  Play,
  Pause,
  Users,
  Trophy,
  Zap,
  Timer,
  Flag,
  Car,
  Settings,
  Crown,
  Target
} from "lucide-react";
import { Link } from "wouter";

interface Player {
  id: string;
  name: string;
  car: string;
  position: { x: number; y: number };
  speed: number;
  lap: number;
  lapTime: number;
  totalTime: number;
  rank: number;
  isHuman: boolean;
  color: string;
}

interface PowerUp {
  id: string;
  type: 'speed' | 'shield' | 'oil' | 'nitro';
  position: { x: number; y: number };
  collected: boolean;
}

interface RaceTrack {
  checkpoints: { x: number; y: number }[];
  powerUps: PowerUp[];
  laps: number;
}

export default function MultiplayerRacing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'lobby' | 'racing' | 'finished'>('lobby');
  const [raceTime, setRaceTime] = useState(0);
  const [players, setPlayers] = useState<Player[]>([
    {
      id: 'player1',
      name: 'You',
      car: 'Formula Red',
      position: { x: 100, y: 300 },
      speed: 0,
      lap: 0,
      lapTime: 0,
      totalTime: 0,
      rank: 1,
      isHuman: true,
      color: '#ff4757'
    },
    {
      id: 'player2',
      name: 'SpeedDemon',
      car: 'Lightning Blue',
      position: { x: 100, y: 320 },
      speed: 0,
      lap: 0,
      lapTime: 0,
      totalTime: 0,
      rank: 2,
      isHuman: false,
      color: '#3742fa'
    },
    {
      id: 'player3',
      name: 'TurboMax',
      car: 'Thunder Green',
      position: { x: 100, y: 340 },
      speed: 0,
      lap: 0,
      lapTime: 0,
      totalTime: 0,
      rank: 3,
      isHuman: false,
      color: '#2ed573'
    },
    {
      id: 'player4',
      name: 'RaceKing',
      car: 'Storm Purple',
      position: { x: 100, y: 360 },
      speed: 0,
      lap: 0,
      lapTime: 0,
      totalTime: 0,
      rank: 4,
      isHuman: false,
      color: '#a55eea'
    }
  ]);

  const [track] = useState<RaceTrack>({
    checkpoints: [
      { x: 150, y: 200 },
      { x: 400, y: 150 },
      { x: 650, y: 200 },
      { x: 700, y: 400 },
      { x: 500, y: 500 },
      { x: 200, y: 450 },
      { x: 100, y: 300 }
    ],
    powerUps: [
      { id: 'p1', type: 'speed', position: { x: 300, y: 200 }, collected: false },
      { id: 'p2', type: 'nitro', position: { x: 600, y: 300 }, collected: false },
      { id: 'p3', type: 'shield', position: { x: 400, y: 450 }, collected: false },
      { id: 'p4', type: 'oil', position: { x: 250, y: 380 }, collected: false }
    ],
    laps: 3
  });

  const [keys, setKeys] = useState<{ [key: string]: boolean }>({});
  const [connectedPlayers, setConnectedPlayers] = useState(4);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key]: true }));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState === 'racing') {
      const interval = setInterval(() => {
        setRaceTime(prev => prev + 0.1);
        
        // Update player positions
        setPlayers(prevPlayers => {
          return prevPlayers.map(player => {
            let newSpeed = player.speed;
            let newPosition = { ...player.position };
            
            if (player.isHuman) {
              // Human player controls
              if (keys['ArrowUp'] || keys['w']) newSpeed = Math.min(8, newSpeed + 0.3);
              if (keys['ArrowDown'] || keys['s']) newSpeed = Math.max(-3, newSpeed - 0.2);
              if (!keys['ArrowUp'] && !keys['w'] && !keys['ArrowDown'] && !keys['s']) {
                newSpeed *= 0.95; // Friction
              }
              
              if (keys['ArrowLeft'] || keys['a']) {
                newPosition.x -= 3;
              }
              if (keys['ArrowRight'] || keys['d']) {
                newPosition.x += 3;
              }
            } else {
              // AI player movement
              const targetCheckpoint = track.checkpoints[player.lap % track.checkpoints.length];
              const dx = targetCheckpoint.x - player.position.x;
              const dy = targetCheckpoint.y - player.position.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance > 30) {
                newSpeed = Math.min(6 + Math.random() * 2, newSpeed + 0.2);
                newPosition.x += (dx / distance) * newSpeed * 0.8;
                newPosition.y += (dy / distance) * newSpeed * 0.8;
              } else {
                // Reached checkpoint
                player.lap++;
              }
            }
            
            // Apply speed to position
            newPosition.y -= newSpeed * 0.5;
            
            // Keep within bounds
            newPosition.x = Math.max(50, Math.min(750, newPosition.x));
            newPosition.y = Math.max(50, Math.min(550, newPosition.y));
            
            return {
              ...player,
              position: newPosition,
              speed: newSpeed,
              totalTime: player.totalTime + 0.1
            };
          });
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [gameState, keys, track.checkpoints]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw track
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 60;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      track.checkpoints.forEach((checkpoint, index) => {
        if (index === 0) {
          ctx.moveTo(checkpoint.x, checkpoint.y);
        } else {
          ctx.lineTo(checkpoint.x, checkpoint.y);
        }
      });
      ctx.closePath();
      ctx.stroke();

      // Draw track center line
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      track.checkpoints.forEach((checkpoint, index) => {
        if (index === 0) {
          ctx.moveTo(checkpoint.x, checkpoint.y);
        } else {
          ctx.lineTo(checkpoint.x, checkpoint.y);
        }
      });
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw checkpoints
      track.checkpoints.forEach((checkpoint, index) => {
        ctx.fillStyle = index === 0 ? '#ef4444' : '#10b981';
        ctx.beginPath();
        ctx.arc(checkpoint.x, checkpoint.y, 15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(index === 0 ? 'START' : `${index}`, checkpoint.x, checkpoint.y + 4);
      });

      // Draw power-ups
      track.powerUps.forEach(powerUp => {
        if (!powerUp.collected) {
          const colors = {
            speed: '#3b82f6',
            nitro: '#f59e0b',
            shield: '#10b981',
            oil: '#6b7280'
          };
          
          ctx.fillStyle = colors[powerUp.type];
          ctx.beginPath();
          ctx.arc(powerUp.position.x, powerUp.position.y, 12, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          const symbols = { speed: '⚡', nitro: '🔥', shield: '🛡', oil: '💧' };
          ctx.fillText(symbols[powerUp.type], powerUp.position.x, powerUp.position.y + 3);
        }
      });

      // Draw players
      players.forEach(player => {
        // Car shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(player.position.x + 2, player.position.y + 2, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Car body
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.ellipse(player.position.x, player.position.y, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Car details
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(player.position.x, player.position.y - 2, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Player name
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, player.position.x, player.position.y - 25);

        // Rank indicator
        ctx.fillStyle = player.rank === 1 ? '#fbbf24' : '#6b7280';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(`#${player.rank}`, player.position.x, player.position.y + 25);
      });

      // Draw UI
      if (gameState === 'racing') {
        // Race timer
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${raceTime.toFixed(1)}s`, canvas.width / 2, 40);

        // Speed indicator for human player
        const humanPlayer = players.find(p => p.isHuman);
        if (humanPlayer) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '16px Arial';
          ctx.textAlign = 'left';
          ctx.fillText(`Speed: ${Math.floor(humanPlayer.speed * 10)} km/h`, 20, canvas.height - 40);
          ctx.fillText(`Lap: ${humanPlayer.lap}/${track.laps}`, 20, canvas.height - 20);
        }
      }
    };

    render();
    const animationFrame = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationFrame);
  }, [players, track, gameState, raceTime]);

  const startRace = () => {
    setGameState('racing');
    setRaceTime(0);
    setPlayers(prev => prev.map(player => ({
      ...player,
      lap: 0,
      totalTime: 0,
      rank: Math.floor(Math.random() * 4) + 1
    })));
  };

  const resetRace = () => {
    setGameState('lobby');
    setRaceTime(0);
    setPlayers(prev => prev.map((player, index) => ({
      ...player,
      position: { x: 100, y: 300 + (index * 20) },
      speed: 0,
      lap: 0,
      totalTime: 0,
      rank: index + 1
    })));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Link href="/engine-launcher">
              <Button variant="ghost" className="text-gray-300 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Launcher
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-yellow-400">
                Multiplayer Racing Championship
              </h1>
              <p className="text-gray-400">Real-time multiplayer racing with power-ups and leaderboards</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge className="bg-red-500/20 text-red-400">
              <Users className="w-3 h-3 mr-1" />
              {connectedPlayers} Players
            </Badge>
            <Badge className="bg-green-500/20 text-green-400">
              Multiplayer
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Race View */}
          <div className="lg:col-span-3">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <Car className="w-5 h-5 mr-2 text-red-400" />
                    Thunder Track Circuit
                  </div>
                  <div className="flex items-center space-x-2">
                    {gameState === 'lobby' && (
                      <Button
                        onClick={startRace}
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Race
                      </Button>
                    )}
                    {gameState === 'racing' && (
                      <Button
                        onClick={resetRace}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        End Race
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="w-full bg-gray-900 rounded-lg border border-gray-600"
                />
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex space-x-4">
                    <div className="text-sm text-gray-400">
                      <span className="text-yellow-400">⚡</span> Speed Boost
                    </div>
                    <div className="text-sm text-gray-400">
                      <span className="text-orange-400">🔥</span> Nitro
                    </div>
                    <div className="text-sm text-gray-400">
                      <span className="text-green-400">🛡</span> Shield
                    </div>
                    <div className="text-sm text-gray-400">
                      <span className="text-gray-400">💧</span> Oil Slick
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    WASD / Arrow Keys: Drive • Space: Use Power-up
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Leaderboard & Stats */}
          <div className="space-y-4">
            {/* Live Leaderboard */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                  Live Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {players
                    .sort((a, b) => a.rank - b.rank)
                    .map((player, index) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        player.isHuman 
                          ? 'bg-orange-500/20 border border-orange-500/30' 
                          : 'bg-gray-700/30'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500' :
                          index === 1 ? 'bg-gray-400' :
                          index === 2 ? 'bg-orange-600' : 'bg-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: player.color }}></div>
                        <div>
                          <div className="text-white font-medium">{player.name}</div>
                          <div className="text-xs text-gray-400">{player.car}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white text-sm">Lap {player.lap}/3</div>
                        <div className="text-xs text-gray-400">{player.totalTime.toFixed(1)}s</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Race Stats */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Timer className="w-5 h-5 mr-2 text-blue-400" />
                  Race Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Race Time</span>
                  <span className="text-white">{raceTime.toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Track Length</span>
                  <span className="text-white">2.4 km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Laps</span>
                  <span className="text-white">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Power-ups</span>
                  <span className="text-white">{track.powerUps.filter(p => !p.collected).length} Available</span>
                </div>
              </CardContent>
            </Card>

            {/* Player Status */}
            {players.find(p => p.isHuman) && (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Target className="w-5 h-5 mr-2 text-green-400" />
                    Your Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(() => {
                    const player = players.find(p => p.isHuman)!;
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Position</span>
                          <span className="text-yellow-400 font-bold">#{player.rank}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Current Speed</span>
                          <span className="text-white">{Math.floor(player.speed * 10)} km/h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Lap Progress</span>
                          <span className="text-white">{player.lap}/3</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Lap Progress</span>
                            <span className="text-blue-400">{Math.min(100, (player.lap / 3) * 100).toFixed(0)}%</span>
                          </div>
                          <Progress value={(player.lap / 3) * 100} className="h-2" />
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/collaboration-hub">
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white" size="sm">
                    <Users className="w-4 h-4 mr-2" />
                    Invite Friends
                  </Button>
                </Link>
                <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Car Settings
                </Button>
                <Link href="/analytics-dashboard">
                  <Button className="w-full bg-green-500 hover:bg-green-600 text-white" size="sm">
                    <Trophy className="w-4 h-4 mr-2" />
                    View Records
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