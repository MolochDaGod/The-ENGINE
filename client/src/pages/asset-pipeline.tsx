/**
 * Grudge Studio — Asset Pipeline Admin
 *
 * Admin-only page for managing all game assets across R2 + D1.
 * Features:
 *   - Browse all 4,778+ assets by category, search, and tags
 *   - 3D model preview with mesh hierarchy inspection
 *   - Metadata editor (icon, stats, spell, bone attachment)
 *   - Bulk import from GitHub ObjectStore icons
 *   - Sync status between D1 index and R2 files
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Box, Database, Download, ExternalLink, Eye, FileText, Folder,
  Image, Layers, Loader2, Package, RefreshCw, Search, Upload, Zap,
} from "lucide-react";
import { Link } from "wouter";

// ── Types ──────────────────────────────────────────────────────────

interface AssetItem {
  id: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  category: string;
  tags: string[];
  visibility: string;
  metadata: Record<string, any>;
  created_at: string;
  file_url: string;
}

interface AssetSearchResult {
  items: AssetItem[];
  count: number;
  limit: number;
  offset: number;
}

interface CategoryCount {
  category: string;
  count: number;
}

// ── API helpers ────────────────────────────────────────────────────

const OBJECTSTORE_API = "https://objectstore.grudge-studio.com/v1";
const GITHUB_ICONS_BASE = "https://molochdagod.github.io/ObjectStore/icons";
const ASSETS_CDN = "https://assets.grudge-studio.com";

async function fetchAssets(params: { category?: string; q?: string; limit?: number; offset?: number }): Promise<AssetSearchResult> {
  const url = new URL(`${OBJECTSTORE_API}/assets`);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.q) url.searchParams.set("q", params.q);
  url.searchParams.set("limit", String(params.limit || 50));
  url.searchParams.set("offset", String(params.offset || 0));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`ObjectStore API ${r.status}`);
  return r.json();
}

// GitHub icon directories with known counts
const ICON_CATEGORIES = [
  { dir: "weapons", label: "Weapons", count: 584 },
  { dir: "armor", label: "Armor", count: 533 },
  { dir: "armor_full", label: "Armor (Full)", count: 503 },
  { dir: "weapons_full", label: "Weapons (Full)", count: 502 },
  { dir: "resources", label: "Resources", count: 478 },
  { dir: "spells", label: "Spells", count: 358 },
  { dir: "skills", label: "Skills", count: 198 },
  { dir: "consumables", label: "Consumables", count: 128 },
  { dir: "abilities", label: "Abilities", count: 86 },
  { dir: "materials", label: "Materials", count: 79 },
  { dir: "loot", label: "Loot", count: 48 },
  { dir: "food", label: "Food", count: 41 },
  { dir: "magic-effects", label: "Magic Effects", count: 20 },
  { dir: "projectile_frames", label: "Projectiles", count: 16 },
  { dir: "potions", label: "Potions", count: 15 },
  { dir: "professions", label: "Professions", count: 13 },
];

// ── Asset categories from D1 ───────────────────────────────────────

const D1_CATEGORIES = [
  { key: "icon", label: "Icons", icon: "🎨", count: 1941 },
  { key: "sprite", label: "Sprites", icon: "🖼️", count: 1357 },
  { key: "effect", label: "VFX Effects", icon: "✨", count: 176 },
  { key: "items", label: "3D Items", icon: "⚔️", count: 72 },
  { key: "characters", label: "Characters", icon: "🧑", count: 47 },
  { key: "ui", label: "UI Elements", icon: "📐", count: 35 },
  { key: "environments", label: "Environments", icon: "🌲", count: 19 },
  { key: "animations", label: "Animations", icon: "🎬", count: 16 },
  { key: "weapons", label: "Weapons (3D)", icon: "🗡️", count: 13 },
];

// Game data datasets served by The-ENGINE
const GAME_DATASETS = [
  { key: "weapons", label: "Weapons DB", desc: "843 weapons with stats, abilities, tiers" },
  { key: "armor", label: "Armor DB", desc: "1,218 armor pieces with set bonuses" },
  { key: "items", label: "Items", desc: "General items and craftables" },
  { key: "recipes", label: "Recipes", desc: "Crafting recipes" },
  { key: "consumables", label: "Consumables", desc: "Potions, food, scrolls" },
  { key: "relics", label: "Relics", desc: "Equipment relics" },
  { key: "capes", label: "Capes", desc: "Cape equipment" },
  { key: "shields", label: "Shields", desc: "Shield equipment" },
  { key: "mounts", label: "Mounts", desc: "Rideable mounts" },
  { key: "classes", label: "Classes", desc: "Warrior, Mage, Ranger, Worge" },
  { key: "races", label: "Races", desc: "Human, Elf, Dwarf, Orc, Barbarian, Undead" },
  { key: "professions", label: "Professions", desc: "Miner, Forester, Mystic, Chef, Engineer" },
];

// ── Component ──────────────────────────────────────────────────────

export default function AssetPipeline() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();

  const assetsQuery = useQuery<AssetSearchResult>({
    queryKey: ["pipeline-assets", activeCategory, searchQuery, offset],
    queryFn: () => fetchAssets({
      category: activeCategory || undefined,
      q: searchQuery || undefined,
      limit: 50,
      offset,
    }),
    staleTime: 30_000,
  });

  const healthQuery = useQuery({
    queryKey: ["objectstore-health"],
    queryFn: async () => {
      const r = await fetch("https://objectstore.grudge-studio.com/health");
      return r.json();
    },
    staleTime: 60_000,
  });

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    queryClient.invalidateQueries({ queryKey: ["pipeline-assets"] });
  }, [queryClient]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getFileIcon = (mime: string, filename: string) => {
    if (mime.startsWith("model/") || filename.match(/\.(glb|gltf|fbx|obj)$/i)) return "🧊";
    if (mime.startsWith("image/") || filename.match(/\.(png|jpg|webp|gif)$/i)) return "🖼️";
    if (filename.match(/\.(mp3|ogg|wav)$/i)) return "🔊";
    if (filename.match(/\.(json)$/i)) return "📄";
    return "📦";
  };

  return (
    <div className="min-h-screen bg-[hsl(225,30%,6%)] text-[hsl(45,30%,90%)]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading gold-text" style={{ WebkitTextFillColor: "unset" }}>
              Asset Pipeline
            </h1>
            <p className="text-sm text-[hsl(45,15%,60%)] font-body mt-1">
              Manage all game assets across R2 CDN, D1 index, and game databases
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`border text-[10px] ${healthQuery.data?.status === "ok" ? "bg-[hsl(120,60%,50%)]/15 text-[hsl(120,60%,60%)] border-[hsl(120,60%,50%)]/30" : "bg-[hsl(0,60%,55%)]/15 text-[hsl(0,70%,70%)] border-[hsl(0,60%,55%)]/30"}`}>
              {healthQuery.data?.status === "ok" ? "● R2 Connected" : "● Checking..."}
            </Badge>
            <Badge className="border text-[10px] bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border-[hsl(43,60%,30%)]/30">
              {assetsQuery.data?.count || "..."} total assets
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="browse" className="w-full">
          <TabsList className="w-full justify-start bg-[hsl(225,25%,10%)] border border-[hsl(43,60%,30%)]/15 rounded-lg p-1 gap-1 h-auto flex-wrap">
            <TabsTrigger value="browse" className="data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)] text-[hsl(45,15%,55%)] text-xs font-heading">
              <Database className="w-3.5 h-3.5 mr-1.5" /> Browse D1
            </TabsTrigger>
            <TabsTrigger value="icons" className="data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)] text-[hsl(45,15%,55%)] text-xs font-heading">
              <Image className="w-3.5 h-3.5 mr-1.5" /> Icon Library
            </TabsTrigger>
            <TabsTrigger value="gamedata" className="data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)] text-[hsl(45,15%,55%)] text-xs font-heading">
              <Layers className="w-3.5 h-3.5 mr-1.5" /> Game Data
            </TabsTrigger>
            <TabsTrigger value="cdn" className="data-[state=active]:bg-[hsl(43,85%,55%)]/15 data-[state=active]:text-[hsl(43,85%,55%)] text-[hsl(45,15%,55%)] text-xs font-heading">
              <Package className="w-3.5 h-3.5 mr-1.5" /> R2 CDN
            </TabsTrigger>
          </TabsList>

          {/* ── Browse D1 Assets ──────────────────────────────── */}
          <TabsContent value="browse" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
              {/* Sidebar: categories */}
              <div className="fantasy-panel p-4 h-fit">
                <div className="text-xs uppercase tracking-widest text-[hsl(43,85%,55%)] font-heading mb-3">Categories</div>
                <button
                  onClick={() => { setActiveCategory(""); setOffset(0); }}
                  className={`w-full text-left p-2 rounded text-sm mb-1 transition ${!activeCategory ? "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)]" : "text-[hsl(45,15%,60%)] hover:bg-[hsl(225,25%,15%)]"}`}
                >
                  📦 All Assets <span className="float-right text-xs opacity-60">4,778</span>
                </button>
                {D1_CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => { setActiveCategory(cat.key); setOffset(0); }}
                    className={`w-full text-left p-2 rounded text-sm mb-1 transition ${activeCategory === cat.key ? "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)]" : "text-[hsl(45,15%,60%)] hover:bg-[hsl(225,25%,15%)]"}`}
                  >
                    {cat.icon} {cat.label} <span className="float-right text-xs opacity-60">{cat.count}</span>
                  </button>
                ))}
              </div>

              {/* Main: search + results */}
              <div>
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(45,15%,40%)]" />
                    <Input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search assets... (sword, fireball, tree, heal)"
                      className="pl-10 bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/25 text-[hsl(45,30%,90%)]"
                    />
                  </div>
                  <Button type="submit" className="gilded-button">
                    <Search className="w-4 h-4" />
                  </Button>
                </form>

                {assetsQuery.isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[hsl(43,85%,55%)]" /></div>
                ) : (
                  <>
                    <div className="text-xs text-[hsl(45,15%,50%)] mb-3">
                      Showing {assetsQuery.data?.items?.length || 0} of {assetsQuery.data?.count || 0} assets
                      {activeCategory && <> in <span className="text-[hsl(43,85%,55%)]">{activeCategory}</span></>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {assetsQuery.data?.items?.map(asset => (
                        <button
                          key={asset.id}
                          onClick={() => setSelectedAsset(asset)}
                          className={`fantasy-panel p-3 text-left hover:rune-glow transition ${selectedAsset?.id === asset.id ? "ring-2 ring-[hsl(43,85%,55%)]" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="text-2xl flex-shrink-0">{getFileIcon(asset.mime, asset.filename)}</div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{asset.filename}</div>
                              <div className="text-[10px] text-[hsl(45,15%,50%)] mt-0.5">
                                {asset.category} · {formatSize(asset.size)}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {asset.tags?.slice(0, 3).map(tag => (
                                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(225,25%,15%)] text-[hsl(45,15%,55%)]">{tag}</span>
                                ))}
                              </div>
                              {asset.metadata?.bundle && (
                                <div className="text-[10px] text-[hsl(43,85%,55%)] mt-1 truncate">
                                  📦 {asset.metadata.bundle}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Pagination */}
                    {(assetsQuery.data?.count || 0) > 50 && (
                      <div className="flex justify-center gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={offset === 0}
                          onClick={() => setOffset(Math.max(0, offset - 50))}
                          className="border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)]"
                        >
                          ← Previous
                        </Button>
                        <span className="text-xs text-[hsl(45,15%,50%)] self-center">
                          Page {Math.floor(offset / 50) + 1} of {Math.ceil((assetsQuery.data?.count || 0) / 50)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={offset + 50 >= (assetsQuery.data?.count || 0)}
                          onClick={() => setOffset(offset + 50)}
                          className="border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)]"
                        >
                          Next →
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Asset Detail Panel */}
            {selectedAsset && (
              <div className="fantasy-panel p-5 mt-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-heading text-lg text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
                      {getFileIcon(selectedAsset.mime, selectedAsset.filename)} {selectedAsset.filename}
                    </h3>
                    <div className="text-xs text-[hsl(45,15%,50%)] font-mono mt-1">{selectedAsset.id}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedAsset(null)} className="text-[hsl(45,15%,55%)]">✕</Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-black/20 p-3 rounded border border-[hsl(43,60%,30%)]/15">
                    <div className="text-[10px] text-[hsl(45,15%,50%)] uppercase">Category</div>
                    <div className="text-sm">{selectedAsset.category}</div>
                  </div>
                  <div className="bg-black/20 p-3 rounded border border-[hsl(43,60%,30%)]/15">
                    <div className="text-[10px] text-[hsl(45,15%,50%)] uppercase">Format</div>
                    <div className="text-sm">{selectedAsset.metadata?.format || selectedAsset.mime}</div>
                  </div>
                  <div className="bg-black/20 p-3 rounded border border-[hsl(43,60%,30%)]/15">
                    <div className="text-[10px] text-[hsl(45,15%,50%)] uppercase">Size</div>
                    <div className="text-sm">{formatSize(selectedAsset.size)}</div>
                  </div>
                  <div className="bg-black/20 p-3 rounded border border-[hsl(43,60%,30%)]/15">
                    <div className="text-[10px] text-[hsl(45,15%,50%)] uppercase">Bundle</div>
                    <div className="text-sm truncate">{selectedAsset.metadata?.bundle || "—"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-[hsl(43,85%,55%)] font-heading mb-2">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedAsset.tags?.map(tag => (
                        <Badge key={tag} variant="outline" className="border-[hsl(43,60%,30%)]/40 text-[hsl(43,85%,55%)]">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-[hsl(43,85%,55%)] font-heading mb-2">Metadata</div>
                    <pre className="text-[10px] text-[hsl(45,15%,60%)] bg-black/30 p-2 rounded overflow-x-auto max-h-32">
                      {JSON.stringify(selectedAsset.metadata, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[hsl(43,60%,30%)]/15">
                  <div className="text-xs uppercase tracking-wider text-[hsl(43,85%,55%)] font-heading mb-2">CDN URL</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-[hsl(45,15%,55%)] bg-black/30 p-2 rounded flex-1 overflow-x-auto">
                      {selectedAsset.file_url}
                    </code>
                    <div className={`w-3 h-3 rounded-full ${selectedAsset.file_url?.includes("undefined") ? "bg-[hsl(0,70%,50%)]" : "bg-[hsl(120,60%,50%)]"}`}
                      title={selectedAsset.file_url?.includes("undefined") ? "File not uploaded to R2" : "File available on CDN"} />
                  </div>
                  {selectedAsset.file_url?.includes("undefined") && (
                    <div className="text-[10px] text-[hsl(0,70%,60%)] mt-1">
                      ⚠ File not uploaded to R2 — metadata exists in D1 but binary is missing
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <div className="text-[10px] text-[hsl(45,15%,50%)]">SHA256: {selectedAsset.sha256?.substring(0, 16)}...</div>
                  <div className="text-[10px] text-[hsl(45,15%,50%)]">Created: {selectedAsset.created_at}</div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Icon Library ──────────────────────────────────── */}
          <TabsContent value="icons" className="mt-4">
            <div className="fantasy-panel p-5">
              <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>
                GitHub Icon Library — molochdagod/ObjectStore
              </h3>
              <p className="text-sm text-[hsl(45,15%,60%)] mb-4">
                3,600+ organized icons hosted on GitHub Pages. These are the canonical icons used by the GRUDGE_Item_Database and all game frontends.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {ICON_CATEGORIES.map(cat => (
                  <a
                    key={cat.dir}
                    href={`https://github.com/MolochDaGod/ObjectStore/tree/main/icons/${cat.dir}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fantasy-panel p-3 hover:rune-glow transition text-center"
                  >
                    <div className="text-2xl mb-1"><Image className="w-6 h-6 mx-auto text-[hsl(43,85%,55%)]" /></div>
                    <div className="text-sm font-medium">{cat.label}</div>
                    <div className="text-lg font-heading gold-text">{cat.count}</div>
                    <div className="text-[10px] text-[hsl(45,15%,50%)]">icons</div>
                  </a>
                ))}
              </div>
              <div className="mt-4 p-3 bg-black/20 rounded border border-[hsl(43,60%,30%)]/15">
                <div className="text-xs text-[hsl(43,85%,55%)] font-heading mb-1">CDN Base URL</div>
                <code className="text-xs text-[hsl(45,15%,55%)]">
                  {GITHUB_ICONS_BASE}/{"<category>/<filename>.png"}
                </code>
                <div className="text-[10px] text-[hsl(45,15%,50%)] mt-1">
                  Example: {GITHUB_ICONS_BASE}/weapons/bloodfeud-blade.png
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Game Data ─────────────────────────────────────── */}
          <TabsContent value="gamedata" className="mt-4">
            <div className="fantasy-panel p-5">
              <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>
                Game Data Datasets — The-ENGINE API
              </h3>
              <p className="text-sm text-[hsl(45,15%,60%)] mb-4">
                Live item/equipment datasets served by the Railway backend. Data sourced from ObjectStore, cached 5 minutes.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {GAME_DATASETS.map(ds => (
                  <div key={ds.key} className="fantasy-panel p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{ds.label}</div>
                      <a
                        href={`/api/studio/game-data/${ds.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[hsl(43,85%,55%)] hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="text-xs text-[hsl(45,15%,55%)]">{ds.desc}</div>
                    <code className="text-[10px] text-[hsl(45,15%,40%)] mt-1 block">/api/studio/game-data/{ds.key}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="fantasy-panel p-5 mt-4">
              <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>
                Static Item Database — Cloudflare Pages
              </h3>
              <p className="text-sm text-[hsl(45,15%,60%)] mb-4">
                Master JSON files with full item definitions (stats, abilities, tiers, icons). These are the source of truth for item design.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { name: "Weapons", count: 843, url: "https://grudge-objectstore.pages.dev/api/v1/master-weapons.json" },
                  { name: "Armor", count: 1218, url: "https://grudge-objectstore.pages.dev/api/v1/master-armor.json" },
                  { name: "Consumables", count: 137, url: "https://grudge-objectstore.pages.dev/api/v1/master-consumables.json" },
                  { name: "Materials", count: "93+", url: "https://grudge-objectstore.pages.dev/api/v1/master-materials.json" },
                ].map(db => (
                  <a
                    key={db.name}
                    href={db.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fantasy-panel p-3 hover:rune-glow transition text-center"
                  >
                    <div className="text-lg font-heading gold-text">{db.count}</div>
                    <div className="text-sm">{db.name}</div>
                    <div className="text-[10px] text-[hsl(43,85%,55%)]">View JSON →</div>
                  </a>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── R2 CDN ────────────────────────────────────────── */}
          <TabsContent value="cdn" className="mt-4">
            <div className="fantasy-panel p-5">
              <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>
                R2 CDN — assets.grudge-studio.com
              </h3>
              <p className="text-sm text-[hsl(45,15%,60%)] mb-4">
                Cloudflare R2 bucket serving binary assets (GLB models, textures, spritesheets). Only the toon-shooter bundle has uploaded files currently.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="fantasy-panel p-4">
                  <div className="text-sm font-heading text-[hsl(43,85%,55%)] mb-2">Characters (3 models)</div>
                  {["Character_Soldier.glb", "Character_Enemy.glb", "Character_Hazmat.glb"].map(f => (
                    <div key={f} className="flex items-center gap-2 py-1 text-xs">
                      <div className="w-2 h-2 rounded-full bg-[hsl(120,60%,50%)]" />
                      <span className="text-[hsl(45,15%,60%)]">{f}</span>
                      <span className="text-[10px] text-[hsl(45,15%,40%)] ml-auto">~1.3MB</span>
                    </div>
                  ))}
                </div>
                <div className="fantasy-panel p-4">
                  <div className="text-sm font-heading text-[hsl(43,85%,55%)] mb-2">Weapons (14 models)</div>
                  {["AK.glb", "Pistol.glb", "Shotgun.glb", "Sniper.glb", "Knife_1.glb", "Knife_2.glb"].map(f => (
                    <div key={f} className="flex items-center gap-2 py-1 text-xs">
                      <div className="w-2 h-2 rounded-full bg-[hsl(120,60%,50%)]" />
                      <span className="text-[hsl(45,15%,60%)]">{f}</span>
                    </div>
                  ))}
                  <div className="text-[10px] text-[hsl(45,15%,40%)] mt-1">+8 more weapons</div>
                </div>
                <div className="fantasy-panel p-4">
                  <div className="text-sm font-heading text-[hsl(43,85%,55%)] mb-2">Environment (50+ models)</div>
                  {["Tree_1.glb", "Structure_1.glb", "Crate.glb", "Tank.glb", "Fence.glb"].map(f => (
                    <div key={f} className="flex items-center gap-2 py-1 text-xs">
                      <div className="w-2 h-2 rounded-full bg-[hsl(120,60%,50%)]" />
                      <span className="text-[hsl(45,15%,60%)]">{f}</span>
                    </div>
                  ))}
                  <div className="text-[10px] text-[hsl(45,15%,40%)] mt-1">+45 more environment pieces</div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-black/20 rounded border border-[hsl(43,60%,30%)]/15">
                <div className="text-xs text-[hsl(43,85%,55%)] font-heading mb-1">CDN Base URL</div>
                <code className="text-xs text-[hsl(45,15%,55%)]">{ASSETS_CDN}/toon-shooter/{"<category>/<filename>.glb"}</code>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
