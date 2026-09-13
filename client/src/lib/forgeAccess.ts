/**
 * Forge paid-access gate helpers for The Engine portal.
 */
import { buildForgeLaunchUrl, hasForgePaidAccess, type ForgeAccessPlayer } from "@/lib/canonicalDomains";

const TOKEN_KEYS = ["grudge_auth_token", "grudge_session_token", "grudge_token"];

export function readAuthToken(): string | null {
  try {
    for (const k of TOKEN_KEYS) {
      const v = localStorage.getItem(k);
      if (v) return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type ForgeGateResult =
  | { ok: true; launchUrl: string }
  | { ok: false; reason: "auth" | "paid"; message: string };

export function evaluateForgeAccess(player: ForgeAccessPlayer | null): ForgeGateResult {
  if (!player) {
    return {
      ok: false,
      reason: "auth",
      message: "Sign in with Grudge ID to open Studio Forge.",
    };
  }
  if (!hasForgePaidAccess(player)) {
    return {
      ok: false,
      reason: "paid",
      message:
        "Studio Forge requires a paid / premium Grudge account (or admin). Visit the Store to upgrade, or contact support.",
    };
  }
  return {
    ok: true,
    launchUrl: buildForgeLaunchUrl({
      token: readAuthToken(),
      grudgeId: player.grudgeId ?? (player.id != null ? String(player.id) : null),
      returnTo: typeof window !== "undefined" ? window.location.origin : null,
    }),
  };
}
