import { GAMES } from './_catalog';

export default function handler(req: any, res: any) {
  const { platform, q } = req.query;

  let results = GAMES;

  if (platform && typeof platform === 'string') {
    results = results.filter(g => g.platform === platform);
  }

  if (q && typeof q === 'string' && q.trim()) {
    const query = q.toLowerCase().trim();
    results = results.filter(g => g.title.toLowerCase().includes(query));
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.json(results);
}
