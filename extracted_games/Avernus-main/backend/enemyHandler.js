function handleEnemyEvents(socket, gameRooms) {
  // Handle enemy damage from players
  socket.on('enemy-damage', (data) => {
    const { roomId, enemyId, damage, sourcePlayerId } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    // Use sourcePlayerId if provided, otherwise fall back to socket.id for direct player damage
    const actualSourcePlayerId = sourcePlayerId || socket.id;
    const result = room.damageEnemy(enemyId, damage, actualSourcePlayerId);
    
    if (result) {
      // Broadcast damage result to all players in the room
      room.io.to(roomId).emit('enemy-damaged', {
        enemyId: result.enemyId,
        newHealth: result.newHealth,
        maxHealth: result.maxHealth,
        damage: result.damage,
        fromPlayerId: result.fromPlayerId,
        wasKilled: result.wasKilled,
        timestamp: Date.now()
      });
      
    }
  });

  // Handle enemy position updates from AI
  socket.on('enemy-position-update', (data) => {
    const { roomId, enemyId, position, rotation } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const enemy = room.getEnemy(enemyId);
    
    if (enemy) {
      enemy.position = position;
      enemy.rotation = rotation;
      
      // Broadcast position update to all players
      room.io.to(roomId).emit('enemy-moved', {
        enemyId,
        position,
        rotation,
        timestamp: Date.now()
      });
    }
  });

  // Handle status effect applications
  socket.on('apply-status-effect', (data) => {
    const { roomId, enemyId, effectType, duration } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const success = room.applyStatusEffect(enemyId, effectType, duration);
    
    if (success) {
      // console.log(`🎯 Applied ${effectType} to enemy ${enemyId} for ${duration}ms by player ${socket.id}`);
    }
  });

  // Handle requests for enemy status effects
  socket.on('get-enemy-status', (data) => {
    const { roomId, enemyId } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const effects = room.getEnemyStatusEffects(enemyId);
    
    socket.emit('enemy-status-response', {
      enemyId,
      effects,
      timestamp: Date.now()
    });
  });
}

// Utility function to broadcast enemy spawn to all players in a room
function broadcastEnemySpawn(io, roomId, enemyData) {
  io.to(roomId).emit('enemy-spawned', {
    enemy: enemyData,
    timestamp: Date.now()
  });
}

// Utility function to broadcast enemy death to all players in a room
function broadcastEnemyDeath(io, roomId, enemyId, killedBy) {
  io.to(roomId).emit('enemy-died', {
    enemyId,
    killedBy,
    timestamp: Date.now()
  });
}

module.exports = { 
  handleEnemyEvents, 
  broadcastEnemySpawn, 
  broadcastEnemyDeath 
};
