/**
 * Pop-out player inspector — identity, wallets, Puter assets, universe, admin actions.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Rocket,
  Shield,
  User,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface SystemDevUserRow {
  id: number;
  username: string;
  displayName?: string | null;
  grudgeId: string;
  puterId?: string | null;
  email?: string | null;
  phone?: string | null;
  discordId?: string | null;
  solanaAddress?: string | null;
  gbuxBalance?: string | null;
  role: string;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

interface UserDetail {
  user: SystemDevUserRow & { puterUsername?: string | null; needsProfile?: boolean };
  wallets?: Array<{
    id: number;
    address: string;
    provider: string;
    chain: string;
    isActive: boolean;
    connectedAt?: string;
  }>;
  assets?: Array<{ name: string; path: string; url: string | null }>;
  gbux?: { dbBalance: number; onChainBalance: number; synced: boolean } | null;
  universe?: {
    characters?: unknown[];
    decks?: unknown[];
    islands?: unknown[];
    saves?: unknown[];
  } | null;
  playSettings?: unknown;
  recentPlays?: unknown[];
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

function Field({
  label,
  value,
  mono,
  copy,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  copy?: boolean;
}) {
  const v = value?.trim() || "—";
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)]">{label}</div>
      <div className="flex items-center gap-1.5">
        <span
          className={`text-xs break-all ${mono ? "font-mono text-[hsl(43,85%,55%)]" : "text-[hsl(45,30%,88%)]"}`}
        >
          {v}
        </span>
        {copy && value && (
          <button
            type="button"
            onClick={() => copyText(value)}
            className="text-[hsl(45,15%,50%)] hover:text-[hsl(43,85%,55%)]"
            title="Copy"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

const ROLES = ["guest", "player", "member", "admin", "master"] as const;

export function SystemDevUserSheet({
  user,
  open,
  onOpenChange,
}: {
  user: SystemDevUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const key = user ? String(user.id) : "";

  const detailQ = useQuery({
    queryKey: ["/api/admin/system/user", key],
    queryFn: () => fetchJSON<UserDetail>(`/api/admin/system/user/${key}`),
    enabled: open && !!user,
  });

  const bootstrapM = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/admin/system/bootstrap/${encodeURIComponent(user!.grudgeId)}`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/system/user", key] }),
  });

  const roleM = useMutation({
    mutationFn: (role: string) =>
      fetchJSON(`/api/admin/system/user/${key}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/system/user", key] });
      qc.invalidateQueries({ queryKey: ["/api/admin/system"] });
    },
  });

  const assetsM = useMutation({
    mutationFn: () =>
      fetchJSON<{ assets: UserDetail["assets"] }>(`/api/admin/system/user/${key}/assets`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/system/user", key] }),
  });

  const detail = detailQ.data;
  const assets = detail?.assets ?? [];
  const primaryWallet =
    detail?.wallets?.find((w) => w.isActive)?.address ??
    user?.solanaAddress ??
    detail?.user?.solanaAddress;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-[hsl(225,30%,8%)] border-[hsl(43,60%,30%)]/30 text-[hsl(45,30%,90%)] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="font-heading gold-text flex items-center gap-2">
            <User className="w-5 h-5" />
            {user?.displayName || user?.username || "Player"}
          </SheetTitle>
          <SheetDescription className="text-[hsl(45,15%,55%)] font-mono text-xs">
            {user?.grudgeId}
          </SheetDescription>
        </SheetHeader>

        {!user ? null : detailQ.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
          </div>
        ) : detailQ.isError ? (
          <p className="text-sm text-red-400 mt-4">{(detailQ.error as Error).message}</p>
        ) : (
          <div className="mt-6 space-y-6 pb-8">
            {/* Identity */}
            <section className="fantasy-panel p-4 space-y-3">
              <h3 className="text-sm font-heading flex items-center gap-2">
                <Shield className="w-4 h-4 text-[hsl(43,85%,55%)]" /> Identity
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Username" value={detail?.user.username} />
                <Field label="Display name" value={detail?.user.displayName} />
                <Field label="Grudge ID" value={detail?.user.grudgeId} mono copy />
                <Field label="Role" value={detail?.user.role} />
                <Field label="Puter ID" value={detail?.user.puterId} mono copy />
                <Field label="Puter username" value={detail?.user.puterUsername} />
                <Field label="Email" value={detail?.user.email} copy />
                <Field label="Phone" value={detail?.user.phone} copy />
                <Field label="Discord ID" value={detail?.user.discordId} mono copy />
                <Field label="GBux (DB)" value={detail?.user.gbuxBalance ?? detail?.gbux?.dbBalance?.toString()} />
              </div>
              {detail?.gbux && (
                <div className="text-[10px] text-[hsl(45,15%,55%)] font-mono">
                  On-chain GBux: {detail.gbux.onChainBalance} · synced: {detail.gbux.synced ? "yes" : "no"}
                </div>
              )}
            </section>

            {/* Wallets */}
            <section className="fantasy-panel p-4 space-y-3">
              <h3 className="text-sm font-heading flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[hsl(43,85%,55%)]" /> Wallets
              </h3>
              <Field label="Primary Solana" value={primaryWallet} mono copy />
              {(detail?.wallets?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  {detail!.wallets!.map((w) => (
                    <div
                      key={w.id}
                      className="text-[11px] font-mono p-2 rounded bg-black/25 border border-[hsl(43,60%,30%)]/15"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="text-[hsl(43,85%,55%)] truncate">{w.address}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">
                          {w.provider}
                        </Badge>
                      </div>
                      <div className="text-[hsl(45,15%,50%)] mt-0.5">
                        {w.chain} · {w.isActive ? "active" : "inactive"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[hsl(45,15%,50%)]">No wallet_connections rows.</p>
              )}
            </section>

            {/* Assets dropdown */}
            <section className="fantasy-panel p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-heading">Player assets (Puter)</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] border-[hsl(43,60%,30%)]/40"
                  disabled={assetsM.isPending}
                  onClick={() => assetsM.mutate()}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${assetsM.isPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              {assets.length === 0 ? (
                <p className="text-[11px] text-[hsl(45,15%,50%)]">No files in PlayerAssets/{user.grudgeId}/</p>
              ) : (
                <Select
                  onValueChange={(path) => {
                    const hit = assets.find((a) => a.path === path);
                    if (hit?.url) window.open(hit.url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <SelectTrigger className="bg-black/30 border-[hsl(43,60%,30%)]/30 text-xs h-9">
                    <SelectValue placeholder={`${assets.length} asset(s) — pick to open`} />
                  </SelectTrigger>
                  <SelectContent className="bg-[hsl(225,30%,10%)] border-[hsl(43,60%,30%)]/40">
                    {assets.map((a) => (
                      <SelectItem key={a.path} value={a.path} className="text-xs font-mono">
                        {a.name}
                        {!a.url ? " (no URL)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {assets.some((a) => a.url) && (
                <div className="flex flex-wrap gap-2">
                  {assets
                    .filter((a) => a.url)
                    .slice(0, 4)
                    .map((a) => (
                      <a
                        key={a.path}
                        href={a.url!}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[hsl(43,85%,55%)] hover:underline inline-flex items-center gap-1"
                      >
                        {a.name} <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                </div>
              )}
            </section>

            {/* Universe */}
            {detail?.universe && (
              <section className="fantasy-panel p-4 space-y-2">
                <h3 className="text-sm font-heading">Universe</h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ["Chars", detail.universe.characters?.length ?? 0],
                    ["Decks", detail.universe.decks?.length ?? 0],
                    ["Islands", detail.universe.islands?.length ?? 0],
                    ["Saves", detail.universe.saves?.length ?? 0],
                  ].map(([label, n]) => (
                    <div key={String(label)} className="p-2 rounded bg-black/25">
                      <div className="text-[10px] text-[hsl(45,15%,50%)]">{label}</div>
                      <div className="text-lg font-heading gold-text">{String(n)}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Actions */}
            <section className="fantasy-panel p-4 space-y-3">
              <h3 className="text-sm font-heading">Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gilded-button text-xs"
                  disabled={bootstrapM.isPending}
                  onClick={() => bootstrapM.mutate()}
                >
                  {bootstrapM.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Rocket className="w-3.5 h-3.5 mr-1" /> Bootstrap starter
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-[hsl(43,60%,30%)]/40"
                  onClick={() => copyText(user.grudgeId)}
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy Grudge ID
                </Button>
                <a
                  href={`/account`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-xs px-3 py-1.5 rounded border border-[hsl(43,60%,30%)]/40 hover:bg-black/20"
                >
                  Account hub <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)]">Set role</div>
                <Select
                  value={detail?.user.role}
                  onValueChange={(role) => roleM.mutate(role)}
                  disabled={roleM.isPending}
                >
                  <SelectTrigger className="bg-black/30 border-[hsl(43,60%,30%)]/30 text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[hsl(225,30%,10%)]">
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <details className="text-[10px]">
              <summary className="cursor-pointer text-[hsl(45,15%,50%)] hover:text-[hsl(43,85%,55%)]">
                Raw JSON
              </summary>
              <pre className="mt-2 font-mono bg-black/40 p-3 rounded max-h-48 overflow-auto border border-[hsl(43,60%,30%)]/20">
                {JSON.stringify(detail, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}