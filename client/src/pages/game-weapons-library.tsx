/**
 * Grudge6 Canonical Items Library — grudge6.grudge-studio.com/game/weapons
 *
 * Information + prefab reference for weapons, armor, character loadouts, and assets.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  BookOpen,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  Package,
  Search,
  Shield,
  Swords,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemModelPreview } from "@/components/item-model-preview";
import { PrefabModelPreview } from "@/components/prefab-model-preview";
import type { ClassId, RaceId } from "@shared/character-prefabs";
import {
  CANONICAL_SOURCES,
  filterLibraryItems,
  loadCanonicalLibrary,
  uniqueCategories,
  type CanonicalItem,
  type CanonicalLibrary,
  type LibraryKind,
} from "@/lib/canonical-items";

type TabKind = LibraryKind | "all";

const TAB_META: { key: TabKind; label: string; Icon: typeof Swords }[] = [
  { key: "all", label: "All", Icon: Package },
  { key: "weapon", label: "Weapons", Icon: Swords },
  { key: "armor", label: "Armor", Icon: Shield },
  { key: "prefab", label: "Prefabs", Icon: Users },
];

const PREFAB_RACES: RaceId[] = ["human", "barbarian", "elf", "dwarf", "orc", "undead"];
const PREFAB_CLASSES: ClassId[] = ["warrior", "mage", "ranger", "worge"];

const RACE_LABELS: Record<RaceId, string> = {
  human: "Human",
  barbarian: "Barbarian",
  elf: "Elf",
  dwarf: "Dwarf",
  orc: "Orc",
  undead: "Undead",
};

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
}

function PrefabIconStack({ item }: { item: CanonicalItem }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-2">
      {item.raceIconUrl && (
        <img
          src={item.raceIconUrl}
          alt=""
          className="w-[72%] h-[72%] object-contain drop-shadow-md"
          loading="lazy"
        />
      )}
      {item.classIconUrl && (
        <img
          src={item.classIconUrl}
          alt=""
          className="absolute bottom-1 right-1 w-[38%] h-[38%] object-contain rounded bg-[hsl(225,25%,8%)]/90 border border-[hsl(43,60%,30%)]/40 p-0.5"
          loading="lazy"
        />
      )}
    </div>
  );
}

export default function GameWeaponsLibraryPage() {
  const [lib, setLib] = useState<CanonicalLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKind>("weapon");
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<number | "all">("all");
  const [category, setCategory] = useState("all");
  const [raceFilter, setRaceFilter] = useState<RaceId | "all">("all");
  const [classFilter, setClassFilter] = useState<ClassId | "all">("all");
  const [selected, setSelected] = useState<CanonicalItem | null>(null);

  useEffect(() => {
    let live = true;
    loadCanonicalLibrary()
      .then((data) => {
        if (!live) return;
        setLib(data);
        setSelected(data.weapons[0] ?? data.armor[0] ?? data.prefabs[0] ?? null);
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : "Failed to load catalog");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const pool = useMemo(() => {
    if (!lib) return [];
    if (tab === "weapon") return lib.weapons;
    if (tab === "armor") return lib.armor;
    if (tab === "prefab") return lib.prefabs;
    return [...lib.weapons, ...lib.armor, ...lib.prefabs];
  }, [lib, tab]);

  const filtered = useMemo(() => {
    let items = filterLibraryItems(pool, {
      kind: tab === "all" ? "all" : tab,
      query,
      tier: tab === "prefab" ? "all" : tier,
      category: tab === "prefab" ? "all" : category,
    });
    if (tab === "prefab" || tab === "all") {
      if (raceFilter !== "all") {
        items = items.filter((i) => i.prefab?.race === raceFilter);
      }
      if (classFilter !== "all") {
        items = items.filter((i) => i.prefab?.classId === classFilter);
      }
    }
    return items;
  }, [pool, tab, query, tier, category, raceFilter, classFilter]);

  const categories = useMemo(() => uniqueCategories(pool), [pool]);

  const isDedicatedHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "character.grudge-studio.com" ||
      window.location.hostname === "characters.grudge-studio.com" ||
      window.location.hostname === "grudge6.grudge-studio.com");

  const counts = lib
    ? {
        weapons: lib.weapons.length,
        armor: lib.armor.length,
        prefabs: lib.prefabs.length,
        total: lib.weapons.length + lib.armor.length + lib.prefabs.length,
      }
    : null;

  return (
    <div className="min-h-screen bg-[hsl(225,30%,6%)] text-[hsl(45,30%,92%)] flex flex-col">
      <header className="shrink-0 border-b border-[hsl(43,60%,30%)]/25 bg-[hsl(225,25%,8%)]/90 backdrop-blur px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {!isDedicatedHost && (
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)]">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Portal
                </Button>
              </Link>
            )}
            <div>
              <h1 className="text-lg font-heading text-[hsl(43,85%,55%)] flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Canonical Items Library
              </h1>
              <p className="text-xs text-[hsl(45,15%,55%)]">
                {counts
                  ? `${counts.weapons} weapons · ${counts.armor} armor · ${counts.prefabs} Grudge6 prefabs`
                  : "Loading ObjectStore master data…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/viewer">
              <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)]/40">
                <Users className="w-3.5 h-3.5 mr-1" /> Characters
              </Button>
            </Link>
            <Link href="/roster">
              <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)]/40">
                <Layers className="w-3.5 h-3.5 mr-1" /> Roster
              </Button>
            </Link>
            <a
              href={CANONICAL_SOURCES.weapons}
              target="_blank"
              rel="noreferrer"
              className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)]"
              title="Master weapons JSON"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 grid grid-cols-1 xl:grid-cols-[minmax(280px,320px)_minmax(320px,1fr)_minmax(340px,400px)] gap-4 min-h-0">
        {/* Filters */}
        <aside className="flex flex-col gap-3 min-h-0">
          <div className="flex flex-wrap gap-1.5">
            {TAB_META.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  setCategory("all");
                  setRaceFilter("all");
                  setClassFilter("all");
                  if (key === "prefab" && lib?.prefabs[0]) {
                    setSelected(lib.prefabs[0]);
                  }
                }}
                className={`text-[10px] px-2.5 py-1 rounded border flex items-center gap-1 transition-colors ${
                  tab === key
                    ? "border-[hsl(43,85%,55%)]/60 text-[hsl(43,85%,55%)] bg-[hsl(43,85%,55%)]/10"
                    : "border-[hsl(43,60%,30%)]/25 text-[hsl(45,15%,60%)] hover:border-[hsl(43,60%,30%)]/50"
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-[hsl(45,15%,50%)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, uuid, mesh…"
              className="pl-9 bg-[hsl(225,25%,10%)] border-[hsl(43,60%,30%)]/30"
            />
          </div>

          {(tab === "prefab" || tab === "all") && (
            <>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-[hsl(45,15%,50%)] w-full uppercase tracking-wider">Race</span>
                <button
                  type="button"
                  onClick={() => setRaceFilter("all")}
                  className={`text-[10px] px-2 py-0.5 rounded border ${
                    raceFilter === "all"
                      ? "border-[hsl(43,85%,55%)]/50 text-[hsl(43,85%,55%)]"
                      : "border-[hsl(43,60%,30%)]/20 text-[hsl(45,15%,55%)]"
                  }`}
                >
                  All
                </button>
                {PREFAB_RACES.map((race) => (
                  <button
                    key={race}
                    type="button"
                    onClick={() => setRaceFilter(race)}
                    className={`text-[10px] px-2 py-0.5 rounded border ${
                      raceFilter === race
                        ? "border-[hsl(43,85%,55%)]/50 text-[hsl(43,85%,55%)]"
                        : "border-[hsl(43,60%,30%)]/20 text-[hsl(45,15%,55%)]"
                    }`}
                  >
                    {RACE_LABELS[race]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] text-[hsl(45,15%,50%)] w-full uppercase tracking-wider">Class</span>
                <button
                  type="button"
                  onClick={() => setClassFilter("all")}
                  className={`text-[10px] px-2 py-0.5 rounded border capitalize ${
                    classFilter === "all"
                      ? "border-[hsl(43,85%,55%)]/50 text-[hsl(43,85%,55%)]"
                      : "border-[hsl(43,60%,30%)]/20 text-[hsl(45,15%,55%)]"
                  }`}
                >
                  All
                </button>
                {PREFAB_CLASSES.map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setClassFilter(cls)}
                    className={`text-[10px] px-2 py-0.5 rounded border capitalize ${
                      classFilter === cls
                        ? "border-[hsl(43,85%,55%)]/50 text-[hsl(43,85%,55%)]"
                        : "border-[hsl(43,60%,30%)]/20 text-[hsl(45,15%,55%)]"
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab !== "prefab" && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] text-[hsl(45,15%,50%)] w-full uppercase tracking-wider">Tier</span>
              {(["all", 1, 2, 3, 4, 5, 6, 7, 8] as const).map((t) => (
                <button
                  key={String(t)}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`text-[10px] px-2 py-0.5 rounded border ${
                    tier === t
                      ? "border-[hsl(43,85%,55%)]/50 text-[hsl(43,85%,55%)]"
                      : "border-[hsl(43,60%,30%)]/20 text-[hsl(45,15%,55%)]"
                  }`}
                >
                  {t === "all" ? "Any" : `T${t}`}
                </button>
              ))}
            </div>
          )}

          {categories.length > 1 && tab !== "prefab" && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-xs rounded border border-[hsl(43,60%,30%)]/30 bg-[hsl(225,25%,10%)] px-2 py-2"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <p className="text-[10px] text-[hsl(45,15%,50%)]">
            {filtered.length} of {pool.length} entries
            {lib?.generated ? ` · generated ${new Date(lib.generated).toLocaleDateString()}` : ""}
          </p>
        </aside>

        {/* Grid */}
        <section className="min-h-0 flex flex-col border border-[hsl(43,60%,30%)]/20 rounded-lg bg-[hsl(225,25%,8%)]/50 overflow-hidden">
          {loading && (
            <div className="flex-1 flex items-center justify-center text-[hsl(43,85%,55%)]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
          {error && (
            <div className="flex-1 flex items-center justify-center text-sm text-[hsl(0,60%,55%)] px-4 text-center">
              {error}
            </div>
          )}
          {!loading && !error && (
            <div className="flex-1 overflow-auto p-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 content-start">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`text-left rounded-lg border p-2 transition-all hover:border-[hsl(43,85%,55%)]/40 ${
                    selected?.id === item.id
                      ? "border-[hsl(43,85%,55%)]/60 bg-[hsl(43,85%,55%)]/8"
                      : "border-[hsl(43,60%,30%)]/20 bg-[hsl(225,25%,10%)]/60"
                  }`}
                >
                  <div className="aspect-square rounded bg-[#0d0908] mb-2 flex items-center justify-center overflow-hidden">
                    {item.kind === "prefab" ? (
                      <PrefabIconStack item={item} />
                    ) : item.iconUrl ? (
                      <img src={item.iconUrl} alt="" className="w-full h-full object-contain p-1" loading="lazy" />
                    ) : (
                      <Package className="w-8 h-8 text-[hsl(45,15%,40%)]" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium truncate">{item.name}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 border-[hsl(43,60%,30%)]/30"
                      style={{ color: item.tierColor }}
                    >
                      {item.tierLabel}
                    </Badge>
                    <span className="text-[9px] text-[hsl(45,15%,50%)] capitalize">{item.kind}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Detail */}
        <aside className="min-h-0 overflow-auto flex flex-col gap-3 border border-[hsl(43,60%,30%)]/20 rounded-lg bg-[hsl(225,25%,8%)]/50 p-4">
          {!selected ? (
            <p className="text-sm text-[hsl(45,15%,55%)]">Select an item to inspect prefab data and assets.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  {selected.kind === "prefab" && (
                    <div className="relative shrink-0 w-12 h-12">
                      {selected.raceIconUrl && (
                        <img src={selected.raceIconUrl} alt="" className="w-full h-full object-contain" />
                      )}
                      {selected.classIconUrl && (
                        <img
                          src={selected.classIconUrl}
                          alt=""
                          className="absolute -bottom-0.5 -right-0.5 w-5 h-5 object-contain rounded bg-[hsl(225,25%,8%)] border border-[hsl(43,60%,30%)]/40 p-0.5"
                        />
                      )}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-base font-heading text-[hsl(43,85%,55%)]">{selected.name}</h2>
                    <p className="text-[10px] text-[hsl(45,15%,50%)] font-mono break-all">{selected.uuid}</p>
                    {selected.prefab && (
                      <p className="text-[10px] text-[hsl(45,15%,55%)] capitalize mt-0.5">
                        {selected.prefab.race} · {selected.prefab.classId} · {selected.prefab.faction}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-[hsl(43,60%,30%)]/40"
                  onClick={() =>
                    copyText(JSON.stringify(selected.prefabJson ?? selected, null, 2))
                  }
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Prefab JSON
                </Button>
              </div>

              {selected.description && (
                <p className="text-xs text-[hsl(45,15%,65%)] leading-relaxed">{selected.description}</p>
              )}

              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <Badge variant="outline" style={{ borderColor: selected.tierColor, color: selected.tierColor }}>
                  {selected.tierLabel}
                </Badge>
                <Badge variant="outline" className="border-[hsl(43,60%,30%)]/30 capitalize">
                  {selected.category}
                </Badge>
                {selected.slotType && (
                  <Badge variant="outline" className="border-[hsl(43,60%,30%)]/30">
                    {selected.slotType}
                  </Badge>
                )}
                {selected.setName && (
                  <Badge variant="outline" className="border-[hsl(43,60%,30%)]/30">
                    Set: {selected.setName}
                  </Badge>
                )}
              </div>

              {selected.prefab && (
                <PrefabModelPreview key={selected.prefab.id} prefab={selected.prefab} />
              )}

              {selected.modelUrl && !selected.prefab && (
                <ItemModelPreview modelUrl={selected.modelUrl} />
              )}

              {selected.stats && Object.keys(selected.stats).length > 0 && (
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] mb-1.5">Stats</h3>
                  <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                    {Object.entries(selected.stats).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-[hsl(43,60%,30%)]/15 py-0.5">
                        <span className="text-[hsl(45,15%,55%)] uppercase">{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.abilities && selected.abilities.length > 0 && (
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] mb-1">Abilities</h3>
                  <ul className="text-[11px] text-[hsl(45,15%,70%)] space-y-0.5 list-disc pl-4">
                    {selected.abilities.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.passives && selected.passives.length > 0 && (
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] mb-1">Passives</h3>
                  <ul className="text-[11px] text-[hsl(45,15%,70%)] space-y-0.5 list-disc pl-4">
                    {selected.passives.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.signature && (
                <p className="text-[11px] text-[hsl(43,85%,55%)]">
                  <span className="text-[hsl(45,15%,50%)]">Signature: </span>
                  {selected.signature}
                </p>
              )}

              {selected.meshNames && selected.meshNames.length > 0 && (
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] mb-1">
                    Wardrobe meshes (FBX prefab definition)
                  </h3>
                  <ul className="text-[10px] font-mono text-[hsl(45,15%,65%)] space-y-0.5 max-h-32 overflow-auto">
                    {selected.meshNames.map((m) => (
                      <li key={m} className="break-all">
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(selected.modelUrl || selected.modelPath) && (
                <div className="text-[10px] space-y-1 break-all">
                  {selected.modelUrl && (
                    <a
                      href={selected.modelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[hsl(43,85%,55%)] hover:underline block"
                    >
                      GLB: {selected.modelUrl}
                    </a>
                  )}
                  {selected.modelPath && (
                    <p className="text-[hsl(45,15%,50%)]">CDN path: {selected.modelPath}</p>
                  )}
                </div>
              )}

              <div className="text-[10px] text-[hsl(45,15%,45%)] mt-auto pt-2 border-t border-[hsl(43,60%,30%)]/15">
                Sources:{" "}
                <a href={CANONICAL_SOURCES.weapons} className="text-[hsl(43,85%,55%)] hover:underline" target="_blank" rel="noreferrer">
                  master-weapons
                </a>
                {" · "}
                <a href={CANONICAL_SOURCES.armor} className="text-[hsl(43,85%,55%)] hover:underline" target="_blank" rel="noreferrer">
                  master-armor
                </a>
                {" · "}
                <span>@shared/character-prefabs</span>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}