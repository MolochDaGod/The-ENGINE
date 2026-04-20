import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Bot, Gamepad2, Layers3, LayoutDashboard, Library, Rocket, Sparkles } from "lucide-react";
import grudgeLogo from "@assets/uXpJmRe_1773828784729.png";
import homeBg from "@assets/2kljxaj_1773841543581.png";
import {
  featuredProducts,
  legacyProducts,
  playProducts,
  portalStats,
  studioProducts,
  type PortalProduct,
} from "@/data/portalProducts";

const statusClasses: Record<string, string> = {
  live: "bg-[hsl(120,60%,50%)]/15 text-[hsl(120,60%,60%)] border-[hsl(120,60%,50%)]/30",
  planned: "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border-[hsl(43,85%,55%)]/30",
  beta: "bg-[hsl(280,70%,60%)]/15 text-[hsl(280,70%,70%)] border-[hsl(280,70%,60%)]/30",
  admin: "bg-[hsl(0,60%,55%)]/15 text-[hsl(0,70%,70%)] border-[hsl(0,60%,55%)]/30",
};

function ProductCard({ product }: { product: PortalProduct }) {
  const body = (
    <div className="h-full fantasy-panel p-5 hover:rune-glow transition-all flex flex-col justify-between">
      <div>
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
      <div className="mt-5 flex items-center text-sm text-[hsl(43,85%,55%)] font-medium">
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

export default function Home() {
  return (
    <div className="min-h-screen relative">
      <div
        className="fixed inset-0 z-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: `url(${homeBg})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[hsl(225,30%,6%)]/80 via-transparent to-[hsl(225,30%,6%)]/90 pointer-events-none" />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(225,35%,12%)] via-[hsl(225,30%,8%)] to-[hsl(225,30%,6%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 25% 25%, hsl(43,85%,55%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
              <img src={grudgeLogo} alt="Grudge Studio" className="w-16 h-16 rounded-full ring-2 ring-[hsl(43,85%,55%)]/30" />
              <Badge className="gilded-button text-xs">Client Portal</Badge>
            </div>

            <h1 className="text-4xl md:text-6xl font-heading mb-5" style={{ WebkitTextFillColor: "unset" }}>
              Start in <span className="gold-text">Grudge Studio</span>
            </h1>
            <p className="text-lg md:text-xl text-[hsl(45,15%,60%)] max-w-3xl font-body leading-relaxed">
              One portal for Warlords, launcher, dashboard, AI, assets, and studio tools. Sign in once, choose the product you want, and move through the ecosystem from a single client-first entry point.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <a href="https://id.grudge-studio.com" target="_blank" rel="noopener noreferrer">
                <Button className="gilded-button">
                  <Sparkles className="w-4 h-4 mr-2" /> Sign In with Grudge ID
                </Button>
              </a>
              <a href="https://grudgewarlords.com" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,16%)]">
                  <Gamepad2 className="w-4 h-4 mr-2" /> Launch Warlords
                </Button>
              </a>
              <a href="#products">
                <Button variant="ghost" className="text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)] hover:bg-[hsl(225,25%,16%)]">
                  Browse Products
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 border-y border-[hsl(43,60%,30%)]/20 relative overflow-hidden" style={{ background: "hsl(225,30%,7%)" }}>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "Products", value: portalStats.totalProducts.toString(), icon: Layers3 },
              { label: "Live", value: portalStats.live.toString(), icon: Sparkles },
              { label: "Planned", value: portalStats.planned.toString(), icon: Rocket },
              { label: "Auth-linked", value: portalStats.authRequired.toString(), icon: LayoutDashboard },
            ].map((stat) => (
              <div key={stat.label} className="text-center group">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg stone-panel mb-3 group-hover:animate-gem-glow transition-all">
                  <stat.icon className="w-6 h-6 text-[hsl(43,85%,55%)]" />
                </div>
                <div className="text-2xl font-heading gold-text font-bold">{stat.value}</div>
                <div className="text-sm text-[hsl(45,15%,60%)] mt-1 font-body">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="products" className="relative py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Badge className="mb-3 bg-[hsl(43,85%,55%)]/10 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]/40">Featured Products</Badge>
            <h2 className="text-3xl font-heading text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>Choose a live product or the next mission target</h2>
            <p className="text-[hsl(45,15%,60%)] mt-2 font-body max-w-3xl">
              The portal is the shell. Products are the destinations. Warlords, launcher, dashboard, and AI should all be discoverable from the same front door.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section id="play" className="relative py-16 border-t border-[hsl(43,60%,30%)]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Badge className="mb-3 bg-[hsl(220,60%,55%)]/10 text-[hsl(220,70%,70%)] border border-[hsl(220,60%,55%)]/30">Play</Badge>
            <h2 className="text-3xl font-heading text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>Live play surfaces</h2>
            <p className="text-[hsl(45,15%,60%)] mt-2 font-body max-w-3xl">
              Warlords stays the main live game. Other play surfaces remain available, and the retro library stays accessible without dominating the portal identity.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[...playProducts, ...legacyProducts].map((product) => (
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

      <section className="relative py-16 border-t border-[hsl(43,60%,30%)]/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="fantasy-panel p-8 text-center">
            <Badge className="mb-4 bg-[hsl(220,60%,55%)]/10 text-[hsl(220,70%,70%)] border border-[hsl(220,60%,55%)]/30">Legacy / Secondary</Badge>
            <h2 className="text-2xl font-heading text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>Retro stays available — just not first</h2>
            <p className="text-[hsl(45,15%,60%)] mt-3 font-body max-w-2xl mx-auto">
              The emulator library remains part of the ecosystem, but the main landing experience is now the client portal for Grudge Studio products rather than the retro catalog itself.
            </p>
            <Link href="/games">
              <Button className="mt-6 gilded-button">
                <Library className="w-4 h-4 mr-2" /> Enter Retro Library
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
