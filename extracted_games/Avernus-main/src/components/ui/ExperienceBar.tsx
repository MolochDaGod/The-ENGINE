'use client';

import React from 'react';

interface ExperienceBarProps {
  experience: number;
  level: number;
  playerId?: string;
  isLocalPlayer?: boolean;
}

export default function ExperienceBar({ experience, level, playerId, isLocalPlayer = false }: ExperienceBarProps) {
  // Calculate EXP needed for next level
  const getExpForNextLevel = (currentLevel: number): number => {
    switch (currentLevel) {
      case 1: return 50;  // 50 EXP to reach level 2
      case 2: return 100; // 100 EXP to reach level 3
      case 3: return 200; // 200 EXP to reach level 4
      case 4: return 400; // 400 EXP to reach level 5
      case 5: return 0;   // Max level
      default: return 0;
    }
  };

  // Calculate current level progress
  const getLevelProgress = (currentLevel: number, currentExp: number): number => {
    if (currentLevel >= 5) return 100; // Max level

    const expForPrevLevels = currentLevel === 1 ? 0 :
      currentLevel === 2 ? 50 :
      currentLevel === 3 ? 150 :
      currentLevel === 4 ? 350 : 0;

    const expForCurrentLevel = getExpForNextLevel(currentLevel);
    const currentLevelExp = currentExp - expForPrevLevels;

    return Math.min((currentLevelExp / expForCurrentLevel) * 100, 100);
  };

  // Calculate total EXP needed to reach current level
  const getTotalExpForLevel = (targetLevel: number): number => {
    switch (targetLevel) {
      case 1: return 0;
      case 2: return 50;
      case 3: return 150;
      case 4: return 350;
      case 5: return 750;
      default: return 0;
    }
  };

  // Get current level's EXP range for display
  const getCurrentLevelExpRange = (currentLevel: number) => {
    const minExp = getTotalExpForLevel(currentLevel);
    const maxExp = getTotalExpForLevel(currentLevel + 1);
    return { min: minExp, max: maxExp };
  };

  const progress = getLevelProgress(level, experience);
  const { min, max } = getCurrentLevelExpRange(level);
  const currentLevelExp = experience - min;
  const maxLevelExp = max - min;
  const isMaxLevel = level >= 5;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-black bg-opacity-70 backdrop-blur-sm rounded-lg p-2 border border-gray-600">
        <div className="flex items-center space-x-3">
          {/* Level indicator */}
          <div className="flex items-center space-x-2">
            <div className={`text-sm font-bold ${isLocalPlayer ? 'text-yellow-400' : 'text-blue-400'}`}>
              LV {level}
            </div>
            <div className="text-xs text-gray-400">
              {isMaxLevel ? 'MAX' : `${currentLevelExp}/${maxLevelExp} EXP`}
            </div>
          </div>

          {/* Experience bar */}
          <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isLocalPlayer ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' : 'bg-gradient-to-r from-blue-500 to-blue-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Total EXP display */}
          <div className="text-xs text-gray-400">
            Total: {experience} EXP
          </div>
        </div>
      </div>
    </div>
  );
}
