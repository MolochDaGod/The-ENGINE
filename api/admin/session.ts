import { verifyToken, parseCookies, COOKIE_NAME } from '../_auth';

export default function handler(req: any, res: any) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return res.status(500).json({ authenticated: false, error: 'Admin auth not configured' });
  }

  const cookies = parseCookies(req.headers.cookie as string | undefined);
  const token = cookies[COOKIE_NAME];

  if (!token || !verifyToken(token, secret)) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({ authenticated: true });
}
