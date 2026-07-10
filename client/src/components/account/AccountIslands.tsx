import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Home, Loader2, Map, Play } from "lucide-react";
import {
  createIsland,
  fetchUniverse,
  launchWithIsland,
  patchIsland,
  type UniverseIsland,
  type UniverseSnapshot,
} from "@/lib/universe-api";

export default function AccountIslands() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState<string | number | null>(null);
  const [newName, setNewName] = useState("");
  const [biome, setBiome] = useState("tropical");

  const q = useQuery<UniverseSnapshot>({
    queryKey: ["/api/me/universe"],
    queryFn: fetchUniverse,
  });

  const islands = q.data?.islands ?? [];
  const biomes = q.data?.catalog?.biomes ?? [];

  async function makeHome(island: UniverseIsland) {
    setBusy(island.id);
    try {
      await patchIsland(island.id, { isHome: true });
      await qc.invalidateQueries({ queryKey: ["/api/me/universe"] });
    } finally {
      setBusy(null);
    }
  }

  async function visit(island: UniverseIsland, target: "islands" | "metaverse") {
    setBusy(`${target}-${island.id}`);
    try {
      await launchWithIsland(island, target, navigate);
      await qc.invalidateQueries({ queryKey: ["/api/me/universe"] });
    } finally {
      setBusy(null);
    }
  }

  async function addIsland() {
    if (!newName.trim()) return;
    setBusy("create");
    try {
      await createIsland({
        name: newName.trim(),
        biome,
        isHome: islands.length === 0,
      });
      setNewName("");
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-base text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
              Home Islands
            </h3>
            <p className="text-xs text-[hsl(45,15%,55%)] font-body mt-1 max-w-xl">
              Warlords-era plots bound to your Grudge ID — dock, hut, banner, and resources. Launch into Islands or
              Metaverse with your home seed.
            </p>
          </div>
          <Map className="w-5 h-5 text-[hsl(43,85%,55%)] shrink-0" />
        </div>
        {q.data?.bootstrapped?.island && (
          <Badge className="mt-2 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
            Home island provisioned
          </Badge>
        )}
      </section>

      <section className="fantasy-panel p-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <div className="flex-1">
          <label className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,55%)] font-body">New island</label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Outpost name"
            className="mt-1 bg-black/30 border-[hsl(43,60%,30%)]/30"
          />
        </div>
        <div className="sm:w-40">
          <label className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,55%)] font-body">Biome</label>
          <select
            value={biome}
            onChange={(e) => setBiome(e.target.value)}
            className="mt-1 w-full h-10 rounded-md bg-black/30 border border-[hsl(43,60%,30%)]/30 text-sm px-2"
          >
            {biomes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.emoji} {b.label}
              </option>
            ))}
          </select>
        </div>
        <Button className="gilded-button" disabled={busy === "create" || !newName.trim()} onClick={addIsland}>
          {busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Found island"}
        </Button>
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        {islands.map((island) => {
          const biomeMeta = biomes.find((b) => b.id === island.biome);
          const res = (island.layout as any)?.resources as Record<string, number> | undefined;
          return (
            <div
              key={island.id}
              className={`fantasy-panel p-4 flex flex-col gap-3 ${island.isHome ? "ring-1 ring-[hsl(43,85%,55%)]/50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-heading text-sm text-[hsl(45,30%,92%)]">
                    {biomeMeta?.emoji ?? "🏝️"} {island.name}
                  </h4>
                  <p className="text-[11px] text-[hsl(45,15%,55%)] font-body capitalize mt-0.5">
                    {biomeMeta?.label ?? island.biome}
                  </p>
                </div>
                {island.isHome && (
                  <Badge className="bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)] border-[hsl(43,85%,55%)]/40 text-[9px]">
                    <Home className="w-3 h-3 mr-0.5" /> Home
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded bg-black/25 p-2">
                  <div className="text-[9px] text-[hsl(45,15%,50%)]">Level</div>
                  <div className="font-heading text-[hsl(43,85%,55%)]">{island.progress?.level ?? 1}</div>
                </div>
                <div className="rounded bg-black/25 p-2">
                  <div className="text-[9px] text-[hsl(45,15%,50%)]">Defense</div>
                  <div className="font-heading text-[hsl(43,85%,55%)]">{island.progress?.defense ?? 0}</div>
                </div>
                <div className="rounded bg-black/25 p-2">
                  <div className="text-[9px] text-[hsl(45,15%,50%)]">Pop</div>
                  <div className="font-heading text-[hsl(43,85%,55%)]">{island.progress?.population ?? 0}</div>
                </div>
              </div>
              {res && (
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-[hsl(45,15%,60%)]">
                  {Object.entries(res).map(([k, v]) => (
                    <span key={k} className="px-1.5 py-0.5 rounded bg-black/30 border border-[hsl(43,60%,30%)]/20">
                      {k}:{v}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-auto">
                {!island.isHome && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-[hsl(43,60%,30%)]/40"
                    disabled={busy === island.id}
                    onClick={() => makeHome(island)}
                  >
                    Set home
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gilded-button text-xs flex-1"
                  disabled={!!busy}
                  onClick={() => visit(island, "islands")}
                >
                  {busy === `islands-${island.id}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 mr-1" /> Visit
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-[hsl(43,60%,30%)]/40"
                  disabled={!!busy}
                  onClick={() => visit(island, "metaverse")}
                >
                  Metaverse
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {!islands.length && (
        <div className="fantasy-panel p-8 text-center text-[hsl(45,15%,55%)] font-body">
          No islands — refresh to claim your home plot.
        </div>
      )}
    </div>
  );
}
