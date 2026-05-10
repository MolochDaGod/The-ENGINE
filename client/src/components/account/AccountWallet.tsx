import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Coins, Copy, ExternalLink, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import type { PlayerProfile } from "@/lib/player-auth";

interface WalletRow {
  id: number;
  address: string;
  provider: string;
  chain: string;
  isActive: boolean;
  connectedAt: string;
}

interface TransactionRow {
  id: number;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function AccountWallet({ player }: { player: PlayerProfile }) {
  const queryClient = useQueryClient();

  const walletsQuery = useQuery<WalletRow[]>({
    queryKey: ["/api/me/wallets"],
    queryFn: () => fetchJSON<WalletRow[]>("/api/me/wallets"),
  });

  const txQuery = useQuery<TransactionRow[]>({
    queryKey: ["/api/transactions"],
    queryFn: () => fetchJSON<TransactionRow[]>("/api/transactions?limit=20"),
  });

  const removeWallet = useMutation({
    mutationFn: async (walletId: number) => {
      const res = await fetch(`/api/me/wallets/${walletId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to remove wallet");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/me/wallets"] }),
  });

  const connectPhantom = async () => {
    try {
      const { phantomSignIn } = await import("@/lib/player-auth");
      await phantomSignIn("auto");
      queryClient.invalidateQueries({ queryKey: ["/api/me/wallets"] });
    } catch {
      // handled by phantomSignIn
    }
  };

  return (
    <div className="space-y-6">
      {/* GBUX Balance Card */}
      <section className="fantasy-panel p-6">
        <div className="flex items-center gap-4 mb-4">
          <Coins className="w-6 h-6 text-[hsl(43,85%,55%)]" />
          <div>
            <div className="text-xs text-[hsl(45,15%,60%)] font-body uppercase tracking-wider">GBUX Balance</div>
            <div className="text-3xl font-heading gold-text">{Number(player.gbuxBalance || 0).toFixed(2)}</div>
          </div>
        </div>
        {player.solanaAddress && (
          <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-[hsl(270,50%,40%)]/25 border-l-2 border-l-[hsl(270,60%,50%)]">
            <div>
              <div className="text-[10px] text-[hsl(45,15%,50%)] uppercase tracking-wider font-body">Primary Solana Wallet</div>
              <div className="text-sm font-mono text-[hsl(270,60%,70%)]">{player.solanaAddress}</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => copyText(player.solanaAddress!)} className="text-[hsl(45,15%,45%)] hover:text-[hsl(270,60%,70%)] transition p-1">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a href={`https://solscan.io/account/${player.solanaAddress}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="text-[hsl(45,15%,45%)] hover:text-[hsl(270,60%,70%)] transition p-1">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
        {!player.solanaAddress && (
          <Button onClick={connectPhantom} className="gilded-button w-full sm:w-auto">
            <Wallet className="w-4 h-4 mr-2" /> Connect Phantom Wallet
          </Button>
        )}
      </section>

      {/* GBUX Purchase Packages */}
      <section className="fantasy-panel p-5">
        <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>
          <Coins className="w-4 h-4 inline mr-2 text-[hsl(43,85%,55%)]" />
          Purchase GBUX
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { amount: 100, price: "$0.99", bonus: null, popular: false },
            { amount: 500, price: "$4.49", bonus: "+50 bonus", popular: false },
            { amount: 1200, price: "$9.99", bonus: "+200 bonus", popular: true },
            { amount: 5000, price: "$39.99", bonus: "+1000 bonus", popular: false },
          ].map(pkg => (
            <button key={pkg.amount}
              onClick={() => alert(`Purchase ${pkg.amount} GBUX for ${pkg.price} — payment integration coming soon.`)}
              className={`relative p-4 rounded-lg border-2 transition-all text-center hover:scale-[1.02] ${
                pkg.popular
                  ? "border-[hsl(43,85%,55%)] bg-[hsl(43,85%,55%)]/10 shadow-lg shadow-[hsl(43,85%,55%)]/10"
                  : "border-[hsl(43,60%,30%)]/30 bg-black/20 hover:border-[hsl(43,60%,30%)]/60"
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[hsl(43,85%,55%)] text-[hsl(225,30%,8%)] text-[9px] font-heading px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Best Value
                </div>
              )}
              <div className="text-2xl font-heading gold-text">{pkg.amount.toLocaleString()}</div>
              <div className="text-xs text-[hsl(45,15%,55%)] font-body">GBUX</div>
              {pkg.bonus && <div className="text-[10px] text-[hsl(120,60%,60%)] font-body mt-0.5">{pkg.bonus}</div>}
              <div className="text-sm font-heading text-[hsl(45,30%,92%)] mt-2">{pkg.price}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline" className="text-[9px] border-[hsl(270,50%,40%)]/30 text-[hsl(270,60%,70%)]">
            Solana Pay
          </Badge>
          <Badge variant="outline" className="text-[9px] border-[hsl(43,60%,30%)]/30 text-[hsl(45,15%,55%)]">
            Stripe
          </Badge>
          <Badge variant="outline" className="text-[9px] border-[hsl(43,60%,30%)]/30 text-[hsl(45,15%,55%)]">
            Coming Soon
          </Badge>
        </div>
      </section>

      {/* Connected Wallets — from wallet_connections table */}
      <section className="fantasy-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-base text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
            Connected Wallets
          </h3>
          <Badge variant="outline" className="text-[10px] border-[hsl(43,60%,30%)]/50 text-[hsl(43,85%,55%)]">
            {walletsQuery.data?.length || 0}
          </Badge>
        </div>
        {walletsQuery.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
        ) : !walletsQuery.data?.length ? (
          <p className="text-sm text-[hsl(45,15%,60%)] font-body">No additional wallets connected.</p>
        ) : (
          <div className="space-y-2">
            {walletsQuery.data.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 rounded border border-[hsl(43,60%,30%)]/15 bg-black/15">
                <div className="flex items-center gap-3 min-w-0">
                  <Wallet className="w-4 h-4 text-[hsl(270,60%,60%)] flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-mono text-[hsl(45,30%,90%)] truncate">{shortenAddress(w.address)}</div>
                    <div className="text-[10px] text-[hsl(45,15%,50%)] font-body">{w.provider} · {w.chain}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => copyText(w.address)} className="text-[hsl(45,15%,45%)] hover:text-[hsl(43,85%,55%)] transition p-1">
                    <Copy className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeWallet.mutate(w.id)} className="text-[hsl(45,15%,45%)] hover:text-[hsl(0,70%,60%)] transition p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* GBUX Transaction History */}
      <section className="fantasy-panel p-5">
        <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>
          GBUX Transactions
        </h3>
        {txQuery.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
        ) : !txQuery.data?.length ? (
          <p className="text-sm text-[hsl(45,15%,60%)] font-body">No transactions yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {txQuery.data.map((tx) => {
              const amt = Number(tx.amount);
              return (
                <li key={tx.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div className="text-[hsl(45,30%,90%)] truncate">{tx.description || tx.type}</div>
                    <div className="text-[10px] text-[hsl(45,15%,55%)] font-body">{new Date(tx.createdAt).toLocaleString()}</div>
                  </div>
                  <div className={`font-heading text-sm flex-shrink-0 ${amt >= 0 ? "text-[hsl(120,60%,60%)]" : "text-[hsl(0,70%,65%)]"}`}>
                    {amt >= 0 ? "+" : ""}{amt.toFixed(2)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
