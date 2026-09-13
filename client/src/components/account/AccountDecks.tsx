import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Star, Layers, ExternalLink, Database, RefreshCw } from "lucide-react";
import {
  fetchUniverse,
  launchWithDeck,
  patchDeck,
  type UniverseDeck,
  type UniverseSnapshot,
} from "@/lib/universe-api";

const NEXUS_HOST = "https://grudgeplatform.io";
const NEXUS_DECK_BUILDER = `${NEXUS_HOST}/deck-builder`;
const NEXUS_LIBRARY = `${NEXUS_HOST}/library`;

function isMirror(deck: UniverseDeck): boolean {
  return (
    deck.name === "Nexus Battle Deck" ||
    (deck.description || "").toLowerCase().includes("user_season0") ||
    (deck.description || "").toLowerCase().includes("grudgeplatform")
  );
}

export default function AccountDecks() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<number | string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const q = useQuery<UniverseSnapshot & { nexus?: { synced?: boolean; origin?: string; error?: string }; policy?: any }>({
    queryKey: ["/api/me/universe"],
    queryFn: fetchUniverse,
  });

  const decks = q.data?.decks ?? [];
  const purged = (q.data as any)?.bootstrapped?.fakeDecksPurged ?? 0;

  async function setActive(deck: UniverseDeck) {
    setBusy(deck.id);
    try {
      await patchDeck(deck.id, { isActive: true });
      await qc.invalidateQueries({ queryKey: ["/api/me/universe"] });
    } finally {
      setBusy(null);
    }
  }

  async function play(deck: UniverseDeck) {
    setBusy(`play-${deck.id}`);
    try {
      if (!deck.isActive) await patchDeck(deck.id, { isActive: true });
      await launchWithDeck(deck);
      await qc.invalidateQueries({ queryKey: ["/api/me/universe"] });
    } finally {
      setBusy(null);
    }
  }

  async function syncFromNexus() {
    setBusy("sync");
    setSyncMsg(null);
    try {
      const res = await fetch("/api/me/universe/sync-nexus-deck", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncMsg(json.error || `Sync failed (${res.status})`);
      } else {
        setSyncMsg(
          `Synced ${json.mirror?.totalCards ?? "?"} cards from grudgeplatform.io`,
        );
        await qc.invalidateQueries({ queryKey: ["/api/me/universe"] });
      }
    } catch (e: any) {
      setSyncMsg(e?.message || "Sync network error");
    } finally {
      setBusy(null);
    }
  }

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="fantasy-panel p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3
              className="font-heading text-base text-[hsl(45,30%,92%)]"
              style={{ WebkitTextFillColor: "unset" }}
            >
              Nexus Decks — real DB only
            </h3>
            <p className="text-xs text-[hsl(45,15%,55%)] font-body mt-1 max-w-2xl">
              <strong className="text-emerald-300/90">No fake cards. No portal starter invent.</strong>{" "}
              Playable SSOT is Railway Postgres on{" "}
              <a href={NEXUS_HOST} className="text-[hsl(43,85%,55%)] underline" target="_blank" rel="noreferrer">
                grudgeplatform.io
              </a>
              : <code className="text-[hsl(43,85%,55%)]">user_season0_cards</code> +{" "}
              <code className="text-[hsl(43,85%,55%)]">/api/user/battledeck</code>. Portal only mirrors
              after a successful sync — or shows empty.
            </p>
          </div>
          <Database className="w-5 h-5 text-[hsl(43,85%,55%)] shrink-0" />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <a href={NEXUS_DECK_BUILDER} target="_blank" rel="noreferrer">
            <Button size="sm" className="gilded-button text-xs">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Deck Builder (SSOT)
            </Button>
          </a>
          <a href={NEXUS_LIBRARY} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline" className="text-xs border-[hsl(43,60%,30%)]/40">
              Collection / library
            </Button>
          </a>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-[hsl(43,60%,30%)]/40"
            disabled={busy === "sync"}
            onClick={() => syncFromNexus()}
          >
            {busy === "sync" ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
            )}
            Sync from grudgeplatform
          </Button>
          {(q.data as any)?.nexus?.synced && (
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
              Nexus mirror live
            </Badge>
          )}
          {purged > 0 && (
            <Badge className="bg-amber-500/15 text-amber-200 border-amber-500/30 text-[10px]">
              Purged {purged} fake deck{purged === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        {syncMsg && (
          <p className="text-xs mt-2 text-[hsl(45,20%,70%)] font-body border border-[hsl(43,60%,30%)]/25 rounded p-2">
            {syncMsg}
          </p>
        )}
        {(q.data as any)?.nexus?.error && (
          <p className="text-xs mt-2 text-amber-200/90 font-body">
            Sync note: {(q.data as any).nexus.error} — sign in with the same fleet JWT as grudgeplatform.
          </p>
        )}
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks.map((deck) => (
          <div
            key={deck.id}
            className={`fantasy-panel p-4 flex flex-col gap-3 ${
              deck.isActive ? "ring-1 ring-[hsl(43,85%,55%)]/50" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-heading text-sm text-[hsl(45,30%,92%)]">{deck.name}</h4>
                <p className="text-[11px] text-[hsl(45,15%,55%)] font-body mt-0.5 line-clamp-2">
                  {deck.description || "—"}
                </p>
              </div>
              {deck.isActive && (
                <Badge className="bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)] border-[hsl(43,85%,55%)]/40 text-[9px]">
                  <Star className="w-3 h-3 mr-0.5" /> Active
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[9px] border-[hsl(43,60%,30%)]/40">
                {deck.totalCards} cards
              </Badge>
              {isMirror(deck) && (
                <Badge className="text-[9px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                  DB mirror
                </Badge>
              )}
              <Badge
                variant="outline"
                className={`text-[9px] ${
                  deck.isValid
                    ? "border-emerald-500/40 text-emerald-300"
                    : "border-amber-500/40 text-amber-300"
                }`}
              >
                {deck.isValid ? "Valid 20" : "Incomplete"}
              </Badge>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1 text-[10px] font-mono text-[hsl(45,15%,60%)] border border-[hsl(43,60%,30%)]/15 rounded p-2 bg-black/20">
              {deck.cards.slice(0, 12).map((c) => (
                <div key={c.cardKey} className="flex justify-between gap-2">
                  <span className="truncate">
                    {c.name}
                    <span className="text-[hsl(45,15%,40%)]"> · #{c.cardKey}</span>
                  </span>
                  <span>×{c.qty}</span>
                </div>
              ))}
              {deck.cards.length > 12 && (
                <div className="text-[hsl(45,15%,45%)]">+{deck.cards.length - 12} more…</div>
              )}
            </div>
            <div className="flex gap-2 mt-auto">
              {!deck.isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs border-[hsl(43,60%,30%)]/40"
                  disabled={busy === deck.id}
                  onClick={() => setActive(deck)}
                >
                  Set active
                </Button>
              )}
              <Button
                size="sm"
                className="gilded-button flex-1 text-xs"
                disabled={!!busy}
                onClick={() => play(deck)}
              >
                {busy === `play-${deck.id}` ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 mr-1" /> Open Nexus
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {!decks.length && (
        <div className="fantasy-panel p-8 text-center text-[hsl(45,15%,55%)] font-body">
          <Layers className="w-8 h-8 mx-auto mb-3 text-[hsl(43,85%,55%)]/70" />
          <p className="font-heading text-[hsl(45,30%,85%)]">No real battle deck mirrored yet</p>
          <p className="text-xs mt-2 max-w-md mx-auto">
            Portal will not invent a starter. Save a 20-card deck on grudgeplatform (owned Season 0
            instances), then sync — or open the Deck Builder directly.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <a href={NEXUS_DECK_BUILDER} target="_blank" rel="noreferrer">
              <Button size="sm" className="gilded-button">
                Build on grudgeplatform.io
              </Button>
            </a>
            <Button
              size="sm"
              variant="outline"
              className="border-[hsl(43,60%,30%)]/40"
              disabled={busy === "sync"}
              onClick={() => syncFromNexus()}
            >
              Sync from DB
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
