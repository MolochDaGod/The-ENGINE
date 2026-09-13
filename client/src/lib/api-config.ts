/**
 * Canonical API + Web3 client config for the Vercel portal.
 * Session cookies are scoped to .grudge-studio.com — same-origin /api/* on
 * grudge-studio.com is preferred (Vercel rewrites → Railway).
 *
 * NEVER use api.grudge-studio.com for game data — it redirects to portal HTML.
 */

export const PORTAL_ORIGIN =
  import.meta.env.VITE_PORTAL_ORIGIN || "https://grudge-studio.com";

/** Railway game-data SSOT (characters, wallet, islands). */
export const GAME_DATA_ORIGIN =
  import.meta.env.VITE_GAME_DATA_ORIGIN ||
  "https://grudge-api-production-0d46.up.railway.app";

export const OBJECTSTORE_ORIGIN =
  import.meta.env.VITE_OBJECTSTORE_ORIGIN || "https://objectstore.grudge-studio.com";

export const ASSETS_ORIGIN =
  import.meta.env.VITE_ASSETS_ORIGIN || "https://assets.grudge-studio.com";

/** @deprecated prefer GAME_DATA_ORIGIN */
export const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN || GAME_DATA_ORIGIN;

/** Same-origin relative path when on portal; absolute Railway host when embedded elsewhere. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (
      host === "grudge-studio.com" ||
      host === "www.grudge-studio.com" ||
      host.endsWith(".vercel.app")
    ) {
      return p;
    }
  }
  if (API_ORIGIN) return `${API_ORIGIN.replace(/\/$/, "")}${p}`;
  return `${GAME_DATA_ORIGIN.replace(/\/$/, "")}${p}`;
}

export function objectStoreUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${OBJECTSTORE_ORIGIN.replace(/\/$/, "")}${p}`;
}

/** Hosts that should load R2 assets via same-origin /api/assets proxy (avoids CDN CORS). */
function useAssetProxy(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "grudge-studio.com" ||
    host === "www.grudge-studio.com" ||
    host.endsWith(".grudge-studio.com") ||
    host.endsWith(".vercel.app")
  );
}

function toAssetProxyPath(pathOrUrl: string): string {
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `/api/assets${p}`;
}

/**
 * Resolve CDN asset paths.
 * Prefer **absolute assets.grudge-studio.com** (CORS *). Same-origin `/api/assets`
 * proxy is available as fallback for environments that block cross-origin GLB.
 *
 * Never use assets.grudge.studio (dead 522) — only assets.grudge-studio.com.
 */
export function assetUrl(path: string, opts?: { preferProxy?: boolean }): string {
  if (!path) return "";
  if (/^(data:|blob:)/i.test(path)) return path;

  // Normalize legacy dead host
  const fixed = path.replace(
    /^https?:\/\/assets\.grudge\.studio(?=\/|$)/i,
    ASSETS_ORIGIN.replace(/\/$/, ""),
  );

  if (/^https?:/i.test(fixed)) {
    if (opts?.preferProxy && useAssetProxy()) {
      try {
        const u = new URL(fixed);
        if (
          u.hostname === "assets.grudge-studio.com" ||
          u.hostname === "assets.grudge.studio"
        ) {
          return toAssetProxyPath(`${u.pathname}${u.search}`);
        }
      } catch {
        /* keep original */
      }
    }
    return fixed;
  }

  const p = fixed.startsWith("/") ? fixed : `/${fixed}`;
  // Default: absolute CDN (works for img + fetch with CORS *)
  return `${ASSETS_ORIGIN.replace(/\/$/, "")}${p}`;
}

/** Absolute CDN URL only (icons / portraits — never go through broken proxies). */
export function cdnAssetUrl(path: string): string {
  if (!path) return "";
  if (/^(data:|blob:|https?:)/i.test(path)) {
    return path.replace(
      /^https?:\/\/assets\.grudge\.studio(?=\/|$)/i,
      ASSETS_ORIGIN.replace(/\/$/, ""),
    );
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${ASSETS_ORIGIN.replace(/\/$/, "")}${p}`;
}

export const SOLANA_NETWORK =
  (import.meta.env.VITE_SOLANA_NETWORK || "mainnet-beta") as "mainnet-beta" | "devnet" | "testnet";

export function solanaExplorerAccountUrl(address: string): string {
  const cluster = SOLANA_NETWORK === "mainnet-beta" ? "" : `?cluster=${SOLANA_NETWORK}`;
  return `https://solscan.io/account/${address}${cluster}`;
}

/**
 * WebSocket origin for Treaty Chat + engine presence.
 * Must hit the process that runs `WebSocketServer({ path: "/ws/chat" })` (The-ENGINE / Railway).
 * Do NOT default to ws.grudge-studio.com — that host does not run /ws/chat.
 *
 * Priority: VITE_WS_URL → VITE_ENGINE_WS_ORIGIN → Railway ENGINE host.
 */
export const ENGINE_WS_ORIGIN =
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_ENGINE_WS_ORIGIN ||
  "https://the-engine.up.railway.app";

/** Engine Socket.IO + legacy alias — same origin as chat WS (Railway process). */
export const WS_URL = ENGINE_WS_ORIGIN;