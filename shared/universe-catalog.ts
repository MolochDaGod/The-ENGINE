/**
 * Account universe catalog — real fleet data only.
 *
 * HARD RULE: No invented cards, no portal filler decks, no demo catalogs.
 * Nexus battle decks live on grudgeplatform.io (user_season0_cards / battledeck).
 * Portal may only *mirror* real decks after a successful API sync, or show empty.
 */

export type StarterDeckCard = {
  cardKey: string;
  name: string;
  qty: number;
  cost?: number;
  attack?: number;
  health?: number;
  rarity?: string;
  tribe?: string;
  type?: string;
};

/**
 * Known portal-invented card keys/names (must be purged, never re-created).
 */
export const LEGACY_FAKE_CARD_KEYS = new Set([
  "grudge_grunt",
  "dock_runner",
  "harbor_guard",
  "cutlass_adept",
  "powder_monkey",
  "warcamp_banner",
  "cannon_crew",
  "reef_shaman",
  "black_flag",
  "nemesis_blade",
  "island_lord",
  "tide_ward",
  "smuggler_cache",
  "board_action",
]);

const LEGACY_FAKE_NAMES = new Set([
  "grudge grunt",
  "dock runner",
  "harbor guard",
  "cutlass adept",
  "powder monkey",
  "warcamp banner",
  "cannon crew",
  "reef shaman",
  "black flag",
  "nemesis blade",
  "island lord",
  "tide ward",
  "smuggler cache",
  "board action",
]);

export function isLegacyFakeDeck(cards: Array<{ cardKey?: string; name?: string }>): boolean {
  if (!cards?.length) return false;
  return cards.some((c) => {
    const key = String(c.cardKey || "").toLowerCase();
    if (LEGACY_FAKE_CARD_KEYS.has(key)) return true;
    // Non-numeric keys that aren't real season0 ids are also suspect for "Nexus" decks
    const n = String(c.name || "").toLowerCase();
    if (LEGACY_FAKE_NAMES.has(n)) return true;
    return false;
  });
}

/**
 * A deck is "real Season 0 shape" only when every cardKey is a numeric template id
 * (matches season0_basic_cards.id / cardId strings like "1".."102").
 */
export function isRealSeason0DeckCards(
  cards: Array<{ cardKey?: string; name?: string }>,
): boolean {
  if (!cards?.length) return false;
  if (isLegacyFakeDeck(cards)) return false;
  return cards.every((c) => {
    const key = String(c.cardKey || "").trim();
    return /^\d+$/.test(key);
  });
}

/** @deprecated Never auto-seed. Kept empty so any leftover import fails closed. */
export const STARTER_NEXUS_DECK = null as never;

export function countDeckCards(cards: Array<{ qty: number }>): number {
  return cards.reduce((sum, c) => sum + Math.max(0, c.qty | 0), 0);
}

/** Battle-ready for Nexus is exactly 20 owned instances. */
export function isDeckValid(cards: Array<{ qty: number }>, min = 20, max = 20): boolean {
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

/**
 * Home island rows are player-owned progress in portal DB (real rows).
 * Empty until the player creates one — no auto-fake island.
 */
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
 * Fleet launch targets — production domains only.
 * Nemesis TCG SSOT: grudgeplatform.io (Railway nexus-nemesis + Postgres).
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
    route: "https://grudgeplatform.io/library",
    label: "Nexus Nemesis",
  },
  nemesisDeck: {
    gameKey: "nemesis-tcg",
    route: "https://grudgeplatform.io/deck-builder",
    label: "Nexus Deck Builder",
  },
  nemesisBattledeck: {
    gameKey: "nemesis-tcg",
    route: "https://grudgeplatform.io/api/user/battledeck",
    label: "Battle Deck API",
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

/** Production Nexus host (constant — override only on server via env in nexus-deck-sync). */
export const NEXUS_TCG_ORIGIN = "https://grudgeplatform.io";