/**
 * POST /api/avernus/session — create tracked arena run
 * GET  /api/avernus/session?id=… — fetch session (in-memory / passthrough)
 */

import crypto from 'crypto';

type Session = {
  id: string;
  gameId: string;
  mode: string;
  race: string;
  weapon: string;
  heroId?: string;
  createdAt: number;
  status: 'active' | 'ended';
};

// Edge-friendly memory (resets on cold start — Railway owns durable scores)
const SESSIONS = new Map<string, Session>();

export default async function handler(
  req: {
    method?: string;
    body?: Record<string, unknown>;
    query?: Record<string, string | string[]>;
  },
  res: {
    status: (n: number) => { json: (b: unknown) => void; end: () => void };
    setHeader: (k: string, v: string) => void;
  },
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const id = String(req.query?.id || '');
    if (!id) return res.status(400).json({ error: 'id required' });
    const s = SESSIONS.get(id);
    if (!s) return res.status(404).json({ error: 'session not found' });
    return res.status(200).json(s);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const session: Session = {
    id: crypto.randomUUID?.() ?? `av-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    gameId: 'avernus-arena',
    mode: String(body.mode || 'survival'),
    race: String(body.race || 'human'),
    weapon: String(body.weapon || 'sword_shield'),
    heroId: body.heroId ? String(body.heroId) : undefined,
    createdAt: Date.now(),
    status: 'active',
  };
  SESSIONS.set(session.id, session);

  // Cap map size
  if (SESSIONS.size > 500) {
    const first = SESSIONS.keys().next().value;
    if (first) SESSIONS.delete(first);
  }

  return res.status(201).json(session);
}
