// ─── Enums / Unions ────────────────────────────────────────────────────────
export type HeroId = 'death_mage' | 'holy_paladin' | 'orc_shaman' | 'stone_guardian';
export type GameMode = 'solo' | 'pvp' | 'pve';
export type MatchState = 'lobby' | 'active' | 'ended';

// ─── Hero Kit ──────────────────────────────────────────────────────────────
export interface AbilityDef {
  name: string;
  desc: string;
  damage: number;
  range: number;      // px radius / reach
  mana: number;
  cooldown: number;   // seconds
  color: string;      // projectile / effect color
  projSpeed?: number; // projectile speed (px/frame)
  projRadius?: number;
  aoeRadius?: number; // for AoE abilities
  heal?: number;      // heals caster
  duration?: number;  // seconds (shields / totems)
  isAoe?: boolean;
  isMelee?: boolean;
  isTeleport?: boolean;
  isBeam?: boolean;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  lore: string;
  color: string;       // primary (circle fill)
  rimColor: string;    // secondary (glow / rim)
  maxHealth: number;
  maxMana: number;
  speed: number;       // px/frame
  emoji: string;
  basic: AbilityDef;
  q: AbilityDef;
  e: AbilityDef;
  r: AbilityDef;
}

export const HEROES: Record<HeroId, HeroDef> = {
  death_mage: {
    id: 'death_mage',
    name: 'Death Mage',
    lore: 'Wielder of void and shadow. Drains life to fuel ever darker powers.',
    color: '#9b59b6',
    rimColor: '#2c1654',
    maxHealth: 80,
    maxMana: 150,
    speed: 4.5,
    emoji: '💀',
    basic: {
      name: 'Void Bolt',
      desc: 'Fire a fast void projectile that pierces.',
      damage: 30, range: 520, mana: 8, cooldown: 0.3,
      color: '#d355e8', projSpeed: 14, projRadius: 7,
    },
    q: {
      name: 'Soul Drain',
      desc: 'Drain life from all nearby enemies.',
      damage: 18, range: 160, mana: 25, cooldown: 6,
      color: '#8e44ad', aoeRadius: 160, heal: 12, isAoe: true,
    },
    e: {
      name: 'Spectral Blink',
      desc: 'Instantly teleport to cursor position.',
      damage: 0, range: 270, mana: 30, cooldown: 8,
      color: '#e8c3f8', isTeleport: true,
    },
    r: {
      name: 'Death Nova',
      desc: 'Detonate void energy in a massive explosion.',
      damage: 130, range: 300, mana: 70, cooldown: 20,
      color: '#c0392b', aoeRadius: 300, isAoe: true, projRadius: 300,
    },
  },

  holy_paladin: {
    id: 'holy_paladin',
    name: 'Holy Paladin',
    lore: 'Champion of divine light. Punishes evil and protects allies.',
    color: '#f1c40f',
    rimColor: '#7d6608',
    maxHealth: 135,
    maxMana: 100,
    speed: 3.5,
    emoji: '⚔️',
    basic: {
      name: 'Holy Strike',
      desc: 'A powerful melee strike in a wide arc.',
      damage: 50, range: 95, mana: 5, cooldown: 0.6,
      color: '#fff176', isMelee: true, aoeRadius: 95,
    },
    q: {
      name: 'Divine Shield',
      desc: 'Become invulnerable for 2.5 seconds.',
      damage: 0, range: 0, mana: 30, cooldown: 12,
      color: '#fffde7', duration: 2.5, isAoe: false,
    },
    e: {
      name: 'Consecrate',
      desc: 'Bless the ground — heal allies, burn enemies.',
      damage: 22, range: 200, mana: 40, cooldown: 10,
      color: '#ffd54f', aoeRadius: 200, heal: 18, isAoe: true,
    },
    r: {
      name: 'Wrath Beam',
      desc: 'Fire a concentrated beam of holy light.',
      damage: 160, range: 620, mana: 70, cooldown: 20,
      color: '#ffffff', isBeam: true, projRadius: 18,
    },
  },

  orc_shaman: {
    id: 'orc_shaman',
    name: 'Orc Shaman',
    lore: 'Storm-caller and spirit master. Commands lightning with fury.',
    color: '#27ae60',
    rimColor: '#145a32',
    maxHealth: 100,
    maxMana: 120,
    speed: 4.0,
    emoji: '⚡',
    basic: {
      name: 'Lightning Bolt',
      desc: 'Hurl a bolt that chains to 2 nearby foes.',
      damage: 28, range: 460, mana: 10, cooldown: 0.4,
      color: '#a8ff3e', projSpeed: 13, projRadius: 6,
    },
    q: {
      name: 'Thunder Clap',
      desc: 'Shockwave stuns and damages nearby enemies.',
      damage: 55, range: 190, mana: 35, cooldown: 9,
      color: '#82e0aa', aoeRadius: 190, isAoe: true,
    },
    e: {
      name: 'Storm Totem',
      desc: 'Place a lightning totem that attacks for 8s.',
      damage: 20, range: 320, mana: 30, cooldown: 11,
      color: '#2ecc71', duration: 8, projRadius: 5,
    },
    r: {
      name: 'Storm Call',
      desc: 'Call down 5 lightning strikes in an area.',
      damage: 90, range: 260, mana: 65, cooldown: 18,
      color: '#c8ff3e', aoeRadius: 260, isAoe: true,
    },
  },

  stone_guardian: {
    id: 'stone_guardian',
    name: 'Stone Guardian',
    lore: 'Ancient earth protector. Immovable, unstoppable.',
    color: '#7f8c8d',
    rimColor: '#2c3e50',
    maxHealth: 185,
    maxMana: 80,
    speed: 2.8,
    emoji: '🪨',
    basic: {
      name: 'Ground Slam',
      desc: 'Slam the ground in a wide melee arc.',
      damage: 60, range: 110, mana: 5, cooldown: 0.8,
      color: '#bdc3c7', isMelee: true, aoeRadius: 110,
    },
    q: {
      name: 'Stone Skin',
      desc: 'Harden skin — take 70% less damage for 4s.',
      damage: 0, range: 0, mana: 20, cooldown: 9,
      color: '#aab7b8', duration: 4,
    },
    e: {
      name: 'Earthquake',
      desc: 'Crack the earth — damages and slows all nearby.',
      damage: 45, range: 230, mana: 35, cooldown: 11,
      color: '#a04000', aoeRadius: 230, isAoe: true, duration: 2,
    },
    r: {
      name: 'Meteor',
      desc: 'Call a giant meteor at cursor — 1.2s delay.',
      damage: 210, range: 310, mana: 60, cooldown: 24,
      color: '#e74c3c', aoeRadius: 100, isAoe: true, duration: 1.2,
    },
  },
};

