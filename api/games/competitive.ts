/**
 * Vercel serverless: Rec0deD competitive Top 10.
 * Portal /api/games/* is NOT rewritten to Railway — this file is required.
 * Roster IDs must stay in sync with shared/retroCompetitive.ts.
 */
import GAMES_RAW from "../_games.json" with { type: "json" };

const GAMES: Array<Record<string, unknown>> = GAMES_RAW as Array<Record<string, unknown>>;
const RAILWAY_API = process.env.RAILWAY_API_URL || "https://the-engine.up.railway.app";

type Mode = "pvp" | "pve" | "coop";

/** Keep in sync with shared/retroCompetitive.ts */
const ROSTER: Array<{
  gameId: number;
  title: string;
  platform: string;
  modes: Mode[];
  blurb: string;
  scoreHint: string;
}> = [
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
];

export default async function handler(
  req: { method?: string; query?: Record<string, string | string[]> },
  res: {
    status: (n: number) => { json: (b: unknown) => void };
    setHeader: (k: string, v: string) => void;
  },
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const modeRaw = String(req.query?.mode || "all").toLowerCase();
  const mode: Mode | "all" =
    modeRaw === "pvp" || modeRaw === "pve" || modeRaw === "coop" ? modeRaw : "all";

  try {
    const qs = mode === "all" ? "" : `?mode=${mode}`;
    const upstream = await fetch(`${RAILWAY_API}/api/games/competitive${qs}`, {
      headers: { Accept: "application/json" },
    });
    if (upstream.ok) {
      const data = await upstream.json();
      res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
      return res.status(200).json(data);
    }
  } catch {
    /* static fallback */
  }

  const roster = mode === "all" ? ROSTER : ROSTER.filter((g) => g.modes.includes(mode));
  const byId = new Map(GAMES.map((g) => [Number(g.id), g]));

  const out = roster.map((meta, i) => {
    const live = byId.get(meta.gameId);
    const rank = ROSTER.findIndex((g) => g.gameId === meta.gameId) + 1 || i + 1;
    return {
      ...(live || {
        id: meta.gameId,
        title: meta.title,
        slug: meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        platform: meta.platform,
        isFeatured: true,
        category: "retro",
        isPlayable: true,
        description: meta.blurb,
        thumbnailUrl: null,
        embedUrl: null,
      }),
      competitive: {
        modes: meta.modes,
        blurb: meta.blurb,
        scoreHint: meta.scoreHint,
        rank,
      },
    };
  });

  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
  return res.status(200).json(out);
}
