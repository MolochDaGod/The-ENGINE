/**
 * Grudge Studio — Unified Account Page
 *
 * Tabbed layout merging patterns from:
 *   - GrudgeBuilder/client/src/pages/AccountPage.tsx (profile card, identity, XP/GBUX)
 *   - GrudgeBuilder/client/src/pages/WalletPage.tsx (wallet connections, cNFT, Crossmint)
 *   - Warlord-Crafting-Suite/client/src/pages/Settings.tsx (sidebar settings sections)
 *
 * All API calls use The-ENGINE cookie-based routes:
 *   - GET  /api/auth/me          → player profile (incl. provider IDs)
 *   - GET  /api/me/stats         → stats aggregate
 *   - GET  /api/me/scores        → recent scores
 *   - GET  /api/me/games         → games played
 *   - GET  /api/me/connections   → linked providers + wallets
 *   - GET  /api/me/wallets       → wallet_connections rows
 *   - PATCH /api/me/profile      → update displayName, bio, avatarUrl
 *   - GET  /api/transactions     → GBUX ledger
 *   - GET  /api/friends          → friend list
 *   - GET  /api/challenges/*     → PvP
 */
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Coins, Gamepad, Loader2, LogOut, Settings, Swords, Users, UserCircle, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useAuthModal } from "@/components/auth-modal";
import AccountOverview from "@/components/account/AccountOverview";
import AccountWallet from "@/components/account/AccountWallet";
import AccountSettings from "@/components/account/AccountSettings";
import AccountCharacters from "@/components/account/AccountCharacters";
import AccountGamesHub from "@/components/account/AccountGamesHub";

export default function AccountPage() {
  const { player, loading, logout } = useAuth();
  const { open: openAuthModal } = useAuthModal();

  useEffect(() => {
    if (!loading && !player) {
      openAuthModal({ redirectTo: "/account", initialTab: "signin", reason: "Sign in to see your stats, scores, and PvP history." });
    }
  }, [loading, player, openAuthModal]);

  if (loading || !player) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
        {!loading && !player && (
          <Button className="gilded-button" onClick={() => openAuthModal({ redirectTo: "/account", initialTab: "signin" })}>
            Sign in to continue
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(225,30%,6%)] text-[hsl(45,30%,90%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header with sign-out */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-heading gold-text" style={{ WebkitTextFillColor: "unset" }}>
            My Account
          </h1>
          <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)]" onClick={() => logout()}>
            <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign out
          </Button>
        </div>

        {/* Tabbed layout */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start bg-[hsl(225,25%,10%)] border border-[hsl(43,60%,30%)]/15 rounded-lg p-1 gap-1 flex-wrap h-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)] text-[hsl(45,15%,55%)] text-xs font-heading">
              <Gamepad className="w-3.5 h-3.5 mr-1.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="games" className="data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)] text-[hsl(45,15%,55%)] text-xs font-heading">
              <Gamepad className="w-3.5 h-3.5 mr-1.5" /> Games
            </TabsTrigger>
            <TabsTrigger value="wallet" className="data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)] text-[hsl(45,15%,55%)] text-xs font-heading">
              <Wallet className="w-3.5 h-3.5 mr-1.5" /> Wallet & Web3
            </TabsTrigger>
            <TabsTrigger value="characters" className="data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)] text-[hsl(45,15%,55%)] text-xs font-heading">
              <UserCircle className="w-3.5 h-3.5 mr-1.5" /> Characters
            </TabsTrigger>
            <TabsTrigger value="pvp" className="data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)] text-[hsl(45,15%,55%)] text-xs font-heading">
              <Swords className="w-3.5 h-3.5 mr-1.5" /> PvP
            </TabsTrigger>
            <TabsTrigger value="friends" className="data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)] text-[hsl(45,15%,55%)] text-xs font-heading">
              <Users className="w-3.5 h-3.5 mr-1.5" /> Friends
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)] text-[hsl(45,15%,55%)] text-xs font-heading">
              <Settings className="w-3.5 h-3.5 mr-1.5" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <AccountOverview player={player} />
          </TabsContent>

          <TabsContent value="games" className="mt-6">
            <AccountGamesHub />
          </TabsContent>

          <TabsContent value="wallet" className="mt-6">
            <AccountWallet player={player} />
          </TabsContent>

          <TabsContent value="characters" className="mt-6">
            <AccountCharacters player={player} />
          </TabsContent>

          <TabsContent value="pvp" className="mt-6">
            <PvPTab />
          </TabsContent>

          <TabsContent value="friends" className="mt-6">
            <FriendsTab />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <AccountSettings player={player} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ── Inline lightweight tabs for PvP and Friends ── */

