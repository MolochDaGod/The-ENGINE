/**
 * Gruda / Crossmint game wallet via Railway 0d46.
 * Check status first. Create only when the account has none.
 * Not a second bag DB — player SSOT stays on 0d46 /api/wallet/*.
 */
import type { Request } from "express";
import { parseCookies } from "./auth";

const GAME_DATA =
  process.env.GRUDGE_GAME_DATA_URL ||
  process.env.GAME_DATA_ORIGIN ||
  "https://grudge-api-production-0d46.up.railway.app";

const TRADER_ORIGIN = process.env.TRADER_ORIGIN || "https://trader.grudge-studio.com";
const WALLET_SITE = process.env.WALLET_SITE_ORIGIN || "https://wallet.grudge-studio.com";

function peekJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export function getFleetBearer(req: Request): string | null {
  if ((req as any).fleetBearer) return (req as any).fleetBearer;
  const cookies = parseCookies(req.headers.cookie);
  const candidates: string[] = [];
  for (const k of ["sso_token", "grudge_auth_token", "grudge_session_token", "grudge_token"]) {
    if (cookies[k]) candidates.push(cookies[k]);
  }
  const auth = req.headers.authorization || req.headers.Authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    candidates.push(auth.slice(7).trim());
  }
  const x = req.headers["x-grudge-token"];
  if (typeof x === "string" && x.trim()) candidates.push(x.trim());

  for (const t of candidates) {
    const p = peekJwt(t);
    if (!p) continue;
    if (p.isGuest === true || p.guest === true) continue;
    if (p.grudgeId || p.grudge_id) {
      (req as any).fleetBearer = t;
      return t;
    }
  }
  return null;
}

async function gameData(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const r = await fetch(`${GAME_DATA.replace(/\/$/, "")}${path}`, { ...init, headers });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

export async function fetchGrudaWalletStatus(token: string) {
  return gameData("/api/wallet/status", token);
}

export async function ensureGrudaWallet(token: string, email?: string) {
  const st = await fetchGrudaWalletStatus(token);
  if (!st.ok) return { ok: false, status: st.status, error: st.body?.error || "wallet_status_failed", body: st.body };
  const addr = st.body?.walletAddress;
  if (st.body?.hasWallet && addr) {
    return {
      ok: true,
      existed: true,
      walletAddress: addr,
      walletType: st.body.walletType || "crossmint",
      grudgeId: st.body.grudgeId || null,
      gbuxBalance: st.body.gbuxBalance ?? 0,
      message: "Wallet already exists",
    };
  }
  if (!email) return { ok: false, status: 400, error: "email_required_to_create" };
  const created = await gameData("/api/wallet/create", token, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!created.ok) {
    return { ok: false, status: created.status, error: created.body?.error || "wallet_create_failed", body: created.body };
  }
  return {
    ok: true,
    existed: false,
    walletAddress: created.body.walletAddress,
    walletType: created.body.walletType || "crossmint",
    grudgeId: st.body?.grudgeId || null,
    gbuxBalance: st.body?.gbuxBalance ?? 0,
    message: created.body.message || "Wallet created",
  };
}

export function grudaLinks() {
  return {
    trader: TRADER_ORIGIN,
    walletSite: WALLET_SITE,
    fee: { baseSol: 0.005, tpBps: 500, remainder: "stays_in_trading_wallet" },
  };
}
