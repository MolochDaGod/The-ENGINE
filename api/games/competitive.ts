/**
 * Vercel edge/serverless: Rec0deD competitive Top 10.
 * Portal /api/games/* is NOT rewritten to Railway (vercel.json exclude),
 * so this file is required for grudge-studio.com/api/games/competitive.
 */
import GAMES_RAW from "../_games.json" with { type: "json" };
import {
  RETRO_COMPETITIVE_TOP10,
  type CompetitiveMode,
} from "../../shared/retroCompetitive";

const GAMES: Array<Record<string, unknown>> = GAMES_RAW as Array<Record<string, unknown>>;
const RAILWAY_API = process.env.RAILWAY_API_URL || "https://the-engine.up.railway.app";

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
  const mode = (
    modeRaw === "pvp" || modeRaw === "pve" || modeRaw === "coop" ? modeRaw : "all"
  ) as CompetitiveMode | "all";

  // Prefer Railway (live thumbnails / featured flags) when available
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

  const roster =
    mode === "all"
      ? [...RETRO_COMPETITIVE_TOP10]
      : RETRO_COMPETITIVE_TOP10.filter((g) => g.modes.includes(mode));

  const byId = new Map(GAMES.map((g) => [Number(g.id), g]));
  const out = roster.map((meta, i) => {
    const live = byId.get(meta.gameId);
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
        rank: RETRO_COMPETITIVE_TOP10.findIndex((g) => g.gameId === meta.gameId) + 1 || i + 1,
      },
    };
  });

  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
  return res.status(200).json(out);
}
