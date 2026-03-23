import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PLATFORMS } from './_catalog';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.json(PLATFORMS);
}
