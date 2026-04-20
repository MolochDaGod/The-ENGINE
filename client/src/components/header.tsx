import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Cloud, ExternalLink, Flame, Home, Layers3, Library, LogIn, LogOut, Menu, Sparkles, Swords, Trophy, UserCircle, Wrench, X } from "lucide-react";
import grudgeLogo from "@assets/uXpJmRe_1773828784729.png";
import { useAuth } from "@/components/auth-provider";
import { useAuthModal } from "@/components/auth-modal";
import {
  featuredProducts,
  legacyProducts,
  playProducts,
  studioProducts,
  type PortalProduct,
} from "@/data/portalProducts";

const statusClasses: Record<string, string> = {
  live: "bg-[hsl(120,60%,50%)]/15 text-[hsl(120,60%,60%)] border-[hsl(120,60%,50%)]/30",
  planned: "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border-[hsl(43,85%,55%)]/30",
  beta: "bg-[hsl(280,70%,60%)]/15 text-[hsl(280,70%,70%)] border-[hsl(280,70%,60%)]/30",
  admin: "bg-[hsl(0,60%,55%)]/15 text-[hsl(0,70%,70%)] border-[hsl(0,60%,55%)]/30",
};

function ProductMenuRow({ product, onNavigate }: { product: PortalProduct; onNavigate: () => void }) {
  const content = (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[hsl(43,60%,30%)]/20 hover:border-[hsl(43,60%,30%)]/40 hover:bg-[hsl(225,25%,12%)] transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[hsl(45,30%,92%)]">{product.name}</span>
          {product.external && <ExternalLink className="w-3 h-3 text-[hsl(45,15%,60%)]" />}
        </div>
        <p className="text-xs text-[hsl(45,15%,60%)] mt-1">{product.description}</p>
      </div>
      <Badge className={`border text-[10px] uppercase tracking-wide ${statusClasses[product.status]}`}>{product.status}</Badge>
    </div>
  );

  if (product.external) {
    return (
      <a href={product.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
        {content}
      </a>
    );
  }

  return (
    <Link href={product.href} onClick={onNavigate}>
      {content}
    </Link>
  );
}

export default function Header() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { player, logout } = useAuth();
  const { open: openAuthModal } = useAuthModal();

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const navLinks = [
    { name: "Products", href: "/#products", icon: Layers3 },
    { name: "Play", href: "/#play", icon: Swords },
    { name: "Compete", href: "/leaderboards", icon: Trophy },
    { name: "PvP", href: "/pvp", icon: Flame },
    { name: "Studio", href: "/#studio", icon: Wrench },
    { name: "Retro", href: "/games", icon: Library },
  ] as const;

  const isHome = location === "/";

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[hsl(43,60%,30%)]/30" style={{ background: "linear-gradient(135deg, hsl(225,30%,8%), hsl(225,25%,6%))" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)] transition-colors p-1"
                aria-label="Toggle menu"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <Link href="/" className="flex items-center gap-3">
                <img src={grudgeLogo} alt="Grudge Studio" className="w-9 h-9 rounded-full ring-2 ring-[hsl(43,85%,55%)]/30" />
                <div className="hidden sm:block">
                  <div className="text-lg font-heading gold-text font-bold leading-none">GRUDGE STUDIO</div>
                  <div className="text-[11px] text-[hsl(45,15%,60%)] font-body mt-0.5">Client Portal</div>
                </div>
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => {
                const active =
                  link.href === "/games"
                    ? location.startsWith("/games")
                    : link.href === "/leaderboards"
                      ? location.startsWith("/leaderboards")
                      : link.href === "/pvp"
                        ? location.startsWith("/pvp")
                        : link.href.startsWith("/#")
                          ? isHome
                          : location === link.href;
                const className = `transition-colors font-body text-sm ${active ? "text-[hsl(43,85%,55%)]" : "text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)]"}`;
                if (link.href.startsWith("/#")) {
                  return (
                    <a key={link.name} href={link.href} className={className}>
                      {link.name}
                    </a>
                  );
                }
                return (
                  <Link key={link.name} href={link.href} className={className}>
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              {player ? (
                <>
                  <Link href="/account" className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded border border-[hsl(43,60%,30%)]/40 hover:border-[hsl(43,60%,30%)] text-sm">
                    <UserCircle className="w-4 h-4 text-[hsl(43,85%,55%)]" />
                    <span className="font-body">{player.displayName || player.username}</span>
                    <span className="text-[10px] text-[hsl(43,85%,55%)] font-heading">{Number(player.gbuxBalance || 0).toFixed(0)}¤</span>
                  </Link>
                  <Link href="/cloud" className="hidden md:inline-flex">
                    <Button variant="ghost" size="sm" className="text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)] hover:bg-[hsl(225,25%,15%)]">
                      <Cloud className="w-4 h-4 mr-1" /> My Cloud
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" className="text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)] hover:bg-[hsl(225,25%,15%)] hidden sm:flex" onClick={() => logout()}>
                    <LogOut className="w-4 h-4 mr-1" /> Sign Out
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)] hover:bg-[hsl(225,25%,15%)] hidden sm:flex"
                  onClick={() => openAuthModal({ initialTab: "signin" })}
                >
                  <LogIn className="w-4 h-4 mr-1" /> Sign In
                </Button>
              )}
              <a href="https://grudgewarlords.com" target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="gilded-button">
                  <Sparkles className="w-4 h-4 mr-1" /> Open Warlords
                </Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
          <div className="fantasy-panel border-r w-96 h-full overflow-y-auto shadow-2xl" style={{ borderRadius: 0 }}>
            <div className="p-4 border-b border-[hsl(43,60%,30%)]" style={{ background: "linear-gradient(135deg, hsl(225,30%,12%), hsl(225,25%,8%))" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={grudgeLogo} alt="Grudge Studio" className="w-9 h-9 rounded" />
                  <div>
                    <h2 className="font-heading text-lg gold-text">Grudge Studio</h2>
                    <p className="text-[hsl(45,15%,60%)] text-xs font-body">Client-first portal for products, play, and studio tools</p>
                  </div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] transition-colors p-1" aria-label="Close menu">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-[hsl(43,60%,30%)]/30 space-y-2">
              <div className="text-xs text-[hsl(43,85%,55%)] uppercase tracking-widest font-heading">Quick Access</div>
              <Link href="/">
                <Button variant="ghost" className="w-full justify-start text-left text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)]" onClick={() => setMenuOpen(false)}>
                  <Home className="w-4 h-4 mr-2" /> Portal Home
                </Button>
              </Link>
              <Link href="/leaderboards">
                <Button variant="ghost" className="w-full justify-start text-left text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)]" onClick={() => setMenuOpen(false)}>
                  <Trophy className="w-4 h-4 mr-2" /> Leaderboards
                </Button>
              </Link>
              <Link href="/pvp">
                <Button variant="ghost" className="w-full justify-start text-left text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)]" onClick={() => setMenuOpen(false)}>
                  <Flame className="w-4 h-4 mr-2" /> PvP Hub
                </Button>
              </Link>
              <Link href="/games">
                <Button variant="ghost" className="w-full justify-start text-left text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)]" onClick={() => setMenuOpen(false)}>
                  <Library className="w-4 h-4 mr-2" /> Retro Library
                </Button>
              </Link>
              {player ? (
                <>
                  <Link href="/account">
                    <Button variant="ghost" className="w-full justify-start text-left text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)]" onClick={() => setMenuOpen(false)}>
                      <UserCircle className="w-4 h-4 mr-2" /> My Account
                    </Button>
                  </Link>
                  <Link href="/cloud">
                    <Button variant="ghost" className="w-full justify-start text-left text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)]" onClick={() => setMenuOpen(false)}>
                      <Cloud className="w-4 h-4 mr-2" /> My Cloud
                    </Button>
                  </Link>
                  <Button variant="ghost" className="w-full justify-start text-left text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)]" onClick={() => { setMenuOpen(false); logout(); }}>
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)]"
                  onClick={() => { setMenuOpen(false); openAuthModal({ initialTab: "signin" }); }}
                >
                  <LogIn className="w-4 h-4 mr-2" /> Sign In
                </Button>
              )}
            </div>

            <div className="p-4 border-b border-[hsl(43,60%,30%)]/30 space-y-3">
              <div className="text-xs text-[hsl(43,85%,55%)] uppercase tracking-widest font-heading">Featured Products</div>
              {featuredProducts.map((product) => (
                <ProductMenuRow key={product.id} product={product} onNavigate={() => setMenuOpen(false)} />
              ))}
            </div>

            <div className="p-4 border-b border-[hsl(43,60%,30%)]/30 space-y-3">
              <div className="text-xs text-[hsl(43,85%,55%)] uppercase tracking-widest font-heading">Play</div>
              {playProducts.map((product) => (
                <ProductMenuRow key={product.id} product={product} onNavigate={() => setMenuOpen(false)} />
              ))}
            </div>

            <div className="p-4 border-b border-[hsl(43,60%,30%)]/30 space-y-3">
              <div className="text-xs text-[hsl(43,85%,55%)] uppercase tracking-widest font-heading">Studio</div>
              {studioProducts.map((product) => (
                <ProductMenuRow key={product.id} product={product} onNavigate={() => setMenuOpen(false)} />
              ))}
            </div>

            <div className="p-4 space-y-3">
              <div className="text-xs text-[hsl(43,85%,55%)] uppercase tracking-widest font-heading">Legacy / Secondary</div>
              {legacyProducts.map((product) => (
                <ProductMenuRow key={product.id} product={product} onNavigate={() => setMenuOpen(false)} />
              ))}
            </div>

            <div className="p-4 border-t border-[hsl(43,60%,30%)]/30" style={{ background: "hsl(225,30%,6%)" }}>
              <div className="flex items-center justify-between gap-3 text-xs text-[hsl(45,15%,60%)] font-body">
                <span>One portal. Many products.</span>
                <a href="/#products" className="inline-flex items-center gap-1 text-[hsl(43,85%,55%)] hover:text-[hsl(43,90%,70%)]">
                  Browse <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
