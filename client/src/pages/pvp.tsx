import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, Flame, Loader2, LogIn, Swords, Trophy, Users } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useAuthModal } from "@/components/auth-modal";
import { useLaunchNav } from "@/hooks/useLaunchNav";
import { pvpProducts, type PortalProduct, type PortalProductStatus } from "@/data/portalProducts";
import {
  ARENA_READINESS,
  cardBackgroundStyle,
  filterArenaProducts,
  getArenaCardImage,
  getArenaHeroBackground,
  groupArenasByStatus,
  type ArenaFilter,
} from "@/data/arenaArt";
import type { Game } from "@shared/schema";
import { RetroCompetitiveGrid } from "@/components/retro-competitive-panel";
import {
  RETRO_COMPETITIVE_TOP10,
  type CompetitiveMode,
} from "@/data/retroCompetitive";

interface ChallengeRow {
  id: number;
  challengerId: number;
  opponentId: number;
  gameId: number;
  gbuxWager: string;
  status: string;
  challengerScore: number | null;
  opponentScore: number | null;
  winnerId: number | null;
  createdAt: string;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const tagClasses: Record<string, string> = {
  pvp: "bg-[hsl(0,60%,55%)]/15 text-[hsl(0,70%,70%)] border-[hsl(0,60%,55%)]/30",
  pvpve: "bg-[hsl(280,70%,60%)]/15 text-[hsl(280,70%,70%)] border-[hsl(280,70%,60%)]/30",
  coop: "bg-[hsl(120,60%,50%)]/15 text-[hsl(120,60%,60%)] border-[hsl(120,60%,50%)]/30",
  arena: "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border-[hsl(43,85%,55%)]/30",
  rts: "bg-[hsl(220,70%,60%)]/15 text-[hsl(220,70%,70%)] border-[hsl(220,70%,60%)]/30",
  mmo: "bg-[hsl(165,60%,55%)]/15 text-[hsl(165,70%,65%)] border-[hsl(165,60%,55%)]/30",
  solo: "bg-[hsl(200,40%,50%)]/15 text-[hsl(200,50%,70%)] border-[hsl(200,40%,50%)]/30",
};

const statusClasses: Record<PortalProductStatus, string> = {
  live: "bg-[hsl(120,60%,50%)]/15 text-[hsl(120,60%,60%)] border-[hsl(120,60%,50%)]/30",
  planned: "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border-[hsl(43,85%,55%)]/30",
  beta: "bg-[hsl(280,70%,60%)]/15 text-[hsl(280,70%,70%)] border-[hsl(280,70%,60%)]/30",
  admin: "bg-[hsl(0,60%,55%)]/15 text-[hsl(0,70%,70%)] border-[hsl(0,60%,55%)]/30",
};

const FILTER_CHIPS: { id: ArenaFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pvp", label: "PvP" },
  { id: "pvpve", label: "PvPvE" },
  { id: "coop", label: "Co-op" },
  { id: "arena", label: "Arena" },
  { id: "rts", label: "RTS" },
  { id: "live", label: "Live" },
  { id: "beta", label: "Beta" },
];

const STATUS_SECTION_LABEL: Record<PortalProductStatus, string> = {
  live: "Live Arenas",
  beta: "Beta Arenas",
  planned: "Planned Arenas",
  admin: "Admin",
};

function ArenaCard({ product }: { product: PortalProduct }) {
  const { navigateExternal } = useLaunchNav();
  const imageUrl = getArenaCardImage(product);
  const readiness = ARENA_READINESS[product.id];

  const content = (
    <div
      className="fantasy-panel p-5 h-full min-h-[220px] hover:rune-glow transition-all flex flex-col justify-between relative overflow-hidden group"
      style={cardBackgroundStyle(imageUrl)}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={cardBackgroundStyle(imageUrl, true)}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="font-heading text-lg text-[hsl(45,30%,92%)] drop-shadow-md" style={{ WebkitTextFillColor: "unset" }}>
            {product.name}
          </h3>
          <Badge className={`border text-[10px] uppercase tracking-wide shrink-0 ${statusClasses[product.status]}`}>
            {product.status}
          </Badge>
        </div>
        <p className="text-sm text-[hsl(45,15%,75%)] font-body line-clamp-3 drop-shadow-sm">{product.description}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {(product.tags || []).map((tag) => (
            <Badge key={tag} variant="outline" className={`text-[10px] uppercase ${tagClasses[tag] || ""}`}>
              {tag}
            </Badge>
          ))}
          {product.authRequired && (
            <Badge variant="outline" className="border-[hsl(43,60%,30%)]/40 text-[hsl(43,85%,55%)] text-[10px]">
              Grudge ID
            </Badge>
          )}
        </div>
        {readiness?.note && (
          <p className="text-[11px] text-[hsl(45,15%,65%)] font-body mt-2 italic">{readiness.note}</p>
        )}
      </div>
      <div className="relative z-10 mt-4 text-sm text-[hsl(43,85%,55%)] font-medium flex items-center">
        Enter arena <ArrowUpRight className="w-4 h-4 ml-1" />
      </div>
    </div>
  );

  if (product.external) {
    if (product.authRequired) {
      return (
        <div
          role="link"
          tabIndex={0}
          className="block h-full cursor-pointer"
          onClick={() => navigateExternal(product.href, true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigateExternal(product.href, true);
          }}
        >
          {content}
        </div>
      );
    }
    return (
      <a href={product.href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {content}
      </a>
    );
  }

  return (
    <Link href={product.href} className="block h-full">
      {content}
    </Link>
  );
}

export default function PvpPage() {
  const { player, loading } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ArenaFilter>("all");
  const [retroMode, setRetroMode] = useState<CompetitiveMode | "all">("all");
  const { open: openAuthModal } = useAuthModal();

  const [opponentUsername, setOpponentUsername] = useState("");
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);
  const [wager, setWager] = useState("0");

  // Deep-link: /pvp?game=146 preselects competitive challenge game
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const g = q.get("game");
      if (g && Number.isFinite(Number(g))) setGameId(Number(g));
    } catch {
      /* ignore */
    }
  }, []);

  const activeQuery = useQuery<ChallengeRow[]>({
    queryKey: ["/api/challenges/active"],
    queryFn: () => fetchJSON<ChallengeRow[]>("/api/challenges/active"),
    enabled: !!player,
  });

  const pendingQuery = useQuery<ChallengeRow[]>({
    queryKey: ["/api/challenges/pending"],
    queryFn: () => fetchJSON<ChallengeRow[]>("/api/challenges/pending"),
    enabled: !!player,
  });

  const gamesQuery = useQuery<Game[]>({
    queryKey: ["/api/games"],
    queryFn: () => fetchJSON<Game[]>("/api/games"),
    enabled: !!player,
  });

  const sortedGames = useMemo(() => {
    const list = gamesQuery.data || [];
    const competitiveIds = new Set(RETRO_COMPETITIVE_TOP10.map((g) => g.gameId));
    return [...list].sort((a, b) => {
      const ac = competitiveIds.has(a.id) ? 1 : 0;
      const bc = competitiveIds.has(b.id) ? 1 : 0;
      if (bc !== ac) return bc - ac;
      return Number(!!b.isFeatured) - Number(!!a.isFeatured) || a.title.localeCompare(b.title);
    });
  }, [gamesQuery.data]);

  const competitiveOptions = useMemo(() => {
    const byId = new Map((gamesQuery.data || []).map((g) => [g.id, g]));
    return RETRO_COMPETITIVE_TOP10.map((meta) => {
      const live = byId.get(meta.gameId);
      return {
        id: meta.gameId,
        title: live?.title || meta.title,
        platform: live?.platform || meta.platform,
        modes: meta.modes,
      };
    });
  }, [gamesQuery.data]);

  const filteredArenas = useMemo(() => filterArenaProducts(pvpProducts, filter), [filter]);
  const groupedArenas = useMemo(() => groupArenasByStatus(filteredArenas), [filteredArenas]);

  const create = useMutation({
    mutationFn: () => postJSON<ChallengeRow>("/api/challenges", { opponentId, gameId, gbuxWager: wager }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/challenges/active"] });
      qc.invalidateQueries({ queryKey: ["/api/challenges/pending"] });
      setOpponentUsername("");
      setOpponentId(null);
      setWager("0");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const accept = useMutation({
    mutationFn: (id: number) => postJSON(`/api/challenges/${id}/accept`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/challenges/active"] });
      qc.invalidateQueries({ queryKey: ["/api/challenges/pending"] });
    },
  });

  const decline = useMutation({
    mutationFn: (id: number) => postJSON(`/api/challenges/${id}/decline`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/challenges/active"] });
      qc.invalidateQueries({ queryKey: ["/api/challenges/pending"] });
    },
  });

  const handleCreate = async () => {
    setError("");
    if (!opponentUsername.trim()) return setError("Enter an opponent username.");
    if (!gameId) return setError("Pick a game.");
    try {
      const res = await fetch(`/api/auth/lookup?username=${encodeURIComponent(opponentUsername.trim())}`, {
        credentials: "include",
      });
      let resolvedId: number | null = null;
      if (res.ok) {
        const data = await res.json();
        resolvedId = data.id ?? null;
      }
      if (!resolvedId && opponentId) resolvedId = opponentId;
      if (!resolvedId) return setError("Opponent lookup unavailable. Use their numeric user ID instead.");
      setOpponentId(resolvedId);
      create.mutate();
    } catch {
      setError("Failed to resolve opponent. Try their numeric user ID.");
    }
  };

  const heroBg = getArenaHeroBackground();

  return (
    <div className="min-h-screen bg-[hsl(225,30%,6%)] text-[hsl(45,30%,90%)]">
      {/* Hero banner */}
      <div
        className="relative border-b border-[hsl(43,60%,30%)]/30"
        style={{
          backgroundImage: `linear-gradient(to bottom, hsla(225,30%,6%,0.25), hsla(225,30%,6%,0.95)), url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <Badge className="mb-3 bg-[hsl(0,60%,55%)]/10 text-[hsl(0,70%,70%)] border border-[hsl(0,60%,55%)]/30">
            PvP · PvPvE · Co-op
          </Badge>
          <h1 className="text-3xl md:text-5xl font-heading gold-text" style={{ WebkitTextFillColor: "unset" }}>
            The Arena
          </h1>
          <p className="text-[hsl(45,15%,70%)] font-body mt-3 max-w-3xl text-base md:text-lg">
            Jump into full PvP, PvPvE, and co-op surfaces across the Grudge ecosystem — or challenge players to GBUX duels when signed in.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-6">
            <Link href="/leaderboards">
              <Button className="gilded-button">
                <Trophy className="w-4 h-4 mr-2" /> Leaderboards
              </Button>
            </Link>
            {player ? (
              <Link href="/account">
                <Button variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(45,30%,90%)]">
                  <Users className="w-4 h-4 mr-2" /> My Stats
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                className="border-[hsl(43,60%,30%)] text-[hsl(45,30%,90%)]"
                onClick={() => openAuthModal({ redirectTo: "/pvp", initialTab: "signin", reason: "Sign in to challenge players and wager GBUX." })}
              >
                <LogIn className="w-4 h-4 mr-2" /> Sign in to challenge
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Rec0deD competitive Top 10 — retro PvP / PvE ready */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <Badge className="mb-2 bg-[hsl(43,85%,55%)]/10 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]/40">
                Rec0deD:88 · Competitive
              </Badge>
              <h2
                className="font-heading text-2xl text-[hsl(45,30%,92%)]"
                style={{ WebkitTextFillColor: "unset" }}
              >
                Top 10 retro for PvP &amp; PvE
              </h2>
              <p className="text-sm text-[hsl(45,15%,65%)] font-body mt-1 max-w-2xl">
                Curated from the 1,360+ library. Play in-browser, submit scores for global boards, or
                challenge a friend with GBUX when signed in. This is portal retro — not Open / grudge6.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["pvp", "PvP"],
                  ["pve", "PvE"],
                  ["coop", "Co-op"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRetroMode(id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-heading border transition ${
                    retroMode === id
                      ? "bg-[hsl(43,85%,55%)]/20 border-[hsl(43,85%,55%)] text-[hsl(43,85%,55%)]"
                      : "border-[hsl(43,60%,30%)]/40 text-[hsl(45,15%,70%)] hover:border-[hsl(43,85%,55%)]/50"
                  }`}
                >
                  {label}
                </button>
              ))}
              <Link href="/leaderboards?tab=competitive">
                <Button size="sm" variant="outline" className="border-[hsl(43,60%,30%)] h-8">
                  <Trophy className="w-3 h-3 mr-1" /> Leaderboards
                </Button>
              </Link>
            </div>
          </div>
          <RetroCompetitiveGrid
            mode={retroMode}
            onPickForChallenge={
              player
                ? (id) => {
                    setGameId(id);
                    setError("");
                    try {
                      document.getElementById("pvp-challenge-form")?.scrollIntoView({ behavior: "smooth" });
                    } catch {
                      /* ignore */
                    }
                  }
                : undefined
            }
          />
        </section>

        {/* Challenges — guests see CTA, signed-in users get full UI */}
        {player ? (
          <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
            <div className="space-y-6">
              <div className="fantasy-panel p-5">
                <h2 className="font-heading text-lg mb-4" style={{ WebkitTextFillColor: "unset" }}>
                  <Flame className="inline w-5 h-5 text-[hsl(43,85%,55%)] mr-2" />
                  Open Challenges
                </h2>
                {pendingQuery.isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
                ) : !pendingQuery.data?.length ? (
                  <p className="text-sm text-[hsl(45,15%,60%)] font-body">No pending challenges for you right now.</p>
                ) : (
                  <ul className="space-y-2">
                    {pendingQuery.data.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 p-3 rounded border border-[hsl(43,60%,30%)]/20">
                        <Swords className="w-4 h-4 text-[hsl(43,85%,55%)]" />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">Challenge #{c.id} · Game {c.gameId}</div>
                          <div className="text-xs text-[hsl(45,15%,60%)] font-body">
                            Wager: {Number(c.gbuxWager).toFixed(2)} GBUX · from user #{c.challengerId}
                          </div>
                        </div>
                        <Button size="sm" className="gilded-button" onClick={() => accept.mutate(c.id)} disabled={accept.isPending}>
                          Accept
                        </Button>
                        <Button size="sm" variant="outline" className="border-[hsl(43,60%,30%)]" onClick={() => decline.mutate(c.id)} disabled={decline.isPending}>
                          Decline
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="fantasy-panel p-5">
                <h2 className="font-heading text-lg mb-4" style={{ WebkitTextFillColor: "unset" }}>
                  Active Challenges
                </h2>
                {activeQuery.isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
                ) : !activeQuery.data?.length ? (
                  <p className="text-sm text-[hsl(45,15%,60%)] font-body">No active challenges. Send one from the right.</p>
                ) : (
                  <ul className="space-y-2">
                    {activeQuery.data.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 p-3 rounded border border-[hsl(43,60%,30%)]/20">
                        <div className="flex-1 text-sm">
                          <div className="font-medium">Challenge #{c.id}</div>
                          <div className="text-xs text-[hsl(45,15%,60%)] font-body">
                            Wager: {Number(c.gbuxWager).toFixed(2)} GBUX · status: {c.status}
                          </div>
                        </div>
                        <Link href={`/play/${c.gameId}`}>
                          <Button size="sm" className="gilded-button">Open game</Button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div id="pvp-challenge-form" className="fantasy-panel p-5">
              <h2 className="font-heading text-lg mb-4" style={{ WebkitTextFillColor: "unset" }}>
                Send a Challenge
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[hsl(45,15%,60%)] font-body">Opponent username or user ID</label>
                  <Input
                    value={opponentUsername}
                    onChange={(e) => {
                      setOpponentUsername(e.target.value);
                      const maybeId = Number(e.target.value);
                      setOpponentId(Number.isFinite(maybeId) && maybeId > 0 ? maybeId : null);
                    }}
                    placeholder="e.g. Racalvin or 42"
                    className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[hsl(45,15%,60%)] font-body">Game (Competitive Top 10 first)</label>
                  <select
                    value={gameId ?? ""}
                    onChange={(e) => setGameId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full border border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)] rounded px-3 py-2 text-sm"
                  >
                    <option value="">Select a game…</option>
                    <optgroup label="Rec0deD Competitive Top 10">
                      {competitiveOptions.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title} · {g.platform.toUpperCase()} · {g.modes.join("/")}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Full library">
                      {sortedGames.slice(0, 200).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title} · {g.platform?.toUpperCase()}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[hsl(45,15%,60%)] font-body">GBUX wager (0 for friendly)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={wager}
                    onChange={(e) => setWager(e.target.value)}
                    className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
                  />
                  <div className="text-xs text-[hsl(45,15%,60%)] font-body mt-1">
                    Your balance: {Number(player.gbuxBalance || 0).toFixed(2)} GBUX
                  </div>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button className="w-full gilded-button" onClick={handleCreate} disabled={create.isPending}>
                  {create.isPending ? "Sending..." : "Send Challenge"}
                </Button>
                <p className="text-xs text-[hsl(45,15%,60%)] font-body">
                  Challenges use the existing score system. Play the selected game, submit a score, and the winner takes the combined wager.
                </p>
              </div>
            </div>
          </section>
        ) : !loading ? (
          <div className="fantasy-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-lg" style={{ WebkitTextFillColor: "unset" }}>GBUX Challenges</h2>
              <p className="text-sm text-[hsl(45,15%,60%)] font-body mt-1">
                Browse every arena below without signing in. Sign in with Grudge ID to send challenges and wager GBUX.
              </p>
            </div>
            <Button
              className="gilded-button shrink-0"
              onClick={() => openAuthModal({ redirectTo: "/pvp", initialTab: "signin", reason: "Sign in to challenge players and wager GBUX." })}
            >
              <LogIn className="w-4 h-4 mr-2" /> Sign in
            </Button>
          </div>
        ) : null}

        {/* Arena filters */}
        <section>
          <div className="sticky top-16 z-20 -mx-4 px-4 py-3 bg-[hsl(225,30%,6%)]/95 backdrop-blur border-y border-[hsl(43,60%,30%)]/20 mb-6">
            <div className="flex flex-wrap gap-2">
              {FILTER_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wide border transition ${
                    filter === chip.id
                      ? "bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)] border-[hsl(43,85%,55%)]/40"
                      : "bg-[hsl(225,25%,12%)] text-[hsl(45,15%,60%)] border-[hsl(43,60%,30%)]/30 hover:border-[hsl(43,85%,55%)]/30"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-[hsl(45,15%,50%)] font-body self-center">
                {filteredArenas.length} arena{filteredArenas.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {(["live", "beta", "planned"] as const).map((status) => {
            const items = groupedArenas[status];
            if (!items.length) return null;
            return (
              <div key={status} className="mb-10">
                <div className="mb-4">
                  <h2 className="font-heading text-xl text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
                    {STATUS_SECTION_LABEL[status]}
                  </h2>
                  <p className="text-sm text-[hsl(45,15%,60%)] font-body">
                    {status === "live" && "Production-ready PvP, PvE, and co-op surfaces."}
                    {status === "beta" && "Playable betas — projectiles, VFX, and assets actively tuned."}
                    {status === "planned" && "Coming soon — card art and routes reserved."}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((product) => (
                    <ArenaCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            );
          })}

          {!filteredArenas.length && (
            <p className="text-sm text-[hsl(45,15%,60%)] font-body text-center py-12">No arenas match this filter.</p>
          )}
        </section>
      </div>
    </div>
  );
}