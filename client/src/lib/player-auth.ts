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
  gbuxBalance: string;
  role: string;
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

export async function phantomSignIn(): Promise<{ ok: true; player: PlayerProfile } | { ok: false; error: string }> {
  try {
    const solana = (window as any).solana;
    if (!solana?.isPhantom) return { ok: false, error: "Phantom wallet not detected. Install it from phantom.app." };
    const resp = await solana.connect({ onlyIfTrusted: false });
    const address = resp?.publicKey?.toString?.() || resp?.publicKey?.toBase58?.() || solana.publicKey?.toString();
    if (!address) return { ok: false, error: "Could not read wallet address." };

    const nonceRes = await fetch("/api/auth/phantom/nonce", {
      method: "POST",
      credentials: "include",
      headers: JSON_HEADERS,
      body: JSON.stringify({ address }),
    });
    const nonceJson = await nonceRes.json();
    if (!nonceRes.ok) return { ok: false, error: nonceJson.error || "Nonce request failed" };

    const encoded = new TextEncoder().encode(nonceJson.message);
    const signed = await solana.signMessage(encoded, "utf8");
    const sigBytes: Uint8Array = signed?.signature || signed; // Phantom returns { signature, publicKey }
    // base58 encode without shipping bs58 to client: use minimal inline encoder
    const signatureB58 = base58Encode(sigBytes);

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
    return { ok: false, error: err?.message || "Wallet sign-in failed" };
  }
}

export function discordSignIn(redirectTo: string = "/") {
  const url = `/api/auth/discord/start?redirect=${encodeURIComponent(redirectTo)}`;
  window.location.href = url;
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

// Minimal base58 encoder (Bitcoin alphabet) for Phantom signature bytes.
const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) result += B58_ALPHABET[digits[i]];
  return result;
}
