import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHARACTER_PREFABS, type CharacterPrefab, type RaceId, type ClassId } from "@shared/character-prefabs";
import type { PlayerProfile } from "@/lib/player-auth";

const RACES: { id: RaceId; label: string; icon: string }[] = [
  { id: "human", label: "Human", icon: "👑" },
  { id: "barbarian", label: "Barbarian", icon: "🪓" },
  { id: "elf", label: "Elf", icon: "🧝" },
  { id: "dwarf", label: "Dwarf", icon: "⛏️" },
  { id: "orc", label: "Orc", icon: "👹" },
  { id: "undead", label: "Undead", icon: "💀" },
];

const CLASSES: { id: ClassId; label: string; icon: string }[] = [
  { id: "warrior", label: "Warrior", icon: "⚔️" },
  { id: "mage", label: "Mage", icon: "🧙" },
  { id: "ranger", label: "Ranger", icon: "🏹" },
  { id: "worge", label: "Worge", icon: "🐺" },
];

const factionColors: Record<string, string> = {
  crusade: "border-blue-500/40 bg-blue-950/20",
  fabled: "border-green-500/40 bg-green-950/20",
  legion: "border-red-500/40 bg-red-950/20",
};

export default function AccountCharacters({ player }: { player: PlayerProfile }) {
  const [raceFilter, setRaceFilter] = useState<RaceId | "all">("all");
  const [classFilter, setClassFilter] = useState<ClassId | "all">("all");
  const [selected, setSelected] = useState<CharacterPrefab | null>(null);

  const filtered = CHARACTER_PREFABS.filter(p =>
    (raceFilter === "all" || p.race === raceFilter) &&
    (classFilter === "all" || p.classId === classFilter)
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <section className="fantasy-panel p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <div className="text-[10px] text-[hsl(45,15%,55%)] uppercase tracking-wider font-body mb-1.5">Race</div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setRaceFilter("all")}
                className={`px-2.5 py-1 rounded text-xs font-heading transition-all ${raceFilter === "all" ? "bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)] border border-[hsl(43,85%,55%)]/40" : "text-[hsl(45,15%,55%)] border border-[hsl(43,60%,30%)]/20 hover:border-[hsl(43,60%,30%)]/40"}`}>
                All
              </button>
              {RACES.map(r => (
                <button key={r.id} onClick={() => setRaceFilter(r.id)}
                  className={`px-2.5 py-1 rounded text-xs font-heading transition-all ${raceFilter === r.id ? "bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)] border border-[hsl(43,85%,55%)]/40" : "text-[hsl(45,15%,55%)] border border-[hsl(43,60%,30%)]/20 hover:border-[hsl(43,60%,30%)]/40"}`}>
                  {r.icon} {r.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[hsl(45,15%,55%)] uppercase tracking-wider font-body mb-1.5">Class</div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setClassFilter("all")}
                className={`px-2.5 py-1 rounded text-xs font-heading transition-all ${classFilter === "all" ? "bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)] border border-[hsl(43,85%,55%)]/40" : "text-[hsl(45,15%,55%)] border border-[hsl(43,60%,30%)]/20 hover:border-[hsl(43,60%,30%)]/40"}`}>
                All
              </button>
              {CLASSES.map(c => (
                <button key={c.id} onClick={() => setClassFilter(c.id)}
                  className={`px-2.5 py-1 rounded text-xs font-heading transition-all ${classFilter === c.id ? "bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)] border border-[hsl(43,85%,55%)]/40" : "text-[hsl(45,15%,55%)] border border-[hsl(43,60%,30%)]/20 hover:border-[hsl(43,60%,30%)]/40"}`}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map(p => (
              <button key={p.id} onClick={() => setSelected(p)}
                className={`fantasy-panel p-3 text-left transition-all hover:rune-glow ${selected?.id === p.id ? "ring-2 ring-[hsl(43,85%,55%)]" : ""} ${factionColors[p.faction]}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ background: p.classColor + "30" }}>
                    {CLASSES.find(c => c.id === p.classId)?.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-heading text-[hsl(45,30%,92%)] truncate">{p.name}</div>
                    <div className="text-[10px] text-[hsl(45,15%,50%)] font-body capitalize">{p.faction}</div>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {Object.entries(p.baseStats).slice(0, 4).map(([k, v]) => (
                    <span key={k} className="text-[9px] bg-black/30 px-1 py-0.5 rounded font-mono text-[hsl(45,15%,60%)]">
                      {k}:{v}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="fantasy-panel p-8 text-center text-[hsl(45,15%,55%)] font-body">No characters match this filter.</div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="lg:w-[320px] flex-shrink-0 space-y-4">
            <section className={`fantasy-panel p-5 ${factionColors[selected.faction]}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: selected.classColor + "30", border: `2px solid ${selected.classColor}50` }}>
                  {CLASSES.find(c => c.id === selected.classId)?.icon}
                </div>
                <div>
                  <h3 className="font-heading text-lg text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>{selected.name}</h3>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="text-[9px] uppercase" style={{ borderColor: selected.classColor + "60", color: selected.classColor }}>{selected.classId}</Badge>
                    <Badge variant="outline" className="text-[9px] uppercase border-[hsl(43,60%,30%)]/40 text-[hsl(43,85%,55%)]">{selected.faction}</Badge>
                  </div>
                </div>
              </div>
              <p className="text-xs text-[hsl(45,15%,60%)] font-body leading-relaxed">{selected.lore}</p>
            </section>

            {/* Stats */}
            <section className="fantasy-panel p-4">
              <div className="text-[10px] text-[hsl(45,15%,55%)] uppercase tracking-wider font-body mb-2">Base Stats</div>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(selected.baseStats).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <div className="text-[10px] text-[hsl(45,15%,50%)] font-body">{k}</div>
                    <div className="text-sm font-heading gold-text">{v}</div>
                    <div className="w-full bg-black/30 h-1 rounded mt-0.5">
                      <div className="h-full rounded" style={{ width: `${(v / 7) * 100}%`, background: selected.classColor }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Skills */}
            <section className="fantasy-panel p-4">
              <div className="text-[10px] text-[hsl(45,15%,55%)] uppercase tracking-wider font-body mb-2">Starting Skills</div>
              <div className="space-y-2">
                {selected.skills.map(s => (
                  <div key={s.id} className="flex items-start gap-2 p-2 rounded bg-black/20 border border-[hsl(43,60%,30%)]/10">
                    <span className="text-lg">{s.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-heading text-[hsl(45,30%,92%)]">{s.name} <span className="text-[hsl(45,15%,45%)] font-body">T{s.tier}</span></div>
                      <div className="text-[10px] text-[hsl(45,15%,55%)] font-body">{s.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Equipment */}
            <section className="fantasy-panel p-4">
              <div className="text-[10px] text-[hsl(45,15%,55%)] uppercase tracking-wider font-body mb-2">Starting Equipment</div>
              <div className="grid grid-cols-2 gap-1 text-[10px] font-body text-[hsl(45,15%,60%)]">
                {selected.equipment.rightHandType && <div>🗡️ {selected.equipment.rightHandType}</div>}
                {selected.equipment.leftHandType && <div>🏹 {selected.equipment.leftHandType}</div>}
                {selected.equipment.shield && <div>🛡️ Shield</div>}
                {selected.equipment.head && <div>⛑️ Helmet</div>}
                <div>👕 Body Armor</div>
                <div>🦾 Arm Guards</div>
                <div>🦿 Leg Guards</div>
                {selected.equipment.utility.map(u => <div key={u}>🎒 {u}</div>)}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
