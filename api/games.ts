import GAMES_RAW from "./_games.json" with { type: "json" };
const GAMES: any[] = GAMES_RAW as any;

function matchesLetter(title: string, letter: string): boolean {
  if (letter === "#") return /^[^a-zA-Z]/.test(title);
  return title.toUpperCase().startsWith(letter.toUpperCase());
}

export default function handler(req: any, res: any) {
  const { platform, q, featured, letter } = req.query;

  if (featured === "true") {
    const featuredGames = GAMES.filter((g: any) => g.isFeatured);
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.json(featuredGames);
  }

  let results: any[] = GAMES;

  if (platform && typeof platform === "string") {
    results = results.filter((g: any) => g.platform === platform);
  }

  if (q && typeof q === "string" && q.trim()) {
    const query = q.toLowerCase().trim();
    results = results.filter((g: any) => g.title.toLowerCase().includes(query));
  }

  if (letter && typeof letter === "string" && letter.length === 1) {
    results = results.filter((g: any) => matchesLetter(g.title, letter));
  }

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json(results);
}