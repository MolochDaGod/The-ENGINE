/**
 * Canonical API + Web3 client config for the Vercel portal.
 * Session cookies are scoped to .grudge-studio.com — same-origin /api/* on
 * grudge-studio.com is preferred; cross-subdomain calls use api.grudge-studio.com.
 */

export const PORTAL_ORIGIN =
  import.meta.env.VITE_PORTAL_ORIGIN || "https://grudge-studio.com";

export const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN || "";

/** Same-origin relative path when on portal; absolute api host when embedded elsewhere. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "grudge-studio.com" || host === "www.grudge-studio.com" || host.endsWith(".vercel.app")) {
      return p;
    }
  }
  if (API_ORIGIN) return `${API_ORIGIN.replace(/\/$/, "")}${p}`;
  return `https://api.grudge-studio.com${p}`;
}

export const SOLANA_NETWORK =
  (import.meta.env.VITE_SOLANA_NETWORK || "mainnet-beta") as "mainnet-beta" | "devnet" | "testnet";

export function solanaExplorerAccountUrl(address: string): string {
  const cluster = SOLANA_NETWORK === "mainnet-beta" ? "" : `?cluster=${SOLANA_NETWORK}`;
  return `https://solscan.io/account/${address}${cluster}`;
}

export const WS_URL = import.meta.env.VITE_WS_URL || "https://ws.grudge-studio.com";