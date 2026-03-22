class EnemyAI {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    this.room = null; // Will be set by GameRoom
    this.aiTimer = null;
    this.updateInterval = 100; // Update AI every 100ms
    
    // Enemy aggro tracking
    this.enemyAggro = new Map(); // enemyId -> { targetPlayerId, lastUpdate, aggro }
    
  }

  setRoom(room) {
    this.room = room;
  }

  startAI() {
    if (this.aiTimer) return; // Already running
    
    this.aiTimer = setInterval(() => {
      this.updateAI();
    }, this.updateInterval);
    
  }

  stopAI() {
    if (this.aiTimer) {
      clearInterval(this.aiTimer);
      this.aiTimer = null;
    }
    
    this.enemyAggro.clear();
  }

  updateAI() {
    if (!this.room || !this.room.getGameStarted()) return;
    
    const enemies = this.room.getEnemies();
    const players = this.room.getPlayers();
    
    if (enemies.length === 0 || players.length === 0) return;
    
    // Update each enemy's AI
    enemies.forEach(enemy => {
      if (enemy.isDying) return;
      
      this.updateEnemyAI(enemy, players);
    });
  }

  updateEnemyAI(enemy, players) {
    // Get or create aggro data for this enemy
    let aggroData = this.enemyAggro.get(enemy.id);
    if (!aggroData) {
      // Find closest player as initial target
      const closestPlayer = this.findClosestPlayer(enemy, players);
      if (!closestPlayer) return;
      
      aggroData = {
        targetPlayerId: closestPlayer.id,
        lastUpdate: Date.now(),
        aggro: 100
      };
      this.enemyAggro.set(enemy.id, aggroData);
    }
    
    // Find current target player
    const targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    if (!targetPlayer) {
      // Target player left, find new target
      const newTarget = this.findClosestPlayer(enemy, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
      } else {
        return;
      }
    }
    
    // Move enemy towards target
    this.moveEnemyTowardsTarget(enemy, targetPlayer || players.find(p => p.id === aggroData.targetPlayerId));
  }

  findClosestPlayer(enemy, players) {
    let closestPlayer = null;
    let closestDistance = Infinity;
    
    players.forEach(player => {
      const distance = this.calculateDistance(enemy.position, player.position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    });
    
    return closestPlayer;
  }

  moveEnemyTowardsTarget(enemy, targetPlayer) {
    if (!targetPlayer) return;
    
    const distance = this.calculateDistance(enemy.position, targetPlayer.position);
    const moveSpeed = this.getEnemyMoveSpeed(enemy.type);
    
    // Don't move if too close (avoid jittering)
    if (distance < 2.0) return;
    
    // Calculate direction vector
    const direction = {
      x: targetPlayer.position.x - enemy.position.x,
      y: 0, // Keep enemies on ground
      z: targetPlayer.position.z - enemy.position.z
    };
    
    // Normalize direction
    const magnitude = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (magnitude === 0) return;
    
    direction.x /= magnitude;
    direction.z /= magnitude;
    
    // Apply movement
    const deltaTime = this.updateInterval / 1000; // Convert to seconds
    const moveDistance = moveSpeed * deltaTime;
    
    enemy.position.x += direction.x * moveDistance;
    enemy.position.z += direction.z * moveDistance;
    
    // Calculate rotation to face target
    enemy.rotation = Math.atan2(direction.x, direction.z);
    
    // Broadcast position update to all players
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: enemy.id,
        position: enemy.position,
        rotation: enemy.rotation,
        timestamp: Date.now()
      });
    }
  }

  getEnemyMoveSpeed(enemyType) {
    // Different enemy types have different movement speeds
    switch (enemyType) {
      case 'elite': return 0.0; // Elite enemies are stationary like training dummies
      case 'skeleton': return 2.0;
      case 'mage': return 1.5;
      case 'reaper': return 2.5;
      case 'abomination': return 1.0;
      case 'death-knight': return 1.8;
      case 'ascendant': return 2.2;
      case 'fallen-titan': return 0.8;
      default: return 2.0;
    }
  }

  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Remove enemy from aggro tracking when it dies
  removeEnemyAggro(enemyId) {
    this.enemyAggro.delete(enemyId);
  }

  // Update aggro when player damages enemy
  updateAggro(enemyId, playerId, aggroAmount = 50) {
    const aggroData = this.enemyAggro.get(enemyId);
    if (aggroData) {
      // Switch target to the player who damaged the enemy
      aggroData.targetPlayerId = playerId;
      aggroData.aggro += aggroAmount;
      aggroData.lastUpdate = Date.now();
    }
  }
}

module.exports = EnemyAI;
