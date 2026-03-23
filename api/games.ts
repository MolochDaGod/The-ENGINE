// Use require() to load JSON so this works as CommonJS bundle
const GAMES: any[] = require('./_games.json');

export default function handler(req: any, res: any) {
  const { platform, q } = req.query;

  let results: any[] = GAMES;

  if (platform && typeof platform === 'string') {
    results = results.filter((g: any) => g.platform === platform);
  }

  if (q && typeof q === 'string' && q.trim()) {
    const query = q.toLowerCase().trim();
    results = results.filter((g: any) => g.title.toLowerCase().includes(query));
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.json(results);
}
