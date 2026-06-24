const ADMIN_ROLES = ['admin', 'master_admin', 'master'] as const;

/**
 * Check admin access via the player's Grudge ID role.
 * Falls back to the legacy admin session cookie for backward compat.
 */
export async function checkAdminSession(): Promise<boolean> {
  // 1. Preferred: check player role from Grudge ID auth
  try {
    const meRes = await fetch("/api/auth/me", { credentials: "include" });
    if (meRes.ok) {
      const player = await meRes.json();
      if (player?.role && ADMIN_ROLES.includes(player.role)) {
        return true;
      }
    }
  } catch {
    // fall through
  }

  // 2. Fallback: legacy admin passcode cookie
  try {
    const response = await fetch("/api/portal-admin/session", {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) return false;
    const json = await response.json();
    return Boolean(json?.authenticated);
  } catch {
    return false;
  }
}

/** Legacy passcode login — kept for backward compat */
export async function loginAdmin(passcode: string) {
  try {
    const response = await fetch("/api/portal-admin/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (!response.ok) return false;
    const json = await response.json();
    return Boolean(json?.authenticated);
  } catch {
    return false;
  }
}

export async function logoutAdmin() {
  try {
    await fetch("/api/portal-admin/logout", { method: "POST", credentials: "include" });
  } catch {
    // ignore
  }
}
