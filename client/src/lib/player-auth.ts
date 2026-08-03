/**
 * Player Auth — client API helpers
 */

export interface PlayerProfile {
  id: number;
  username: string;
  grudgeId: string;
  puterId?: string | null;
  email?: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  gbuxBalance: string;
  role: string;
  solanaAddress?: string | null;
  discordId?: string | null;
  githubId?: string | null;
  googleId?: string | null;
  phone?: string | null;
  needsProfile?: boolean;
  createdAt?: string;
  isNew?: boolean;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function fetchMe(): Promise<PlayerProfile | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function registerPlayer(data: {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
}): Promise<{ ok: true; player: PlayerProfile } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "Registration failed" };
    return { ok: true, player: json };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function loginPlayer(data: {
  username: string;
  password: string;
}): Promise<{ ok: true; player: PlayerProfile } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "Login failed" };
    return { ok: true, player: json };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function logoutPlayer(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    // ignore
  }
}

export async function puterSSO(data: {
  puterId: string;
  puterUsername?: string;
  email?: string;
}): Promise<{ ok: true; player: PlayerProfile } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/puter-sso", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "SSO failed" };
    return { ok: true, player: json };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function guestSignIn(): Promise<{ ok: true; player: PlayerProfile } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/guest", { method: "POST", credentials: "include", headers: JSON_HEADERS });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "Guest sign-in failed" };
    return { ok: true, player: json };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function completeProfile(data: {
  username?: string;
  displayName?: string;
  email?: string;
}): Promise<{ ok: true; player: PlayerProfile } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/complete-profile", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "Failed to update profile" };
    return { ok: true, player: json };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/**
 * Solana wallet sign-in (multi-wallet).
 *
 * Does NOT use Phantom Auth2 /login/start (that 400s without a valid portal app).
 * Uses injected extensions only: Phantom, Solflare, Backpack, Glow, etc.
 *
 * Flow:
 *   1. connect injected wallet → address
 *   2. POST /api/auth/solana/nonce (alias of phantom/nonce)
 *   3. wallet.signMessage(nonce message)
 *   4. POST /api/auth/solana/verify → session cookie + optional link to existing account
 *
 * `provider` arg kept for API compat: "auto" | "phantom" | "injected" | wallet id.
 * "google" | "apple" | "deeplink" Auth2 paths are disabled (return clear error).
 */
export async function phantomSignIn(
  provider:
    | "google"
    | "apple"
    | "phantom"
    | "injected"
    | "deeplink"
    | "auto"
    | "solflare"
    | "backpack"
    | "glow"
    | "coinbase"
    | "exodus"
    | "nightly"
    | "trust" = "auto",
): Promise<{ ok: true; player: PlayerProfile } | { ok: false; error: string }> {
  // Auth2 embedded paths are broken without Phantom Portal app allowlist — do not call them.
  if (provider === "google" || provider === "apple" || provider === "deeplink") {
    return {
      ok: false,
      error:
        "Embedded Phantom Auth2 is disabled. Use a browser Solana wallet (Phantom, Solflare, Backpack, Glow, …).",
    };
  }

  try {
    const { pickDefaultWallet, connectSolanaWallet, signSolanaMessage } = await import(
      "./solana-wallets"
    );

    let walletId: import("./solana-wallets").SolanaWalletId;
    if (provider === "auto") {
      const picked = pickDefaultWallet();
      if (!picked) {
        return {
          ok: false,
          error:
            "No Solana wallet extension found. Install Phantom, Solflare, Backpack, or Glow, then refresh.",
        };
      }
      walletId = picked;
    } else if (provider === "injected") {
      walletId = pickDefaultWallet() || "injected";
    } else {
      walletId = provider as import("./solana-wallets").SolanaWalletId;
    }

    const { address, wallet, provider: inj } = await connectSolanaWallet(walletId);
    if (!address) return { ok: false, error: "Could not read wallet address." };

    // Prefer solana/* routes; fall back to legacy phantom/* paths
    const nonceRes = await fetch("/api/auth/solana/nonce", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify({ address, wallet }),
    }).catch(() => null);

    let nonceJson: any;
    if (nonceRes && nonceRes.ok) {
      nonceJson = await nonceRes.json();
    } else {
      const legacy = await fetch("/api/auth/phantom/nonce", {
        method: "POST",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify({ address }),
      });
      nonceJson = await legacy.json();
      if (!legacy.ok) return { ok: false, error: nonceJson.error || "Nonce request failed" };
    }

    const signatureB58 = await signSolanaMessage(inj, nonceJson.message);

    const verifyBody = {
      address,
      nonce: nonceJson.nonce,
      signature: signatureB58,
      wallet,
    };

    let verifyRes = await fetch("/api/auth/solana/verify", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify(verifyBody),
    }).catch(() => null);

    if (!verifyRes || !verifyRes.ok) {
      verifyRes = await fetch("/api/auth/phantom/verify", {
        method: "POST",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify(verifyBody),
      });
    }

    const verifyJson = await verifyRes.json();
    if (!verifyRes.ok) {
      return { ok: false, error: verifyJson.error || "Wallet verification failed" };
    }
    return { ok: true, player: verifyJson };
  } catch (err: any) {
    const msg = String(err?.message || err || "Wallet sign-in failed");
    // Surface Auth2 failures with a clear fix message
    if (/Auth2|login\/start|400|Bad Request/i.test(msg)) {
      return {
        ok: false,
        error:
          "Phantom Auth2 failed (misconfigured app). Use an installed Solana extension wallet instead of embedded login.",
      };
    }
    return { ok: false, error: msg };
  }
}

