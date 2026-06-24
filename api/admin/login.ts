import {
  createToken,
  setCookieHeader,
  verifyAdminPasscode,
  getAdminSessionSecret,
  TTL_MS,
} from '../_auth';

function readPasscode(req: { body?: unknown }): string {
  const body = req.body;
  if (body && typeof body === 'object' && 'passcode' in body) {
    return String((body as { passcode?: unknown }).passcode || '');
  }
  if (typeof body === 'string' && body.trim()) {
    try {
      const parsed = JSON.parse(body) as { passcode?: unknown };
      return String(parsed.passcode || '');
    } catch {
      return '';
    }
  }
  return '';
}

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const passcode = readPasscode(req);
  const secret = getAdminSessionSecret();

  if (!secret) {
    return res.status(500).json({ authenticated: false, error: 'Admin auth not configured' });
  }

  if (!passcode || !verifyAdminPasscode(passcode)) {
    return res.status(401).json({ authenticated: false, error: 'Invalid credentials' });
  }

  const token = createToken(secret);
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', setCookieHeader(token, Math.floor(TTL_MS / 1000), secure));
  return res.json({ authenticated: true });
}