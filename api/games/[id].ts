import GAMES_RAW from "../_games.json" with { type: "json" };
const GAMES: any[] = GAMES_RAW as any;

export default function handler(req: any, res: any) {
  const { id } = req.query;
  if (id === "featured") {
    const featured = GAMES.filter((g: any) => g.isFeatured);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.json(featured);
  }
  const numId = parseInt(id as string, 10);
  if (isNaN(numId)) return res.status(400).json({ error: "Invalid game ID" });
  const game = GAMES.find((g: any) => g.id === numId);
  if (!game) return res.status(404).json({ error: "Game not found" });
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  return res.json(game);
}