import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

function fetchJSON<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

function PvPTab() {
  const active = useQuery({ queryKey: ["/api/challenges/active"], queryFn: () => fetchJSON<any[]>("/api/challenges/active") });
  const pending = useQuery({ queryKey: ["/api/challenges/pending"], queryFn: () => fetchJSON<any[]>("/api/challenges/pending") });
  const all = [...(pending.data || []), ...(active.data || [])];

  return (
    <div className="space-y-6">
      <section className="fantasy-panel p-5">
        <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>Active & Pending PvP</h3>
        {active.isLoading || pending.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
        ) : !all.length ? (
          <p className="text-sm text-[hsl(45,15%,60%)] font-body">No open challenges. <Link href="/pvp" className="text-[hsl(43,85%,55%)] hover:underline">Start one</Link>.</p>
        ) : (
          <ul className="space-y-2">
            {all.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded border border-[hsl(43,60%,30%)]/20">
                <div className="text-sm">
                  <div className="font-medium">Challenge #{c.id}</div>
                  <div className="text-xs text-[hsl(45,15%,60%)] font-body">Wager: {Number(c.gbuxWager).toFixed(2)} GBUX</div>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase border-[hsl(43,60%,30%)]/50 text-[hsl(43,85%,55%)]">{c.status}</Badge>
              </li>
            ))}
          </ul>
        )}
        <Link href="/pvp"><Button className="w-full mt-4 gilded-button"><Swords className="w-4 h-4 mr-2" /> Open PvP Hub</Button></Link>
      </section>
    </div>
  );
}

function FriendsTab() {
  const friends = useQuery({ queryKey: ["/api/friends"], queryFn: () => fetchJSON<any[]>("/api/friends") });
  const pendingReqs = useQuery({ queryKey: ["/api/friends/pending"], queryFn: () => fetchJSON<any[]>("/api/friends/pending") });

  return (
    <div className="space-y-6">
      {(pendingReqs.data?.length ?? 0) > 0 && (
        <section className="fantasy-panel p-5">
          <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-3" style={{ WebkitTextFillColor: "unset" }}>Pending Requests</h3>
          <ul className="space-y-2">
            {pendingReqs.data!.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between p-2.5 rounded border border-[hsl(43,60%,30%)]/20">
                <span className="text-sm">{r.from?.displayName || r.from?.username || "Unknown"}</span>
                <Button size="sm" className="gilded-button h-7 text-xs" onClick={async () => {
                  await fetch(`/api/friends/${r.id}/accept`, { method: "POST", credentials: "include" });
                  pendingReqs.refetch();
                  friends.refetch();
                }}>Accept</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="fantasy-panel p-5">
        <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-3" style={{ WebkitTextFillColor: "unset" }}>Friends</h3>
        {friends.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
        ) : !friends.data?.length ? (
          <p className="text-sm text-[hsl(45,15%,60%)] font-body">No friends yet. Use the <Link href="/chat" className="text-[hsl(43,85%,55%)] hover:underline">chat</Link> to meet players.</p>
        ) : (
          <ul className="space-y-2">
            {friends.data.map((f: any) => (
              <li key={f.friendshipId || f.id} className="flex items-center justify-between p-2.5 rounded border border-[hsl(43,60%,30%)]/15">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${f.isOnline ? "bg-[hsl(120,60%,50%)] shadow-[0_0_4px_hsl(120,60%,50%)]" : "bg-[hsl(45,15%,30%)]"}`} />
                  <div>
                    <div className="text-sm font-medium">{f.displayName || f.username}</div>
                    <div className="text-[10px] text-[hsl(45,15%,50%)] font-body">{f.grudgeId}</div>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] border-[hsl(43,60%,30%)]/30 text-[hsl(45,15%,55%)]">
                  {f.isOnline ? "Online" : "Offline"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
