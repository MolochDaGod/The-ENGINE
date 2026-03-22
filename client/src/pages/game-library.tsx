import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Gamepad2, Download, Star, Play, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Game, GamePlatform } from "@shared/schema";
import libraryBg from "@assets/HRuOcD2_1773841538318.png";

const PLATFORM_PAGES: Record<string, string> = {
  nes: "https://rec0ded88.com/play-nes-games/",
  snes: "https://rec0ded88.com/play-snes-games/",
  genesis: "https://rec0ded88.com/play-sega-genesis-games/",
  n64: "https://rec0ded88.com/play-nintendo-64-games/",
  neogeo: "https://rec0ded88.com/play-neo-geo-games/",
  playstation: "https://rec0ded88.com/play-playstation-games/",
  gameboy: "https://rec0ded88.com/play-nintendo-game-boy-games/",
  gba: "https://rec0ded88.com/play-nintendo-game-boy-advance-games/",
  nds: "https://rec0ded88.com/play-nintendo-ds-games/",
};

const GAMES_PER_PAGE = 20;

const PLATFORM_COLORS: Record<string, { bg: string; accent: string }> = {
  nes: { bg: 'linear-gradient(135deg, hsl(0,60%,20%), hsl(0,50%,12%))', accent: 'hsl(0,70%,55%)' },
  snes: { bg: 'linear-gradient(135deg, hsl(270,50%,22%), hsl(270,40%,12%))', accent: 'hsl(270,60%,60%)' },
  genesis: { bg: 'linear-gradient(135deg, hsl(220,60%,20%), hsl(220,50%,10%))', accent: 'hsl(220,70%,55%)' },
  n64: { bg: 'linear-gradient(135deg, hsl(120,45%,18%), hsl(120,40%,10%))', accent: 'hsl(120,55%,50%)' },
  neogeo: { bg: 'linear-gradient(135deg, hsl(45,60%,22%), hsl(45,50%,12%))', accent: 'hsl(45,70%,55%)' },
  playstation: { bg: 'linear-gradient(135deg, hsl(210,50%,22%), hsl(210,45%,12%))', accent: 'hsl(210,60%,55%)' },
  gameboy: { bg: 'linear-gradient(135deg, hsl(80,40%,22%), hsl(80,35%,12%))', accent: 'hsl(80,50%,55%)' },
  gba: { bg: 'linear-gradient(135deg, hsl(190,50%,20%), hsl(190,45%,10%))', accent: 'hsl(190,60%,50%)' },
  nds: { bg: 'linear-gradient(135deg, hsl(330,50%,22%), hsl(330,40%,12%))', accent: 'hsl(330,60%,55%)' },
};

