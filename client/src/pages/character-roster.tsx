/**
 * Grudge6 Roster — character.grudge-studio.com/roster
 *
 * Pregame lobby: pick your hero (unarmed), choose weapons, preview loadout.
 * Lane characters = all 24 CHARACTER_PREFABS exactly as defined (class gear).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Check, ExternalLink, Swords, Users, Shield, Zap,
} from "lucide-react";
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
  LANE_HEROES,
  PREGAME_WEAPONS,
  buildRosterSearch,
  defaultPlayerLoadout,
  getWeaponById,
  parseRosterSearch,
  readPlayerLoadout,
  savePlayerLoadout,
  toUnarmedPrefab,
  type PlayerLoadout,
} from "@shared/game-roster";

const RACES: RaceId[] = ["human", "barbarian", "elf", "dwarf", "orc", "undead"];
const CLASSES: ClassId[] = ["warrior", "mage", "ranger", "worge"];

const RACE_LABELS: Record<RaceId, string> = {
  human: "Human", barbarian: "Barbarian", elf: "Elf",
  dwarf: "Dwarf", orc: "Orc", undead: "Undead",
};

type Step = "hero" | "weapons" | "ready";

export default function CharacterRosterPage() {
  const [location, navigate] = useLocation();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const urlLoadout = useMemo(() => parseRosterSearch(search), [search, location]);

  const [step, setStep] = useState<Step>("hero");
  const [heroId, setHeroId] = useState(urlLoadout.heroId ?? readPlayerLoadout()?.heroId ?? defaultPlayerLoadout().heroId);
  const [primaryWeapon, setPrimaryWeapon] = useState(urlLoadout.primaryWeapon ?? readPlayerLoadout()?.primaryWeapon ?? defaultPlayerLoadout().primaryWeapon);
  const [secondaryWeapon, setSecondaryWeapon] = useState<string | null>(
    urlLoadout.secondaryWeapon ?? readPlayerLoadout()?.secondaryWeapon ?? defaultPlayerLoadout().secondaryWeapon,
  );
  const [raceFilter, setRaceFilter] = useState<RaceId>("barbarian");
  const [classFilter, setClassFilter] = useState<ClassId>("warrior");
  const [lanePreviewId, setLanePreviewId] = useState<string | null>(null);

  const heroPrefab = useMemo(() => getPrefab(heroId) ?? CHARACTER_PREFABS[0], [heroId]);
  const unarmedPrefab = useMemo(() => toUnarmedPrefab(heroPrefab), [heroPrefab]);
  const lanePreviewPrefab = useMemo(
    () => (lanePreviewId ? getPrefab(lanePreviewId) : null),
    [lanePreviewId],
  );

  const weaponManifestKeys = useMemo(() => {
    const keys: string[] = [];
    const p = getWeaponById(primaryWeapon);
    const s = secondaryWeapon ? getWeaponById(secondaryWeapon) : null;
    if (p) keys.push(p.manifestKey);
    if (s && s.id !== p?.id) keys.push(s.manifestKey);
    return keys;
  }, [primaryWeapon, secondaryWeapon]);

  const syncUrl = useCallback((loadout: PlayerLoadout) => {
    const next = `/roster${buildRosterSearch(loadout)}`;
    if (`${location}${search}` !== next) navigate(next);
  }, [navigate, location, search]);

  useEffect(() => {
    document.title = "Roster — Grudge6 Pregame";
  }, []);

  useEffect(() => {
    if (heroPrefab) {
      setRaceFilter(heroPrefab.race);
      setClassFilter(heroPrefab.classId);
    }
  }, [heroPrefab]);

  function selectHero(prefab: CharacterPrefab) {
    setHeroId(prefab.id);
    setRaceFilter(prefab.race);
    setClassFilter(prefab.classId);
    syncUrl({ heroId: prefab.id, primaryWeapon, secondaryWeapon });
  }

  function toggleWeapon(id: string) {
    let nextPrimary = primaryWeapon;
    let nextSecondary = secondaryWeapon;
    if (primaryWeapon === id) {
      nextPrimary = secondaryWeapon ?? PREGAME_WEAPONS.find((w) => w.id !== id)?.id ?? id;
      nextSecondary = null;
    } else if (secondaryWeapon === id) {
      nextSecondary = null;
    } else if (!primaryWeapon) {
      nextPrimary = id;
    } else if (!secondaryWeapon) {
      nextSecondary = id;
    } else {
      nextSecondary = id;
    }
    setPrimaryWeapon(nextPrimary);
    setSecondaryWeapon(nextSecondary);
    syncUrl({ heroId, primaryWeapon: nextPrimary, secondaryWeapon: nextSecondary });
  }

  function confirmLoadout() {
    if (!primaryWeapon) return;
    const loadout: PlayerLoadout = { heroId, primaryWeapon, secondaryWeapon };
    savePlayerLoadout(loadout);
    syncUrl(loadout);
    setStep("ready");
  }

  const filteredHeroes = useMemo(
    () => CHARACTER_PREFABS.filter((p) => p.race === raceFilter && p.classId === classFilter),
    [raceFilter, classFilter],
  );

  const isDedicatedHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "character.grudge-studio.com" ||
      window.location.hostname === "characters.grudge-studio.com" ||
      window.location.hostname === "grudge6.grudge-studio.com");

  const primaryW = getWeaponById(primaryWeapon);
  const secondaryW = secondaryWeapon ? getWeaponById(secondaryWeapon) : null;

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
            <Link href="/viewer">
              <Button variant="ghost" size="sm" className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)]">
                Viewer
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-heading text-[hsl(43,85%,55%)] flex items-center gap-2">
                <Swords className="w-5 h-5" />
                Grudge6 Roster — Pregame
              </h1>
              <p className="text-xs text-[hsl(45,15%,55%)]">
                You spawn unarmed · Pick weapons here · Lanes use all {PREFAB_STATS.total} heroes as-is
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["hero", "weapons", "ready"] as Step[]).map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(s)}
                className={`text-[10px] px-2.5 py-1 rounded-full border capitalize ${
                  step === s
                    ? "border-[hsl(43,85%,55%)]/60 text-[hsl(43,85%,55%)] bg-[hsl(43,85%,55%)]/10"
                    : "border-[hsl(43,60%,30%)]/25 text-[hsl(45,15%,55%)]"
                }`}
              >
                {i + 1}. {s}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-[minmax(240px,280px)_1fr_minmax(220px,260px)] gap-4 min-h-0">
        {/* Hero picker */}
        <aside className="flex flex-col gap-3 min-h-0 overflow-auto">
          <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] flex items-center gap-1">
            <Users size={12} /> Your hero (unarmed)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RACES.map((race) => (
              <button
                key={race}
                type="button"
                onClick={() => {
                  setRaceFilter(race);
                  const p = CHARACTER_PREFABS.find((x) => x.race === race && x.classId === classFilter)
                    ?? CHARACTER_PREFABS.find((x) => x.race === race);
                  if (p) selectHero(p);
                }}
                className={`text-[10px] px-2 py-1 rounded border ${
                  raceFilter === race
                    ? "border-[hsl(43,85%,55%)]/60 text-[hsl(43,85%,55%)]"
                    : "border-[hsl(43,60%,30%)]/25 text-[hsl(45,15%,60%)]"
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
                  const p = CHARACTER_PREFABS.find((x) => x.race === raceFilter && x.classId === cls);
                  if (p) selectHero(p);
                }}
                className={`text-[10px] px-2 py-1 rounded border capitalize ${
                  classFilter === cls
                    ? "border-[hsl(43,85%,55%)]/60 text-[hsl(43,85%,55%)]"
                    : "border-[hsl(43,60%,30%)]/25 text-[hsl(45,15%,60%)]"
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            {filteredHeroes.map((prefab) => (
              <button
                key={prefab.id}
                type="button"
                onClick={() => selectHero(prefab)}
                className={`text-left p-2 rounded-lg border ${
                  heroId === prefab.id
                    ? "border-[hsl(43,85%,55%)]/50 bg-[hsl(43,85%,55%)]/8"
                    : "border-[hsl(43,60%,30%)]/20 hover:border-[hsl(43,60%,30%)]/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <img src={prefab.iconUrl} alt="" className="w-7 h-7 rounded object-cover" loading="lazy" />
                  <span className="text-xs font-medium">{prefab.name}</span>
                  {heroId === prefab.id && <Check size={12} className="ml-auto text-[hsl(43,85%,55%)]" />}
                </div>
              </button>
            ))}
          </div>
          <Button
            size="sm"
            className="bg-[hsl(43,85%,45%)] hover:bg-[hsl(43,85%,40%)]"
            onClick={() => setStep("weapons")}
          >
            Next: Weapons
          </Button>
        </aside>

        {/* Preview */}
        <main className="min-h-[400px] flex flex-col gap-3">
          <CharacterViewport
            key={`${unarmedPrefab.id}-${primaryWeapon}-${secondaryWeapon}`}
            prefab={unarmedPrefab}
            unarmed
            weaponManifestKeys={weaponManifestKeys}
          />
          {lanePreviewPrefab && (
            <div className="rounded-lg border border-[hsl(43,60%,30%)]/30 p-2">
              <div className="text-[10px] text-[hsl(45,15%,55%)] mb-2 flex items-center gap-1">
                <Shield size={11} /> Lane preview — {lanePreviewPrefab.name} (full class loadout)
              </div>
              <div className="h-[200px]">
                <CharacterViewport
                  key={`lane-${lanePreviewPrefab.id}`}
                  prefab={lanePreviewPrefab}
                  laneMode
                />
              </div>
            </div>
          )}
          <p className="text-[11px] text-[hsl(45,15%,50%)] leading-relaxed">
            {heroPrefab.lore}
          </p>
        </main>

        {/* Weapons + lane roster */}
        <aside className="flex flex-col gap-3 min-h-0 overflow-auto">
          <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] flex items-center gap-1">
            <Zap size={12} /> Pregame weapons
          </div>
          <p className="text-[10px] text-[hsl(45,15%,55%)] leading-relaxed">
            Select primary (slot 1) and optional secondary (slot 2). You enter the match unarmed until loadout applies.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {PREGAME_WEAPONS.map((w) => {
              const isPrimary = primaryWeapon === w.id;
              const isSecondary = secondaryWeapon === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => toggleWeapon(w.id)}
                  className={`text-left p-2 rounded border text-[10px] ${
                    isPrimary || isSecondary
                      ? "border-[hsl(43,85%,55%)]/50 bg-[hsl(43,85%,55%)]/8"
                      : "border-[hsl(43,60%,30%)]/20"
                  }`}
                >
                  <span className="text-base mr-1">{w.icon}</span>
                  {w.label}
                  {isPrimary && <Badge className="ml-1 text-[8px] px-1">1</Badge>}
                  {isSecondary && <Badge className="ml-1 text-[8px] px-1">2</Badge>}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 text-[10px] p-2 rounded bg-[hsl(225,25%,10%)] border border-[hsl(43,60%,30%)]/20">
            <span>Loadout:</span>
            <span className="text-[hsl(43,85%,55%)]">{primaryW?.icon} {primaryW?.label ?? "—"}</span>
            {secondaryW && (
              <>
                <span>+</span>
                <span>{secondaryW.icon} {secondaryW.label}</span>
              </>
            )}
          </div>
          <Button
            size="sm"
            disabled={!primaryWeapon}
            className="bg-[hsl(43,85%,45%)]"
            onClick={confirmLoadout}
          >
            <Check className="w-3.5 h-3.5 mr-1" /> Lock loadout
          </Button>

          <div className="border-t border-[hsl(43,60%,30%)]/20 pt-3 mt-1">
            <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] mb-2">
              Lane heroes ({LANE_HEROES.length})
            </div>
            <p className="text-[9px] text-[hsl(45,15%,55%)] mb-2">
              These march lanes with class weapons &amp; armor from the roster — not player picks.
            </p>
            <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
              {LANE_HEROES.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setLanePreviewId(lanePreviewId === h.id ? null : h.id)}
                  className={`text-left px-2 py-1 rounded text-[9px] border ${
                    lanePreviewId === h.id
                      ? "border-[hsl(43,85%,55%)]/40 text-[hsl(43,85%,55%)]"
                      : "border-transparent text-[hsl(45,15%,60%)] hover:bg-[hsl(225,25%,12%)]"
                  }`}
                >
                  {h.name}
                  <span className="text-[hsl(45,15%,45%)] ml-1">· {h.animationPack}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {step === "ready" && (
        <div className="shrink-0 border-t border-[hsl(43,60%,30%)]/25 bg-[hsl(225,25%,8%)] px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-[hsl(43,85%,55%)] font-semibold">{heroPrefab.name}</span>
              <span className="text-[hsl(45,15%,55%)]"> ready — </span>
              <span>{primaryW?.label}</span>
              {secondaryW && <span> + {secondaryW.label}</span>}
            </div>
            <div className="flex gap-2">
              <Link href={`/annihilate-demo?hero=${heroId}`}>
                <Button size="sm" variant="outline" className="border-[hsl(43,60%,30%)]/40">
                  Enter Annihilate
                </Button>
              </Link>
              <a href="https://github.com/Grudge-Warlords/The-ENGINE" target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4 text-[hsl(45,15%,55%)]" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}