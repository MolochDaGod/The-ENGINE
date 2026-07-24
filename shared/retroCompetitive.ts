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
  /** Catalog / DB game id — MUST match api/_games.json and game_library.id */
  gameId: number;
  /** Display title (catalog may differ slightly) */
  title: string;
  platform: string;
  modes: CompetitiveMode[];
  blurb: string;
  /** Shown next to score submit / challenge UI */
  scoreHint: string;
  /**
   * Canonical box art (libretro Named_Boxarts with region suffix).
   * Prefer these over bare catalog URLs that 403 without (USA).
   */
  thumbnailUrl: string;
}

/** libretro-thumbnails CDN roots by portal platform slug */
export const LIBRETRO_PLATFORM_ROOT: Record<string, string> = {
  nes: "Nintendo_-_Nintendo_Entertainment_System",
  snes: "Nintendo_-_Super_Nintendo_Entertainment_System",
  genesis: "Sega_-_Mega_Drive_-_Genesis",
  n64: "Nintendo_-_Nintendo_64",
  neogeo: "SNK_-_Neo_Geo",
  playstation: "Sony_-_PlayStation",
  gameboy: "Nintendo_-_Game_Boy",
  gba: "Nintendo_-_Game_Boy_Advance",
  nds: "Nintendo_-_Nintendo_DS",
};

export function libretroBoxartUrl(platform: string, fileNameWithExt: string): string {
  const root = LIBRETRO_PLATFORM_ROOT[platform] || LIBRETRO_PLATFORM_ROOT.nes;
  const enc = encodeURIComponent(fileNameWithExt);
  return `https://cdn.jsdelivr.net/gh/libretro-thumbnails/${root}@master/Named_Boxarts/${enc}`;
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
    thumbnailUrl: libretroBoxartUrl("n64", "Super Smash Bros. (USA).png"),
  },
  {
    gameId: 381,
    title: "Street Fighter II Special Champion Edition",
    platform: "genesis",
    modes: ["pvp"],
    blurb: "Genesis classic — best-of arcade matches.",
    scoreHint: "Submit match wins or perfects as score.",
    thumbnailUrl: libretroBoxartUrl(
      "genesis",
      "Street Fighter II' - Special Champion Edition (USA).png",
    ),
  },
  {
    gameId: 261,
    title: "Mortal Kombat II",
    platform: "snes",
    modes: ["pvp"],
    blurb: "SNES fighter — fatalities optional, ladder required.",
    scoreHint: "Submit tournament wins or consecutive victories.",
    thumbnailUrl: libretroBoxartUrl("snes", "Mortal Kombat II (USA).png"),
  },
  {
    gameId: 272,
    title: "Super Mario Kart",
    platform: "snes",
    modes: ["pvp", "pve"],
    blurb: "SNES racing — ghost times vs friends.",
    scoreHint: "Lower is better mentally; submit inverse time (higher = faster).",
    thumbnailUrl: libretroBoxartUrl("snes", "Super Mario Kart (USA).png"),
  },
  {
    gameId: 648,
    title: "The King of Fighters ’98 – The Slugfest",
    platform: "neogeo",
    modes: ["pvp"],
    blurb: "Neo Geo team fighter — competitive staple.",
    scoreHint: "Submit wins or perfect rounds as score.",
    // Neo Geo CD pack often has longer filename; USA AES/CD common path:
    thumbnailUrl: libretroBoxartUrl("neogeo", "The King of Fighters '98 - The Slugfest (World).png"),
  },
  {
    gameId: 612,
    title: "Metal Slug – Super Vehicle-001",
    platform: "neogeo",
    modes: ["pve", "coop"],
    blurb: "Run-and-gun score attack / co-op waves.",
    scoreHint: "Submit end-of-run high score from the results screen.",
    thumbnailUrl: libretroBoxartUrl("neogeo", "Metal Slug - Super Vehicle-001.png"),
  },
  {
    gameId: 49,
    title: "Contra",
    platform: "nes",
    modes: ["pve", "coop"],
    blurb: "NES co-op bullet hell — Konami code optional.",
    scoreHint: "Submit stage reached × 1000 + remaining lives.",
    thumbnailUrl: libretroBoxartUrl("nes", "Contra (USA).png"),
  },
  {
    gameId: 146,
    title: "Tetris",
    platform: "nes",
    modes: ["pvp", "pve"],
    blurb: "Pure score attack — global and 1v1 high score duels.",
    scoreHint: "Submit the in-game score directly.",
    thumbnailUrl: libretroBoxartUrl("nes", "Tetris (USA).png"),
  },
  {
    gameId: 35,
    title: "Bomberman",
    platform: "nes",
    modes: ["pvp", "pve"],
    blurb: "Battle mode / stage clear score.",
    scoreHint: "Submit wins (battle) or stage score (solo).",
    thumbnailUrl: libretroBoxartUrl("nes", "Bomberman (USA).png"),
  },
  {
    gameId: 95,
    title: "Mike Tyson’s Punch-Out!!",
    platform: "nes",
    modes: ["pve"],
    blurb: "Boss rush PvE — circuit climb.",
    scoreHint: "Submit opponents defeated × 1000 + remaining hearts.",
    thumbnailUrl: libretroBoxartUrl("nes", "Mike Tyson's Punch-Out!! (Europe).png"),
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
