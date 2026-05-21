import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Anchor, ArrowUpRight, Bot, ChevronLeft, ChevronRight, Crown, Flame, Layers3, LayoutDashboard, Library, Loader2, Rocket, Sparkles, Swords, Trophy } from "lucide-react";
import { useAuthModal } from "@/components/auth-modal";
import grudgeLogo from "@assets/uXpJmRe_1773828784729.png";
import homeBg from "@assets/2kljxaj_1773841543581.png";
import {
  featuredProducts,
  legacyProducts,
  playProducts,
  portalStats,
  studioProducts,
  PORTAL_PRODUCTS,
  type PortalProduct,
} from "@/data/portalProducts";
import type { Game } from "@shared/schema";
import { GameCover } from "@/components/game-cover";
import { EraCarousel } from "@/components/era-carousel";

interface TopGame extends Game {
  playerCount: number;
  scoreCount: number;
}

interface TopPlayer {
  userId: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalScore: number;
  personalBests: number;
  globalRecords: number;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const statusClasses: Record<string, string> = {
  live: "bg-[hsl(120,60%,50%)]/15 text-[hsl(120,60%,60%)] border-[hsl(120,60%,50%)]/30",
  planned: "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border-[hsl(43,85%,55%)]/30",
  beta: "bg-[hsl(280,70%,60%)]/15 text-[hsl(280,70%,70%)] border-[hsl(280,70%,60%)]/30",
  admin: "bg-[hsl(0,60%,55%)]/15 text-[hsl(0,70%,70%)] border-[hsl(0,60%,55%)]/30",
};

function ProductCard({ product }: { product: PortalProduct }) {
  const body = (
    <div
      className= "h-full fantasy-panel p-5 hover:rune-glow transition-all flex flex-col justify-between relative overflow-hidden group"
  style = {
    product.image ? {
      backgroundImage: `linear-gradient(to bottom, hsla(225,30%,8%,0.55), hsla(225,30%,6%,0.92)), url(${product.image})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    } : undefined
  }
    >
    {/* subtle hover brighten on the bg image */ }
  {
    product.image && (
      <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
    style = {{
      backgroundImage: `linear-gradient(to bottom, hsla(225,30%,8%,0.35), hsla(225,30%,6%,0.85)), url(${product.image})`,
        backgroundSize: "cover",
          backgroundPosition: "center",
          }
  }
        />
      )
}
<div className="relative z-10" >
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-heading text-lg text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
            {product.name}
          </h3>
          <Badge className={`border text-[10px] uppercase tracking-wide ${statusClasses[product.status]}`}>{product.status}</Badge>
        </div>
        <p className="text-sm text-[hsl(45,15%,60%)] font-body">{product.description}</p>
        {(product.authRequired || product.note) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {product.authRequired && (
              <Badge variant="outline" className="border-[hsl(43,60%,30%)]/40 text-[hsl(43,85%,55%)]">
                Grudge ID
              </Badge>
            )}
            {product.note && (
              <Badge variant="outline" className="border-[hsl(220,15%,25%)] text-[hsl(45,15%,60%)]">
                {product.note}
              </Badge>
            )}
          </div>
        )}
      </div>
  < div className = "relative z-10 mt-5 flex items-center text-sm text-[hsl(43,85%,55%)] font-medium" >
        Open product <ArrowUpRight className="w-4 h-4 ml-1" />
      </div>
    </div>
  );

  if (product.external) {
    return (
      <a href={product.href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {body}
      </a>
    );
  }

  return (
    <Link href={product.href} className="block h-full">
      {body}
    </Link>
  );
}

const studioPrinciples = [
  {
    title: "One account",
    description: "Grudge ID should be the front door to every product in the ecosystem.",
    icon: Sparkles,
  },
  {
    title: "Client-first",
    description: "The main portal should help players choose products and sessions, not drop them into the wrong app.",
    icon: Rocket,
  },
  {
    title: "Live operations",
    description: "Dashboard, AI, assets, and launcher status should be visible from the same shell.",
    icon: LayoutDashboard,
  },
];

type EraKey = "warlords" | "nexus" | "armada";

const ERAS: { key: EraKey; name: string; tagline: string; description: string; icon: typeof Swords; bgImage: string; accent: string; accentBorder: string; productIds: string[] }[] = [
  {
    key: "warlords",
    name: "Warlords",
    tagline: "Dark Fantasy RPG",
    description: "The medieval dark-fantasy era. Character creation, professions, crafting, faction warfare, and Souls-like PvP combat across island territories.",
    icon: Swords,
    bgImage: "/assets/store/dark_fantasy_scenes.png",
    accent: "hsl(43,85%,55%)",
    accentBorder: "hsl(43,60%,30%)",
    productIds: ["warlords", "grudge-crafting", "grudge-angler", "match-3-grudge", "mage-arena", "avernus-arena", "tower-defense"],
  },
  {
    key: "nexus",
    name: "Nexus",
    tagline: "Competitive Arena",
    description: "The competitive era. MOBA-style battlegrounds, RTS strategy, multiplayer racing, card duels, and wave-survival arenas with GBUX wagers and ranked ladders.",
    icon: Flame,
    bgImage: "/assets/store/mmo_development.png",
    accent: "hsl(0,70%,55%)",
    accentBorder: "hsl(0,60%,35%)",
    productIds: ["betta-warlords", "nemesis-tcg", "wargus", "multiplayer-racing", "annihilate-demo"],
  },
  {
    key: "armada",
    name: "Armada",
    tagline: "Fleet & Space Combat",
    description: "The fleet era. Dogfight gameplay, ship building, fleet command, deep-space survival, and strategic warfare — the next frontier for Grudge Studio.",
    icon: Anchor,
    bgImage: "/assets/store/scifi_environment.png",
    accent: "hsl(200,70%,55%)",
    accentBorder: "hsl(200,60%,30%)",
    productIds: ["starway-gruda", "rts-star-armada", "mech-armada", "star-rts", "survival-game"],
  },
];

// ── Featured Live Games carousel ──
const CAROUSEL_GAMES = ["grudge-studio-app", "betta-warlords", "grudge-angler"] as const;

function FeaturedCarousel() {
  const [idx, setIdx] = useState(0);
  const items = CAROUSEL_GAMES.map(id => PORTAL_PRODUCTS.find(p => p.id === id)!).filter(Boolean);
  const current = items[idx];
  if (!current) return null;

  const prev = () => setIdx(i => (i - 1 + items.length) % items.length);
  const next = () => setIdx(i => (i + 1) % items.length);

  const gradients: Record<string, string> = {
    "grudge-studio-app": "from-amber-900/80 via-amber-800/60 to-transparent",
    "betta-warlords": "from-red-900/80 via-red-800/60 to-transparent",
    "grudge-angler": "from-cyan-900/80 via-cyan-800/60 to-transparent",
  };
  const bgImages: Record<string, string> = {
    "grudge-studio-app": "/assets/carousel/grudge-studio-bg.png",
    "betta-warlords": "/assets/carousel/betta-warlords-bg.png",
    "grudge-angler": "/assets/carousel/grudge-angler-bg.png",
  };
  const icons: Record<string, string> = {
    "grudge-studio-app": "🏰",
    "betta-warlords": "⚔️",
    "grudge-angler": "🎣",
  };

  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-[hsl(43,60%,30%)]/40 mt-8">
      {/* Background image */}
      {bgImages[current.id] && (
        <div className="absolute inset-0 z-0 transition-all duration-500">
          <img src={bgImages[current.id]} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}
      <div className={`relative z-10 bg-gradient-to-r ${gradients[current.id] || 'from-gray-900/80 to-transparent'} p-6 sm:p-8 min-h-[160px] flex flex-col justify-between`}>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{icons[current.id] || '🎮'}</span>
            <div>
              <h3 className="text-xl font-heading gold-text" style={{ WebkitTextFillColor: "unset" }}>{current.name}</h3>
              {current.note && <Badge variant="outline" className="text-[10px] border-[hsl(43,60%,30%)]/40 text-[hsl(43,85%,55%)]">{current.note}</Badge>}
            </div>
            <Badge className={`ml-auto border text-[10px] uppercase tracking-wide ${statusClasses[current.status]}`}>{current.status}</Badge>
          </div>
          <p className="text-sm text-[hsl(45,15%,70%)] font-body max-w-xl">{current.description}</p>
        </div>
        <div className="flex items-center justify-between mt-4">
          <a href={current.href} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="gilded-button">
              <ArrowUpRight className="w-4 h-4 mr-1" /> Play Now
            </Button>
          </a>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {items.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} className={`w-2 h-2 rounded-full transition-all ${i === idx ? 'bg-[hsl(43,85%,55%)] w-5' : 'bg-[hsl(45,15%,40%)]'}`} />
              ))}
            </div>
            <button onClick={prev} className="w-8 h-8 rounded-full border border-[hsl(43,60%,30%)]/40 flex items-center justify-center text-[hsl(45,15%,70%)] hover:text-white hover:border-[hsl(43,85%,55%)] transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={next} className="w-8 h-8 rounded-full border border-[hsl(43,60%,30%)]/40 flex items-center justify-center text-[hsl(45,15%,70%)] hover:text-white hover:border-[hsl(43,85%,55%)] transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EraSection({ era }: { era: typeof ERAS[number] }) {
  const eraProducts = era.productIds
    .map((id) => PORTAL_PRODUCTS.find((p) => p.id === id))
    .filter(Boolean) as PortalProduct[];

  return (
    <section
      id={era.key}
      className="relative py-16 overflow-hidden border-t border-[hsl(43,60%,30%)]/20"
    >
      <div className="absolute inset-0 z-0">
        <img src={era.bgImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(225,30%,6%)]/95 via-[hsl(225,30%,6%)]/85 to-[hsl(225,30%,6%)]/70" />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8">
          <div className="lg:w-2/5">
            <div className="flex items-center gap-3 mb-4">
              <era.icon className="w-7 h-7" style={{ color: era.accent }} />
              <h2 className="text-3xl font-heading" style={{ color: era.accent, WebkitTextFillColor: "unset" }}>
                {era.name}
              </h2>
              <Badge className="border text-[10px] uppercase tracking-wide" style={{ borderColor: era.accentBorder, color: era.accent, background: `${era.accent}15` }}>
                {era.key === "armada" ? "Coming Soon" : "Active"}
              </Badge>
            </div>
            <p className="text-[hsl(45,15%,70%)] font-body leading-relaxed">
              {era.description}
            </p>
            {era.key === "warlords" && (
              <div className="flex gap-3 mt-6">
                <img src="/assets/heroes/death_mage.png" alt="Death Mage" className="w-16 h-20 rounded-lg object-cover border border-[hsl(43,60%,30%)]/40" />
                <img src="/assets/heroes/holy_paladin.png" alt="Holy Paladin" className="w-16 h-20 rounded-lg object-cover border border-[hsl(43,60%,30%)]/40" />
                <img src="/assets/heroes/orc_shaman.png" alt="Orc Shaman" className="w-16 h-20 rounded-lg object-cover border border-[hsl(43,60%,30%)]/40" />
                <img src="/assets/heroes/stone_guardian.png" alt="Stone Guardian" className="w-16 h-20 rounded-lg object-cover border border-[hsl(43,60%,30%)]/40" />
              </div>
            )}
          </div>
          <div className="lg:w-3/5">
            {eraProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {eraProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="fantasy-panel p-8 text-center">
                <era.icon className="w-10 h-10 mx-auto mb-3" style={{ color: era.accent }} />
                <p className="text-[hsl(45,15%,70%)] font-body">Ships and fleet combat are being forged. Stay tuned for the Armada era launch.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CompeteSection() {
  const topGamesQuery = useQuery<TopGame[]>({
    queryKey: ["/api/games/top"],
    queryFn: () => fetchJSON<TopGame[]>("/api/games/top?limit=8&windowDays=30"),
  });
  const topPlayersQuery = useQuery<TopPlayer[]>({
    queryKey: ["/api/leaderboards/global"],
    queryFn: () => fetchJSON<TopPlayer[]>("/api/leaderboards/global?limit=5"),
  });

  return (
    <section id="compete" className="relative py-16 border-t border-[hsl(43,60%,30%)]/20" style={{ background: "hsl(225,30%,7%)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <Badge className="mb-3 bg-[hsl(0,60%,55%)]/10 text-[hsl(0,70%,70%)] border border-[hsl(0,60%,55%)]/30">Compete</Badge>
            <h2 className="text-3xl font-heading text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>Top games, top players, live from The ENGINE</h2>
            <p className="text-[hsl(45,15%,60%)] mt-2 font-body max-w-3xl">
              Leaderboards and PvP challenges are integrated into the portal. Jump into any game to set a personal best, or challenge another player for GBUX.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/leaderboards">
              <Button className="gilded-button">
                <Trophy className="w-4 h-4 mr-2" /> Leaderboards
              </Button>
            </Link>
            <Link href="/pvp">
              <Button variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(45,30%,90%)]">
                <Flame className="w-4 h-4 mr-2" /> PvP Hub
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
          <div className="fantasy-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-heading text-sm uppercase tracking-wider text-[hsl(43,85%,55%)]">Top Games (30d)</div>
              <span className="text-xs text-[hsl(45,15%,60%)] font-body">by unique players</span>
            </div>
            {topGamesQuery.isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" /></div>
            ) : !topGamesQuery.data?.length ? (
              <p className="text-sm text-[hsl(45,15%,60%)] font-body">Once players start scoring, this board fills in automatically.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {topGamesQuery.data.slice(0, 8).map((game, idx) => (
                  <Link key={game.id} href={`/play/${game.id}`}>
                    <div className="fantasy-panel overflow-hidden hover:rune-glow transition cursor-pointer">
                      <div className="aspect-[3/4] bg-[hsl(225,25%,12%)] relative">
    <GameCover
                          src={ game.thumbnailUrl }
  alt = { game.title }
  className = "absolute inset-0 w-full h-full object-cover"
    />
                        <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-[hsl(43,85%,55%)] text-[hsl(225,30%,8%)] font-heading text-xs flex items-center justify-center">
                          {idx + 1}
                        </div>
                      </div>
                      <div className="p-2">
                        <div className="text-xs font-heading truncate">{game.title}</div>
                        <div className="text-[10px] text-[hsl(45,15%,60%)] font-body">{game.playerCount} players</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="fantasy-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-heading text-sm uppercase tracking-wider text-[hsl(43,85%,55%)]">Top Players</div>
              <Crown className="w-4 h-4 text-[hsl(43,85%,55%)]" />
            </div>
            {topPlayersQuery.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
            ) : !topPlayersQuery.data?.length ? (
              <p className="text-sm text-[hsl(45,15%,60%)] font-body">No scores logged yet. Be the first on the board.</p>
            ) : (
              <ol className="space-y-2">
                {topPlayersQuery.data.map((p, idx) => (
                  <li key={p.userId} className="flex items-center gap-3 p-2 rounded border border-[hsl(43,60%,30%)]/20">
                    <div className="w-7 h-7 rounded-full bg-[hsl(225,25%,14%)] text-[hsl(43,85%,55%)] font-heading text-xs flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{p.displayName || p.username}</div>
                      <div className="text-xs text-[hsl(45,15%,60%)] font-body">{p.personalBests} PBs · {p.globalRecords} WRs</div>
                    </div>
                    <div className="font-heading text-sm gold-text">{p.totalScore.toLocaleString()}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { open: openAuth } = useAuthModal();
  const [activeEra, setActiveEra] = useState<EraKey>("warlords");

  return (
    <div className="min-h-screen relative">
      <div
        className="fixed inset-0 z-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: `url(${homeBg})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[hsl(225,30%,6%)]/80 via-transparent to-[hsl(225,30%,6%)]/90 pointer-events-none" />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(225,35%,12%)] via-[hsl(225,30%,8%)] to-[hsl(225,30%,6%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 25% 25%, hsl(43,85%,55%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-4 mb-6">
            <img src={grudgeLogo} alt="Grudge Studio" className="w-14 h-14 rounded-full ring-2 ring-[hsl(43,85%,55%)]/30" />
            <div>
              <h1 className="text-3xl md:text-5xl font-heading" style={{ WebkitTextFillColor: "unset" }}>
                <span className="gold-text">Grudge Studio</span>
              </h1>
              <p className="text-sm text-[hsl(45,15%,60%)] font-body mt-1">Three eras. One portal. Choose your war.</p>
            </div>
          </div>

          {/* Era selector cards */}
<div className="mt-8" > { React.createElement(EraCarousel, { eras: ERAS, activeKey: activeEra, setActiveKey: (k: string) => setActiveEra(k as EraKey) }) } </div>

          <div className="flex flex-wrap gap-3 mt-8">
            <Button className="gilded-button" onClick={() => openAuth({ initialTab: 'signin', reason: 'Sign in to access all Grudge Studio products.' })}>
              <Sparkles className="w-4 h-4 mr-2" /> Sign In with Grudge ID
            </Button>
            <a href="#products">
              <Button variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,16%)]">
                Browse All Products
              </Button>
            </a>
          </div>

          {/* Featured live games carousel */}
          <FeaturedCarousel />
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-8 border-y border-[hsl(43,60%,30%)]/20 relative overflow-hidden" style={{ background: "hsl(225,30%,7%)" }}>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { label: "Products", value: portalStats.totalProducts.toString(), icon: Layers3 },
              { label: "Live", value: portalStats.live.toString(), icon: Sparkles },
              { label: "Eras", value: "3", icon: Swords },
              { label: "Multiplayer", value: portalStats.multiplayer.toString(), icon: Flame },
              { label: "Auth-linked", value: portalStats.authRequired.toString(), icon: LayoutDashboard },
            ].map((stat) => (
              <div key={stat.label} className="text-center group">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg stone-panel mb-2 group-hover:animate-gem-glow transition-all">
                  <stat.icon className="w-5 h-5 text-[hsl(43,85%,55%)]" />
                </div>
                <div className="text-xl font-heading gold-text font-bold">{stat.value}</div>
                <div className="text-xs text-[hsl(45,15%,60%)] mt-1 font-body">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Era sections */}
      {ERAS.map((era) => (
        <EraSection key={era.key} era={era} />
      ))}

      <CompeteSection />

      {/* Featured / all products */}
      <section id="products" className="relative py-16 border-t border-[hsl(43,60%,30%)]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Badge className="mb-3 bg-[hsl(43,85%,55%)]/10 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]/40">All Products</Badge>
            <h2 className="text-3xl font-heading text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>Everything in the ecosystem</h2>
            <p className="text-[hsl(45,15%,60%)] mt-2 font-body max-w-3xl">
              Launcher, dashboard, AI hub, and studio tools — all discoverable from the same front door.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section id="studio" className="relative py-16 border-t border-[hsl(43,60%,30%)]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8">
            <div>
              <Badge className="mb-3 bg-[hsl(280,70%,60%)]/10 text-[hsl(280,70%,70%)] border border-[hsl(280,70%,60%)]/30">Studio</Badge>
              <h2 className="text-3xl font-heading text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>Studio tools and operations</h2>
              <p className="text-[hsl(45,15%,60%)] mt-2 font-body max-w-3xl">
                These surfaces support the ecosystem itself: ops, assets, AI, and legacy editor tooling while the launcher/client direction is brought online.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8">
                {studioProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>

            <div className="fantasy-panel p-6 h-fit">
              <Badge className="mb-4 bg-[hsl(43,85%,55%)]/10 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]/40">Mission Direction</Badge>
              <div className="space-y-4">
                {studioPrinciples.map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg stone-panel flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-[hsl(43,85%,55%)]" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[hsl(45,30%,92%)]">{item.title}</div>
                      <p className="text-xs text-[hsl(45,15%,60%)] mt-1 font-body">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-[hsl(43,60%,30%)]/20">
                <a href="https://dash.grudge-studio.com" target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gilded-button">
                    <LayoutDashboard className="w-4 h-4 mr-2" /> Open Dashboard
                  </Button>
                </a>
                <a href="https://ai.grudge-studio.com" target="_blank" rel="noopener noreferrer" className="block mt-3">
                  <Button variant="outline" className="w-full border-[hsl(43,60%,30%)] text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,16%)]">
                    <Bot className="w-4 h-4 mr-2" /> Open AI Hub
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-12 border-t border-[hsl(43,60%,30%)]/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="fantasy-panel p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-sm font-heading text-[hsl(45,15%,70%)] uppercase tracking-wider">Retro Library</div>
              <p className="text-xs text-[hsl(45,15%,50%)] font-body mt-1">894 verified classic games still available inside the portal.</p>
            </div>
            <Link href="/games">
              <Button size="sm" variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(45,30%,90%)] whitespace-nowrap">
                <Library className="w-4 h-4 mr-1" /> Enter Library
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
