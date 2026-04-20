/**
 * Player Authentication — The Engine
 *
 * HMAC-signed session cookies (same pattern as admin auth),
 * scrypt password hashing, Grudge ID generation, and Express middleware.
 */

import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export const LAUNCH_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes — good for a popup handoff

function launchTokenSecret(): string {
  // JWT_SECRET is the portable cross-service signing key. Fall back to the
  // player-session secret so we never silently sign with empty string.
  return (
    process.env.JWT_SECRET ||
    process.env.LAUNCH_TOKEN_SECRET ||
    getSessionSecret()
  );
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

export interface LaunchTokenClaims {
  sub: number;            // user id
  username: string;
  grudgeId: string;
  aud?: string;           // optional audience (origin that's allowed to consume)
  iat: number;
  exp: number;
}

/** Mint a short-lived HS256 JWT for cross-domain handoff. */
export function createLaunchToken(user: Pick<User, "id" | "username" | "grudgeId">, audience?: string): string {
  const secret = launchTokenSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload: LaunchTokenClaims = {
    sub: user.id,
    username: user.username,
    grudgeId: user.grudgeId,
    aud: audience,
    iat: now,
    exp: now + Math.floor(LAUNCH_TOKEN_TTL_MS / 1000),
  };
  const head = b64url(JSON.stringify(header));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

export function verifyLaunchToken(token: string): LaunchTokenClaims | null {
  try {
    const secret = launchTokenSecret();
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [head, body, sig] = parts;
    const expected = b64url(createHmac("sha256", secret).update(`${head}.${body}`).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const claims = JSON.parse(b64urlDecode(body).toString("utf8")) as LaunchTokenClaims;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Origins allowed to host the modal / consume launch tokens. Defaults to CORS_ORIGINS. */
export function allowedAuthOrigins(): string[] {
  const source = process.env.AUTH_ALLOWED_ORIGINS || process.env.CORS_ORIGINS || "";
  return source
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | undefined | null): boolean {
  if (!origin) return false;
  const list = allowedAuthOrigins();
  if (list.length === 0) return false;
  return list.includes(origin);
}

// ── Constants ────────────────────────────────────────────────────
export const PLAYER_COOKIE = "gs_player_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSessionSecret(): string {
  // Prefer the dedicated player secret; fall back to the shared SESSION_SECRET
  // (what the live .env uses) and finally to ADMIN_SESSION_SECRET for legacy setups.
  return (
    process.env.PLAYER_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    ""
  );
}

// ── Grudge ID ────────────────────────────────────────────────────
export function generateGrudgeId(): string {
  return `GRUDGE-${randomUUID()}`;
}

// ── Password hashing (scrypt) ────────────────────────────────────
const SALT_LEN = 16;
const KEY_LEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN).toString("hex");
  const hash = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(plain, salt, KEY_LEN).toString("hex");
  const a = Buffer.from(hash, "utf8");
  const b = Buffer.from(derived, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Session tokens ───────────────────────────────────────────────
export function createPlayerToken(userId: number): string {
  const secret = getSessionSecret();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}.${randomBytes(8).toString("hex")}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyPlayerToken(token: string): number | null {
  const secret = getSessionSecret();
  const parts = token.split(".");
  if (parts.length < 4) return null;

  const sig = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(".");

  // Verify expiry
  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  // Verify signature
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  // Extract userId
  const userId = Number(parts[0]);
  return Number.isFinite(userId) ? userId : null;
}

// ── Cookie helpers ───────────────────────────────────────────────
export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, seg) => {
    const [k, ...v] = seg.trim().split("=");
    if (k && v.length) acc[k] = decodeURIComponent(v.join("="));
    return acc;
  }, {});
}

function baseCookieParts(value: string, includeExpiry: boolean) {
  const isSecure = process.env.NODE_ENV === "production";
  const cookieDomain = process.env.PLAYER_COOKIE_DOMAIN || (isSecure ? ".grudge-studio.com" : "");
  const parts = [
    `${PLAYER_COOKIE}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
  ];
  if (includeExpiry) parts.push(`Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  else parts.push("Max-Age=0");
  if (cookieDomain) parts.push(`Domain=${cookieDomain}`);
  if (isSecure) parts.push("Secure");
  return parts;
}

function mergeSetCookieHeader(res: Response, next: string) {
  const existing = res.getHeader("Set-Cookie");
  const list = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
  res.setHeader("Set-Cookie", [next, ...list]);
}

export function setPlayerCookie(res: Response, token: string): void {
  mergeSetCookieHeader(res, baseCookieParts(encodeURIComponent(token), true).join("; "));
}

export function clearPlayerCookie(res: Response): void {
  mergeSetCookieHeader(res, baseCookieParts("", false).join("; "));
}

// ── Middleware ────────────────────────────────────────────────────

/** Attaches req.player if a valid session exists (non-blocking). */
export async function loadPlayer(req: Request, _res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[PLAYER_COOKIE];
  if (token) {
    const userId = verifyPlayerToken(token);
    if (userId !== null) {
      const user = await storage.getUser(userId);
      if (user) {
        (req as any).player = user;
      }
    }
  }
  next();
}

/** Requires a valid player session — returns 401 otherwise. */
export function requirePlayer(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).player) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

/** Helper to read current player from request. */
export function getPlayer(req: Request): User | undefined {
  return (req as any).player;
}
