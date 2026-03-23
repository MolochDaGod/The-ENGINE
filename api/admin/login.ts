import crypto from 'crypto';

const COOKIE_NAME = 'gs_admin_session';
const TTL_MS = 1000 * 60 * 60 * 12;

function createToken(secret: string): string {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${expiresAt}.${crypto.randomBytes(8).toString('hex')}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const passcode = String(req.body?.passcode || '');
  const expected = process.env.ADMIN_PASSCODE || process.env.VITE_ADMIN_PASSCODE;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!expected || !secret) {
    return res.status(500).json({ authenticated: false, error: 'Admin auth not configured' });
  }

  try {
    const a = Buffer.from(passcode);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ authenticated: false, error: 'Invalid credentials' });
    }
  } catch { return res.status(401).json({ authenticated: false, error: 'Invalid credentials' }); }

  const token = createToken(secret);
  const secure = process.env.NODE_ENV === 'production';
  const cookie = [`${COOKIE_NAME}=${encodeURIComponent(token)}`, 'HttpOnly', 'Path=/', 'SameSite=None',
    `Max-Age=${Math.floor(TTL_MS / 1000)}`, ...(secure ? ['Secure'] : [])].join('; ');
  res.setHeader('Set-Cookie', cookie);
  return res.json({ authenticated: true });
}
