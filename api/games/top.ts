import GAMES_RAW from "../_games.json" with { type: "json" };

const GAMES: Array<Record<string, unknown>> = GAMES_RAW as Array<Record<string, unknown>>;
const RAILWAY_API = process.env.RAILWAY_API_URL || "https://the-engine.up.railway.app";

function fallbackTop(limit: number) {
  const featured = GAMES.filter((g) => Boolean(g.isFeatured));
  const pool = featured.length ? featured : GAMES;
  return pool.slice(0, limit).map((g) => ({
    ...g,
    playerCount: 0,
    scoreCount: 0,
  }));
}

export default async function handler(req: { method?: string; query?: Record<string, string | string[]> }, res: {
  status: (n: number) => { json: (b: unknown) => void };
  setHeader: (k: string, v: string) => void;
}) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limit = Math.min(parseInt(String(req.query?.limit || "12"), 10) || 12, 50);
  const windowDays = Math.min(parseInt(String(req.query?.windowDays || "7"), 10) || 7, 365);
  const qs = new URLSearchParams({ limit: String(limit), windowDays: String(windowDays) });

  try {
    const upstream = await fetch(`${RAILWAY_API}/api/games/top?${qs}`, {
      headers: { Accept: "application/json" },
    });
    if (upstream.ok) {
      const data = await upstream.json();
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json(data);
    }
  } catch {
    // Railway unavailable — serve static fallback
  }

  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
  return res.status(200).json(fallbackTop(limit));
}