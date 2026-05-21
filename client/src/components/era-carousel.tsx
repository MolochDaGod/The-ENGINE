import { ArrowUpRight, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface EraCarouselItem {
  key: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  bgImage: string;
  accent: string;
  accentBorder: string;
}

interface EraCarouselProps {
  eras: EraCarouselItem[];
  activeKey: string;
  setActiveKey: (k: string) => void;
}

export function EraCarousel({ eras, activeKey, setActiveKey }: EraCarouselProps) {
  const idx = Math.max(0, eras.findIndex((e) => e.key === activeKey));
  const era = eras[idx];
  if (!era) return null;
  const Icon = era.icon;

  const prev = () => setActiveKey(eras[(idx - 1 + eras.length) % eras.length].key);
  const next = () => setActiveKey(eras[(idx + 1) % eras.length].key);
  const visit = () => document.getElementById(era.key)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="relative rounded-xl overflow-hidden border-2 transition-all duration-500" style={{ borderColor: era.accentBorder }}>
      <div className="absolute inset-0 z-0">
        <img key={era.key} src={era.bgImage} alt="" className="w-full h-full object-cover transition-opacity duration-500" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/40" />
      </div>
      <div className="relative z-10 p-6 sm:p-8 min-h-[220px] flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Icon className="w-6 h-6" style={{ color: era.accent }} />
            <h3 className="text-2xl sm:text-3xl font-heading tracking-wide" style={{ color: era.accent, WebkitTextFillColor: "unset" }}>{era.name}</h3>
            <Badge className="border text-[10px] uppercase tracking-wide" style={{ borderColor: era.accentBorder, color: era.accent, background: `${era.accent}15` }}>{era.key === "armada" ? "Coming Soon" : "Active"}</Badge>
            <span className="text-xs text-[hsl(45,15%,70%)] font-body ml-1">{era.tagline}</span>
          </div>
          <p className="text-sm text-[hsl(45,15%,80%)] font-body max-w-2xl leading-relaxed">{era.description}</p>
        </div>
        <div className="flex items-center justify-between mt-5 gap-3 flex-wrap">
          <Button size="sm" onClick={visit} className="gilded-button" style={{ background: era.accent, color: "hsl(225,30%,8%)" }}>
            <ArrowUpRight className="w-4 h-4 mr-1" /> Enter {era.name}
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {eras.map((e, i) => (
                <button
                  key={e.key}
                  onClick={() => setActiveKey(e.key)}
                  aria-label={`Show ${e.name}`}
                  className={`h-2 rounded-full transition-all ${i === idx ? "w-6" : "w-2 bg-[hsl(45,15%,40%)]"}`}
                  style={i === idx ? { background: era.accent } : undefined}
                />
              ))}
            </div>
            <button
              onClick={prev}
              aria-label="Previous era"
              className="w-8 h-8 rounded-full border border-[hsl(43,60%,30%)]/40 flex items-center justify-center text-[hsl(45,15%,70%)] hover:text-white hover:border-[hsl(43,85%,55%)] transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={next}
              aria-label="Next era"
              className="w-8 h-8 rounded-full border border-[hsl(43,60%,30%)]/40 flex items-center justify-center text-[hsl(45,15%,70%)] hover:text-white hover:border-[hsl(43,85%,55%)] transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
