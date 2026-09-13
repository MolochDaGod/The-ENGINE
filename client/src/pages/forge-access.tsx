/**
 * /forge — paid access gate for forge.grudge-studio.com
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { useAuthModal } from "@/components/auth-modal";
import { evaluateForgeAccess } from "@/lib/forgeAccess";
import { CANONICAL } from "@/lib/canonicalDomains";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Loader2, Lock, Shield, Sparkles, Wrench } from "lucide-react";

export default function ForgeAccessPage() {
  const { player, loading } = useAuth();
  const { open: openAuth } = useAuthModal();
  const [, setLocation] = useLocation();
  const [autoLaunch, setAutoLaunch] = useState(true);

  const gate = evaluateForgeAccess(player);

  useEffect(() => {
    if (loading || !autoLaunch) return;
    if (gate.ok) {
      window.location.assign(gate.launchUrl);
    }
  }, [loading, gate, autoLaunch]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(225,30%,6%)]">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/">
          <Button variant="ghost" className="text-gray-400 hover:text-amber-400 mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to portal
          </Button>
        </Link>

        <div className="rounded-2xl border border-amber-500/30 bg-gray-900/60 p-8 shadow-2xl shadow-amber-500/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-amber-100">Studio Forge</h1>
              <p className="text-sm text-gray-400">Paid access · {CANONICAL.forge.replace("https://", "")}</p>
            </div>
          </div>

          <p className="text-gray-300 text-sm leading-relaxed mb-6">
            Grudge Studio Forge is the game-making IDE (scenes, assets, deploy). Access is limited to
            authenticated premium / paid accounts — same identity as the rest of the fleet.
          </p>

          {gate.ok ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <Sparkles className="w-4 h-4" />
                Access granted — launching Forge…
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="bg-amber-600 hover:bg-amber-500 text-black font-semibold"
                  onClick={() => {
                    setAutoLaunch(false);
                    window.location.assign(gate.launchUrl);
                  }}
                >
                  Open Forge <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" className="border-gray-600" onClick={() => setLocation("/super-engine")}>
                  Play forge games instead
                </Button>
              </div>
            </div>
          ) : gate.reason === "auth" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <Lock className="w-4 h-4" />
                {gate.message}
              </div>
              <Button
                className="bg-amber-600 hover:bg-amber-500 text-black font-semibold"
                onClick={() => openAuth()}
              >
                Sign in with Grudge ID
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-rose-300 text-sm">
                <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{gate.message}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/store">
                  <Button className="bg-amber-600 hover:bg-amber-500 text-black font-semibold">
                    Open Store
                  </Button>
                </Link>
                <Link href="/super-engine">
                  <Button variant="outline" className="border-gray-600">
                    Free forge demos
                  </Button>
                </Link>
                <Link href="/account">
                  <Button variant="ghost" className="text-gray-400">
                    Account
                  </Button>
                </Link>
              </div>
              {player && (
                <div className="text-xs text-gray-500 mt-2">
                  Signed in as <Badge variant="outline" className="mx-1">{player.displayName || player.username}</Badge>
                  · role {player.role || "user"} · GBUX {player.gbuxBalance ?? "0"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
