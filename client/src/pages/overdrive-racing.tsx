import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Gauge, Timer, Zap } from "lucide-react";
import { Link } from "wouter";

interface Obstacle {
  x: number;
  z: number;
  width: number;
  height: number;
  type: 'barrel' | 'crate' | 'rock' | 'ramp';
  color: string;
}

export default function OverdriveRacing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [health, setHealth] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const gameStateRef = useRef({
    carX: 0,
    carZ: 0,
    carAngle: 0,
    velocity: 0,
    steerAngle: 0,
    obstacles: [] as Obstacle[],
    roadOffset: 0,
    keys: {} as { [key: string]: boolean },
    lastObstacle: 0,
    boost: 100,
    isJumping: false,
    jumpHeight: 0,
    tireTracks: [] as { x: number; y: number; alpha: number }[],
    sparks: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
    wheelAngle: 0,
    boostActive: false,
    trees: [] as { x: number; y: number; size: number }[]
  });

  useEffect(() => {
    if (!gameStarted || !canvasRef.current || gameOver) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const gs = gameStateRef.current;
    gs.carX = canvas.width / 2;
    gs.carZ = canvas.height * 0.7;
    gs.tireTracks = [];
    gs.sparks = [];
    gs.wheelAngle = 0;
    gs.boostActive = false;

    if (gs.trees.length === 0) {
      for (let i = 0; i < 20; i++) {
        gs.trees.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: 15 + Math.random() * 20
        });
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      gs.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'p') {
        setIsPaused(prev => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gs.keys[e.key.toLowerCase()] = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    const spawnObstacle = () => {
      const types: ('barrel' | 'crate' | 'rock' | 'ramp')[] = ['barrel', 'crate', 'rock', 'ramp'];
      const type = types[Math.floor(Math.random() * types.length)];
      const roadWidth = canvas.width * 0.6;
      const roadLeft = (canvas.width - roadWidth) / 2;
      
      const obstacle: Obstacle = {
        x: roadLeft + Math.random() * roadWidth,
        z: -100,
        width: type === 'rock' ? 80 : type === 'ramp' ? 100 : 40,
        height: type === 'ramp' ? 20 : 40,
        type,
        color: type === 'barrel' ? '#8B4513' : 
               type === 'crate' ? '#DEB887' : 
               type === 'rock' ? '#696969' : '#FFD700'
      };
      gs.obstacles.push(obstacle);
    };

    let animationId: number;
    let lastTime = 0;

    const gameLoop = (timestamp: number) => {
      if (isPaused) {
        animationId = requestAnimationFrame(gameLoop);
        return;
      }

      const delta = Math.min((timestamp - lastTime) / 16.67, 2);
      lastTime = timestamp;

      const roadWidth = canvas.width * 0.6;
      const roadLeft = (canvas.width - roadWidth) / 2;
      
      ctx.fillStyle = '#1a4a14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const grassGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grassGrad.addColorStop(0, '#2d6a27');
      grassGrad.addColorStop(1, '#1a4a14');
      ctx.fillStyle = grassGrad;
      ctx.fillRect(0, 0, roadLeft - 10, canvas.height);
      ctx.fillRect(roadLeft + roadWidth + 10, 0, canvas.width - roadLeft - roadWidth - 10, canvas.height);

      gs.trees.forEach(tree => {
        tree.y = (tree.y + gs.velocity * 2 * delta) % (canvas.height + 40);
        if (tree.x < roadLeft - 20 || tree.x > roadLeft + roadWidth + 20) {
          ctx.fillStyle = '#1a5a10';
          ctx.beginPath();
          ctx.arc(tree.x, tree.y, tree.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0d3a08';
          ctx.beginPath();
          ctx.arc(tree.x - tree.size * 0.2, tree.y - tree.size * 0.2, tree.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      const roadGrad = ctx.createLinearGradient(roadLeft, 0, roadLeft + roadWidth, 0);
      roadGrad.addColorStop(0, '#3a3a3a');
      roadGrad.addColorStop(0.1, '#4a4a4a');
      roadGrad.addColorStop(0.5, '#555555');
      roadGrad.addColorStop(0.9, '#4a4a4a');
      roadGrad.addColorStop(1, '#3a3a3a');
      ctx.fillStyle = roadGrad;
      ctx.fillRect(roadLeft, 0, roadWidth, canvas.height);

      gs.roadOffset = (gs.roadOffset + gs.velocity * 2) % 80;

      ctx.strokeStyle = '#ffcc00';
      ctx.setLineDash([30, 30]);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(roadLeft + roadWidth / 2, -gs.roadOffset);
      ctx.lineTo(roadLeft + roadWidth / 2, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.setLineDash([40, 40]);
      ctx.lineWidth = 2;
      for (let lane = 1; lane < 4; lane++) {
        if (lane === 2) continue;
        const laneX = roadLeft + (roadWidth / 4) * lane;
        ctx.beginPath();
        ctx.moveTo(laneX, -gs.roadOffset);
        ctx.lineTo(laneX, canvas.height);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.fillStyle = '#ff0000';
      ctx.fillRect(roadLeft - 10, 0, 10, canvas.height);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < canvas.height; i += 40) {
        const offset = (gs.roadOffset + i) % 80;
        if (offset < 40) {
          ctx.fillRect(roadLeft - 10, i, 10, 20);
        }
      }
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(roadLeft + roadWidth, 0, 10, canvas.height);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < canvas.height; i += 40) {
        const offset = (gs.roadOffset + i) % 80;
        if (offset < 40) {
          ctx.fillRect(roadLeft + roadWidth, i, 10, 20);
        }
      }

      gs.tireTracks = gs.tireTracks.filter(t => t.alpha > 0.02);
      gs.tireTracks.forEach(track => {
        track.alpha *= 0.995;
        ctx.fillStyle = `rgba(30,30,30,${track.alpha})`;
        ctx.fillRect(track.x - 1, track.y, 3, 6);
      });

      if (gs.velocity > 2) {
        gs.tireTracks.push(
          { x: gs.carX - 15, y: gs.carZ + 35, alpha: 0.3 },
          { x: gs.carX + 13, y: gs.carZ + 35, alpha: 0.3 }
        );
        if (gs.tireTracks.length > 300) {
          gs.tireTracks.splice(0, gs.tireTracks.length - 300);
        }
      }

      const maxSpeed = 15;
      const acceleration = 0.15;
      const friction = 0.02;
      const steerSpeed = 0.08;

      if (gs.keys['w'] || gs.keys['arrowup']) {
        gs.velocity = Math.min(maxSpeed, gs.velocity + acceleration * delta);
      }
      if (gs.keys['s'] || gs.keys['arrowdown']) {
        gs.velocity = Math.max(-5, gs.velocity - acceleration * 2 * delta);
      }
      
      gs.velocity *= (1 - friction);
      if (Math.abs(gs.velocity) < 0.1) gs.velocity = 0;

      if (gs.keys['a'] || gs.keys['arrowleft']) {
        gs.steerAngle = Math.max(-1, gs.steerAngle - steerSpeed * delta);
      } else if (gs.keys['d'] || gs.keys['arrowright']) {
        gs.steerAngle = Math.min(1, gs.steerAngle + steerSpeed * delta);
      } else {
        gs.steerAngle *= 0.9;
      }

      gs.carX += gs.steerAngle * gs.velocity * 0.5 * delta;

      if (gs.carX < roadLeft + 30) {
        gs.carX = roadLeft + 30;
        setHealth(prev => Math.max(0, prev - 0.5));
      }
      if (gs.carX > roadLeft + roadWidth - 30) {
        gs.carX = roadLeft + roadWidth - 30;
        setHealth(prev => Math.max(0, prev - 0.5));
      }

      if (gs.isJumping) {
        gs.jumpHeight += 5 * delta;
        if (gs.jumpHeight > 50) {
          gs.isJumping = false;
        }
      } else if (gs.jumpHeight > 0) {
        gs.jumpHeight = Math.max(0, gs.jumpHeight - 8 * delta);
      }

      gs.lastObstacle += gs.velocity * delta;
      const spawnDistance = Math.max(100, 300 - gs.velocity * 10);
      if (gs.lastObstacle > spawnDistance) {
        spawnObstacle();
        gs.lastObstacle = 0;
      }

      for (let i = gs.obstacles.length - 1; i >= 0; i--) {
        const obs = gs.obstacles[i];
        obs.z += gs.velocity * 3 * delta;

        if (obs.z > canvas.height + 100) {
          gs.obstacles.splice(i, 1);
          continue;
        }

        const scale = 1 + (obs.z / canvas.height) * 0.5;
        const screenWidth = obs.width * scale;
        const screenHeight = obs.height * scale;
        const screenX = obs.x;
        const screenY = obs.z;

        if (obs.type === 'ramp') {
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.moveTo(screenX - screenWidth/2, screenY + screenHeight);
          ctx.lineTo(screenX, screenY);
          ctx.lineTo(screenX + screenWidth/2, screenY + screenHeight);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.moveTo(screenX - screenWidth/4, screenY + screenHeight);
          ctx.lineTo(screenX, screenY + screenHeight * 0.3);
          ctx.lineTo(screenX + screenWidth/4, screenY + screenHeight);
          ctx.closePath();
          ctx.fill();
        } else if (obs.type === 'barrel') {
          ctx.fillStyle = '#8B4513';
          ctx.beginPath();
          ctx.ellipse(screenX, screenY, screenWidth / 2, screenHeight / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#5a2d0c';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(screenX, screenY, screenWidth / 2, screenHeight / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = '#aaa';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(screenX, screenY - screenHeight * 0.15, screenWidth * 0.4, 3, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(screenX, screenY + screenHeight * 0.15, screenWidth * 0.4, 3, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (obs.type === 'crate') {
          ctx.fillStyle = '#DEB887';
          ctx.fillRect(screenX - screenWidth/2, screenY - screenHeight/2, screenWidth, screenHeight);
          ctx.strokeStyle = '#8B6914';
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX - screenWidth/2, screenY - screenHeight/2, screenWidth, screenHeight);
          ctx.beginPath();
          ctx.moveTo(screenX - screenWidth/2, screenY - screenHeight/2);
          ctx.lineTo(screenX + screenWidth/2, screenY + screenHeight/2);
          ctx.moveTo(screenX + screenWidth/2, screenY - screenHeight/2);
          ctx.lineTo(screenX - screenWidth/2, screenY + screenHeight/2);
          ctx.stroke();
        } else if (obs.type === 'rock') {
          ctx.fillStyle = '#696969';
          ctx.beginPath();
          ctx.moveTo(screenX - screenWidth * 0.4, screenY + screenHeight * 0.3);
          ctx.lineTo(screenX - screenWidth * 0.3, screenY - screenHeight * 0.35);
          ctx.lineTo(screenX + screenWidth * 0.1, screenY - screenHeight * 0.45);
          ctx.lineTo(screenX + screenWidth * 0.4, screenY - screenHeight * 0.2);
          ctx.lineTo(screenX + screenWidth * 0.45, screenY + screenHeight * 0.3);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.beginPath();
          ctx.moveTo(screenX - screenWidth * 0.2, screenY - screenHeight * 0.3);
          ctx.lineTo(screenX + screenWidth * 0.1, screenY - screenHeight * 0.45);
          ctx.lineTo(screenX + screenWidth * 0.3, screenY - screenHeight * 0.1);
          ctx.closePath();
          ctx.fill();
        }

        const carWidth = 40;
        const carHeight = 70;
        if (gs.jumpHeight < 20 && 
            Math.abs(gs.carX - obs.x) < (carWidth + screenWidth) / 2 - 10 &&
            Math.abs(gs.carZ - obs.z) < (carHeight + screenHeight) / 2 - 10) {
          
          if (obs.type === 'ramp') {
            gs.isJumping = true;
            gs.jumpHeight = 0;
            setDistance(prev => prev + 50);
          } else {
            const damage = obs.type === 'rock' ? 20 : 10;
            for (let s = 0; s < 12; s++) {
              gs.sparks.push({
                x: gs.carX + (Math.random() - 0.5) * 30,
                y: gs.carZ - gs.jumpHeight + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8 - 3,
                life: 20 + Math.random() * 15,
                color: Math.random() > 0.5 ? '#ffaa00' : '#ffdd44'
              });
            }
            setHealth(prev => {
              const newHealth = Math.max(0, prev - damage);
              if (newHealth <= 0) {
                setGameOver(true);
                if (distance > highScore) {
                  setHighScore(distance);
                }
              }
              return newHealth;
            });
            gs.velocity *= 0.5;
            gs.obstacles.splice(i, 1);
          }
        }
      }

      gs.sparks = gs.sparks.filter(s => s.life > 0);
      gs.sparks.forEach(spark => {
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += 0.3;
        spark.life -= 1;
        ctx.globalAlpha = spark.life / 35;
        ctx.fillStyle = spark.color;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      gs.wheelAngle += gs.velocity * 0.1 * delta;
      gs.boostActive = (gs.keys['shift'] || gs.keys[' ']) && gs.velocity > 8;

      if (gs.velocity > maxSpeed * 0.5) {
        const speedRatio = gs.velocity / maxSpeed;
        const lineCount = Math.floor(speedRatio * 15);
        ctx.strokeStyle = `rgba(255,255,255,${speedRatio * 0.15})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < lineCount; i++) {
          const angle = (Math.PI * 2 / lineCount) * i + gs.wheelAngle;
          const inner = 80 + Math.random() * 40;
          const outer = inner + 60 + Math.random() * 80;
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
          ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
          ctx.stroke();
        }
      }

      ctx.save();
      ctx.translate(gs.carX, gs.carZ - gs.jumpHeight);
      ctx.rotate(gs.steerAngle * 0.2);

      if (gs.jumpHeight > 0) {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = gs.jumpHeight;
      }

      if (gs.boostActive || gs.velocity > 12) {
        for (let f = 0; f < 5; f++) {
          const flameY = 38 + f * 5 + Math.random() * 6;
          const flameR = 8 - f * 1.2 + Math.random() * 3;
          ctx.fillStyle = f < 2 ? `rgba(255,${100 + Math.random() * 100},0,${0.8 - f * 0.15})` : `rgba(255,${200 + Math.random() * 55},50,${0.5 - f * 0.08})`;
          ctx.beginPath();
          ctx.arc(-8 + Math.random() * 4, flameY, flameR, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(8 + Math.random() * 4, flameY, flameR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      ctx.moveTo(-22, 35);
      ctx.lineTo(-22, -25);
      ctx.quadraticCurveTo(-22, -38, -15, -38);
      ctx.lineTo(15, -38);
      ctx.quadraticCurveTo(22, -38, 22, -25);
      ctx.lineTo(22, 35);
      ctx.quadraticCurveTo(22, 38, 18, 38);
      ctx.lineTo(-18, 38);
      ctx.quadraticCurveTo(-22, 38, -22, 35);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#c62828';
      ctx.beginPath();
      ctx.moveTo(-22, 5);
      ctx.lineTo(22, 5);
      ctx.lineTo(22, 35);
      ctx.quadraticCurveTo(22, 38, 18, 38);
      ctx.lineTo(-18, 38);
      ctx.quadraticCurveTo(-22, 38, -22, 35);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(100,180,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(-16, -22);
      ctx.lineTo(-12, -30);
      ctx.lineTo(12, -30);
      ctx.lineTo(16, -22);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(100,180,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(-14, 5);
      ctx.lineTo(-10, -2);
      ctx.lineTo(10, -2);
      ctx.lineTo(14, 5);
      ctx.closePath();
      ctx.fill();

      const drawWheel = (wx: number, wy: number) => {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(wx - 5, wy - 10, 10, 20);
        ctx.fillStyle = '#333';
        ctx.fillRect(wx - 4, wy - 9, 8, 18);
        const rotLine = Math.sin(gs.wheelAngle) * 6;
        ctx.fillStyle = '#555';
        ctx.fillRect(wx - 1, wy - 8 + rotLine, 2, 3);
      };
      drawWheel(-25, -25);
      drawWheel(25, -25);
      drawWheel(-25, 22);
      drawWheel(25, 22);

      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(-14, 36, 3, 0, Math.PI * 2);
      ctx.arc(14, 36, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(-12, -36, 3, 0, Math.PI * 2);
      ctx.arc(12, -36, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(-15, -35);
      ctx.lineTo(-5, -20);
      ctx.lineTo(-5, -35);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();

      setSpeed(Math.abs(Math.floor(gs.velocity * 10)));
      setDistance(prev => prev + gs.velocity * delta * 0.5);

      if (!gameOver) {
        animationId = requestAnimationFrame(gameLoop);
      }
    };

    animationId = requestAnimationFrame(gameLoop);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gs.carX = canvas.width / 2;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameStarted, gameOver, isPaused, distance, highScore]);

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-orange-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-2xl mx-auto p-8">
          <Link href="/super-engine">
            <Button variant="outline" className="absolute top-4 left-4 border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-black" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-500 mb-4">
            OVERDRIVE
          </h1>
          <p className="text-xl text-gray-300 mb-2">Speed. Skill. Survival.</p>
          <p className="text-gray-400 mb-8">
            An adrenaline-pumping racing game where you navigate through endless obstacles.
            Push your limits and see how far you can drive!
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8 text-left bg-gray-800/50 p-6 rounded-lg">
            <div>
              <h3 className="text-orange-400 font-bold mb-2">Controls</h3>
              <p className="text-gray-300 text-sm">W / ↑ - Accelerate</p>
              <p className="text-gray-300 text-sm">S / ↓ - Brake/Reverse</p>
              <p className="text-gray-300 text-sm">A / ← - Steer Left</p>
              <p className="text-gray-300 text-sm">D / → - Steer Right</p>
              <p className="text-gray-300 text-sm">P - Pause</p>
            </div>
            <div>
              <h3 className="text-orange-400 font-bold mb-2">Obstacles</h3>
              <p className="text-yellow-600 text-sm">Barrels - Small damage</p>
              <p className="text-yellow-800 text-sm">Crates - Medium damage</p>
              <p className="text-gray-500 text-sm">Rocks - Heavy damage</p>
              <p className="text-yellow-400 text-sm">Ramps - Jump boost!</p>
            </div>
          </div>

          <Button 
            onClick={() => setGameStarted(true)}
            className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700 text-white px-12 py-6 text-xl"
            data-testid="button-start-game"
          >
            <Play className="w-6 h-6 mr-2" />
            Start Racing
          </Button>

          {highScore > 0 && (
            <p className="mt-4 text-yellow-400">High Score: {Math.floor(highScore)}m</p>
          )}
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-orange-900 to-gray-900 flex items-center justify-center">
        <div className="text-center bg-gray-800/80 p-12 rounded-xl">
          <h1 className="text-5xl font-bold text-orange-500 mb-4">CRASHED!</h1>
          <div className="text-2xl text-white mb-2">Distance: {Math.floor(distance)}m</div>
          <div className="text-xl text-gray-300 mb-2">Max Speed: {speed} km/h</div>
          {distance > highScore && (
            <div className="text-xl text-yellow-400 mb-4">New High Score!</div>
          )}
          <div className="flex gap-4 justify-center mt-6">
            <Button 
              onClick={() => {
                setGameOver(false);
                setGameStarted(false);
                setHealth(100);
                setSpeed(0);
                setDistance(0);
                gameStateRef.current.obstacles = [];
                gameStateRef.current.velocity = 0;
              }}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="button-play-again"
            >
              Race Again
            </Button>
            <Link href="/super-engine">
              <Button variant="outline" className="border-gray-400 text-gray-400" data-testid="button-exit">
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
      <canvas ref={canvasRef} className="absolute inset-0" />
      
      {isPaused && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white mb-4">PAUSED</h2>
            <p className="text-gray-400">Press P to resume</p>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 space-y-2">
        <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded">
          <Gauge className="w-5 h-5 text-orange-500" />
          <span className="text-white text-xl font-bold" data-testid="text-speed">{speed} km/h</span>
        </div>
        <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded">
          <Timer className="w-5 h-5 text-blue-500" />
          <span className="text-white text-lg" data-testid="text-distance">{Math.floor(distance)}m</span>
        </div>
      </div>

      <div className="absolute top-4 right-4">
        <div className="bg-black/60 px-4 py-2 rounded">
          <div className="text-gray-400 text-sm mb-1">Health</div>
          <div className="w-32 h-4 bg-gray-700 rounded overflow-hidden">
            <div 
              className={`h-full transition-all ${health > 50 ? 'bg-green-500' : health > 25 ? 'bg-yellow-500' : 'bg-red-500'}`} 
              style={{ width: `${health}%` }} 
            />
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 text-gray-400 text-sm">
        WASD or Arrow Keys to drive | P to pause
      </div>
    </div>
  );
}