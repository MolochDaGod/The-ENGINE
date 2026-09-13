/**
 * Grudge6 Roster — grudge-studio.com/roster · character.grudge-studio.com/roster
 *
 * Pregame lobby: pick hero (unarmed), weapons, Unity wings/capes cosmetics,
 * class skills + weapon skills, mesh material labels for edit tooling.
 *
 * API best practices (Grudge Studio):
 * - Identity / JWT → id.grudge-studio.com
 * - Character SSOT → Railway /api/characters (not D1, not localStorage alone)
 * - Definitions (skills, cosmetics catalog) → ObjectStore + this shared module
 * - Binaries → assets.grudge-studio.com
 * - Mesh labels = definition layer; never PATCH onto character progress
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Check, ExternalLink, Swords, Users, Shield, Zap, Layers, Sparkles,
} from "lucide-react";
import CharacterViewport from "@/components/character-viewport";
import { HeroPortrait } from "@/components/hero-portrait";
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
  weaponSkillsTypeForPregame,
  type PlayerLoadout,
} from "@shared/game-roster";
import { ROSTER_CAPES, ROSTER_WINGS, type RosterCosmetic } from "@shared/cosmetics-roster";
import {
  summarizeLabels,
  type MeshLabel,
} from "@shared/mesh-material-labels";
import {
  loadWeaponSkillsCatalog,
  getSkillsForWeapon,
  type WeaponSkill,
} from "@/lib/weapon-skills";

const RACES: RaceId[] = ["human", "barbarian", "elf", "dwarf", "orc", "undead"];
const CLASSES: ClassId[] = ["warrior", "mage", "ranger", "worge"];

const RACE_LABELS: Record<RaceId, string> = {
  human: "Human", barbarian: "Barbarian", elf: "Elf",
  dwarf: "Dwarf", orc: "Orc", undead: "Undead",
};

type Step = "hero" | "weapons" | "cosmetics" | "ready";

function currentLoadout(
  heroId: string,
  primaryWeapon: string,
  secondaryWeapon: string | null,
  wingsId: string | null,
  capeId: string | null,
): PlayerLoadout {
  return { heroId, primaryWeapon, secondaryWeapon, wingsId, capeId };
}

export default function CharacterRosterPage() {
  const [location, navigate] = useLocation();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const urlLoadout = useMemo(() => parseRosterSearch(search), [search, location]);
  const stored = useMemo(() => readPlayerLoadout(), []);

  const [step, setStep] = useState<Step>("hero");
  const [heroId, setHeroId] = useState(
    urlLoadout.heroId ?? stored?.heroId ?? defaultPlayerLoadout().heroId,
  );
  const [primaryWeapon, setPrimaryWeapon] = useState(
    urlLoadout.primaryWeapon ?? stored?.primaryWeapon ?? defaultPlayerLoadout().primaryWeapon,
  );
  const [secondaryWeapon, setSecondaryWeapon] = useState<string | null>(
    urlLoadout.secondaryWeapon ?? stored?.secondaryWeapon ?? defaultPlayerLoadout().secondaryWeapon,
  );
  const [wingsId, setWingsId] = useState<string | null>(
    urlLoadout.wingsId ?? stored?.wingsId ?? null,
  );
  const [capeId, setCapeId] = useState<string | null>(
    urlLoadout.capeId ?? stored?.capeId ?? null,
  );
  const [raceFilter, setRaceFilter] = useState<RaceId>("barbarian");
  const [classFilter, setClassFilter] = useState<ClassId>("warrior");
  const [lanePreviewId, setLanePreviewId] = useState<string | null>(null);
  const [meshLabels, setMeshLabels] = useState<MeshLabel[]>([]);
  const [weaponSkills, setWeaponSkills] = useState<WeaponSkill[]>([]);
  const [skillsStatus, setSkillsStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");

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

  const meshSummary = useMemo(() => summarizeLabels(meshLabels), [meshLabels]);
  const editableLabels = useMemo(
    () => meshLabels.filter((l) => l.editable).slice(0, 24),
    [meshLabels],
  );

  const syncUrl = useCallback((loadout: PlayerLoadout) => {
    const next = `/roster${buildRosterSearch(loadout)}`;
    if (`${location}${search}` !== next) navigate(next);
  }, [navigate, location, search]);

  useEffect(() => {
    document.title = "Roster — Grudge Studio";
  }, []);

  useEffect(() => {
    if (heroPrefab) {
      setRaceFilter(heroPrefab.race);
      setClassFilter(heroPrefab.classId);
    }
  }, [heroPrefab]);

  // Load ObjectStore weapon skills for selection
  useEffect(() => {
    let cancelled = false;
    setSkillsStatus("loading");
    loadWeaponSkillsCatalog()
      .then((cat) => {
        if (cancelled) return;
        const typeId = weaponSkillsTypeForPregame(primaryWeapon);
        // Try several id casings / aliases
        const candidates = [
          typeId,
          typeId.toUpperCase(),
          typeId.toLowerCase(),
          primaryWeapon,
          getWeaponById(primaryWeapon)?.tags?.[0] ?? "",
        ].filter(Boolean);
        let skills: WeaponSkill[] = [];
        for (const c of candidates) {
          skills = getSkillsForWeapon(c);
          if (skills.length) break;
          // fuzzy match catalog types
          const hit = cat.weaponTypes.find(
            (t) =>
              t.id.toLowerCase() === c.toLowerCase() ||
              t.name.toLowerCase().includes(c.toLowerCase()),
          );
          if (hit) {
            skills = hit.skills;
            break;
          }
        }
        // Fallback: first few skills from any matching tag
        if (!skills.length && cat.weaponTypes.length) {
          const ranged = /pistol|smg|shotgun|ak|sniper|revolver|rifle/.test(primaryWeapon);
          const pick = cat.weaponTypes.find((t) =>
            ranged
              ? /rifle|pistol|gun|ranged/i.test(t.id + t.name)
              : /sword|melee|knife|dagger|axe/i.test(t.id + t.name),
          );
          skills = (pick?.skills ?? cat.weaponTypes[0].skills).slice(0, 6);
        }
        setWeaponSkills(skills.slice(0, 8));
        setSkillsStatus("ok");
      })
      .catch(() => {
        if (!cancelled) {
          setWeaponSkills([]);
          setSkillsStatus("err");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [primaryWeapon]);

  function pushLoadout(partial: Partial<PlayerLoadout>) {
    const next = currentLoadout(
      partial.heroId ?? heroId,
      partial.primaryWeapon ?? primaryWeapon,
      partial.secondaryWeapon !== undefined ? partial.secondaryWeapon : secondaryWeapon,
      partial.wingsId !== undefined ? partial.wingsId ?? null : wingsId,
      partial.capeId !== undefined ? partial.capeId ?? null : capeId,
    );
    syncUrl(next);
  }

  function selectHero(prefab: CharacterPrefab) {
    setHeroId(prefab.id);
    setRaceFilter(prefab.race);
    setClassFilter(prefab.classId);
    pushLoadout({ heroId: prefab.id });
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
    pushLoadout({ primaryWeapon: nextPrimary, secondaryWeapon: nextSecondary });
  }

  function toggleCosmetic(c: RosterCosmetic) {
    if (c.kind === "wings") {
      const next = wingsId === c.id ? null : c.id;
      setWingsId(next);
      pushLoadout({ wingsId: next });
    } else {
      const next = capeId === c.id ? null : c.id;
      setCapeId(next);
      pushLoadout({ capeId: next });
    }
  }

  function confirmLoadout() {
    if (!primaryWeapon) return;
    const loadout = currentLoadout(heroId, primaryWeapon, secondaryWeapon, wingsId, capeId);
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
      window.location.hostname === "grudge6.grudge-studio.com" ||
      window.location.hostname === "grudge-studio.com" ||
      window.location.hostname === "www.grudge-studio.com");

  const primaryW = getWeaponById(primaryWeapon);
  const secondaryW = secondaryWeapon ? getWeaponById(secondaryWeapon) : null;
  const classSkills = heroPrefab.skills ?? [];

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
                Grudge Studio Roster
              </h1>
              <p className="text-xs text-[hsl(45,15%,55%)]">
                Hero · weapons · wings/capes · class &amp; weapon skills · mesh labels
                {" · "}
                {PREFAB_STATS.total} lane heroes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["hero", "weapons", "cosmetics", "ready"] as Step[]).map((s, i) => (
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

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-[minmax(240px,280px)_1fr_minmax(240px,280px)] gap-4 min-h-0">
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
                  <HeroPortrait
                    prefab={prefab}
                    className="w-7 h-7 rounded object-cover shrink-0"
                    size={28}
                  />
                  <span className="text-xs font-medium">{prefab.name}</span>
                  {heroId === prefab.id && <Check size={12} className="ml-auto text-[hsl(43,85%,55%)]" />}
                </div>
              </button>
            ))}
          </div>

          {/* Class skills */}
          <div className="border-t border-[hsl(43,60%,30%)]/20 pt-3">
            <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] mb-2 flex items-center gap-1">
              <Shield size={12} /> Class skills · {heroPrefab.classId}
            </div>
            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
              {classSkills.map((sk) => (
                <div
                  key={sk.id}
                  className="rounded border border-[hsl(43,60%,30%)]/20 px-2 py-1.5 bg-[hsl(225,25%,9%)]"
                >
                  <div className="text-[11px] font-medium flex items-center gap-1">
                    <span>{sk.icon}</span> {sk.name}
                    <Badge className="ml-auto text-[8px] px-1">T{sk.tier}</Badge>
                  </div>
                  <p className="text-[9px] text-[hsl(45,15%,55%)] leading-snug mt-0.5">{sk.description}</p>
                </div>
              ))}
            </div>
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
            key={`${unarmedPrefab.id}-${primaryWeapon}-${secondaryWeapon}-${wingsId}-${capeId}`}
            prefab={unarmedPrefab}
            unarmed
            weaponManifestKeys={weaponManifestKeys}
            wingsId={wingsId}
            capeId={capeId}
            applyMaterialLabels
            onMeshLabels={setMeshLabels}
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

          {/* Mesh material labels inspector */}
          <div className="rounded-lg border border-[hsl(43,60%,30%)]/25 bg-[hsl(225,25%,8%)] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] mb-2 flex items-center gap-1">
              <Layers size={12} /> Mesh labels · Three.js materials
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2 text-[9px]">
              <Badge variant="outline" className="text-[8px]">meshes {meshSummary.total}</Badge>
              <Badge variant="outline" className="text-[8px]">skin {meshSummary.skin}</Badge>
              <Badge variant="outline" className="text-[8px]">cloth {meshSummary.cloth}</Badge>
              <Badge variant="outline" className="text-[8px]">leather {meshSummary.leather}</Badge>
              <Badge variant="outline" className="text-[8px]">metal {meshSummary.metal}</Badge>
              <Badge variant="outline" className="text-[8px]">armor slots {meshSummary.armor}</Badge>
              <Badge variant="outline" className="text-[8px]">editable {meshSummary.editable}</Badge>
            </div>
            <div className="max-h-[140px] overflow-y-auto flex flex-col gap-0.5">
              {editableLabels.length === 0 && (
                <p className="text-[9px] text-[hsl(45,15%,50%)]">Load a hero to detect mesh materials…</p>
              )}
              {editableLabels.map((l) => (
                <div
                  key={l.name}
                  className="flex items-center gap-2 text-[9px] py-0.5 border-b border-[hsl(43,60%,30%)]/10"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: l.materialPreset.chip }}
                    title={l.materialPreset.label}
                  />
                  <span className="font-mono text-[hsl(45,20%,70%)] truncate max-w-[140px]" title={l.name}>
                    {l.name}
                  </span>
                  <span className="text-[hsl(43,70%,55%)] capitalize">{l.semantic}</span>
                  <span className="text-[hsl(45,15%,45%)] ml-auto">
                    m={l.materialPreset.metalness} r={l.materialPreset.roughness}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[8px] text-[hsl(45,15%,45%)] mt-2 leading-relaxed">
              Labels drive edit groups (skin / armor cloth·leather·metal). Atlas maps kept;
              metalness &amp; roughness tuned per semantic for MeshStandardMaterial.
            </p>
          </div>
        </main>

        {/* Weapons + cosmetics + weapon skills */}
        <aside className="flex flex-col gap-3 min-h-0 overflow-auto">
          <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] flex items-center gap-1">
            <Zap size={12} /> Pregame weapons
          </div>
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

          {/* Weapon skills from ObjectStore */}
          <div className="border-t border-[hsl(43,60%,30%)]/20 pt-3">
            <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] mb-2 flex items-center gap-1">
              <Sparkles size={12} /> Weapon skills · {primaryW?.label ?? "—"}
            </div>
            {skillsStatus === "loading" && (
              <p className="text-[9px] text-[hsl(45,15%,50%)]">Loading ObjectStore catalog…</p>
            )}
            {skillsStatus === "err" && (
              <p className="text-[9px] text-red-400/80">
                Could not load master-weaponSkills.json — check objectstore.grudge-studio.com
              </p>
            )}
            <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto">
              {weaponSkills.map((sk) => (
                <div
                  key={sk.id}
                  className="rounded border border-[hsl(43,60%,30%)]/20 px-2 py-1.5 flex gap-2 items-start bg-[hsl(225,25%,9%)]"
                >
                  {sk.iconUrl ? (
                    <img src={sk.iconUrl} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                  ) : (
                    <span className="text-sm">⚔️</span>
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] font-medium truncate">{sk.name}</div>
                    <div className="text-[8px] text-[hsl(45,15%,50%)]">
                      {sk.slotType}
                      {sk.cooldown != null ? ` · CD ${sk.cooldown}s` : ""}
                      {sk.damage != null ? ` · dmg ${sk.damage}` : ""}
                    </div>
                  </div>
                </div>
              ))}
              {skillsStatus === "ok" && weaponSkills.length === 0 && (
                <p className="text-[9px] text-[hsl(45,15%,50%)]">No skills mapped for this weapon type yet.</p>
              )}
            </div>
          </div>

          {/* Unity wings / capes */}
          <div className="border-t border-[hsl(43,60%,30%)]/20 pt-3">
            <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] mb-1">
              Wings (Unity packs)
            </div>
            <div className="grid grid-cols-2 gap-1 mb-2">
              {ROSTER_WINGS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCosmetic(c)}
                  className={`text-left p-1.5 rounded border text-[9px] ${
                    wingsId === c.id
                      ? "border-[hsl(43,85%,55%)]/50 bg-[hsl(43,85%,55%)]/10"
                      : "border-[hsl(43,60%,30%)]/20"
                  }`}
                >
                  <span className="mr-1">{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[hsl(45,15%,50%)] mb-1">
              Capes / cloaks
            </div>
            <div className="grid grid-cols-2 gap-1">
              {ROSTER_CAPES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCosmetic(c)}
                  className={`text-left p-1.5 rounded border text-[9px] ${
                    capeId === c.id
                      ? "border-[hsl(43,85%,55%)]/50 bg-[hsl(43,85%,55%)]/10"
                      : "border-[hsl(43,60%,30%)]/20"
                  }`}
                >
                  <span className="mr-1">{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-[8px] text-[hsl(45,15%,45%)] mt-1.5">
              GLB from CDN when baked; procedural fallback until convert lands on R2.
            </p>
          </div>

          <div className="flex gap-2 text-[10px] p-2 rounded bg-[hsl(225,25%,10%)] border border-[hsl(43,60%,30%)]/20 flex-wrap">
            <span>Loadout:</span>
            <span className="text-[hsl(43,85%,55%)]">{primaryW?.icon} {primaryW?.label ?? "—"}</span>
            {secondaryW && (
              <>
                <span>+</span>
                <span>{secondaryW.icon} {secondaryW.label}</span>
              </>
            )}
            {wingsId && <span className="text-fuchsia-300/80">· wings</span>}
            {capeId && <span className="text-violet-300/80">· cape</span>}
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
            <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto">
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
              {wingsId && <span className="text-fuchsia-300/90"> + wings</span>}
              {capeId && <span className="text-violet-300/90"> + cape</span>}
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
