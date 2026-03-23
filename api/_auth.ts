// Shared admin auth helpers — HMAC cookie-based sessions.
// Used by api/admin/login.ts, session.ts, logout.ts

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const COOKIE_NAME = 'gs_admin_session';
export const TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export function createToken(secret: string): string {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${expiresAt}.${randomBytes(8).toString('hex')}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length < 3) return false;
  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const sig = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join('.');
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, seg) => {
    const [k, ...v] = seg.trim().split('=');
    if (k && v.length) acc[k] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
}

export function setCookieHeader(value: string, maxAge: number, secure: boolean): string {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=None',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
