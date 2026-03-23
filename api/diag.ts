export default function handler(_req: any, res: any) {
  try {
    // Inline a small test — if this works, the import chain is the issue
    const count = 1360;
    res.json({ count, ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
