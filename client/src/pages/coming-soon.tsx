import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Hammer, Sparkles } from "lucide-react";
import { PORTAL_PRODUCTS, type PortalProduct } from "@/data/portalProducts";
import Footer from "@/components/footer";

const ERA_BG: Record<string, string> = {
  warlords: "/assets/store/dark_fantasy_scenes.png",
  nexus: "/assets/store/mmo_development.png",
  armada: "/assets/store/scifi_environment.png",
};

const ERA_ACCENT: Record<string, { color: string; border: string; bg: string }> = {
  warlords: { color: "hsl(43,85%,55%)", border: "hsl(43,60%,30%)", bg: "/assets/store/dark_fantasy_scenes.png" },
  nexus: { color: "hsl(0,70%,55%)", border: "hsl(0,60%,35%)", bg: "/assets/store/mmo_development.png" },
  armada: { color: "hsl(200,70%,55%)", border: "hsl(200,60%,30%)", bg: "/assets/store/scifi_environment.png" },
};

const ARMADA_IDS = new Set(["starway-gruda", "rts-star-armada", "mech-armada", "star-rts", "survival-game"]);

function eraForProduct(p: PortalProduct | undefined): keyof typeof ERA_ACCENT {
  if (!p) return "armada";
  if (ARMADA_IDS.has(p.id)) return "armada";
  if (p.section === "play" && (p.tags?.includes("pvp") || p.tags?.includes("arena"))) return "nexus";
  return "warlords";
}

export default function ComingSoon() {
  const [location] = useLocation();
  const product = PORTAL_PRODUCTS.find((p) => p.href === location);
  const era = eraForProduct(product);
  const theme = ERA_ACCENT[era];

  const name = product?.name ?? "Coming Soon";
  const description = product?.description ?? "This Grudge Studio experience is still in active development.";
  const tags = product?.tags ?? [];
  const image = product?.image ?? ERA_BG[era];

  return (
    <div className="min-h-screen relative" style={{ background: "linear-gradient(180deg, hsl(225,30%,6%), hsl(225,28%,10%))" }}>
      <div
        className="fixed inset-0 z-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage: `url(${image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[hsl(225,30%,6%)]/85 via-[hsl(225,30%,6%)]/70 to-[hsl(225,30%,6%)]/95 pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[hsl(45,15%,65%)] hover:text-[hsl(43,85%,55%)] transition-colors font-body mb-10">
          <ArrowLeft className="w-4 h-4" /> Back to Grudge Studio
        </Link>

        <div className="ornate-frame p-8 sm:p-12 corner-ornaments vignette">
          <div className="flex items-center gap-3 mb-6">
            <Badge
              className="border text-[10px] uppercase tracking-wider"
              style={{ borderColor: theme.border, color: theme.color, background: `${theme.color}15` }}
            >
              {era} era
            </Badge>
            <Badge className="border text-[10px] uppercase tracking-wider bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border-[hsl(43,60%,30%)]/40">
              {product?.status ?? "planned"}
            </Badge>
            {tags.map((t) => (
              <Badge key={t} className="border text-[10px] uppercase tracking-wider bg-[hsl(225,25%,15%)] text-[hsl(45,15%,75%)] border-[hsl(43,60%,30%)]/30">
                {t}
              </Badge>
            ))}
          </div>

          <h1
            className="text-4xl sm:text-5xl font-heading gold-text font-bold mb-4 text-shadow-gold"
            style={{ WebkitTextFillColor: "unset", color: theme.color }}
          >
            {name}
          </h1>
          <p className="text-lg text-[hsl(45,15%,75%)] font-body leading-relaxed max-w-3xl mb-8">
            {description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <div className="fantasy-panel p-4">
              <Hammer className="w-5 h-5 mb-2" style={{ color: theme.color }} />
              <div className="font-heading text-sm gold-text mb-1" style={{ WebkitTextFillColor: "unset", color: theme.color }}>In Development</div>
              <div className="text-xs text-[hsl(45,15%,60%)] font-body">Pipeline planned, builds underway.</div>
            </div>
            <div className="fantasy-panel p-4">
              <Sparkles className="w-5 h-5 mb-2" style={{ color: theme.color }} />
              <div className="font-heading text-sm gold-text mb-1" style={{ WebkitTextFillColor: "unset", color: theme.color }}>Playtest Access</div>
              <div className="text-xs text-[hsl(45,15%,60%)] font-body">Sign in with Grudge ID to be notified.</div>
            </div>
            <div className="fantasy-panel p-4">
              <ExternalLink className="w-5 h-5 mb-2" style={{ color: theme.color }} />
              <div className="font-heading text-sm gold-text mb-1" style={{ WebkitTextFillColor: "unset", color: theme.color }}>Discord</div>
              <div className="text-xs text-[hsl(45,15%,60%)] font-body">Join for build drops and tournaments.</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/account">
              <Button className="gilded-button">Get Notified · Sign In</Button>
            </Link>
            <a href="https://discord.gg/grudge" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,15%)]">
                <ExternalLink className="w-4 h-4 mr-2" /> Join Discord
              </Button>
            </a>
            <Link href="/">
              <Button variant="ghost" className="text-[hsl(45,15%,65%)] hover:text-[hsl(43,85%,55%)]">
                Browse Live Games
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