export default function GameLibrary() {
  const [location, setLocation] = useLocation();
  const urlParams = new URLSearchParams(location.split("?")[1] || "");
  const initialPlatform = urlParams.get("platform");
  const initialQuery = urlParams.get("q") || "";
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(initialPlatform);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: platforms = [], isLoading: platformsLoading } = useQuery<GamePlatform[]>({
    queryKey: ["/api/platforms"],
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games", selectedPlatform, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPlatform) params.set("platform", selectedPlatform);
      if (searchQuery) params.set("q", searchQuery);
      const resp = await fetch(`/api/games?${params.toString()}`);
      return resp.json();
    },
  });



  const scrapeMutation = useMutation({
    mutationFn: async (platform: string) => {
      const platformUrl = PLATFORM_PAGES[platform];
      if (!platformUrl) throw new Error("No source URL for platform");
      return apiRequest("POST", "/api/scrape/games", { platformUrl, platform });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms"] });
    },
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

  const filteredGames = useMemo(() => {
    if (!letterFilter) return games;
    return games.filter((g) => {
      if (letterFilter === "#") return /^[^a-zA-Z]/.test(g.title);
      return g.title.toUpperCase().startsWith(letterFilter);
    });
  }, [games, letterFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredGames.length / GAMES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * GAMES_PER_PAGE;
  const paginatedGames = filteredGames.slice(startIdx, startIdx + GAMES_PER_PAGE);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlatformChange = (slug: string | null) => {
    setSelectedPlatform(slug);
    setLetterFilter(null);
    setCurrentPage(1);
  };

  const handleLetterChange = (letter: string | null) => {
    setLetterFilter(letter);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('ellipsis');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [safePage, totalPages]);

  const totalGames = platforms.reduce((sum, p) => sum + (p.gameCount || 0), 0);

  return (
    <div className="min-h-screen relative" style={{ background: 'hsl(225,30%,6%)' }}>
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url(${libraryBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[hsl(225,30%,6%)]/70 via-transparent to-[hsl(225,30%,6%)]/90 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 py-4 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-heading gold-text font-bold" style={{ WebkitTextFillColor: 'unset' }}>
            Game Library <span className="text-sm text-[hsl(45,15%,60%)] font-body ml-2">{totalGames} games</span>
          </h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(45,15%,60%)]" />
            <Input
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 bg-[hsl(225,25%,15%)] border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)] placeholder:text-[hsl(45,15%,60%)] focus:border-[hsl(43,85%,55%)]"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-6 flex gap-6 relative z-10">
        <aside className="w-56 shrink-0 hidden md:block">
          <h2 className="text-xs font-heading text-[hsl(43,85%,55%)] uppercase tracking-widest mb-3" style={{ WebkitTextFillColor: 'unset' }}>Platforms</h2>
          <div className="space-y-1">
            <button
              onClick={() => handlePlatformChange(null)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition flex items-center justify-between ${!selectedPlatform ? "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]" : "text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)]"}`}
            >
              <span className="font-body">All Platforms</span>
              <span className="text-xs opacity-60">{totalGames}</span>
            </button>
            {platforms.filter(p => p.slug !== 'custom').map((p) => (
              <div key={p.id} className="flex items-center gap-1">
                <button
                  onClick={() => handlePlatformChange(p.slug)}
                  className={`flex-1 text-left px-3 py-2 rounded text-sm transition flex items-center justify-between ${selectedPlatform === p.slug ? "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]" : "text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)]"}`}
                >
                  <span className="flex items-center gap-2 font-body">
                    <span>{p.iconEmoji}</span>
                    <span>{p.name}</span>
                  </span>
                  {(p.gameCount || 0) > 0 && (
                    <span className="text-xs opacity-60">{p.gameCount}</span>
                  )}
                </button>
                {PLATFORM_PAGES[p.slug] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)]"
                    onClick={() => scrapeMutation.mutate(p.slug)}
                    disabled={scrapeMutation.isPending}
                    title={`Scrape ${p.name} games`}
                  >
                    {scrapeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1 mb-4">
            <button onClick={() => handleLetterChange(null)} className={`px-2 py-1 text-xs rounded font-heading transition ${!letterFilter ? "bg-[hsl(43,85%,55%)] text-[hsl(225,30%,8%)]" : "bg-[hsl(225,25%,15%)] text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]/20"}`}>
              All
            </button>
            {alphabet.map((letter) => (
              <button key={letter} onClick={() => handleLetterChange(letter)} className={`px-2 py-1 text-xs rounded font-heading transition ${letterFilter === letter ? "bg-[hsl(43,85%,55%)] text-[hsl(225,30%,8%)]" : "bg-[hsl(225,25%,15%)] text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]/20"}`}>
                {letter}
              </button>
            ))}
          </div>

          {(gamesLoading || platformsLoading) && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
            </div>
          )}

          {!gamesLoading && filteredGames.length === 0 && (
            <div className="text-center py-20">
              <Gamepad2 className="w-16 h-16 text-[hsl(43,60%,30%)] mx-auto mb-4" />
              <h3 className="text-xl font-heading text-[hsl(43,85%,65%)] mb-2" style={{ WebkitTextFillColor: 'unset' }}>No games found</h3>
              <p className="text-[hsl(45,15%,60%)] mb-4 font-body">
                {selectedPlatform ? `Scrape ${selectedPlatform.toUpperCase()} games to populate the library` : "Select a platform and scrape games to get started"}
              </p>
            </div>
          )}

          {!gamesLoading && filteredGames.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[hsl(45,15%,60%)] font-body">
                Showing {startIdx + 1}–{Math.min(startIdx + GAMES_PER_PAGE, filteredGames.length)} of {filteredGames.length} games
              </p>
              {totalPages > 1 && (
                <p className="text-sm text-[hsl(45,15%,60%)] font-body">
                  Page {safePage} of {totalPages}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {paginatedGames.map((game) => {
              const colors = PLATFORM_COLORS[game.platform || ''] || { bg: 'linear-gradient(135deg, hsl(225,25%,15%), hsl(225,30%,10%))', accent: 'hsl(43,85%,55%)' };
              const initial = (game.title[0] || '?').toUpperCase();
              return (
                <div key={game.id} className="fantasy-panel overflow-hidden hover:animate-gem-glow transition group relative card-hover cursor-pointer" onClick={() => setLocation(`/play/${game.id}`)}>
                  <div className="aspect-video flex items-center justify-center relative overflow-hidden" style={{ background: colors.bg }}>
                    <span className="text-4xl font-heading font-bold opacity-20 select-none" style={{ color: colors.accent }}>{initial}</span>
                    <Gamepad2 className="absolute bottom-1 right-1 w-4 h-4 opacity-20" style={{ color: colors.accent }} />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/50">
                      <Play className="w-8 h-8 text-[hsl(43,85%,55%)]" />
                    </div>
                    {game.isFeatured && (
                      <Star className="absolute top-1 right-1 w-3 h-3 text-[hsl(43,85%,55%)] fill-[hsl(43,85%,55%)]" />
                    )}
                  </div>
                  <div className="p-2">
                    <h3 className="text-sm font-heading text-[hsl(45,30%,90%)] truncate" style={{ WebkitTextFillColor: 'unset' }}>{game.title}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <Badge variant="outline" className="text-[10px] border-[hsl(43,60%,30%)]/50 text-[hsl(43,85%,55%)]">{game.platform?.toUpperCase()}</Badge>
                      <span className="text-[10px] text-[hsl(43,85%,55%)] flex items-center gap-1 font-heading">
                        Play <Play className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-1 mt-8 mb-4" aria-label="Pagination">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToPage(1)}
                disabled={safePage === 1}
                className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] disabled:opacity-30"
                aria-label="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
                className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {pageNumbers.map((p, idx) =>
                p === 'ellipsis' ? (
                  <span key={`e${idx}`} className="px-2 text-[hsl(45,15%,60%)]">...</span>
                ) : (
                  <Button
                    key={p}
                    variant="ghost"
                    size="sm"
                    onClick={() => goToPage(p)}
                    className={`min-w-[36px] ${safePage === p
                      ? "bg-[hsl(43,85%,55%)] text-[hsl(225,30%,8%)] hover:bg-[hsl(43,85%,60%)] font-bold"
                      : "text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] hover:bg-[hsl(225,25%,15%)]"
                    }`}
                    aria-label={`Page ${p}`}
                    aria-current={safePage === p ? "page" : undefined}
                  >
                    {p}
                  </Button>
                )
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === totalPages}
                className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToPage(totalPages)}
                disabled={safePage === totalPages}
                className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] disabled:opacity-30"
                aria-label="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </nav>
          )}
        </main>
      </div>
    </div>
  );
}
