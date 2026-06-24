import {
  createToken,
  setCookieHeader,
  verifyAdminPasscode,
  getAdminSessionSecret,
  TTL_MS,
} from '../_auth';

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const passcode = String(req.body?.passcode || '');
  const secret = getAdminSessionSecret();

  if (!secret) {
    return res.status(500).json({ authenticated: false, error: 'Admin auth not configured' });
  }

  if (!verifyAdminPasscode(passcode)) {
    return res.status(401).json({ authenticated: false, error: 'Invalid credentials' });
  }

  const token = createToken(secret);
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', setCookieHeader(token, Math.floor(TTL_MS / 1000), secure));
  return res.json({ authenticated: true });
}