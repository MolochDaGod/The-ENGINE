/**
 * Grudge6 Character Viewer — character.grudge-studio.com/viewer
 *
 * Native Three.js viewer for 24 race×class prefabs. Syncs URL params:
 *   ?race=barbarian&class=warrior&id=barbarian_warrior&vfx=1
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Users, ExternalLink, ArrowLeft, Swords, BookOpen } from "lucide-react";
import CharacterViewport from "@/components/character-viewport";
import {
  CHARACTER_PREFABS,
  PREFAB_STATS,
  getPrefab,
  type CharacterPrefab,
  type RaceId,
  type ClassId,
} from "@shared/character-prefabs";
import {
  loadWeaponSkillsCatalog,
  getDefaultHotbar,
  type WeaponSkill,
} from "@/lib/weapon-skills";

const RACES: RaceId[] = ["human", "barbarian", "elf", "dwarf", "orc", "undead"];
const CLASSES: ClassId[] = ["warrior", "mage", "ranger", "worge"];

/** Default mainhand weapon type per class (ObjectStore master-weaponSkills). */
const CLASS_WEAPON: Record<ClassId, string> = {
  warrior: "SWORD",
  mage: "STAFF",
  ranger: "BOW",
  worge: "SPEAR",
};

const RACE_LABELS: Record<RaceId, string> = {
  human: "Human",
  barbarian: "Barbarian",
  elf: "Elf",
  dwarf: "Dwarf",
  orc: "Orc",
  undead: "Undead",
};

function parseViewerSearch(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const race = (params.get("race") as RaceId | null) ?? "barbarian";
  const classId = (params.get("class") as ClassId | null) ?? "warrior";
  const id = params.get("id");
  const vfx = params.get("vfx") === "1" || params.get("vfx") === "true";
  return { race, classId, id, vfx };
}

function buildViewerSearch(prefab: CharacterPrefab, vfx: boolean): string {
  const params = new URLSearchParams();
  params.set("race", prefab.race);
  params.set("class", prefab.classId);
  params.set("id", prefab.id);
  if (vfx) params.set("vfx", "1");
  return `?${params.toString()}`;
}

