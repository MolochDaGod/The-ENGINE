/**
 * @deprecated Prefer `@/lib/solana-wallets` + `phantomSignIn()` / `solanaWalletSignIn()`.
 *
 * Phantom BrowserSDK Auth2 (`/login/start`) returns 400 when the portal appId /
 * redirect URL is not allowlisted. Production login uses **injected multi-wallet**
 * only (Phantom, Solflare, Backpack, Glow, …) — no Auth2.
 *
 * This module is kept for optional experimental embedded flows and must not
 * be used as the default sign-in path.
 */

import { BrowserSDK, AddressType, waitForPhantomExtension } from "@phantom/browser-sdk";
import bs58 from "bs58";

const PHANTOM_APP_ID =
  import.meta.env.VITE_PHANTOM_APP_ID || "656b4ef2-7acc-44fe-bec7-4b288cfdd2e9";

function getRedirectUrl(): string {
  if (typeof window === "undefined") return "https://grudge-studio.com/auth/callback";
  return `${window.location.origin}/auth/callback`;
}

let _sdk: BrowserSDK | null = null;

/**
 * Injected-only SDK (no google/apple/phantom Auth2 providers).
 * Still may fail if @phantom/browser-sdk misbehaves — use solana-wallets.ts instead.
 */
export function getPhantomSDK(): BrowserSDK {
  if (_sdk) return _sdk;

  _sdk = new BrowserSDK({
    // CRITICAL: only "injected" — avoid Auth2 /login/start 400s
    providers: ["injected"],
    addressTypes: [AddressType.solana],
    appId: PHANTOM_APP_ID,
    authOptions: {
      redirectUrl: getRedirectUrl(),
    },
  });

  return _sdk;
}

export async function isPhantomExtensionInstalled(): Promise<boolean> {
  try {
    return await waitForPhantomExtension(3000);
  } catch {
    return false;
  }
}

export async function connectPhantom(
  provider: "injected" = "injected",
): Promise<{ address: string; addresses: Array<{ address: string; addressType: string }> }> {
  // Prefer native multi-wallet path
  const { connectSolanaWallet, pickDefaultWallet } = await import("./solana-wallets");
  const id = pickDefaultWallet() || "injected";
  const { address } = await connectSolanaWallet(id);
  return { address, addresses: [{ address, addressType: "solana" }] };
}

export async function signMessage(message: string): Promise<string> {
  const { connectSolanaWallet, pickDefaultWallet, signSolanaMessage } = await import(
    "./solana-wallets"
  );
  const id = pickDefaultWallet() || "injected";
  const { provider } = await connectSolanaWallet(id);
  return signSolanaMessage(provider, message);
}

export async function getSolanaPublicKey(): Promise<string> {
  try {
    const { pickDefaultWallet, getInjectedProvider } = await import("./solana-wallets");
    const id = pickDefaultWallet();
    if (!id) return "";
    const p = getInjectedProvider(id);
    return p?.publicKey?.toString?.() || "";
  } catch {
    return "";
  }
}

export function isConnected(): boolean {
  try {
    const w = window as any;
    return !!(w.solana?.publicKey || w.phantom?.solana?.publicKey || w.solflare?.publicKey);
  } catch {
    return false;
  }
}

export async function disconnectPhantom(): Promise<void> {
  try {
    const { disconnectSolanaWallet, pickDefaultWallet } = await import("./solana-wallets");
    const id = pickDefaultWallet();
    if (id) await disconnectSolanaWallet(id);
  } catch {
    /* ignore */
  }
}
