/**
 * System Development console — admin/master operators + agents.
 * Data from /api/admin/system*
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  ChevronRight,
  Database,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Shield,
  Terminal,
  Wrench,
} from "lucide-react";
import { checkAdminSession, loginAdmin } from "@/lib/admin-auth";
import {
  SystemDevUserSheet,
  type SystemDevUserRow,
} from "@/components/system-dev/SystemDevUserSheet";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function clip(s: string | null | undefined, n = 14) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default function SystemDevPage() {
  const qc = useQueryClient();
  const [pass, setPass] = useState("");
  const [grudgeLookup, setGrudgeLookup] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<SystemDevUserRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const sessionQ = useQuery({
    queryKey: ["admin-session"],
    queryFn: checkAdminSession,
    retry: false,
  });

  const systemQ = useQuery({
    queryKey: ["/api/admin/system"],
    queryFn: () => fetchJSON<any>("/api/admin/system"),
    enabled: !!sessionQ.data,
    refetchInterval: 60_000,
  });

  const loginM = useMutation({
    mutationFn: async () => {
      const ok = await loginAdmin(pass);
      if (!ok) throw new Error("Invalid admin password");
    },
    onSuccess: () => {
      setAuthErr("");
      qc.invalidateQueries({ queryKey: ["admin-session"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/system"] });
    },
    onError: (e: Error) => setAuthErr(e.message),
  });

  const ensureM = useMutation({
    mutationFn: () =>
      fetchJSON("/api/admin/system/ensure-schema", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/system"] }),
  });

  const userQ = useQuery({
    queryKey: ["/api/admin/system/user", grudgeLookup],
    queryFn: () => fetchJSON<any>(`/api/admin/system/user/${encodeURIComponent(grudgeLookup)}`),
    enabled: !!sessionQ.data && grudgeLookup.trim().length > 3,
  });

  const bootstrapM = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/admin/system/bootstrap/${encodeURIComponent(grudgeLookup)}`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/system/user", grudgeLookup] }),
  });

  const openUser = (u: SystemDevUserRow) => {
    setSelectedUser(u);
    setSheetOpen(true);
  };

  const recentUsers: SystemDevUserRow[] = systemQ.data?.recentUsers ?? [];

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return recentUsers;
    return recentUsers.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.grudgeId?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.puterId?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.discordId?.toLowerCase().includes(q) ||
        u.solanaAddress?.toLowerCase().includes(q),
    );
  }, [recentUsers, userSearch]);

  if (sessionQ.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(225,30%,6%)]">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
      </div>
    );
  }

  if (!sessionQ.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(225,30%,6%)] p-4">
        <div className="fantasy-panel p-8 max-w-md w-full space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[hsl(43,85%,55%)]" />
            <h1 className="font-heading text-xl gold-text">System Dev Login</h1>
          </div>
          <p className="text-xs text-[hsl(45,15%,55%)] font-body">
            Admin passcode session for schema, universe, fleet audit, and agent tooling.
          </p>
          <Input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Admin password"
            className="bg-black/30 border-[hsl(43,60%,30%)]/30"
            onKeyDown={(e) => e.key === "Enter" && loginM.mutate()}
          />
          {authErr && <p className="text-xs text-red-400">{authErr}</p>}
          <Button className="gilded-button w-full" disabled={loginM.isPending} onClick={() => loginM.mutate()}>
            {loginM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enter console"}
          </Button>
          <Link href="/" className="text-xs text-[hsl(43,85%,55%)] hover:underline block text-center">
            ← Portal home
          </Link>
        </div>
      </div>
    );
  }

  const sys = systemQ.data;
  const tables = sys?.database?.tables ?? {};
  const counts = sys?.database?.universeCounts ?? {};
  const audit = sys?.fleet?.audit ?? {};

  return (
    <div className="min-h-screen bg-[hsl(225,30%,6%)] text-[hsl(45,30%,90%)]">
      <SystemDevUserSheet
        user={selectedUser}
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setSelectedUser(null);
        }}
      />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading gold-text flex items-center gap-2">
              <Terminal className="w-6 h-6" /> System Development
            </h1>
            <p className="text-xs text-[hsl(45,15%,55%)] font-body mt-1">
              Account DB · player registry · Puter assets · fleet audit · agent contracts
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-[hsl(43,60%,30%)]/40"
              onClick={() => systemQ.refetch()}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
            <Button
              size="sm"
              className="gilded-button"
              disabled={ensureM.isPending}
              onClick={() => ensureM.mutate()}
            >
              <Wrench className="w-3.5 h-3.5 mr-1" />
              {ensureM.isPending ? "Ensuring…" : "Ensure schema"}
            </Button>
          </div>
        </header>

        {systemQ.isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
          </div>
        )}
        {systemQ.isError && (
          <div className="fantasy-panel p-4 text-red-400 text-sm">
            {(systemQ.error as Error).message}
          </div>
        )}

        {sys && (
          <>
            <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                ["Users", counts.users ?? tables.users],
                ["Characters", counts.characters ?? tables.player_characters],
                ["Decks", counts.decks ?? tables.player_decks],
                ["Islands", counts.islands ?? tables.player_islands],
                ["Saves", counts.saves ?? tables.player_game_saves],
              ].map(([label, n]) => (
                <div key={String(label)} className="fantasy-panel p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,55%)]">{label}</div>
                  <div className="text-2xl font-heading gold-text mt-1">{String(n)}</div>
                </div>
              ))}
            </section>

            {/* Player registry */}
            <section className="fantasy-panel p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-heading text-base">Player registry</h2>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(45,15%,50%)]" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Filter by name, Grudge ID, Puter, email…"
                    className="pl-8 bg-black/30 border-[hsl(43,60%,30%)]/30 text-sm h-9"
                  />
                </div>
              </div>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[11px] min-w-[900px]">
                  <thead className="text-[hsl(45,15%,50%)] text-left border-b border-[hsl(43,60%,30%)]/20">
                    <tr>
                      <th className="py-2 pr-2">Player</th>
                      <th className="pr-2">Grudge ID</th>
                      <th className="pr-2">Puter ID</th>
                      <th className="pr-2">Puter user</th>
                      <th className="pr-2">Wallet</th>
                      <th className="pr-2">Email</th>
                      <th className="pr-2">Phone</th>
                      <th className="pr-2">Discord</th>
                      <th className="pr-2">Role</th>
                      <th className="pr-2">Last login</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="border-t border-[hsl(43,60%,30%)]/10 hover:bg-black/20 cursor-pointer transition-colors"
                        onClick={() => openUser(u)}
                      >
                        <td className="py-2 pr-2 font-medium">{u.displayName || u.username}</td>
                        <td className="pr-2 font-mono text-[hsl(43,85%,55%)]">{clip(u.grudgeId, 12)}</td>
                        <td className="pr-2 font-mono text-[hsl(45,15%,60%)]">{clip(u.puterId, 10)}</td>
                        <td className="pr-2">{u.puterId ? (u.displayName || u.username) : "—"}</td>
                        <td className="pr-2 font-mono">{clip(u.solanaAddress, 8)}</td>
                        <td className="pr-2">{clip(u.email, 16)}</td>
                        <td className="pr-2">{clip(u.phone, 12)}</td>
                        <td className="pr-2 font-mono">{clip(u.discordId, 10)}</td>
                        <td className="pr-2">
                          <Badge variant="outline" className="text-[9px] capitalize">
                            {u.role}
                          </Badge>
                        </td>
                        <td className="pr-2 text-[hsl(45,15%,55%)] whitespace-nowrap">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}
                        </td>
                        <td className="text-right">
                          <ChevronRight className="w-4 h-4 text-[hsl(43,85%,55%)] inline" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <p className="text-center text-xs text-[hsl(45,15%,50%)] py-6">No players match filter.</p>
                )}
              </div>
              <p className="text-[10px] text-[hsl(45,15%,50%)]">
                Click any row to open player info, Puter assets dropdown, and admin actions.
              </p>
            </section>

            <section className="grid lg:grid-cols-2 gap-4">
              <div className="fantasy-panel p-5">
                <h2 className="font-heading text-base flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4 text-[hsl(43,85%,55%)]" /> Database tables
                </h2>
                <div className="space-y-1 font-mono text-[11px]">
                  {Object.entries(tables).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[hsl(43,60%,30%)]/10 py-1">
                      <span className="text-[hsl(45,15%,60%)]">{k}</span>
                      <span className={typeof v === "string" && String(v).startsWith("ERR") ? "text-red-400" : "text-[hsl(43,85%,55%)]"}>
                        {String(v)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[10px] text-[hsl(45,15%,50%)]">
                  user columns:{" "}
                  {Array.isArray(sys.database?.userColumns)
                    ? sys.database.userColumns.join(", ")
                    : JSON.stringify(sys.database?.userColumns)}
                </div>
                {sys.ensure && (
                  <Badge className="mt-2 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                    ensure: {sys.ensure.ok ? "ok" : "fail"} · applied {sys.ensure.applied}
                  </Badge>
                )}
              </div>

              <div className="fantasy-panel p-5">
                <h2 className="font-heading text-base flex items-center gap-2 mb-3">
                  <Server className="w-4 h-4 text-[hsl(43,85%,55%)]" /> Fleet canonical
                </h2>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="outline" className="text-[10px]">
                    ok {audit.summary?.canonical ?? "—"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                    vercel {audit.summary?.vercelPending ?? "—"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    external {audit.summary?.external ?? "—"}
                  </Badge>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 text-[11px]">
                  {(audit.rows || []).map((r: any) => (
                    <div key={r.id} className="flex items-start justify-between gap-2 py-1 border-b border-[hsl(43,60%,30%)]/10">
                      <div>
                        <span className="font-medium">{r.name}</span>
                        <div className="text-[hsl(45,15%,50%)] font-mono truncate max-w-[240px]">{r.canonicalUrl}</div>
                      </div>
                      <Badge
                        className={`text-[9px] shrink-0 ${
                          r.grade === "vercel-pending"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        {r.grade}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="fantasy-panel p-5">
              <h2 className="font-heading text-base flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-[hsl(43,85%,55%)]" /> Agent contract
              </h2>
              <div className="grid sm:grid-cols-2 gap-3 text-[11px] font-mono">
                {Object.entries(sys.agentHints || {}).map(([k, v]) => (
                  <div key={k} className="p-2 rounded bg-black/25 border border-[hsl(43,60%,30%)]/15">
                    <div className="text-[hsl(43,85%,55%)]">{k}</div>
                    <div className="text-[hsl(45,15%,65%)] break-all mt-0.5">{String(v)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="https://grudge-studio.com/embed/grudge-universe.js"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[hsl(43,85%,55%)] hover:underline inline-flex items-center gap-1"
                >
                  Fleet SDK <ExternalLink className="w-3 h-3" />
                </a>
                <Link href="/account" className="text-xs text-[hsl(43,85%,55%)] hover:underline">
                  Account hub
                </Link>
                <Link href="/super-engine" className="text-xs text-[hsl(43,85%,55%)] hover:underline">
                  Super Engine
                </Link>
              </div>
            </section>

            <section className="fantasy-panel p-5 space-y-3">
              <h2 className="font-heading text-base">User universe lookup</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={grudgeLookup}
                  onChange={(e) => setGrudgeLookup(e.target.value)}
                  placeholder="grudgeId or numeric user id"
                  className="bg-black/30 border-[hsl(43,60%,30%)]/30 font-mono text-sm"
                />
                <Button
                  className="gilded-button"
                  disabled={!grudgeLookup.trim() || bootstrapM.isPending}
                  onClick={() => bootstrapM.mutate()}
                >
                  Bootstrap starter
                </Button>
              </div>
              {userQ.isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
              {userQ.data && (
                <pre className="text-[10px] font-mono bg-black/40 p-3 rounded max-h-80 overflow-auto border border-[hsl(43,60%,30%)]/20">
                  {JSON.stringify(userQ.data, null, 2)}
                </pre>
              )}
              {userQ.isError && (
                <p className="text-xs text-red-400">{(userQ.error as Error).message}</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}