// Experience System Utilities for PVP mode

export class ExperienceSystem {
  // Level requirements (cumulative EXP needed)
  private static readonly LEVEL_REQUIREMENTS = {
    1: 0,     // Starting level
    2: 50,    // Need 50 total EXP for level 2
    3: 150,   // Need 150 total EXP for level 3
    4: 350,   // Need 300 total EXP for level 4
    5: 750    // Need 500 total EXP for level 5 (max)
  };

  // EXP per level increment
  private static readonly EXP_PER_LEVEL_INCREMENT = {
    1: 50,   // 0 -> 50 for level 2
    2: 100,  // 50 -> 150 for level 3
    3: 200,  // 150 -> 300 for level 4
    4: 400   // 300 -> 500 for level 5
  };

  // Health scaling per level
  private static readonly BASE_HEALTH = 1000;
  private static readonly HEALTH_PER_LEVEL = 150;

  /**
   * Calculate the level based on total experience
   */
  static getLevelFromExperience(experience: number): number {
    if (experience >= this.LEVEL_REQUIREMENTS[5]) return 5;
    if (experience >= this.LEVEL_REQUIREMENTS[4]) return 4;
    if (experience >= this.LEVEL_REQUIREMENTS[3]) return 3;
    if (experience >= this.LEVEL_REQUIREMENTS[2]) return 2;
    return 1;
  }

  /**
   * Get the experience required to reach a specific level
   */
  static getExperienceForLevel(level: number): number {
    return this.LEVEL_REQUIREMENTS[level as keyof typeof this.LEVEL_REQUIREMENTS] || 0;
  }

  /**
   * Get the experience required for the next level
   */
  static getExperienceForNextLevel(currentLevel: number): number {
    if (currentLevel >= 5) return 0;
    return this.LEVEL_REQUIREMENTS[(currentLevel + 1) as keyof typeof this.LEVEL_REQUIREMENTS] || 0;
  }

  /**
   * Get the experience required to level up from current level
   */
  static getExperienceIncrementForLevel(currentLevel: number): number {
    if (currentLevel >= 5) return 0;
    return this.EXP_PER_LEVEL_INCREMENT[currentLevel as keyof typeof this.EXP_PER_LEVEL_INCREMENT] || 0;
  }

  /**
   * Calculate current level progress (0-100)
   */
  static getLevelProgress(currentLevel: number, currentExp: number): number {
    if (currentLevel >= 5) return 100;

    const expForCurrentLevel = this.getExperienceForLevel(currentLevel);
    const expForNextLevel = this.getExperienceForNextLevel(currentLevel);
    const currentLevelExp = currentExp - expForCurrentLevel;
    const requiredExp = expForNextLevel - expForCurrentLevel;

    return Math.min((currentLevelExp / requiredExp) * 100, 100);
  }

  /**
   * Get current level's experience range
   */
  static getCurrentLevelExpRange(currentLevel: number): { min: number; max: number; current: number } {
    const min = this.getExperienceForLevel(currentLevel);
    const max = this.getExperienceForNextLevel(currentLevel);
    return { min, max, current: max - min };
  }

  /**
   * Calculate max health based on level
   */
  static getMaxHealthForLevel(level: number): number {
    const health = this.BASE_HEALTH + ((level - 1) * this.HEALTH_PER_LEVEL);
    // console.log(`📊 ExperienceSystem.getMaxHealthForLevel(${level}) = ${this.BASE_HEALTH} + ((${level} - 1) * ${this.HEALTH_PER_LEVEL}) = ${health}`);
    return health;
  }

  /**
   * Check if player can level up with given experience
   */
  static canLevelUp(currentLevel: number, currentExp: number): boolean {
    if (currentLevel >= 5) return false;
    const requiredExp = this.getExperienceForNextLevel(currentLevel);
    return currentExp >= requiredExp;
  }

  /**
   * Get the new level after gaining experience
   */
  static getNewLevelAfterExperience(currentLevel: number, currentExp: number, expGained: number): number {
    const newExp = currentExp + expGained;
    return this.getLevelFromExperience(newExp);
  }

  /**
   * Award experience and return level up information
   */
  static awardExperience(currentLevel: number, currentExp: number, expGained: number): {
    newLevel: number;
    newExp: number;
    leveledUp: boolean;
    levelsGained: number;
  } {
    const newExp = currentExp + expGained;
    const newLevel = this.getLevelFromExperience(newExp);
    const leveledUp = newLevel > currentLevel;
    const levelsGained = newLevel - currentLevel;

    return {
      newLevel,
      newExp,
      leveledUp,
      levelsGained
    };
  }

  /**
   * Get experience remaining until next level
   */
  static getExperienceToNextLevel(currentLevel: number, currentExp: number): number {
    if (currentLevel >= 5) return 0;
    const requiredExp = this.getExperienceForNextLevel(currentLevel);
    return Math.max(requiredExp - currentExp, 0);
  }
}
