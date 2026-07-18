/**
 * Warlords-era hero roster: all 24 prefabs (6 races × 4 classes)
 * as compact cards with a pop-out detail dialog.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, Swords, Users } from "lucide-react";
import {
  CHARACTER_PREFABS,
  type CharacterPrefab,
  type RaceId,
  type ClassId,
  type FactionId,
} from "@shared/character-prefabs";

const RACE_ORDER: RaceId[] = ["human", "barbarian", "elf", "dwarf", "orc", "undead"];
const CLASS_ORDER: ClassId[] = ["warrior", "mage", "ranger", "worge"];

const CLASS_ICONS: Record<ClassId, string> = {
  warrior: "⚔️",
  mage: "🔮",
  ranger: "🏹",
  worge: "🐺",
};

const FACTION_STYLE: Record<FactionId, { border: string; label: string; tint: string }> = {
  crusade: {
    border: "border-blue-500/40",
    label: "Crusade",
    tint: "from-blue-950/80 to-[hsl(225,30%,8%)]",
  },
  fabled: {
    border: "border-emerald-500/40",
    label: "Fabled",
    tint: "from-emerald-950/80 to-[hsl(225,30%,8%)]",
  },
  legion: {
    border: "border-red-500/40",
    label: "Legion",
    tint: "from-red-950/80 to-[hsl(225,30%,8%)]",
  },
};

const WARLORDS_URL =
  (import.meta.env.VITE_WARLORDS_URL as string | undefined) ?? "https://grudgewarlords.com";

function HeroThumb({
  hero,
  onOpen,
}: {
  hero: CharacterPrefab;
  onOpen: (h: CharacterPrefab) => void;
}) {
  const faction = FACTION_STYLE[hero.faction];
  return (
    <button
      type="button"
      onClick={() => onOpen(hero)}
      className={`group relative aspect-[3/4] rounded-lg overflow-hidden border ${faction.border} bg-gradient-to-b ${faction.tint} text-left transition-all duration-200 hover:scale-[1.04] hover:rune-glow hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(43,85%,55%)]`}
      title={`${hero.name} — ${faction.label}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-1.5">
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 mb-1.5 shadow-lg"
          style={{ borderColor: hero.classColor + "99", background: hero.classColor + "22" }}
        >
          <img
            src={hero.iconUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = "none";
              const sibling = el.nextElementSibling as HTMLElement | null;
              if (sibling) sibling.classList.remove("hidden");
            }}
          />
          <span className="hidden w-full h-full flex items-center justify-center text-lg">
            {CLASS_ICONS[hero.classId]}
          </span>
        </div>
        <span className="text-[9px] sm:text-[10px] font-heading text-[hsl(45,30%,92%)] text-center leading-tight line-clamp-2 px-0.5">
          {hero.name}
        </span>
        <span
          className="mt-0.5 text-[8px] uppercase tracking-wider font-body"
          style={{ color: hero.classColor }}
        >
          {hero.classId}
        </span>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-0.5 opacity-70"
        style={{ background: hero.classColor }}
      />
    </button>
  );
}

function HeroPopOut({
  hero,
  open,
  onOpenChange,
}: {
  hero: CharacterPrefab | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!hero) return null;
  const faction = FACTION_STYLE[hero.faction];
  const stats = Object.entries(hero.baseStats);
  const skills = hero.skills.slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[hsl(43,60%,30%)]/50 bg-[hsl(225,30%,8%)] text-[hsl(45,30%,92%)] sm:rounded-xl p-0 overflow-hidden">
        <div
          className={`relative px-6 pt-6 pb-4 bg-gradient-to-br ${faction.tint} border-b border-[hsl(43,60%,30%)]/30`}
        >
          <DialogHeader className="space-y-3">
            <div className="flex items-start gap-4">
              <div
                className="w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 shadow-xl"
                style={{ borderColor: hero.classColor + "aa", background: hero.classColor + "25" }}
              >
                <img
                  src={hero.iconUrl}
                  alt={hero.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = hero.raceIconUrl;
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle
                  className="font-heading text-xl text-[hsl(45,30%,92%)]"
                  style={{ WebkitTextFillColor: "unset" }}
                >
                  {hero.name}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {hero.lore}
                </DialogDescription>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase"
                    style={{ borderColor: hero.classColor + "70", color: hero.classColor }}
                  >
                    {CLASS_ICONS[hero.classId]} {hero.classId}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase ${faction.border} text-[hsl(45,15%,75%)]`}
                  >
                    {faction.label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase border-[hsl(43,60%,30%)]/40 text-[hsl(43,85%,55%)] capitalize"
                  >
                    {hero.race}
                  </Badge>
                </div>
              </div>
            </div>
          </DialogHeader>
          <p className="mt-3 text-sm text-[hsl(45,15%,70%)] font-body leading-relaxed">
            {hero.lore}
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,55%)] font-body mb-2">
              Base stats
            </div>
            <div className="grid grid-cols-4 gap-2">
              {stats.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-md border border-[hsl(43,60%,30%)]/25 bg-black/25 px-1.5 py-1.5 text-center"
                >
                  <div className="text-[9px] text-[hsl(45,15%,50%)] font-body">{key}</div>
                  <div className="text-sm font-heading gold-text">{value}</div>
                  <div className="mt-0.5 h-1 rounded bg-black/40 overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${Math.min(100, (value / 7) * 100)}%`, background: hero.classColor }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,55%)] font-body mb-2">
              Skills
            </div>
            <ul className="space-y-1.5">
              {skills.map((skill) => (
                <li
                  key={skill.id}
                  className="flex items-start gap-2 rounded-md border border-[hsl(43,60%,30%)]/20 bg-black/20 px-2.5 py-1.5"
                >
                  <span className="text-sm shrink-0 mt-0.5">{skill.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-heading text-[hsl(45,30%,90%)]">
                      {skill.name}
                      <span className="ml-1.5 text-[9px] text-[hsl(45,15%,45%)] font-body">
                        T{skill.tier}
                      </span>
                    </div>
                    <div className="text-[10px] text-[hsl(45,15%,55%)] font-body leading-snug">
                      {skill.description}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <a href={WARLORDS_URL} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button className="w-full gilded-button text-xs h-9">
                <Swords className="w-3.5 h-3.5 mr-1.5" />
                Play Warlords
                <ExternalLink className="w-3 h-3 ml-1.5 opacity-70" />
              </Button>
            </a>
            <Link href={`/roster?hero=${hero.id}`} className="flex-1">
              <Button
                variant="outline"
                className="w-full text-xs h-9 border-[hsl(43,60%,30%)]/50 text-[hsl(45,30%,90%)]"
              >
                <Users className="w-3.5 h-3.5 mr-1.5" />
                Open roster
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WarlordsHeroCards() {
  const [selected, setSelected] = useState<CharacterPrefab | null>(null);
  const [open, setOpen] = useState(false);

  const heroes = CHARACTER_PREFABS.slice().sort((a, b) => {
    const ri = RACE_ORDER.indexOf(a.race) - RACE_ORDER.indexOf(b.race);
    if (ri !== 0) return ri;
    return CLASS_ORDER.indexOf(a.classId) - CLASS_ORDER.indexOf(b.classId);
  });

  function openHero(hero: CharacterPrefab) {
    setSelected(hero);
    setOpen(true);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[hsl(43,85%,55%)]" />
          <h3
            className="text-sm font-heading uppercase tracking-wider text-[hsl(43,85%,55%)]"
            style={{ WebkitTextFillColor: "unset" }}
          >
            24 Warlords Heroes
          </h3>
        </div>
        <span className="text-[10px] text-[hsl(45,15%,50%)] font-body">
          6 races · 4 classes · tap for details
        </span>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 gap-2">
        {heroes.map((hero) => (
          <HeroThumb key={hero.id} hero={hero} onOpen={openHero} />
        ))}
      </div>

      <HeroPopOut hero={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}
