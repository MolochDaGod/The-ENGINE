/**
 * Canonical Grudge API base URL with live fallback.
 *
 * api.grudge-studio.com DNS may still CNAME to a decommissioned Railway app;
 * games and tools should prefer grudge-studio.com/api (Vercel proxy) or Railway direct.
 */

const RAILWAY_CANONICAL = "https://the-engine.up.railway.app";
const PORTAL_PROXY = "https://grudge-studio.com/api";
const LEGACY_API_HOST = "https://api.grudge-studio.com";

let cachedBase: string | null = null;

export function getGrudgeApiBase(): string {
  if (cachedBase) return cachedBase;
  if (typeof window === "undefined") return PORTAL_PROXY;

  const host = window.location.hostname;
  if (host === "grudge-studio.com" || host === "www.grudge-studio.com") {
    return "/api";
  }
  if (host.endsWith(".grudge-studio.com")) {
    return PORTAL_PROXY;
  }
  return LEGACY_API_HOST;
}

/** Probe endpoints and cache the first healthy base (portal proxy → Railway). */
export async function resolveGrudgeApiBase(): Promise<string> {
  const candidates = [PORTAL_PROXY, `${RAILWAY_CANONICAL}/api`, LEGACY_API_HOST];
  for (const base of candidates) {
    try {
      const url = base.endsWith("/api") ? `${base}/health` : `${base}/api/health`;
      const r = await fetch(url, { method: "GET", signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        cachedBase = base.endsWith("/api") ? base : `${base}/api`;
        if (base === LEGACY_API_HOST) cachedBase = LEGACY_API_HOST;
        if (base === PORTAL_PROXY) cachedBase = PORTAL_PROXY;
        if (base.startsWith(RAILWAY_CANONICAL)) cachedBase = `${RAILWAY_CANONICAL}/api`;
        return cachedBase;
      }
    } catch {
      /* try next */
    }
  }
  cachedBase = PORTAL_PROXY;
  return cachedBase;
}

export { RAILWAY_CANONICAL, PORTAL_PROXY, LEGACY_API_HOST };