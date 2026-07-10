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

export function assetUrl(path: string): string {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${ASSETS_ORIGIN.replace(/\/$/, "")}${p}`;
}

export const SOLANA_NETWORK =
  (import.meta.env.VITE_SOLANA_NETWORK || "mainnet-beta") as "mainnet-beta" | "devnet" | "testnet";

export function solanaExplorerAccountUrl(address: string): string {
  const cluster = SOLANA_NETWORK === "mainnet-beta" ? "" : `?cluster=${SOLANA_NETWORK}`;
  return `https://solscan.io/account/${address}${cluster}`;
}

export const WS_URL = import.meta.env.VITE_WS_URL || "https://ws.grudge-studio.com";