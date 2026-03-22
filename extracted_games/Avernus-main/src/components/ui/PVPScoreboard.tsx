import React from 'react';

interface PVPScoreboardProps {
  playerKills: Map<string, number>;
  players: Map<string, any>; // Player data from multiplayer context
  currentPlayerId?: string;
}

const PVPScoreboard: React.FC<PVPScoreboardProps> = ({
  playerKills,
  players,
  currentPlayerId
}) => {
  // Convert all players to array and sort by kill count (descending)
  const sortedPlayers = Array.from(players.entries())
    .map(([playerId, player]) => {
      const kills = playerKills.get(playerId) || 0;
      return {
        playerId,
        kills,
        name: player?.name || playerId.substring(0, 8), // Use player name or truncated ID
        isCurrentPlayer: playerId === currentPlayerId
      };
    })
    .sort((a, b) => b.kills - a.kills); // Sort by kills descending

  if (sortedPlayers.length === 0) {
    return null; // Don't render if no players
  }

  return (
    <div className="fixed bottom-20 right-4 bg-black/80 text-white rounded-lg p-2 min-w-48 max-w-64 z-50 border border-gray-600">

      {/* Player List */}
      <div className="space-y-1">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.playerId}
            className={`flex justify-between items-center p-1.5 rounded text-xs ${
              player.isCurrentPlayer
                ? 'bg-blue-600/30 border border-blue-500/50'
                : 'bg-gray-700/30'
            }`}
          >
            {/* Rank and Name */}
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <span className={`text-xs font-bold w-5 ${
                index === 0 ? 'text-yellow-400' :
                index === 1 ? 'text-gray-400' :
                'text-gray-500'
              }`}>
                #{index + 1}
              </span>
              <span className={`truncate ${
                player.isCurrentPlayer ? 'text-blue-300 font-semibold' : 'text-white'
              }`}>
                {player.name}
                {player.isCurrentPlayer && ' (You)'}
              </span>
            </div>

            {/* Kill Count */}
            <div className="flex items-center space-x-1">
              <span className="text-red-400 font-bold">{player.kills}</span>
              <span className="text-xs text-gray-400">kills</span>
            </div>
          </div>
        ))}
      </div>


    </div>
  );
};

export default PVPScoreboard;
