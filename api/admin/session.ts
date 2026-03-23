import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "gs_admin_session";

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, seg) => {
    const [k, ...v] = seg.trim().split("=");
    if (k && v.length) acc[k] = decodeURIComponent(v.join("="));
    return acc;
  }, {});
}

function verifyToken(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length < 3) return false;
  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const sig = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(".");
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

export default function handler(req: any, res: any) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return res.status(500).json({ authenticated: false });
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token || !verifyToken(token, secret)) return res.status(401).json({ authenticated: false });
  return res.json({ authenticated: true });
}
