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
 * Phantom wallet sign-in — uses the Phantom Browser SDK (Connect).
 * Supports: Google/Apple social login (embedded wallet), Phantom Login,
 * browser extension (injected), and mobile deep link.
 *
 * Flow:
 *   1. SDK connect() → get Solana address
 *   2. Server issues nonce for that address
 *   3. SDK signs the nonce message
 *   4. Server verifies signature → creates/finds user → sets cookie
 *
 * When called without a provider argument the function tries "injected"
 * (browser extension) first and automatically falls back to "google"
 * (Phantom embedded wallet) if the extension is not available.
 */
export async function phantomSignIn(
  provider: "google" | "apple" | "phantom" | "injected" | "deeplink" | "auto" = "auto",
): Promise<{ ok: true; player: PlayerProfile } | { ok: false; error: string }> {
  // Resolve "auto": prefer the browser extension, fall back to Google embedded wallet.
  if (provider === "auto") {
    try {
      const { isPhantomExtensionInstalled } = await import("./phantom-sdk");
      const hasExtension = await isPhantomExtensionInstalled();
      provider = hasExtension ? "injected" : "google";
    } catch {
      provider = "injected";
    }
  }

  return _phantomSignInWithProvider(provider as "google" | "apple" | "phantom" | "injected" | "deeplink");
}

async function _phantomSignInWithProvider(
  provider: "google" | "apple" | "phantom" | "injected" | "deeplink",
): Promise<{ ok: true; player: PlayerProfile } | { ok: false; error: string }> {
  try {
    // Dynamic import to avoid bundling the SDK when not needed
    const { connectPhantom, signMessage: phantomSignMessage } = await import("./phantom-sdk");

    // Step 1: Connect via chosen provider
    const { address } = await connectPhantom(provider);
    if (!address) return { ok: false, error: "Could not read wallet address." };

    // Step 2: Request nonce from server
    const nonceRes = await fetch("/api/auth/phantom/nonce", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify({ address }),
    });
    const nonceJson = await nonceRes.json();
    if (!nonceRes.ok) return { ok: false, error: nonceJson.error || "Nonce request failed" };

    // Step 3: Sign the nonce message via Phantom SDK
    const signatureB58 = await phantomSignMessage(nonceJson.message);

    // Step 4: Verify on server → get session cookie
    const verifyRes = await fetch("/api/auth/phantom/verify", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify({ address, nonce: nonceJson.nonce, signature: signatureB58 }),
    });
    const verifyJson = await verifyRes.json();
    if (!verifyRes.ok) return { ok: false, error: verifyJson.error || "Wallet verification failed" };
    return { ok: true, player: verifyJson };
  } catch (err: any) {
    // If the injected provider failed, try the Google embedded wallet as a last resort.
    if (provider === "injected") {
      try {
        return await _phantomSignInWithProvider("google");
      } catch {
        // fall through to the error below
      }
    }
    return { ok: false, error: err?.message || "Wallet sign-in failed" };
  }
}

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
export function openAuthPopup(options: {
  authHost?: string;              // e.g. https://grudge-studio.com
  audience?: string;              // origin of the caller (defaults to window.location.origin)
  width?: number;
  height?: number;
} = {}): Promise<{ token: string; player: PlayerProfile }> {
  const authHost = (options.authHost || "https://grudgewarlords.com").replace(/\/$/, "");
  const audience = options.audience || window.location.origin;
  const width = options.width || 420;
  const height = options.height || 640;
  const left = (window.screenX || 0) + ((window.outerWidth - width) / 2);
  const top = (window.screenY || 0) + ((window.outerHeight - height) / 2);

  return new Promise((resolve, reject) => {
    const popup = window.open(
      `${authHost}/auth/popup?audience=${encodeURIComponent(audience)}`,
      "grudge-auth",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`,
    );
    if (!popup) return reject(new Error("Popup blocked"));

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== authHost) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "grudge:auth:success" && data.token && data.player) {
        cleanup();
        resolve({ token: data.token, player: data.player });
      } else if (data.type === "grudge:auth:error") {
        cleanup();
        reject(new Error(data.error || "Authentication failed"));
      } else if (data.type === "grudge:auth:cancel") {
        cleanup();
        reject(new Error("Authentication cancelled"));
      }
    };

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (popup && !popup.closed) popup.close();
      clearInterval(poll);
    };

    const poll = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Popup closed before authentication finished"));
      }
    }, 500);

    window.addEventListener("message", onMessage);
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

