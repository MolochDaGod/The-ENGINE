import React, { useState, useEffect } from 'react';
import { useMultiplayer } from '@/contexts/MultiplayerContext';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';

// Extend Window interface to include audioSystem
declare global {
  interface Window {
    audioSystem?: any;
  }
}

interface RoomJoinProps {
  onJoinSuccess: () => void;
  onBack: () => void;
  currentWeapon: WeaponType;
  currentSubclass?: WeaponSubclass;
  gameMode?: 'multiplayer' | 'pvp';
}

export default function RoomJoin({ onJoinSuccess, onBack, currentWeapon, currentSubclass, gameMode = 'multiplayer' }: RoomJoinProps) {
  const { 
    joinRoom, 
    isConnected, 
    isInRoom, 
    connectionError, 
    players, 
    previewRoom, 
    clearPreview, 
    currentPreview,
    startGame,
    gameStarted
  } = useMultiplayer();
  const [roomId, setRoomId] = useState('default');
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Clear preview loading when preview is received
  useEffect(() => {
    if (currentPreview) {
      setPreviewLoading(false);
    }
  }, [currentPreview]);

  const handlePreview = () => {
    if (!roomId.trim()) {
      alert('Please enter a room ID');
      return;
    }
    
    if (!isConnected) {
      alert('Not connected to server. Please wait for connection.');
      return;
    }
    
    setPreviewLoading(true);
    previewRoom(roomId.trim());
    setShowPreview(true);
    
    // Set a timeout to handle non-responsive server
    setTimeout(() => {
      if (previewLoading) {
        setPreviewLoading(false);
        alert('Room preview timed out. Please try again.');
        setShowPreview(false);
      }
    }, 5000);
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      alert('Please enter a player name');
      return;
    }

    // Play interface sound
    if (window.audioSystem) {
      window.audioSystem.playUIInterfaceSound();
    }

    setIsJoining(true);
    try {
      await joinRoom(roomId, playerName.trim(), currentWeapon, currentSubclass, gameMode);
      // Clear preview state
      clearPreview();
      setShowPreview(false);
      // Wait a moment for the room join to complete, then stop joining
      setTimeout(() => {
        setIsJoining(false);
        // Don't automatically start the game - let user click "Start Game" button
      }, 1000);
    } catch (error) {
      console.error('Failed to join room:', error);
      setIsJoining(false);
    }
  };

  const handleBackToForm = () => {
    // Play interface sound
    if (window.audioSystem) {
      window.audioSystem.playUIInterfaceSound();
    }

    setShowPreview(false);
    clearPreview();
  };

  const handleBack = () => {
    // Play interface sound
    if (window.audioSystem) {
      window.audioSystem.playUIInterfaceSound();
    }

    onBack();
  };

  const handleStartGame = () => {
    // Play interface sound
    if (window.audioSystem) {
      window.audioSystem.playUIInterfaceSound();
    }

    startGame();
    onJoinSuccess(); // Still call this to update UI state
  };

  // If already in room, show room info
  if (isInRoom) {
    return (
      <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/95 p-8 rounded-xl border-2 ${gameMode === 'pvp' ? 'border-red-500' : 'border-green-500'} text-white max-w-md w-11/12 z-50 text-center`}>
        <h2 className="text-2xl font-bold mb-4">{gameMode === 'pvp' ? 'PVP' : 'Multiplayer'} Room: {roomId}</h2>
        <p className="mb-4">Players connected: {players.size}</p>
        <div className="flex flex-col gap-3 mb-6">
          {Array.from(players.values()).map(player => (
            <div key={player.id} className="flex justify-between items-center p-3 bg-white/10 rounded-lg border border-gray-600">
              <span className="font-bold text-green-500">{player.name}</span>
              <span className="text-orange-500 capitalize">({player.weapon})</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <button 
            className={`w-full px-8 py-4 text-xl ${gameMode === 'pvp' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:-translate-y-1`}
            onClick={handleStartGame}
            disabled={false}
          >
            {gameStarted ? 'Join Game' : `Start ${gameMode === 'pvp' ? 'PVP' : 'Game'}`}
          </button>
          <button 
            className="w-full px-8 py-3 text-lg bg-gray-600 text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:bg-gray-500 hover:-translate-y-1"
            onClick={handleBack}
          >
            Return
          </button>
        </div>
      </div>
    );
  }

  // Show room preview if requested
  if (showPreview && currentPreview) {
    return (
      <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/95 p-8 rounded-xl border-2 ${gameMode === 'pvp' ? 'border-red-500' : 'border-green-500'} text-white max-w-2xl w-11/12 z-50`}>
        <h2 className="text-2xl font-bold mb-6">{gameMode === 'pvp' ? 'PVP' : 'Multiplayer'} Room Preview: {currentPreview.roomId}</h2>
        
        {currentPreview.exists ? (
          <div className="flex flex-col gap-6">
            <div className="flex justify-around bg-white/5 p-4 rounded-lg mb-4">
              <p className="m-0 font-bold text-green-500">Players: {currentPreview.playerCount}/{currentPreview.maxPlayers}</p>
              {gameMode !== 'pvp' && <p className="m-0 font-bold text-green-500">Enemies: {currentPreview.enemies.length}</p>}
              {gameMode === 'pvp' && <p className="m-0 font-bold text-red-500">Mode: Player vs Player</p>}
            </div>
            
            {currentPreview.playerCount > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="text-lg font-bold">Players in Room:</h3>
                {currentPreview.players.map(player => (
                  <div key={player.id} className="flex justify-between items-center p-3 bg-white/10 rounded-lg border border-gray-600">
                    <span className="font-bold text-green-500">{player.name}</span>
                    <span className="text-orange-500 capitalize">({player.weapon})</span>
                    <span className="text-red-400 font-mono">{player.health}/{player.maxHealth} HP</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 bg-white/5 rounded-lg text-gray-300">
                <p>This room is empty. You&apos;ll be the first player!</p>
              </div>
            )}
            
            <div className="flex gap-4 mt-6">
              <button 
                className="flex-1 px-8 py-4 text-lg bg-green-500 text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:bg-green-600 hover:-translate-y-1 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none"
                onClick={handleJoin}
                disabled={isJoining || !playerName.trim() || currentPreview.playerCount >= currentPreview.maxPlayers}
              >
                {isJoining ? 'Joining...' : 
                 currentPreview.playerCount >= currentPreview.maxPlayers ? 'Room Full' : 'Join This Room'}
              </button>
              <button 
                className="flex-1 px-8 py-4 text-lg bg-gray-600 text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:bg-gray-500 hover:-translate-y-1 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:transform-none"
                onClick={handleBackToForm}
                disabled={isJoining}
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center p-8 bg-white/5 rounded-lg text-gray-300">
            <p>This room doesn&apos;t exist yet. You&apos;ll create it when you join!</p>
            <div className="flex gap-4 mt-6">
              <button 
                className="flex-1 px-8 py-4 text-lg bg-green-500 text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:bg-green-600 hover:-translate-y-1 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none"
                onClick={handleJoin}
                disabled={isJoining || !playerName.trim()}
              >
                {isJoining ? 'Creating Room...' : 'Create & Join Room'}
              </button>
              <button 
                className="flex-1 px-8 py-4 text-lg bg-gray-600 text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:bg-gray-500 hover:-translate-y-1 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:transform-none"
                onClick={handleBackToForm}
                disabled={isJoining}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/95 p-8 rounded-xl border-2 ${gameMode === 'pvp' ? 'border-red-500' : 'border-green-500'} text-white max-w-lg w-11/12 z-50`}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="playerName" className="font-bold text-green-500">Your Name:</label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            disabled={isJoining}
            className="p-2 border-2 border-gray-600 rounded-lg bg-white/10 text-white text-base focus:outline-none focus:border-green-500 focus:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="roomId" className="font-bold text-green-500">Room ID:</label>
          <input
            id="roomId"
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room ID (e.g., 'default', 'room1')"
            maxLength={50}
            disabled={isJoining}
            className="p-2 border-2 border-gray-600 rounded-lg bg-white/10 text-white text-base focus:outline-none focus:border-green-500 focus:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {connectionError && (
          <div className="bg-red-500/20 border border-red-400 text-red-400 p-4 rounded-lg text-center">
            Error: {connectionError}
          </div>
        )}


        <div className="flex flex-col gap-3">
          <button 
            className="w-full px-8 py-2.5 text-lg bg-green-500 text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:bg-green-600 hover:-translate-y-1 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none"
            onClick={handleJoin}
            disabled={isJoining || !isConnected || !playerName.trim()}
          >
            {isJoining ? 'Entering...' : 'Enter Room'}
          </button>
          <button
            className="w-full px-8 py-2.5 text-lg bg-gray-600 text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:bg-gray-500 hover:-translate-y-1 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:transform-none"
            onClick={handleBack}
            disabled={isJoining}
          >
            Back
          </button>
        </div>

      </div>
    </div>
  );
}
