import { CATALOG } from './_catalog-data';

export default function handler(_req: any, res: any) {
  try {
    res.json({ count: CATALOG.length, first: CATALOG[0]?.[1] ?? 'none' });
  } catch (e: any) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
