import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Sword, Shield, Zap, Heart, Star } from "lucide-react";
import { Link } from "wouter";

interface Enemy {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  type: 'grunt' | 'elite' | 'boss';
  color: string;
  attackCooldown: number;
  speed: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  type: 'player' | 'enemy';
  color: string;
}

interface Ability {
  name: string;
  key: string;
  cooldown: number;
  maxCooldown: number;
  manaCost: number;
  color: string;
}

export default function AvernusArena() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [health, setHealth] = useState(100);
  const [maxHealth] = useState(100);
  const [mana, setMana] = useState(100);
  const [maxMana] = useState(100);
  const [level, setLevel] = useState(1);
  const [exp, setExp] = useState(0);
  const [expToLevel, setExpToLevel] = useState(100);
  const [kills, setKills] = useState(0);
  const [wave, setWave] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState<'sword' | 'bow' | 'scythe'>('sword');
  
  const gameStateRef = useRef({
    playerX: 0,
    playerY: 0,
    playerAngle: 0,
    enemies: [] as Enemy[],
    projectiles: [] as Projectile[],
    keys: {} as { [key: string]: boolean },
    mouseX: 0,
    mouseY: 0,
    abilities: [
      { name: 'Charge', key: 'q', cooldown: 0, maxCooldown: 480, manaCost: 20, color: '#FFD700' },
      { name: 'Shield', key: 'e', cooldown: 0, maxCooldown: 600, manaCost: 30, color: '#4169E1' },
      { name: 'Ultimate', key: 'r', cooldown: 0, maxCooldown: 1200, manaCost: 50, color: '#FF4500' },
    ] as Ability[],
    isShielded: false,
    shieldTimer: 0,
    dashCooldown: 0,
    lastAttack: 0,
    waveTimer: 0,
    manaRegen: 0
  });

  useEffect(() => {
    if (!gameStarted || !canvasRef.current || gameOver) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const gs = gameStateRef.current;
    gs.playerX = canvas.width / 2;
    gs.playerY = canvas.height / 2;

    const handleKeyDown = (e: KeyboardEvent) => {
      gs.keys[e.key.toLowerCase()] = true;
      
      if (e.key === 'q' && gs.abilities[0].cooldown <= 0 && mana >= gs.abilities[0].manaCost) {
        const dashDistance = 150;
        gs.playerX += Math.cos(gs.playerAngle) * dashDistance;
        gs.playerY += Math.sin(gs.playerAngle) * dashDistance;
        gs.abilities[0].cooldown = gs.abilities[0].maxCooldown;
        setMana(prev => prev - gs.abilities[0].manaCost);
        
        gs.enemies.forEach(enemy => {
          const dx = enemy.x - gs.playerX;
          const dy = enemy.y - gs.playerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            enemy.health -= 30;
          }
        });
      }
      
      if (e.key === 'e' && gs.abilities[1].cooldown <= 0 && mana >= gs.abilities[1].manaCost) {
        gs.isShielded = true;
        gs.shieldTimer = 180;
        gs.abilities[1].cooldown = gs.abilities[1].maxCooldown;
        setMana(prev => prev - gs.abilities[1].manaCost);
      }
      
      if (e.key === 'r' && gs.abilities[2].cooldown <= 0 && mana >= gs.abilities[2].manaCost) {
        gs.enemies.forEach(enemy => {
          const dx = enemy.x - gs.playerX;
          const dy = enemy.y - gs.playerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 300) {
            enemy.health -= 100;
          }
        });
        gs.abilities[2].cooldown = gs.abilities[2].maxCooldown;
        setMana(prev => prev - gs.abilities[2].manaCost);
      }

      if (e.key === '1') setSelectedWeapon('sword');
      if (e.key === '2') setSelectedWeapon('bow');
      if (e.key === '3') setSelectedWeapon('scythe');
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gs.keys[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      gs.mouseX = e.clientX - rect.left;
      gs.mouseY = e.clientY - rect.top;
      gs.playerAngle = Math.atan2(gs.mouseY - gs.playerY, gs.mouseX - gs.playerX);
    };

    const handleClick = () => {
      const now = Date.now();
      const attackSpeed = selectedWeapon === 'bow' ? 300 : selectedWeapon === 'scythe' ? 600 : 400;
      if (now - gs.lastAttack < attackSpeed) return;
      gs.lastAttack = now;

      if (selectedWeapon === 'bow') {
        const projectile: Projectile = {
          x: gs.playerX,
          y: gs.playerY,
          vx: Math.cos(gs.playerAngle) * 12,
          vy: Math.sin(gs.playerAngle) * 12,
          damage: 25,
          type: 'player',
          color: '#00ff00'
        };
        gs.projectiles.push(projectile);
      } else {
        const attackRange = selectedWeapon === 'scythe' ? 120 : 80;
        const damage = selectedWeapon === 'scythe' ? 50 : 35;
        
        gs.enemies.forEach(enemy => {
          const dx = enemy.x - gs.playerX;
          const dy = enemy.y - gs.playerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angleToEnemy = Math.atan2(dy, dx);
          const angleDiff = Math.abs(angleToEnemy - gs.playerAngle);
          
          if (dist < attackRange && angleDiff < Math.PI / 3) {
            enemy.health -= damage;
          }
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    const spawnEnemy = (type: 'grunt' | 'elite' | 'boss' = 'grunt') => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 400 + Math.random() * 200;
      
      const enemy: Enemy = {
        x: gs.playerX + Math.cos(angle) * distance,
        y: gs.playerY + Math.sin(angle) * distance,
        health: type === 'boss' ? 500 : type === 'elite' ? 200 : 100,
        maxHealth: type === 'boss' ? 500 : type === 'elite' ? 200 : 100,
        type,
        color: type === 'boss' ? '#8B0000' : type === 'elite' ? '#FFD700' : '#4a0e4e',
        attackCooldown: 0,
        speed: type === 'boss' ? 1 : type === 'elite' ? 2.5 : 2
      };
      gs.enemies.push(enemy);
    };

    let animationId: number;
    let lastTime = 0;

    const gameLoop = (timestamp: number) => {
      const delta = Math.min((timestamp - lastTime) / 16.67, 2);
      lastTime = timestamp;

      ctx.fillStyle = '#1a0a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gridSize = 60;
      ctx.strokeStyle = '#2a1a2a';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      const arenaRadius = 350;
      ctx.strokeStyle = '#4a0e4e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, arenaRadius, 0, Math.PI * 2);
      ctx.stroke();

      const moveSpeed = 4 * delta;
      if (gs.keys['w']) gs.playerY -= moveSpeed;
      if (gs.keys['s']) gs.playerY += moveSpeed;
      if (gs.keys['a']) gs.playerX -= moveSpeed;
      if (gs.keys['d']) gs.playerX += moveSpeed;

      gs.playerX = Math.max(30, Math.min(canvas.width - 30, gs.playerX));
      gs.playerY = Math.max(30, Math.min(canvas.height - 30, gs.playerY));

      gs.abilities.forEach(ability => {
        if (ability.cooldown > 0) ability.cooldown -= delta;
      });

      if (gs.isShielded) {
        gs.shieldTimer -= delta;
        if (gs.shieldTimer <= 0) {
          gs.isShielded = false;
        }
      }

      gs.manaRegen += delta;
      if (gs.manaRegen > 30) {
        setMana(prev => Math.min(maxMana, prev + 1));
        gs.manaRegen = 0;
      }

      for (let i = gs.projectiles.length - 1; i >= 0; i--) {
        const proj = gs.projectiles[i];
        proj.x += proj.vx * delta;
        proj.y += proj.vy * delta;

        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = proj.type === 'player' ? '#00aa00' : '#aa0000';
        ctx.beginPath();
        ctx.arc(proj.x - proj.vx * 0.3, proj.y - proj.vy * 0.3, 4, 0, Math.PI * 2);
        ctx.fill();

        if (proj.x < 0 || proj.x > canvas.width || proj.y < 0 || proj.y > canvas.height) {
          gs.projectiles.splice(i, 1);
          continue;
        }

        if (proj.type === 'player') {
          for (let j = gs.enemies.length - 1; j >= 0; j--) {
            const enemy = gs.enemies[j];
            const dx = proj.x - enemy.x;
            const dy = proj.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 30) {
              enemy.health -= proj.damage;
              gs.projectiles.splice(i, 1);
              break;
            }
          }
        } else {
          const dx = proj.x - gs.playerX;
          const dy = proj.y - gs.playerY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 25) {
            if (!gs.isShielded) {
              setHealth(prev => {
                const newHealth = Math.max(0, prev - proj.damage);
                if (newHealth <= 0) setGameOver(true);
                return newHealth;
              });
            }
            gs.projectiles.splice(i, 1);
          }
        }
      }

      for (let i = gs.enemies.length - 1; i >= 0; i--) {
        const enemy = gs.enemies[i];
        
        const dx = gs.playerX - enemy.x;
        const dy = gs.playerY - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 60) {
          enemy.x += (dx / dist) * enemy.speed * delta;
          enemy.y += (dy / dist) * enemy.speed * delta;
        }

        enemy.attackCooldown -= delta;
        if (enemy.attackCooldown <= 0 && dist < 250) {
          const proj: Projectile = {
            x: enemy.x,
            y: enemy.y,
            vx: (dx / dist) * 6,
            vy: (dy / dist) * 6,
            damage: enemy.type === 'boss' ? 25 : enemy.type === 'elite' ? 15 : 10,
            type: 'enemy',
            color: enemy.color
          };
          gs.projectiles.push(proj);
          enemy.attackCooldown = enemy.type === 'boss' ? 60 : enemy.type === 'elite' ? 90 : 120;
        }

        const size = enemy.type === 'boss' ? 40 : enemy.type === 'elite' ? 30 : 22;
        
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, size, 0, Math.PI * 2);
        ctx.fill();

        if (enemy.type === 'elite' || enemy.type === 'boss') {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y, size + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        const healthPercent = enemy.health / enemy.maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(enemy.x - 25, enemy.y - size - 15, 50, 6);
        ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillRect(enemy.x - 25, enemy.y - size - 15, 50 * healthPercent, 6);

        if (enemy.health <= 0) {
          gs.enemies.splice(i, 1);
          const expGain = enemy.type === 'boss' ? 50 : enemy.type === 'elite' ? 25 : 10;
          setKills(prev => prev + 1);
          setExp(prev => {
            const newExp = prev + expGain;
            if (newExp >= expToLevel) {
              setLevel(l => l + 1);
              setExpToLevel(e => Math.floor(e * 1.5));
              setHealth(maxHealth);
              setMana(maxMana);
              return 0;
            }
            return newExp;
          });
        }
      }

      ctx.save();
      ctx.translate(gs.playerX, gs.playerY);
      ctx.rotate(gs.playerAngle);

      if (gs.isShielded) {
        ctx.strokeStyle = '#4169E1';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(65, 105, 225, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();

      if (selectedWeapon === 'sword') {
        ctx.fillStyle = '#888';
        ctx.fillRect(15, -4, 35, 8);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(12, -8, 6, 16);
      } else if (selectedWeapon === 'bow') {
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(20, 0, 25, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, -22);
        ctx.lineTo(20, 22);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#4a0e4e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(50, 0);
        ctx.stroke();
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.arc(50, 0, 15, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(35, 0);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      gs.waveTimer += delta;
      if (gs.waveTimer > 900) {
        setWave(prev => prev + 1);
        gs.waveTimer = 0;
        for (let i = 0; i < wave + 3; i++) {
          spawnEnemy('grunt');
        }
        if (wave % 3 === 0) {
          spawnEnemy('elite');
        }
        if (wave % 5 === 0) {
          spawnEnemy('boss');
        }
      }

      if (gs.enemies.length < 3) {
        spawnEnemy();
      }

      if (!gameOver) {
        animationId = requestAnimationFrame(gameLoop);
      }
    };

    for (let i = 0; i < 5; i++) {
      spawnEnemy();
    }

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [gameStarted, gameOver, selectedWeapon, mana, maxMana, maxHealth, expToLevel, wave]);

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-2xl mx-auto p-8">
          <Link href="/super-engine">
            <Button variant="outline" className="absolute top-4 left-4 border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-black" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-red-500 mb-4">
            AVERNUS
          </h1>
          <p className="text-xl text-gray-300 mb-2">Battle in the Arena</p>
          <p className="text-gray-400 mb-8">
            A 1v1 multiplayer-inspired PVP combat arena with weapons, abilities, and wave-based enemies.
            Level up, unlock abilities, and become the ultimate champion!
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8 text-left bg-gray-800/50 p-6 rounded-lg">
            <div>
              <h3 className="text-purple-400 font-bold mb-2">Controls</h3>
              <p className="text-gray-300 text-sm">WASD - Move</p>
              <p className="text-gray-300 text-sm">Mouse - Aim</p>
              <p className="text-gray-300 text-sm">Click - Attack</p>
              <p className="text-gray-300 text-sm">Q - Charge (dash + damage)</p>
              <p className="text-gray-300 text-sm">E - Shield (block damage)</p>
              <p className="text-gray-300 text-sm">R - Ultimate (AOE attack)</p>
            </div>
            <div>
              <h3 className="text-purple-400 font-bold mb-2">Weapons (1-3)</h3>
              <p className="text-gray-300 text-sm">1 - Sword (melee)</p>
              <p className="text-gray-300 text-sm">2 - Bow (ranged)</p>
              <p className="text-gray-300 text-sm">3 - Scythe (heavy melee)</p>
            </div>
          </div>

          <Button 
            onClick={() => setGameStarted(true)}
            className="bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-700 hover:to-red-700 text-white px-12 py-6 text-xl"
            data-testid="button-start-game"
          >
            <Play className="w-6 h-6 mr-2" />
            Enter Arena
          </Button>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center bg-gray-800/80 p-12 rounded-xl">
          <h1 className="text-5xl font-bold text-purple-500 mb-4">DEFEATED</h1>
          <div className="text-2xl text-white mb-2">Level {level}</div>
          <div className="text-xl text-gray-300 mb-2">Kills: {kills}</div>
          <div className="text-xl text-gray-300 mb-8">Wave: {wave}</div>
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={() => {
                setGameOver(false);
                setGameStarted(false);
                setHealth(100);
                setMana(100);
                setLevel(1);
                setExp(0);
                setExpToLevel(100);
                setKills(0);
                setWave(1);
                gameStateRef.current.enemies = [];
                gameStateRef.current.projectiles = [];
              }}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-play-again"
            >
              Fight Again
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
      
      <div className="absolute top-4 left-4 space-y-2">
        <div className="flex items-center gap-2 bg-black/60 px-3 py-1 rounded">
          <Heart className="w-5 h-5 text-red-500" />
          <div className="w-32 h-3 bg-gray-700 rounded overflow-hidden">
            <div className="h-full bg-red-500 transition-all" style={{ width: `${(health / maxHealth) * 100}%` }} />
          </div>
          <span className="text-white text-sm">{Math.floor(health)}</span>
        </div>
        <div className="flex items-center gap-2 bg-black/60 px-3 py-1 rounded">
          <Zap className="w-5 h-5 text-blue-500" />
          <div className="w-32 h-3 bg-gray-700 rounded overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${(mana / maxMana) * 100}%` }} />
          </div>
          <span className="text-white text-sm">{Math.floor(mana)}</span>
        </div>
        <div className="flex items-center gap-2 bg-black/60 px-3 py-1 rounded">
          <Star className="w-5 h-5 text-yellow-500" />
          <div className="w-32 h-3 bg-gray-700 rounded overflow-hidden">
            <div className="h-full bg-yellow-500 transition-all" style={{ width: `${(exp / expToLevel) * 100}%` }} />
          </div>
          <span className="text-white text-sm">Lv.{level}</span>
        </div>
      </div>

      <div className="absolute top-4 right-4 text-right space-y-1">
        <Badge className="bg-purple-600 text-white text-lg px-4" data-testid="text-wave">Wave {wave}</Badge>
        <div className="text-gray-300" data-testid="text-kills">Kills: {kills}</div>
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
        <div className={`px-4 py-2 rounded ${selectedWeapon === 'sword' ? 'bg-purple-600' : 'bg-gray-700'} text-white`}>
          <Sword className="w-6 h-6 inline mr-1" /> 1
        </div>
        <div className={`px-4 py-2 rounded ${selectedWeapon === 'bow' ? 'bg-purple-600' : 'bg-gray-700'} text-white`}>
          🏹 2
        </div>
        <div className={`px-4 py-2 rounded ${selectedWeapon === 'scythe' ? 'bg-purple-600' : 'bg-gray-700'} text-white`}>
          🔮 3
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex gap-2">
        {gameStateRef.current.abilities.map((ability, i) => (
          <div 
            key={ability.key} 
            className={`w-12 h-12 rounded border-2 flex items-center justify-center text-white font-bold relative ${ability.cooldown <= 0 ? 'border-white bg-gray-700' : 'border-gray-600 bg-gray-800'}`}
            style={{ borderColor: ability.cooldown <= 0 ? ability.color : undefined }}
          >
            {ability.key.toUpperCase()}
            {ability.cooldown > 0 && (
              <div 
                className="absolute inset-0 bg-black/60 rounded" 
                style={{ 
                  clipPath: `inset(${100 - (ability.cooldown / ability.maxCooldown) * 100}% 0 0 0)` 
                }} 
              />
            )}
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 text-gray-400 text-sm">
        WASD to move | Click to attack | Q/E/R abilities
      </div>
    </div>
  );
}