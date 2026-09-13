/**
 * Multi-wallet Solana connect (NO Phantom Auth2 /login/start).
 *
 * Uses injected providers only — Phantom, Solflare, Backpack, Glow, Coinbase,
 * Exodus, Nightly, Trust, and generic window.solana.
 *
 * Auth flow (server SSOT):
 *   1. connectWallet(id) → address
 *   2. POST /api/auth/solana/nonce { address }
 *   3. provider.signMessage(message)
 *   4. POST /api/auth/solana/verify { address, nonce, signature, wallet }
 */

import bs58 from "bs58";

export type SolanaWalletId =
  | "phantom"
  | "solflare"
  | "backpack"
  | "glow"
  | "coinbase"
  | "exodus"
  | "nightly"
  | "trust"
  | "injected";

export type DetectedWallet = {
  id: SolanaWalletId;
  name: string;
  icon: string;
  available: boolean;
  /** Prefer for auto-connect order */
  priority: number;
};

type InjectedProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  isGlow?: boolean;
  isCoinbaseWallet?: boolean;
  isExodus?: boolean;
  isNightly?: boolean;
  isTrust?: boolean;
  publicKey?: { toString(): string; toBase58?: () => string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString(): string } } | void>;
  disconnect?: () => Promise<void>;
  signMessage: (
    message: Uint8Array,
    display?: string,
  ) => Promise<Uint8Array | { signature: Uint8Array; publicKey?: string }>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function win(): any {
  return typeof window !== "undefined" ? window : {};
}

/** Resolve provider object for a known wallet id. */
export function getInjectedProvider(id: SolanaWalletId): InjectedProvider | null {
  const w = win();
  switch (id) {
    case "phantom":
      return (w.phantom?.solana as InjectedProvider) || (w.solana?.isPhantom ? (w.solana as InjectedProvider) : null);
    case "solflare":
      return (w.solflare as InjectedProvider) || (w.solana?.isSolflare ? (w.solana as InjectedProvider) : null);
    case "backpack":
      return (w.backpack as InjectedProvider) || (w.solana?.isBackpack ? (w.solana as InjectedProvider) : null);
    case "glow":
      return (w.glow as InjectedProvider) || (w.solana?.isGlow ? (w.solana as InjectedProvider) : null);
    case "coinbase":
      return (w.coinbaseSolana as InjectedProvider) || (w.solana?.isCoinbaseWallet ? (w.solana as InjectedProvider) : null);
    case "exodus":
      return (w.exodus?.solana as InjectedProvider) || (w.solana?.isExodus ? (w.solana as InjectedProvider) : null);
    case "nightly":
      return (w.nightly?.solana as InjectedProvider) || null;
    case "trust":
      return (w.trustwallet?.solana as InjectedProvider) || (w.solana?.isTrust ? (w.solana as InjectedProvider) : null);
    case "injected":
      return (w.solana as InjectedProvider) || null;
    default:
      return null;
  }
}

/** List wallets the user might use (available ones first). */
export function detectSolanaWallets(): DetectedWallet[] {
  const catalog: Array<Omit<DetectedWallet, "available"> & { id: SolanaWalletId }> = [
    { id: "phantom", name: "Phantom", icon: "◎", priority: 10 },
    { id: "solflare", name: "Solflare", icon: "☀", priority: 9 },
    { id: "backpack", name: "Backpack", icon: "🎒", priority: 8 },
    { id: "glow", name: "Glow", icon: "✨", priority: 7 },
    { id: "coinbase", name: "Coinbase", icon: "🔵", priority: 6 },
    { id: "exodus", name: "Exodus", icon: "◈", priority: 5 },
    { id: "nightly", name: "Nightly", icon: "☾", priority: 4 },
    { id: "trust", name: "Trust", icon: "🛡", priority: 3 },
    { id: "injected", name: "Browser Solana", icon: "🔗", priority: 1 },
  ];

  return catalog
    .map((c) => ({
      ...c,
      available: !!getInjectedProvider(c.id),
    }))
    .sort((a, b) => Number(b.available) - Number(a.available) || b.priority - a.priority);
}

export function pickDefaultWallet(): SolanaWalletId | null {
  const found = detectSolanaWallets().find((w) => w.available && w.id !== "injected");
  if (found) return found.id;
  if (getInjectedProvider("injected")) return "injected";
  return null;
}

export async function connectSolanaWallet(
  id: SolanaWalletId,
): Promise<{ address: string; wallet: SolanaWalletId; provider: InjectedProvider }> {
  const provider = getInjectedProvider(id);
  if (!provider) {
    throw new Error(
      id === "phantom"
        ? "Phantom not found. Install https://phantom.app or pick another Solana wallet."
        : `${id} wallet not found. Install the extension, then refresh.`,
    );
  }

  // Already connected?
  let address = "";
  try {
    if (provider.publicKey) {
      address = provider.publicKey.toBase58?.() || provider.publicKey.toString();
    }
  } catch {
    /* ignore */
  }

  if (!address) {
    const resp = await provider.connect();
    const pk = (resp as any)?.publicKey || provider.publicKey;
    if (!pk) throw new Error("Wallet connected but no public key returned.");
    address = typeof pk.toBase58 === "function" ? pk.toBase58() : pk.toString();
  }

  if (!address || address.length < 32) {
    throw new Error("Invalid Solana address from wallet.");
  }

  return { address, wallet: id, provider };
}

/** Encode signature to base58 for server nacl verify. */
export function encodeSignatureB58(sig: Uint8Array | { signature: Uint8Array }): string {
  const bytes = sig instanceof Uint8Array ? sig : sig.signature;
  if (!(bytes instanceof Uint8Array) || bytes.length < 64) {
    throw new Error("Wallet returned an invalid signature payload.");
  }
  // Some wallets return 64-byte ed25519 sig; some pad — take first 64
  const slice = bytes.length === 64 ? bytes : bytes.slice(0, 64);
  return bs58.encode(slice);
}

export async function signSolanaMessage(
  provider: InjectedProvider,
  message: string,
): Promise<string> {
  const encoded = new TextEncoder().encode(message);
  // Phantom-compatible API; Solflare/Backpack implement the same shape
  const result = await provider.signMessage(encoded, "utf8");
  return encodeSignatureB58(result as any);
}

export async function disconnectSolanaWallet(id: SolanaWalletId): Promise<void> {
  try {
    const p = getInjectedProvider(id);
    await p?.disconnect?.();
  } catch {
    /* ignore */
  }
}
