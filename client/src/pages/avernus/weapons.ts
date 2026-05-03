import type { GunKey } from './assets';

export type WeaponType = 'greatsword' | 'bow' | 'sabres' | 'scythe' | 'runeblade';
export type AbilityKey = 'Q' | 'E' | 'R' | 'F';
export type AttackType = 'melee' | 'ranged' | 'magic';

export interface Ability {
  key: AbilityKey; name: string; cooldown: number; maxCooldown: number;
  cost: number; costType: 'mana' | 'rage' | 'energy'; description: string; unlocked: boolean;
}

export interface WeaponData {
  type: WeaponType; name: string; icon: string; subclass: string;
  abilities: Ability[]; resourceType: 'mana' | 'rage' | 'energy'; color: string;
  gunModel: GunKey; gunModelAlt?: GunKey; attackType: AttackType;
}

export const WEAPONS: WeaponData[] = [
  {
    type: 'greatsword', name: 'Greatsword', icon: '💎', subclass: 'IMMORTAL',
    color: '#00bfff', resourceType: 'rage', gunModel: 'Shovel', attackType: 'melee',
    abilities: [
      { key: 'Q', name: 'Fullguard', cooldown: 0, maxCooldown: 7, cost: 0, costType: 'rage', description: 'Block all damage for 3s', unlocked: true },
      { key: 'E', name: 'Charge', cooldown: 0, maxCooldown: 8, cost: 0, costType: 'rage', description: 'Dash forward, gain 25 rage', unlocked: false },
      { key: 'R', name: 'Colossus Strike', cooldown: 0, maxCooldown: 5, cost: 25, costType: 'rage', description: 'Lightning bolt scales with rage', unlocked: false },
      { key: 'F', name: 'Divine Wind', cooldown: 0, maxCooldown: 1.5, cost: 10, costType: 'rage', description: 'Launch sword, 120 piercing damage', unlocked: false },
    ]
  },
  {
    type: 'bow', name: 'Bow', icon: '🏹', subclass: 'VIPER',
    color: '#00ff00', resourceType: 'energy', gunModel: 'Sniper', attackType: 'ranged',
    abilities: [
      { key: 'Q', name: 'Frost Bite', cooldown: 0, maxCooldown: 5, cost: 50, costType: 'energy', description: 'Fire 5 arrows, apply SLOW', unlocked: true },
      { key: 'E', name: 'Cobra Shot', cooldown: 0, maxCooldown: 2, cost: 60, costType: 'energy', description: 'Apply VENOM DoT', unlocked: false },
      { key: 'R', name: 'Viper Sting', cooldown: 0, maxCooldown: 2, cost: 60, costType: 'energy', description: 'Piercing arrow returns to heal', unlocked: false },
      { key: 'F', name: 'Cloudkill', cooldown: 0, maxCooldown: 4, cost: 40, costType: 'energy', description: 'Arrow barrage from sky', unlocked: false },
    ]
  },
  {
    type: 'sabres', name: 'Sabres', icon: '⚔️', subclass: 'ASSASSIN',
    color: '#ff4444', resourceType: 'energy', gunModel: 'Knife_1', gunModelAlt: 'Knife_2', attackType: 'melee',
    abilities: [
      { key: 'Q', name: 'Backstab', cooldown: 0, maxCooldown: 2, cost: 60, costType: 'energy', description: '75 dmg, 175 from behind', unlocked: true },
      { key: 'E', name: 'Flourish', cooldown: 0, maxCooldown: 1.5, cost: 35, costType: 'energy', description: 'Flurry, stacks to STUN', unlocked: false },
      { key: 'R', name: 'Divebomb', cooldown: 0, maxCooldown: 6, cost: 40, costType: 'energy', description: 'Leap crash, STUN 2s', unlocked: false },
      { key: 'F', name: 'Shadow Step', cooldown: 0, maxCooldown: 10, cost: 0, costType: 'energy', description: 'INVISIBLE 5s', unlocked: false },
    ]
  },
  {
    type: 'scythe', name: 'Scythe', icon: '🦋', subclass: 'WEAVER',
    color: '#4169e1', resourceType: 'mana', gunModel: 'RocketLauncher', attackType: 'magic',
    abilities: [
      { key: 'Q', name: 'Sunwell', cooldown: 0, maxCooldown: 1, cost: 30, costType: 'mana', description: 'Heal 60 HP', unlocked: true },
      { key: 'E', name: 'Coldsnap', cooldown: 0, maxCooldown: 12, cost: 50, costType: 'mana', description: 'FREEZE enemies 6s', unlocked: false },
      { key: 'R', name: 'Crossentropy', cooldown: 0, maxCooldown: 2, cost: 40, costType: 'mana', description: 'Plasma bolt, +10 per BURN stack', unlocked: false },
      { key: 'F', name: 'Mantra', cooldown: 0, maxCooldown: 5, cost: 75, costType: 'mana', description: 'Healing totem 8s', unlocked: false },
    ]
  },
  {
    type: 'runeblade', name: 'Runeblade', icon: '🔮', subclass: 'TEMPLAR',
    color: '#9400d3', resourceType: 'mana', gunModel: 'AK', attackType: 'ranged',
    abilities: [
      { key: 'Q', name: 'Void Grasp', cooldown: 0, maxCooldown: 5, cost: 35, costType: 'mana', description: 'Pull enemy towards you', unlocked: true },
      { key: 'E', name: 'Wraithblade', cooldown: 0, maxCooldown: 3, cost: 35, costType: 'mana', description: 'CORRUPTED, 90% slow', unlocked: false },
      { key: 'R', name: 'Hexed Smite', cooldown: 0, maxCooldown: 3, cost: 45, costType: 'mana', description: 'AoE damage, heal same amount', unlocked: false },
      { key: 'F', name: 'Heartrend', cooldown: 0, maxCooldown: 0, cost: 24, costType: 'mana', description: 'Toggle: +45% crit, +75% crit dmg', unlocked: false },
    ]
  }
];

