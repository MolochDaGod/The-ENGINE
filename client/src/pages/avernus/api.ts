/**
 * Avernus Arena REST client
 *
 * Uses same-origin `/api/*` on grudge-studio.com (Vercel → Railway),
 * and shared scores/leaderboards endpoints.
 */

import { apiUrl } from '@/lib/api-config';
import type { GameMode } from './modes';
import type { WeaponType } from './weapons';
import type { CharacterRace } from '@/engine';

export const AVERNUS_GAME_ID = 'avernus-arena';

export interface AvernusConfig {
  gameId: string;
  name: string;
  version: string;
  modes: { id: GameMode; name: string; description: string; icon: string }[];
  races: { id: CharacterRace; name: string; prefix: string }[];
  weapons: { type: WeaponType; name: string; packId: string }[];
  controls: { keys: string; label: string }[];
  camera: { mode: 'FOLLOW'; distance: number; height: number };
  characterStack: string[];
  rest: Record<string, string>;
}

export interface AvernusSession {
  id: string;
  gameId: string;
  mode: GameMode;
  race: CharacterRace;
  weapon: WeaponType;
  heroId?: string;
  createdAt: number;
  status: 'active' | 'ended';
}

export interface AvernusScorePayload {
  sessionId?: string;
  mode: GameMode;
  race: CharacterRace;
  weapon: WeaponType;
  score: number;
  kills: number;
  wave: number;
  durationSec: number;
  meta?: Record<string, unknown>;
}

export interface LeaderboardEntry {
  rank?: number;
  playerName?: string;
  score: number;
  gameId?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[AvernusAPI] ${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/** GET /api/avernus/config — modes, races, weapons, control SSOT */
export async function fetchAvernusConfig(): Promise<AvernusConfig> {
  try {
    return await jsonFetch<AvernusConfig>('/api/avernus/config');
  } catch {
    // Offline / cold start fallback — client SSOT
    const { MODE_LIST } = await import('./modes');
    const { WEAPONS } = await import('./weapons');
    const { ROLE_HOTKEYS } = await import('@/engine');
    return {
      gameId: AVERNUS_GAME_ID,
      name: 'Avernus Arena',
      version: '2.0.0-local',
      modes: MODE_LIST.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        icon: m.icon,
      })),
      races: [
        { id: 'human', name: 'Human', prefix: 'WK_' },
        { id: 'barbarian', name: 'Barbarian', prefix: 'BRB_' },
        { id: 'elf', name: 'Elf', prefix: 'ELF_' },
        { id: 'dwarf', name: 'Dwarf', prefix: 'DWF_' },
        { id: 'orc', name: 'Orc', prefix: 'ORC_' },
        { id: 'undead', name: 'Undead', prefix: 'UD_' },
      ],
      weapons: WEAPONS.map((w) => ({ type: w.type, name: w.name, packId: w.packId })),
      controls: ROLE_HOTKEYS.map((h) => ({ keys: h.keys, label: h.label })),
      camera: { mode: 'FOLLOW', distance: 7.5, height: 3.8 },
      characterStack: [
        'loadRaceWithEquipment',
        'RoleControls',
        'GameCamera.FOLLOW',
        'weaponPack FBX clips',
        'CharacterFSM',
      ],
      rest: {
        config: '/api/avernus/config',
        session: '/api/avernus/session',
        score: '/api/scores',
        leaderboard: `/api/leaderboards/${AVERNUS_GAME_ID}`,
      },
    };
  }
}

/** POST /api/avernus/session — start tracked run */
export async function createAvernusSession(body: {
  mode: GameMode;
  race: CharacterRace;
  weapon: WeaponType;
  heroId?: string;
}): Promise<AvernusSession> {
  try {
    return await jsonFetch<AvernusSession>('/api/avernus/session', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch {
    return {
      id: `local-${Date.now().toString(36)}`,
      gameId: AVERNUS_GAME_ID,
      mode: body.mode,
      race: body.race,
      weapon: body.weapon,
      heroId: body.heroId,
      createdAt: Date.now(),
      status: 'active',
    };
  }
}

/** POST /api/scores — fleet score pipeline */
export async function submitAvernusScore(payload: AvernusScorePayload): Promise<{ ok: boolean }> {
  try {
    await jsonFetch('/api/scores', {
      method: 'POST',
      body: JSON.stringify({
        gameId: AVERNUS_GAME_ID,
        score: payload.score,
        meta: {
          mode: payload.mode,
          race: payload.race,
          weapon: payload.weapon,
          kills: payload.kills,
          wave: payload.wave,
          durationSec: payload.durationSec,
          sessionId: payload.sessionId,
          ...payload.meta,
        },
      }),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** GET /api/leaderboards/avernus-arena */
export async function fetchAvernusLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  try {
    const data = await jsonFetch<{ entries?: LeaderboardEntry[] } | LeaderboardEntry[]>(
      `/api/leaderboards/${AVERNUS_GAME_ID}?limit=${limit}`,
    );
    if (Array.isArray(data)) return data;
    return data.entries ?? [];
  } catch {
    return [];
  }
}
