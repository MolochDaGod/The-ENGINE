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
