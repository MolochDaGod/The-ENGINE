import { PLATFORMS } from './_catalog';

export default function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.json(PLATFORMS);
}
