import { NPC_PROFILES, type AIProfile, type NPCRole } from './ai';

/* ═══════════════════════════════════════════════════════════════
   GAME MODES — defines NPC selection, waves, allies, scoring
═══════════════════════════════════════════════════════════════ */

export type GameMode = 'survival' | 'team_deathmatch' | 'boss_rush' | 'escort';

export interface WaveDefinition {
  enemies: { role: NPCRole; count: number }[];
  spawnDelay: number; // seconds between spawns
  bonus?: string;     // description of wave bonus
}

export interface ModeConfig {
  id: GameMode;
  name: string;
  description: string;
  icon: string;
  allies: { role: NPCRole; count: number }[];
  waves: WaveDefinition[];
  infiniteWaves: boolean;    // after defined waves, generate harder ones
  timeLimitSec: number | null;
  winCondition: string;
  scorePerKill: number;
  scorePerWave: number;
}

/* ═══ SURVIVAL — solo, escalating waves ═══ */
const SURVIVAL: ModeConfig = {
  id: 'survival',
  name: 'SURVIVAL',
  description: 'Survive endless waves of increasingly powerful enemies. How long can you last?',
  icon: '☠️',
  allies: [], // no allies in survival
  waves: [
    { enemies: [{ role: 'grunt', count: 4 }], spawnDelay: 1.5, bonus: 'Warm up' },
    { enemies: [{ role: 'grunt', count: 5 }, { role: 'ranged', count: 2 }], spawnDelay: 1.2 },
    { enemies: [{ role: 'grunt', count: 4 }, { role: 'flanker', count: 2 }], spawnDelay: 1.0 },
    { enemies: [{ role: 'tank', count: 2 }, { role: 'grunt', count: 4 }], spawnDelay: 1.0, bonus: 'Tanks incoming!' },
    { enemies: [{ role: 'ranged', count: 3 }, { role: 'flanker', count: 3 }, { role: 'grunt', count: 3 }], spawnDelay: 0.8 },
    { enemies: [{ role: 'tank', count: 2 }, { role: 'ranged', count: 3 }, { role: 'flanker', count: 2 }], spawnDelay: 0.8 },
    { enemies: [{ role: 'boss', count: 1 }, { role: 'grunt', count: 6 }], spawnDelay: 0.6, bonus: '⚠ BOSS WAVE' },
    { enemies: [{ role: 'tank', count: 3 }, { role: 'flanker', count: 4 }, { role: 'ranged', count: 3 }], spawnDelay: 0.5 },
    { enemies: [{ role: 'boss', count: 1 }, { role: 'tank', count: 2 }, { role: 'flanker', count: 3 }], spawnDelay: 0.5, bonus: '⚠⚠ DOUBLE THREAT' },
    { enemies: [{ role: 'boss', count: 2 }, { role: 'ranged', count: 4 }, { role: 'tank', count: 2 }, { role: 'flanker', count: 4 }], spawnDelay: 0.3, bonus: '💀 FINAL STAND' },
  ],
  infiniteWaves: true,
  timeLimitSec: null,
  winCondition: 'Survive as long as possible',
  scorePerKill: 10,
  scorePerWave: 100,
};

/* ═══ TEAM DEATHMATCH — allies vs enemies ═══ */
const TEAM_DEATHMATCH: ModeConfig = {
  id: 'team_deathmatch',
  name: 'TEAM DEATHMATCH',
  description: 'Fight alongside your squad against the enemy team. First to 50 kills wins.',
  icon: '⚔️',
  allies: [
    { role: 'ally_soldier', count: 2 },
    { role: 'ally_sniper', count: 1 },
    { role: 'ally_medic', count: 1 },
  ],
  waves: [
    { enemies: [{ role: 'grunt', count: 3 }, { role: 'ranged', count: 1 }], spawnDelay: 2.0 },
    { enemies: [{ role: 'grunt', count: 3 }, { role: 'ranged', count: 2 }, { role: 'flanker', count: 1 }], spawnDelay: 1.5 },
    { enemies: [{ role: 'tank', count: 1 }, { role: 'grunt', count: 3 }, { role: 'ranged', count: 2 }], spawnDelay: 1.5 },
    { enemies: [{ role: 'tank', count: 1 }, { role: 'flanker', count: 2 }, { role: 'ranged', count: 2 }, { role: 'grunt', count: 3 }], spawnDelay: 1.2 },
  ],
  infiniteWaves: true,
  timeLimitSec: null,
  winCondition: 'Reach 50 kills',
  scorePerKill: 10,
  scorePerWave: 50,
};

