/**
 * Starter catalog for the unified account universe.
 * Portal owns identity + save snapshots; fleet games hydrate from these.
 */

export type StarterDeckCard = {
  cardKey: string;
  name: string;
  qty: number;
  cost: number;
  attack: number;
  health: number;
  rarity: "common" | "uncommon" | "rare" | "epic";
  tribe: string;
};

/** Season-0 style starter deck (~30 cards) for Nexus Nemesis account loop. */
export const STARTER_NEXUS_DECK: {
  name: string;
  description: string;
  tribe: string;
  cards: StarterDeckCard[];
} = {
  name: "Grudge Starter",
  description: "Portal starter deck — claim packs in Nexus to expand.",
  tribe: "grudge",
  cards: [
    { cardKey: "grudge_grunt", name: "Grudge Grunt", qty: 3, cost: 1, attack: 1, health: 2, rarity: "common", tribe: "grudge" },
    { cardKey: "dock_runner", name: "Dock Runner", qty: 3, cost: 1, attack: 2, health: 1, rarity: "common", tribe: "grudge" },
    { cardKey: "harbor_guard", name: "Harbor Guard", qty: 3, cost: 2, attack: 1, health: 4, rarity: "common", tribe: "grudge" },
    { cardKey: "cutlass_adept", name: "Cutlass Adept", qty: 3, cost: 2, attack: 3, health: 2, rarity: "common", tribe: "grudge" },
    { cardKey: "powder_monkey", name: "Powder Monkey", qty: 2, cost: 2, attack: 2, health: 2, rarity: "uncommon", tribe: "grudge" },
    { cardKey: "warcamp_banner", name: "Warcamp Banner", qty: 2, cost: 3, attack: 2, health: 4, rarity: "uncommon", tribe: "grudge" },
    { cardKey: "cannon_crew", name: "Cannon Crew", qty: 2, cost: 3, attack: 4, health: 2, rarity: "uncommon", tribe: "grudge" },
    { cardKey: "reef_shaman", name: "Reef Shaman", qty: 2, cost: 3, attack: 2, health: 3, rarity: "uncommon", tribe: "ethereal" },
    { cardKey: "black_flag", name: "Black Flag", qty: 2, cost: 4, attack: 4, health: 4, rarity: "rare", tribe: "grudge" },
    { cardKey: "nemesis_blade", name: "Nemesis Blade", qty: 2, cost: 4, attack: 5, health: 3, rarity: "rare", tribe: "legion" },
    { cardKey: "island_lord", name: "Island Lord", qty: 1, cost: 5, attack: 5, health: 6, rarity: "epic", tribe: "grudge" },
    { cardKey: "tide_ward", name: "Tide Ward", qty: 2, cost: 1, attack: 0, health: 3, rarity: "common", tribe: "ethereal" },
    { cardKey: "smuggler_cache", name: "Smuggler Cache", qty: 2, cost: 2, attack: 0, health: 2, rarity: "common", tribe: "grudge" },
    { cardKey: "board_action", name: "Board Action", qty: 1, cost: 3, attack: 0, health: 0, rarity: "uncommon", tribe: "mixed" },
  ],
};

export function countDeckCards(cards: Array<{ qty: number }>): number {
  return cards.reduce((sum, c) => sum + Math.max(0, c.qty | 0), 0);
}

export function isDeckValid(cards: Array<{ qty: number }>, min = 20, max = 40): boolean {
  const n = countDeckCards(cards);
  return n >= min && n <= max;
}

export type IslandBiome = "tropical" | "volcanic" | "frozen" | "desert" | "swamp" | "ruins";

export const ISLAND_BIOMES: { id: IslandBiome; label: string; emoji: string }[] = [
  { id: "tropical", label: "Tropical Atoll", emoji: "🏝️" },
  { id: "volcanic", label: "Volcanic Ridge", emoji: "🌋" },
  { id: "frozen", label: "Frozen Reach", emoji: "🧊" },
  { id: "desert", label: "Sandspire", emoji: "🏜️" },
  { id: "swamp", label: "Mirehold", emoji: "🐸" },
  { id: "ruins", label: "Sunken Ruins", emoji: "🏛️" },
];

export function defaultHomeIsland(displayName: string) {
  const seed = Math.floor(Math.random() * 1_000_000);
  return {
    name: `${displayName}'s Home Island`,
    biome: "tropical" as IslandBiome,
    isHome: true,
    layout: {
      size: 32,
      seed,
      structures: [
        { id: "dock-1", type: "dock", x: 4, z: 2, level: 1 },
        { id: "hut-1", type: "hut", x: 8, z: 8, level: 1 },
        { id: "flag-1", type: "banner", x: 10, z: 6, level: 1 },
      ],
      resources: { wood: 40, stone: 20, food: 30, scrap: 5 },
      flags: { tutorialDock: true },
    },
    progress: {
      level: 1,
      defense: 10,
      population: 3,
      lastHarvestAt: new Date().toISOString(),
    },
  };
}

/**
 * Fleet launch targets for universe loops — keep in sync with fleetRegistry
 * + CANONICAL domains (prefer *.grudge-studio.com over raw vercel when live).
 */
export const UNIVERSE_LAUNCH = {
  warlords: {
    gameKey: "warlords",
    route: "https://client.grudge-studio.com",
    label: "Warlords",
  },
  warlordGenesis: {
    gameKey: "warlord-genesis",
    route: "https://genesis.grudge-studio.com/play",
    label: "Warlord Genesis",
  },
  nemesis: {
    gameKey: "nemesis-tcg",
    route: "https://nemesis.grudge-studio.com",
    label: "Nexus Nemesis",
  },
  metaverse: {
    gameKey: "grudge-metaverse",
    route: "https://metaverse.grudge-studio.com",
    label: "Metaverse",
  },
  islands: {
    gameKey: "island-crusade-combat-sandbox",
    route: "https://islands.grudge-studio.com/arena",
    label: "Home Islands",
  },
} as const;