// ─── Runtime player / enemy state ─────────────────────────────────────────
export interface ArenaPlayer {
  id: string;
  name: string;
  heroId: HeroId;
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  alive: boolean;
  kills: number;
  deaths: number;
  shielded?: boolean;
  stoneHardened?: boolean;
  isHost?: boolean;
}

export interface ArenaEnemy {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  type: 'grunt' | 'elite' | 'boss';
  speed: number;
  attackCooldown: number;
}

// ─── WebSocket message protocol ────────────────────────────────────────────
// Short keys to minimise bandwidth at 20Hz tick rate

/** Client → Server */
export type WsClientMsg =
  | { t: 'join';    rid: string; hid: HeroId; name: string; mode: GameMode }
  | { t: 'state';   x: number; y: number; ang: number; hp: number; mp: number; sh?: boolean }
  | { t: 'cast';    qi: number; tx: number; ty: number }  // ability index 0=basic,1=q,2=e,3=r
  | { t: 'enemies'; list: Partial<ArenaEnemy>[] }         // host PvE sync
  | { t: 'start' }                                         // host starts match
  | { t: 'dead';   kills: number }
  | { t: 'leave' };

/** Server → Client */
export type WsServerMsg =
  | { t: 'joined';   pid: string; rid: string; players: ArenaPlayer[]; isHost: boolean }
  | { t: 'pjoin';    p: ArenaPlayer }
  | { t: 'pleave';   pid: string }
  | { t: 'pstate';   players: Partial<ArenaPlayer & { id: string }>[] }
  | { t: 'cast';     pid: string; qi: number; tx: number; ty: number }
  | { t: 'enemies';  list: Partial<ArenaEnemy>[] }
  | { t: 'started' }
  | { t: 'ended';    wid?: string; reason: string }
  | { t: 'err';      msg: string };
