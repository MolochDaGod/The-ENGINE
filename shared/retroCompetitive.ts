/**
 * Rec0deD:88 competitive roster — SSOT for portal PvP / PvE / leaderboards.
 *
 * Brand: Rec0deD:88 is the retro library + emulator brand *inside* The-ENGINE
 * (grudge-studio.com). It is NOT a separate company product and NOT Open/annihilate.
 *
 * gameId values match api/_games.json + Railway game_library catalog ids.
 */

export type CompetitiveMode = "pvp" | "pve" | "coop";

export interface CompetitiveRetroGame {
  /** Catalog / DB game id */
  gameId: number;
  /** Display title (catalog may differ slightly) */
  title: string;
  platform: string;
  modes: CompetitiveMode[];
  blurb: string;
  /** Shown next to score submit / challenge UI */
  scoreHint: string;
}

/**
 * Best 10 for live challenges + global boards.
 * Mix of 1v1 fighters, score-attack PvE, and co-op classics that work in-browser.
 */
export const RETRO_COMPETITIVE_TOP10: readonly CompetitiveRetroGame[] = [
  {
    gameId: 548,
    title: "Super Smash Bros",
    platform: "n64",
    modes: ["pvp"],
    blurb: "N64 platform fighter — stock wins, party PvP.",
    scoreHint: "Submit wins as score (e.g. stocks remaining × 100 + KOs).",
  },
  {
    gameId: 381,
    title: "Street Fighter II Special Champion Edition",
    platform: "genesis",
    modes: ["pvp"],
    blurb: "Genesis classic — best-of arcade matches.",
    scoreHint: "Submit match wins or perfects as score.",
  },
  {
    gameId: 261,
    title: "Mortal Kombat II",
    platform: "snes",
    modes: ["pvp"],
    blurb: "SNES fighter — fatalities optional, ladder required.",
    scoreHint: "Submit tournament wins or consecutive victories.",
  },
  {
    gameId: 272,
    title: "Super Mario Kart",
    platform: "snes",
    modes: ["pvp", "pve"],
    blurb: "SNES racing — ghost times vs friends.",
    scoreHint: "Lower is better mentally; submit inverse time (higher = faster).",
  },
  {
    gameId: 648,
    title: "The King of Fighters ’98 – The Slugfest",
    platform: "neogeo",
    modes: ["pvp"],
    blurb: "Neo Geo team fighter — competitive staple.",
    scoreHint: "Submit wins or perfect rounds as score.",
  },
  {
    gameId: 612,
    title: "Metal Slug – Super Vehicle-001",
    platform: "neogeo",
    modes: ["pve", "coop"],
    blurb: "Run-and-gun score attack / co-op waves.",
    scoreHint: "Submit end-of-run high score from the results screen.",
  },
  {
    gameId: 49,
    title: "Contra",
    platform: "nes",
    modes: ["pve", "coop"],
    blurb: "NES co-op bullet hell — Konami code optional.",
    scoreHint: "Submit stage reached × 1000 + remaining lives.",
  },
  {
    gameId: 146,
    title: "Tetris",
    platform: "nes",
    modes: ["pvp", "pve"],
    blurb: "Pure score attack — global and 1v1 high score duels.",
    scoreHint: "Submit the in-game score directly.",
  },
  {
    gameId: 35,
    title: "Bomberman",
    platform: "nes",
    modes: ["pvp", "pve"],
    blurb: "Battle mode / stage clear score.",
    scoreHint: "Submit wins (battle) or stage score (solo).",
  },
  {
    gameId: 95,
    title: "Mike Tyson’s Punch-Out!!",
    platform: "nes",
    modes: ["pve"],
    blurb: "Boss rush PvE — circuit climb.",
    scoreHint: "Submit opponents defeated × 1000 + remaining hearts.",
  },
] as const;

export const RETRO_COMPETITIVE_IDS: readonly number[] = RETRO_COMPETITIVE_TOP10.map(
  (g) => g.gameId,
);

export function getCompetitiveMeta(gameId: number): CompetitiveRetroGame | undefined {
  return RETRO_COMPETITIVE_TOP10.find((g) => g.gameId === gameId);
}

export function competitiveByMode(mode: CompetitiveMode | "all"): CompetitiveRetroGame[] {
  if (mode === "all") return [...RETRO_COMPETITIVE_TOP10];
  return RETRO_COMPETITIVE_TOP10.filter((g) => g.modes.includes(mode));
}