/** Alias — multi-wallet Solana login (same as phantomSignIn). */
export const solanaWalletSignIn = phantomSignIn;

export function discordSignIn(redirectTo: string = "/") {
  const url = `/api/auth/discord/start?redirect=${encodeURIComponent(redirectTo)}`;
  window.location.href = url;
}

export function githubSignIn(redirectTo: string = "/") {
  const url = `/api/auth/github/start?redirect=${encodeURIComponent(redirectTo)}`;
  window.location.href = url;
}

export function googleSignIn(redirectTo: string = "/") {
  const url = `/api/auth/google/start?redirect=${encodeURIComponent(redirectTo)}`;
  window.location.href = url;
}

// ── Cross-domain popup handoff ─────────────────────────────────

export interface PopupTokenResponse {
  token: string;
  expiresIn: number;
  audience: string | null;
}

/** Ask the server to mint a 5-minute JWT for a specific audience origin. */
export async function requestPopupToken(audience?: string): Promise<{ ok: true; data: PopupTokenResponse } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/popup-token", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify({ audience }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "Failed to mint launch token" };
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/**
 * Call from an allowlisted external frontend (e.g. grudgewarlords.com) to
 * sign the user in through the Grudge Studio modal in a popup and receive
 * a short-lived JWT + PlayerProfile back via postMessage. Use the JWT with
 * /api/auth/session/exchange on your own backend to establish a session.
 */
const TRUSTED_AUTH_HOSTS = new Set([
  "https://id.grudge-studio.com",
  "https://grudge-studio.com",
  "https://grudgewarlords.com",
]);

function isTrustedAuthOrigin(origin: string, authHost: string): boolean {
  if (TRUSTED_AUTH_HOSTS.has(origin) || origin === authHost) return true;
  return /^https:\/\/([a-z0-9-]+\.)*grudge-studio\.com$/.test(origin);
}

function parsePopupAuthMessage(data: unknown): { token: string; player: PlayerProfile } | null {
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;
  if (typeof msg.token !== "string") return null;
  if (msg.type === "grudge-auth:success") {
    const player = (msg.user || msg.player) as PlayerProfile | undefined;
    return player ? { token: msg.token, player } : null;
  }
  if (msg.type === "grudge:auth:success" && msg.player) {
    return { token: msg.token, player: msg.player as PlayerProfile };
  }
  return null;
}

export function openAuthPopup(options: {
  authHost?: string;              // canonical: https://id.grudge-studio.com
  audience?: string;              // origin of the caller (defaults to window.location.origin)
  redirect?: string;              // optional full redirect URL after sign-in (non-popup fallback)
  width?: number;
  height?: number;
} = {}): Promise<{ token: string; player: PlayerProfile }> {
  const authHost = (options.authHost || "https://id.grudge-studio.com").replace(/\/$/, "");
  const audience = options.audience || window.location.origin;
  const width = options.width || 440;
  const height = options.height || 720;
  const left = (window.screenX || 0) + ((window.outerWidth - width) / 2);
  const top = (window.screenY || 0) + ((window.outerHeight - height) / 2);

  const params = new URLSearchParams({ origin: audience });
  if (options.redirect) params.set("redirect", options.redirect);

  return new Promise((resolve, reject) => {
    const popup = window.open(
      `${authHost}/api/auth/page?${params.toString()}`,
      "grudge-auth",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`,
    );
    if (!popup) return reject(new Error("Popup blocked — allow popups or use redirect sign-in"));

    const sendInit = () => {
      try { popup.postMessage({ type: "grudge-auth:init", origin: audience }, authHost); } catch { /* ignore */ }
    };

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedAuthOrigin(event.origin, authHost)) return;
      const data = event.data;
      if (data?.type === "grudge-auth:ready") {
        sendInit();
        return;
      }
      if (data?.type === "grudge:auth:error") {
        cleanup();
        reject(new Error(data.error || "Authentication failed"));
        return;
      }
      if (data?.type === "grudge:auth:cancel") {
        cleanup();
        reject(new Error("Authentication cancelled"));
        return;
      }
      const parsed = parsePopupAuthMessage(data);
      if (parsed) {
        cleanup();
        resolve(parsed);
      }
    };

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (popup && !popup.closed) popup.close();
      clearInterval(poll);
      clearInterval(initRetry);
    };

    const poll = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Popup closed before authentication finished"));
      }
    }, 500);

    const initRetry = setInterval(sendInit, 400);
    setTimeout(() => clearInterval(initRetry), 4000);

    window.addEventListener("message", onMessage);
    sendInit();
  });
}

/** Exchange a launch JWT for a real session cookie on the current origin. */
export async function exchangeLaunchToken(token: string): Promise<{ ok: true; player: PlayerProfile } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/session/exchange", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify({ token, audience: window.location.origin }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "Exchange failed" };
    return { ok: true, player: json };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function twilioStart(phone: string): Promise<{ ok: true; status: string; dev?: boolean } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/twilio/start", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify({ phone }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "Failed to send code" };
    return { ok: true, status: json.status, dev: json.status === "dev" };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function twilioVerify(phone: string, code: string): Promise<{ ok: true; player: PlayerProfile } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/twilio/verify", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify({ phone, code }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "Code verification failed" };
    return { ok: true, player: json };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/** Unlink a provider from the current account. */
export async function unlinkProvider(provider: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/auth/link/${encodeURIComponent(provider)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "Unlink failed" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

