import { GAMES } from '../_catalog';

export default function handler(req: any, res: any) {
  const { id } = req.query;

  // Handle /api/games/featured
  if (id === 'featured') {
    const featured = GAMES.filter(g => g.isFeatured);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.json(featured);
  }

  // Handle /api/games/:id
  const numId = parseInt(id as string, 10);
  if (isNaN(numId)) {
    return res.status(400).json({ error: 'Invalid game ID' });
  }

  const game = GAMES.find(g => g.id === numId);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.json(game);
}