/* ═══ BOSS RUSH — fight bosses back to back ═══ */
const BOSS_RUSH: ModeConfig = {
  id: 'boss_rush',
  name: 'BOSS RUSH',
  description: 'Fight increasingly powerful bosses. Each boss has unique minions.',
  icon: '👑',
  allies: [
    { role: 'ally_soldier', count: 1 },
    { role: 'ally_medic', count: 1 },
  ],
  waves: [
    { enemies: [{ role: 'boss', count: 1 }], spawnDelay: 0, bonus: 'BOSS 1 — Hazmat Commander' },
    { enemies: [{ role: 'boss', count: 1 }, { role: 'grunt', count: 4 }], spawnDelay: 1.0, bonus: 'BOSS 2 — With Escort' },
    { enemies: [{ role: 'boss', count: 1 }, { role: 'tank', count: 2 }], spawnDelay: 0.5, bonus: 'BOSS 3 — Armored Division' },
    { enemies: [{ role: 'boss', count: 1 }, { role: 'flanker', count: 4 }, { role: 'ranged', count: 2 }], spawnDelay: 0.5, bonus: 'BOSS 4 — Ambush Squad' },
    { enemies: [{ role: 'boss', count: 2 }, { role: 'tank', count: 2 }, { role: 'ranged', count: 4 }], spawnDelay: 0.3, bonus: '💀 FINAL BOSS — Twin Terrors' },
  ],
  infiniteWaves: false,
  timeLimitSec: null,
  winCondition: 'Defeat all 5 bosses',
  scorePerKill: 25,
  scorePerWave: 200,
};

/* ═══ ESCORT — protect an ally through the arena ═══ */
const ESCORT: ModeConfig = {
  id: 'escort',
  name: 'ESCORT',
  description: 'Protect the VIP as they cross the arena. If the VIP dies, you lose.',
  icon: '🛡️',
  allies: [
    { role: 'ally_medic', count: 1 }, // the VIP (first ally = VIP)
    { role: 'ally_soldier', count: 1 },
  ],
  waves: [
    { enemies: [{ role: 'grunt', count: 3 }], spawnDelay: 2.0 },
    { enemies: [{ role: 'grunt', count: 3 }, { role: 'flanker', count: 2 }], spawnDelay: 1.5 },
    { enemies: [{ role: 'ranged', count: 3 }, { role: 'grunt', count: 2 }], spawnDelay: 1.2 },
    { enemies: [{ role: 'tank', count: 1 }, { role: 'flanker', count: 3 }, { role: 'ranged', count: 2 }], spawnDelay: 1.0 },
    { enemies: [{ role: 'boss', count: 1 }, { role: 'grunt', count: 4 }], spawnDelay: 0.8, bonus: '⚠ Boss blocks the path!' },
  ],
  infiniteWaves: false,
  timeLimitSec: 180, // 3 minutes to get VIP across
  winCondition: 'Escort VIP to extraction point',
  scorePerKill: 10,
  scorePerWave: 150,
};

/* ═══ MODE REGISTRY ═══ */
export const GAME_MODES: Record<GameMode, ModeConfig> = {
  survival: SURVIVAL,
  team_deathmatch: TEAM_DEATHMATCH,
  boss_rush: BOSS_RUSH,
  escort: ESCORT,
};

export const MODE_LIST = Object.values(GAME_MODES);

/* ═══ WAVE GENERATOR — for infinite modes ═══ */
export function generateInfiniteWave(waveNumber: number): WaveDefinition {
  const difficulty = Math.min(waveNumber / 5, 3); // scales up to 3x
  const baseCount = 3 + Math.floor(waveNumber * 0.8);

  // Every 5th wave is a boss wave
  if (waveNumber % 5 === 0) {
    return {
      enemies: [
        { role: 'boss', count: Math.ceil(waveNumber / 10) },
        { role: 'tank', count: Math.floor(difficulty) },
        { role: 'grunt', count: baseCount },
      ],
      spawnDelay: Math.max(0.2, 1.5 - difficulty * 0.3),
      bonus: `⚠ BOSS WAVE ${waveNumber}`,
    };
  }

  // Mix of enemy types scaled by difficulty
  const roles: { role: NPCRole; count: number }[] = [
    { role: 'grunt', count: Math.ceil(baseCount * 0.4) },
  ];

  if (difficulty > 0.5) roles.push({ role: 'ranged', count: Math.ceil(baseCount * 0.2) });
  if (difficulty > 1.0) roles.push({ role: 'flanker', count: Math.ceil(baseCount * 0.2) });
  if (difficulty > 1.5) roles.push({ role: 'tank', count: Math.ceil(baseCount * 0.15) });

  return {
    enemies: roles,
    spawnDelay: Math.max(0.3, 1.5 - difficulty * 0.3),
  };
}

/* ═══ GET ALLY PROFILES FOR MODE ═══ */
export function getAllyProfiles(mode: GameMode): AIProfile[] {
  const config = GAME_MODES[mode];
  const profiles: AIProfile[] = [];
  for (const entry of config.allies) {
    for (let i = 0; i < entry.count; i++) {
      profiles.push({ ...NPC_PROFILES[entry.role] });
    }
  }
  return profiles;
}

/* ═══ GET ENEMY PROFILES FOR WAVE ═══ */
export function getWaveEnemyProfiles(wave: WaveDefinition): AIProfile[] {
  const profiles: AIProfile[] = [];
  for (const entry of wave.enemies) {
    for (let i = 0; i < entry.count; i++) {
      profiles.push({ ...NPC_PROFILES[entry.role] });
    }
  }
  return profiles;
}
