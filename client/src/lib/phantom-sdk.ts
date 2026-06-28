/**
 * Phantom Connect — Browser SDK singleton
 *
 * Central SDK instance used by all Solana wallet flows:
 *   - Social login (Google / Apple) → embedded wallet
 *   - Phantom Login → embedded wallet linked to Phantom account
 *   - Browser extension (injected) → existing Phantom wallet
 *
 * App ID:   656b4ef2-7acc-44fe-bec7-4b288cfdd2e9
 * Portal:   https://portal.phantom.com
 */

import { BrowserSDK, AddressType, waitForPhantomExtension } from "@phantom/browser-sdk";
import bs58 from "bs58";

const PHANTOM_APP_ID =
  import.meta.env.VITE_PHANTOM_APP_ID || "656b4ef2-7acc-44fe-bec7-4b288cfdd2e9";

// Determine redirect URL based on current origin
function getRedirectUrl(): string {
  if (typeof window === "undefined") return "https://grudge-studio.com/auth/callback";
  return `${window.location.origin}/auth/callback`;
}

let _sdk: BrowserSDK | null = null;

/**
 * Returns the shared Phantom BrowserSDK instance.
 * Lazily created on first call so it doesn't break SSR/build.
 */
export function getPhantomSDK(): BrowserSDK {
  if (_sdk) return _sdk;

  _sdk = new BrowserSDK({
    providers: ["google", "apple", "phantom", "injected", "deeplink"],
    addressTypes: [AddressType.solana],
    appId: PHANTOM_APP_ID,
    authOptions: {
      redirectUrl: getRedirectUrl(),
    },
  });

  // Trigger auto-connect asynchronously (checks for existing session)
  _sdk.autoConnect().catch(() => {});

  return _sdk;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Check if the Phantom browser extension is installed. */
export async function isPhantomExtensionInstalled(): Promise<boolean> {
  try {
    return await waitForPhantomExtension(3000);
  } catch {
    return false;
  }
}

/** Connect via a specific provider and return the Solana address. */
export async function connectPhantom(
  provider: "google" | "apple" | "phantom" | "injected" | "deeplink" = "injected",
): Promise<{ address: string; addresses: Array<{ address: string; addressType: string }> }> {
  const sdk = getPhantomSDK();
  const { addresses } = await sdk.connect({ provider });
  // addressType may be an enum value — cast to string for comparison
  const solana = addresses.find((a) => String(a.addressType).toLowerCase() === "solana");
  if (!solana) throw new Error("No Solana address returned from Phantom Connect");
  return {
    address: solana.address,
    addresses: addresses.map((a) => ({ address: a.address, addressType: String(a.addressType) })),
  };
}

/** Sign a message with the connected Solana wallet. Returns base58 signature. */
export async function signMessage(message: string): Promise<string> {
  const sdk = getPhantomSDK();
  const result = await sdk.solana.signMessage(message);
  // signMessage returns { signature: Uint8Array, publicKey: string }
  return bs58.encode(result.signature);
}

/** Get the connected Solana public key (base58). */
export async function getSolanaPublicKey(): Promise<string> {
  const sdk = getPhantomSDK();
  return sdk.solana.publicKey || "";
}

/** Check if the SDK has an active connection. */
export function isConnected(): boolean {
  try {
    const sdk = getPhantomSDK();
    return sdk.isConnected();
  } catch {
    return false;
  }
}

/** Disconnect the current wallet session. */
export async function disconnectPhantom(): Promise<void> {
  try {
    const sdk = getPhantomSDK();
    await sdk.disconnect();
  } catch {
    // ignore disconnect errors
  }
}
