import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, Flame, Loader2, Swords, Trophy, Users } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { pvpProducts, type PortalProduct } from "@/data/portalProducts";
import type { Game } from "@shared/schema";

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
};

function ArenaCard({ product }: { product: PortalProduct }) {
  const content = (
    <div className="fantasy-panel p-5 h-full hover:rune-glow transition flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="font-heading text-lg text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>
            {product.name}
          </h3>
          <Badge className="border text-[10px] uppercase tracking-wide bg-[hsl(43,85%,55%)]/10 text-[hsl(43,85%,55%)] border-[hsl(43,85%,55%)]/30">
            {product.status}
          </Badge>
        </div>
        <p className="text-sm text-[hsl(45,15%,60%)] font-body">{product.description}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {(product.tags || []).map((tag) => (
            <Badge key={tag} variant="outline" className={`text-[10px] uppercase ${tagClasses[tag] || ""}`}>
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <div className="mt-4 text-sm text-[hsl(43,85%,55%)] font-medium flex items-center">
        Enter arena <ArrowUpRight className="w-4 h-4 ml-1" />
      </div>
    </div>
  );
  if (product.external) {
    return <a href={product.href} target="_blank" rel="noopener noreferrer" className="block h-full">{content}</a>;
  }
  return <Link href={product.href} className="block h-full">{content}</Link>;
}

export default function PvpPage() {
  const { player, loading } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const [opponentUsername, setOpponentUsername] = useState("");
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);
  const [wager, setWager] = useState("0");

  useEffect(() => {
    if (!loading && !player) {
      setLocation("/login?redirect=/pvp");
    }
  }, [loading, player, setLocation]);

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
  });

  const sortedGames = useMemo(() => {
    const list = gamesQuery.data || [];
    return [...list].sort((a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured) || a.title.localeCompare(b.title));
  }, [gamesQuery.data]);

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

  if (loading || !player) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
      </div>
    );
  }

  const handleCreate = async () => {
    setError("");
    if (!opponentUsername.trim()) return setError("Enter an opponent username.");
    if (!gameId) return setError("Pick a game.");
    try {
      const res = await fetch(`/api/auth/lookup?username=${encodeURIComponent(opponentUsername.trim())}`, { credentials: "include" });
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

  return (
    <div className="min-h-screen bg-[hsl(225,30%,6%)] text-[hsl(45,30%,90%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Badge className="mb-3 bg-[hsl(0,60%,55%)]/10 text-[hsl(0,70%,70%)] border border-[hsl(0,60%,55%)]/30">
              PvP · PvPvE · Co-op
            </Badge>
            <h1 className="text-3xl md:text-4xl font-heading gold-text" style={{ WebkitTextFillColor: "unset" }}>
              The Arena
            </h1>
            <p className="text-[hsl(45,15%,60%)] font-body mt-2 max-w-3xl">
              Challenge players to score duels, accept open challenges, or drop into a live arena from any Grudge product.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/leaderboards">
              <Button className="gilded-button">
                <Trophy className="w-4 h-4 mr-2" /> Leaderboards
              </Button>
            </Link>
            <Link href="/account">
              <Button variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(45,30%,90%)]">
                <Users className="w-4 h-4 mr-2" /> My Stats
              </Button>
            </Link>
          </div>
        </header>

        {/* Challenges + Create */}
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

          <div className="fantasy-panel p-5">
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
                <label className="text-xs text-[hsl(45,15%,60%)] font-body">Game</label>
                <select
                  value={gameId ?? ""}
                  onChange={(e) => setGameId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)] rounded px-3 py-2 text-sm"
                >
                  <option value="">Select a game…</option>
                  {sortedGames.slice(0, 200).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title} · {g.platform?.toUpperCase()}
                    </option>
                  ))}
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

        {/* Arenas */}
        <section>
          <div className="mb-4">
            <h2 className="font-heading text-xl text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>Live Arenas</h2>
            <p className="text-sm text-[hsl(45,15%,60%)] font-body">Jump into full PvP/PvPvE/Co-op surfaces across the Grudge ecosystem.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pvpProducts.map((product) => (
              <ArenaCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
