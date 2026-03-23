import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createToken, setCookieHeader, TTL_MS } from '../_auth';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const passcode = String(req.body?.passcode || '');
  const expected = process.env.ADMIN_PASSCODE;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!expected || !secret) {
    return res.status(500).json({ authenticated: false, error: 'Admin auth not configured' });
  }

  // Constant-time comparison
  const a = Buffer.from(passcode);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !require('crypto').timingSafeEqual(a, b)) {
    return res.status(401).json({ authenticated: false, error: 'Invalid credentials' });
  }

  const token = createToken(secret);
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', setCookieHeader(token, Math.floor(TTL_MS / 1000), secure));
  return res.json({ authenticated: true });
}
