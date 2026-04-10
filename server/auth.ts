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

// ── Constants ────────────────────────────────────────────────────
export const PLAYER_COOKIE = "gs_player_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSessionSecret(): string {
  return process.env.PLAYER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "";
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

export function setPlayerCookie(res: Response, token: string): void {
  const isSecure = process.env.NODE_ENV === "production";
  const parts = [
    `${PLAYER_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isSecure) parts.push("Secure");
  res.setHeader("Set-Cookie", [
    parts.join("; "),
    // Preserve any existing admin cookie
    ...(Array.isArray(res.getHeader("Set-Cookie"))
      ? (res.getHeader("Set-Cookie") as string[])
      : res.getHeader("Set-Cookie")
        ? [res.getHeader("Set-Cookie") as string]
        : []),
  ]);
}

export function clearPlayerCookie(res: Response): void {
  const isSecure = process.env.NODE_ENV === "production";
  const parts = [
    `${PLAYER_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isSecure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
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
