import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Star, Layers } from "lucide-react";
import {
  fetchUniverse,
  launchWithDeck,
  patchDeck,
  type UniverseDeck,
  type UniverseSnapshot,
} from "@/lib/universe-api";

export default function AccountDecks() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<number | string | null>(null);

  const q = useQuery<UniverseSnapshot>({
    queryKey: ["/api/me/universe"],
    queryFn: fetchUniverse,
  });

  const decks = q.data?.decks ?? [];

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
            <h3 className="font-heading text-base text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
              Nexus Decks
            </h3>
            <p className="text-xs text-[hsl(45,15%,55%)] font-body mt-1 max-w-xl">
              Portal-owned deck snapshots. New accounts receive a Grudge Starter deck. Launch into Nexus Nemesis
              with your active list — expand via packs on the TCG host.
            </p>
          </div>
          <Layers className="w-5 h-5 text-[hsl(43,85%,55%)] shrink-0" />
        </div>
        {q.data?.bootstrapped?.deck && (
          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
            Starter deck provisioned
          </Badge>
        )}
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks.map((deck) => (
          <div
            key={deck.id}
            className={`fantasy-panel p-4 flex flex-col gap-3 ${deck.isActive ? "ring-1 ring-[hsl(43,85%,55%)]/50" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-heading text-sm text-[hsl(45,30%,92%)]">{deck.name}</h4>
                <p className="text-[11px] text-[hsl(45,15%,55%)] font-body mt-0.5 line-clamp-2">
                  {deck.description || "No description"}
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
              {deck.tribe && (
                <Badge variant="outline" className="text-[9px] border-[hsl(43,60%,30%)]/40 capitalize">
                  {deck.tribe}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={`text-[9px] ${deck.isValid ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}`}
              >
                {deck.isValid ? "Valid" : "Incomplete"}
              </Badge>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1 text-[10px] font-mono text-[hsl(45,15%,60%)] border border-[hsl(43,60%,30%)]/15 rounded p-2 bg-black/20">
              {deck.cards.slice(0, 12).map((c) => (
                <div key={c.cardKey} className="flex justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  <span>×{c.qty}</span>
                </div>
              ))}
              {deck.cards.length > 12 && (
                <div className="text-[hsl(45,15%,45%)]">+{deck.cards.length - 12} more types…</div>
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
                    <Play className="w-3.5 h-3.5 mr-1" /> Play Nexus
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {!decks.length && (
        <div className="fantasy-panel p-8 text-center text-[hsl(45,15%,55%)] font-body">
          No decks yet — refresh to provision the starter deck.
          <div className="mt-3">
            <Button size="sm" className="gilded-button" onClick={() => q.refetch()}>
              Bootstrap
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
