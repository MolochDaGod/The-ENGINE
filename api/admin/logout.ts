import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCookieHeader, COOKIE_NAME } from '../_auth';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const secure = process.env.NODE_ENV === 'production';
  // Clear cookie by setting Max-Age=0
  const clearCookie = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=None',
    'Max-Age=0',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
  res.setHeader('Set-Cookie', clearCookie);
  return res.json({ success: true });
}