export default function CharacterViewerPage() {
  const [location, navigate] = useLocation();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const parsed = useMemo(() => parseViewerSearch(search), [search, location]);

  const [vfxMode, setVfxMode] = useState(parsed.vfx);
  const [raceFilter, setRaceFilter] = useState<RaceId>(parsed.race);
  const [classFilter, setClassFilter] = useState<ClassId>(parsed.classId);
  const [skillBar, setSkillBar] = useState<WeaponSkill[]>([]);
  const [catalogMeta, setCatalogMeta] = useState<{ version: string; total: number } | null>(null);

  const selectedPrefab = useMemo(() => {
    if (parsed.id) {
      const byId = getPrefab(parsed.id);
      if (byId) return byId;
    }
    const match = CHARACTER_PREFABS.find(
      (p) => p.race === parsed.race && p.classId === parsed.classId,
    );
    return match ?? CHARACTER_PREFABS[0];
  }, [parsed.id, parsed.race, parsed.classId]);

  const filteredPrefabs = useMemo(
    () =>
      CHARACTER_PREFABS.filter(
        (p) => p.race === raceFilter && p.classId === classFilter,
      ),
    [raceFilter, classFilter],
  );

  // Canonical ObjectStore weapon skills (icons via assets CDN)
  useEffect(() => {
    let cancelled = false;
    const weaponId = CLASS_WEAPON[selectedPrefab.classId] || "SWORD";
    loadWeaponSkillsCatalog()
      .then((cat) => {
        if (cancelled) return;
        setCatalogMeta({ version: cat.version, total: cat.totalSkills });
        setSkillBar(getDefaultHotbar(weaponId, 4));
      })
      .catch(() => {
        if (!cancelled) setSkillBar([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPrefab.classId]);

  const syncUrl = useCallback(
    (prefab: CharacterPrefab, vfx: boolean) => {
      const next = `/viewer${buildViewerSearch(prefab, vfx)}`;
      if (`${location}${search}` !== next) navigate(next);
    },
    [navigate, location, search],
  );

  useEffect(() => {
    document.title = `${selectedPrefab.name} — Grudge Character Viewer`;
  }, [selectedPrefab.name]);

  useEffect(() => {
    setVfxMode(parsed.vfx);
    setRaceFilter(parsed.race);
    setClassFilter(parsed.classId);
  }, [parsed.vfx, parsed.race, parsed.classId]);

  function selectPrefab(prefab: CharacterPrefab) {
    setRaceFilter(prefab.race);
    setClassFilter(prefab.classId);
    syncUrl(prefab, vfxMode);
  }

  function toggleVfx() {
    const next = !vfxMode;
    setVfxMode(next);
    syncUrl(selectedPrefab, next);
  }

  const isDedicatedHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "character.grudge-studio.com" ||
      window.location.hostname === "characters.grudge-studio.com" ||
      window.location.hostname === "grudge6.grudge-studio.com");

  return (
    <div className="min-h-screen bg-[hsl(225,30%,6%)] text-[hsl(45,30%,92%)] flex flex-col">
      <header className="shrink-0 border-b border-[hsl(43,60%,30%)]/25 bg-[hsl(225,25%,8%)]/90 backdrop-blur px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
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
                <Users className="w-5 h-5" />
                Grudge6 Character Viewer
              </h1>
              <p className="text-xs text-[hsl(45,15%,55%)]">
                {PREFAB_STATS.total} prefabs · {PREFAB_STATS.races} races · CDN + FBX fallback
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={vfxMode ? "default" : "outline"}
              size="sm"
              className={vfxMode ? "bg-[hsl(43,85%,45%)]" : "border-[hsl(43,60%,30%)]/40"}
              onClick={toggleVfx}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              VFX {vfxMode ? "on" : "off"}
            </Button>
            <Link href="/game/weapons">
              <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)]/40">
                <BookOpen className="w-3.5 h-3.5 mr-1" /> Items
              </Button>
            </Link>
            <Link href="/roster">
              <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)]/40">
                <Swords className="w-3.5 h-3.5 mr-1" /> Roster
              </Button>
            </Link>
            <a
              href="https://github.com/Grudge-Warlords/The-ENGINE"
              target="_blank"
              rel="noreferrer"
              className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)]"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-[minmax(260px,300px)_1fr] gap-4 min-h-0">
        <aside className="flex flex-col gap-3 min-h-0 overflow-auto">
          <div className="flex flex-wrap gap-1.5">
            {RACES.map((race) => (
              <button
                key={race}
                type="button"
                onClick={() => {
                  setRaceFilter(race);
                  const prefab =
                    CHARACTER_PREFABS.find((p) => p.race === race && p.classId === classFilter) ??
                    CHARACTER_PREFABS.find((p) => p.race === race);
                  if (prefab) selectPrefab(prefab);
                }}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                  raceFilter === race
                    ? "border-[hsl(43,85%,55%)]/60 text-[hsl(43,85%,55%)] bg-[hsl(43,85%,55%)]/10"
                    : "border-[hsl(43,60%,30%)]/25 text-[hsl(45,15%,60%)] hover:border-[hsl(43,60%,30%)]/50"
                }`}
              >
                {RACE_LABELS[race]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CLASSES.map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => {
                  setClassFilter(cls);
                  const prefab = CHARACTER_PREFABS.find(
                    (p) => p.race === raceFilter && p.classId === cls,
                  );
                  if (prefab) selectPrefab(prefab);
                }}
                className={`text-[10px] px-2 py-1 rounded border capitalize transition-colors ${
                  classFilter === cls
                    ? "border-[hsl(43,85%,55%)]/60 text-[hsl(43,85%,55%)] bg-[hsl(43,85%,55%)]/10"
                    : "border-[hsl(43,60%,30%)]/25 text-[hsl(45,15%,60%)] hover:border-[hsl(43,60%,30%)]/50"
                }`}
              >
                {cls}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            {filteredPrefabs.map((prefab) => (
              <button
                key={prefab.id}
                type="button"
                onClick={() => selectPrefab(prefab)}
                className={`text-left p-2.5 rounded-lg border transition-colors ${
                  selectedPrefab.id === prefab.id
                    ? "border-[hsl(43,85%,55%)]/50 bg-[hsl(43,85%,55%)]/8"
                    : "border-[hsl(43,60%,30%)]/20 hover:border-[hsl(43,60%,30%)]/40 bg-[hsl(225,25%,10%)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <img
                    src={prefab.iconUrl}
                    alt=""
                    className="w-8 h-8 rounded object-cover bg-[hsl(225,25%,14%)]"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{prefab.name}</div>
                    <div className="text-[10px] text-[hsl(45,15%,50%)] truncate">{prefab.lore}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[9px] shrink-0 border-[hsl(43,60%,30%)]/40"
                    style={{ color: prefab.classColor, borderColor: `${prefab.classColor}55` }}
                  >
                    {prefab.faction}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-h-[420px] flex flex-col gap-3 min-h-0">
          <CharacterViewport key={selectedPrefab.id + (vfxMode ? "-vfx" : "")} prefab={selectedPrefab} vfxMode={vfxMode} />
          {skillBar.length > 0 && (
            <div className="px-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-wider text-[hsl(43,85%,55%)]">
                  {CLASS_WEAPON[selectedPrefab.classId]} skills
                </span>
                {catalogMeta && (
                  <a
                    href="https://browse.grudge-studio.com/WEAPON_SKILLS"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-[hsl(45,15%,50%)] hover:text-[hsl(43,85%,55%)]"
                  >
                    ObjectStore v{catalogMeta.version} · {catalogMeta.total} skills →
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {skillBar.map((sk, i) => (
                  <div
                    key={sk.id}
                    title={`${sk.name}${sk.description ? ` — ${sk.description}` : ""}`}
                    className="flex items-center gap-2 rounded-md border border-[hsl(43,60%,30%)]/35 bg-[hsl(225,25%,10%)] px-2 py-1.5 min-w-[120px]"
                  >
                    <span className="text-[9px] text-[hsl(45,15%,45%)] w-3">{i + 1}</span>
                    <img
                      src={sk.iconUrl}
                      alt=""
                      className="w-8 h-8 object-contain rounded bg-[hsl(225,30%,8%)]"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium truncate max-w-[100px]">{sk.name}</div>
                      <div className="text-[9px] text-[hsl(45,15%,50%)]">
                        {sk.slotType}
                        {sk.cooldown != null && sk.cooldown > 0 ? ` · ${sk.cooldown}s` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-[11px] text-[hsl(45,15%,50%)] leading-relaxed px-1">
            {selectedPrefab.lore}
          </p>
          <div className="flex flex-wrap gap-2 text-[10px] text-[hsl(45,15%,45%)] px-1">
            <span>STR {selectedPrefab.baseStats.STR}</span>
            <span>DEX {selectedPrefab.baseStats.DEX}</span>
            <span>INT {selectedPrefab.baseStats.INT}</span>
            <span>VIT {selectedPrefab.baseStats.VIT}</span>
            <span>·</span>
            <span>{selectedPrefab.skills.length} starter skills</span>
            <span>·</span>
            <span className="font-mono truncate max-w-[240px]">{selectedPrefab.modelPath}</span>
          </div>
        </main>
      </div>
    </div>
  );
}