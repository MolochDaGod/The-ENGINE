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
      description: 'Survive endless grudge6 waves. How long can you last?',
      icon: '☠️',
    },
    {
      id: 'team_deathmatch',
      name: 'TEAM DEATHMATCH',
      description: 'Fight with squad AI allies vs enemy grudge6 kits.',
      icon: '⚔️',
    },
    {
      id: 'boss_rush',
      name: 'BOSS RUSH',
      description: 'Back-to-back bosses with minions.',
      icon: '👑',
    },
    {
      id: 'escort',
      name: 'ESCORT',
      description: 'Protect the VIP across the Avernus pit.',
      icon: '🛡️',
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
    { keys: 'WASD / Arrows', label: 'Move (camera-relative)' },
    { keys: 'LMB', label: 'Light attack / combo' },
    { keys: 'RMB', label: 'Heavy / bash / whirlwind' },
    { keys: 'Space', label: 'Jump / double jump' },
    { keys: 'Shift', label: 'Dash / dodge' },
    { keys: 'Ctrl (hold)', label: 'Block' },
    { keys: '1–4', label: 'Weapon skills (dash / launch / bash / special)' },
    { keys: 'Q E R F', label: 'Ability bar (pack skills)' },
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
