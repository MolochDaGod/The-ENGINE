/**
 * GET /api/avernus/config
 * Avernus Arena SSOT for opening page + clients.
 */

const CONFIG = {
  gameId: 'avernus-arena',
  name: 'Avernus Arena',
  version: '2.0.0',
  modes: [
    {
      id: 'survival',
      name: 'SURVIVAL',
      description: 'Solo endless waves. Survive until you fall. (DRC combat binds)',
      icon: '☠️',
      winCondition: 'Survive as long as possible',
      infiniteWaves: true,
    },
    {
      id: 'team_deathmatch',
      name: 'TEAM DEATHMATCH',
      description: 'Squad AI allies + you vs grudge6 enemies. First to 50 kills wins.',
      icon: '⚔️',
      winCondition: 'Reach 50 kills',
      killTarget: 50,
      squad: true,
    },
    {
      id: 'boss_rush',
      name: 'BOSS RUSH',
      description: '5 boss waves with minions. Clear all. Small ally squad.',
      icon: '👑',
      winCondition: 'Defeat all 5 bosses',
      infiniteWaves: false,
      squad: true,
    },
    {
      id: 'escort',
      name: 'ESCORT',
      description: 'Keep VIP alive through all waves (3 min timer). VIP death = fail.',
      icon: '🛡️',
      winCondition: 'VIP survives all waves',
      timeLimitSec: 180,
      firstAllyIsVip: true,
    },
  ],
  races: [
    { id: 'human', name: 'Human', prefix: 'WK_' },
    { id: 'barbarian', name: 'Barbarian', prefix: 'BRB_' },
    { id: 'elf', name: 'Elf', prefix: 'ELF_' },
    { id: 'dwarf', name: 'Dwarf', prefix: 'DWF_' },
    { id: 'orc', name: 'Orc', prefix: 'ORC_' },
    { id: 'undead', name: 'Undead', prefix: 'UD_' },
  ],
  weapons: [
    { type: 'sword_shield', name: 'Sword & Shield', packId: 'sword-shield' },
    { type: 'greatsword', name: 'Greatsword', packId: 'great-sword' },
    { type: 'bow', name: 'Longbow', packId: 'longbow' },
    { type: 'sabres', name: 'Dual Sabres', packId: 'unarmed' },
    { type: 'scythe', name: 'Scythe', packId: 'great-sword' },
    { type: 'runeblade', name: 'Runeblade', packId: 'magic-caster' },
  ],
  controls: [
    { keys: 'W A S D', label: 'Move · Shift sprint · Space jump' },
    { keys: 'LMB', label: 'Attack / select (FOCUS)' },
    { keys: 'RMB', label: 'Toggle hard FOCUS' },
    { keys: 'X · C', label: 'Roll · Parry' },
    { keys: 'E', label: 'Interact (else forcefield guard)' },
    { keys: 'F', label: 'Class / weapon skill' },
    { keys: 'R', label: 'Ultimate / heavy weapon skill' },
    { keys: '1–4', label: 'Signature skills' },
    { keys: 'Q · Hold Q', label: 'Tap: swap weapon · Hold: mode/state radial' },
    { keys: 'Shift+Q', label: 'Swap main ↔ side arm' },
  ],
  camera: { mode: 'FOLLOW', distance: 7.5, height: 3.8 },
  characterStack: [
    'loadRaceWithEquipment (grudge6 Toon RTS)',
    'RoleControls (Danger Room hotkeys)',
    'GameCamera.FOLLOW (TPS over-shoulder)',
    'weaponPack FBX clips + AbilitySystem',
    'CharacterFSM + CombatVfx + Attacker',
  ],
  rest: {
    config: '/api/avernus/config',
    session: 'POST /api/avernus/session',
    score: 'POST /api/scores',
    leaderboard: 'GET /api/leaderboards/avernus-arena',
  },
};

export default async function handler(
  req: { method?: string },
  res: {
    status: (n: number) => { json: (b: unknown) => void; end: () => void };
    setHeader: (k: string, v: string) => void;
  },
) {
  if (req.method !== 'GET' && req.method !== 'OPTIONS') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(200).json(CONFIG);
}