export type CoverType = 'solid' | 'breakable' | 'explosive' | 'hazard' | 'pickup';

export interface MapPlacement {
  asset: string;
  pos: [number, number, number];
  rot?: number;
  scale?: number;
  coverType?: CoverType;
  health?: number;
}

export const ARENA_LAYOUT: MapPlacement[] = [
  // Corner structures
  { asset: 'Structure_1', pos: [-22, 0, -22], scale: 2, coverType: 'solid', health: 9999 },
  { asset: 'Structure_2', pos: [22, 0, -22], rot: Math.PI / 2, scale: 2, coverType: 'solid', health: 9999 },
  { asset: 'Structure_3', pos: [-22, 0, 22], rot: -Math.PI / 2, scale: 2, coverType: 'solid', health: 9999 },
  { asset: 'Structure_4', pos: [22, 0, 22], rot: Math.PI, scale: 2, coverType: 'solid', health: 9999 },
  // Center cover
  { asset: 'Container_Small', pos: [-3, 0, 0], scale: 1.5, coverType: 'solid', health: 500 },
  { asset: 'Container_Small', pos: [3, 0, 0], rot: Math.PI, scale: 1.5, coverType: 'solid', health: 500 },
  { asset: 'SackTrench', pos: [0, 0, 4], scale: 2, coverType: 'solid', health: 300 },
  { asset: 'SackTrench', pos: [0, 0, -4], rot: Math.PI, scale: 2, coverType: 'solid', health: 300 },
  // Mid barriers
  { asset: 'Barrier_Large', pos: [-12, 0, 0], rot: Math.PI / 4, scale: 2, coverType: 'solid', health: 400 },
  { asset: 'Barrier_Large', pos: [12, 0, 0], rot: -Math.PI / 4, scale: 2, coverType: 'solid', health: 400 },
  { asset: 'BrickWall_1', pos: [0, 0, -12], scale: 2, coverType: 'solid', health: 600 },
  { asset: 'BrickWall_2', pos: [0, 0, 12], scale: 2, coverType: 'solid', health: 600 },
  // Flanking crates
  { asset: 'Crate', pos: [-8, 0, -8], scale: 2, coverType: 'breakable', health: 100 },
  { asset: 'Crate', pos: [8, 0, 8], scale: 2, coverType: 'breakable', health: 100 },
  { asset: 'Crate', pos: [-8, 0, 8], scale: 2, coverType: 'breakable', health: 100 },
  { asset: 'Crate', pos: [8, 0, -8], scale: 2, coverType: 'breakable', health: 100 },
  { asset: 'CardboardBoxes_1', pos: [-15, 0, -8], scale: 2, coverType: 'breakable', health: 50 },
  { asset: 'CardboardBoxes_2', pos: [15, 0, 8], scale: 2, coverType: 'breakable', health: 50 },
  // Explosive barrels
  { asset: 'ExplodingBarrel', pos: [-6, 0, -10], scale: 2, coverType: 'explosive', health: 30 },
  { asset: 'ExplodingBarrel', pos: [6, 0, 10], scale: 2, coverType: 'explosive', health: 30 },
  { asset: 'ExplodingBarrel', pos: [-10, 0, 6], scale: 2, coverType: 'explosive', health: 30 },
  { asset: 'ExplodingBarrel', pos: [10, 0, -6], scale: 2, coverType: 'explosive', health: 30 },
  // Hazards
  { asset: 'BearTrap_Open', pos: [-5, 0, -15], scale: 2, coverType: 'hazard', health: 1 },
  { asset: 'BearTrap_Open', pos: [5, 0, 15], scale: 2, coverType: 'hazard', health: 1 },
  { asset: 'Landmine', pos: [15, 0, 0], scale: 2, coverType: 'hazard', health: 1 },
  { asset: 'Landmine', pos: [-15, 0, 0], scale: 2, coverType: 'hazard', health: 1 },
  // Health pickups
  { asset: 'Health', pos: [0, 0.5, 18], scale: 2, coverType: 'pickup', health: 1 },
  { asset: 'Health', pos: [0, 0.5, -18], scale: 2, coverType: 'pickup', health: 1 },
  { asset: 'Health', pos: [18, 0.5, 0], scale: 2, coverType: 'pickup', health: 1 },
  { asset: 'Health', pos: [-18, 0.5, 0], scale: 2, coverType: 'pickup', health: 1 },
  // Debris & atmosphere
  { asset: 'Debris_BrokenCar', pos: [-18, 0, -15], rot: 0.3, scale: 2, coverType: 'solid', health: 9999 },
  { asset: 'Debris_Tires', pos: [18, 0, 15], scale: 2, coverType: 'breakable', health: 80 },
  { asset: 'TrafficCone', pos: [-14, 0, 3], scale: 2 },
  { asset: 'TrafficCone', pos: [14, 0, -3], scale: 2 },
  { asset: 'TrashContainer', pos: [-20, 0, 5], scale: 1.5, coverType: 'solid', health: 200 },
  { asset: 'TrashContainer', pos: [20, 0, -5], scale: 1.5, coverType: 'solid', health: 200 },
  // Street lights
  { asset: 'StreetLight', pos: [-12, 0, -12], scale: 2 },
  { asset: 'StreetLight', pos: [12, 0, 12], scale: 2 },
  { asset: 'StreetLight', pos: [-12, 0, 12], scale: 2 },
  { asset: 'StreetLight', pos: [12, 0, -12], scale: 2 },
  // Perimeter trees
  { asset: 'Tree_1', pos: [-26, 0, -10], scale: 2 },
  { asset: 'Tree_2', pos: [-26, 0, 10], scale: 2 },
  { asset: 'Tree_3', pos: [26, 0, -10], scale: 2 },
  { asset: 'Tree_4', pos: [26, 0, 10], scale: 2 },
  { asset: 'Tree_1', pos: [-10, 0, -26], scale: 2 },
  { asset: 'Tree_2', pos: [10, 0, -26], scale: 2 },
  { asset: 'Tree_3', pos: [-10, 0, 26], scale: 2 },
  { asset: 'Tree_4', pos: [10, 0, 26], scale: 2 },
  // Fencing perimeter
  { asset: 'MetalFence', pos: [0, 0, -27], scale: 3, coverType: 'solid', health: 9999 },
  { asset: 'MetalFence', pos: [0, 0, 27], rot: Math.PI, scale: 3, coverType: 'solid', health: 9999 },
  { asset: 'Fence_Long', pos: [-27, 0, 0], rot: Math.PI / 2, scale: 2, coverType: 'solid', health: 9999 },
  { asset: 'Fence_Long', pos: [27, 0, 0], rot: -Math.PI / 2, scale: 2, coverType: 'solid', health: 9999 },
  // Extra props
  { asset: 'GasTank', pos: [-4, 0, 16], scale: 2, coverType: 'explosive', health: 40 },
  { asset: 'Tank', pos: [20, 0, 20], rot: -Math.PI / 4, scale: 1.5, coverType: 'solid', health: 9999 },
  { asset: 'WaterTank_Floor', pos: [-20, 0, -20], scale: 1.5, coverType: 'solid', health: 9999 },
  { asset: 'Sign', pos: [0, 0, -24], scale: 2 },
];
