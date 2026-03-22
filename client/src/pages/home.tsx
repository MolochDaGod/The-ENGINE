import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Gamepad2,
  TrendingUp,
  Star,
  Play,
  ChevronRight,
  Zap,
  Trophy,
  Flame,
  Swords,
  Castle,
  Target,
} from "lucide-react";
import type { Game, GamePlatform, Article } from "@shared/schema";

import grudgeLogo from "@assets/uXpJmRe_1773828784729.png";
import homeBg from "@assets/2kljxaj_1773841543581.png";
import coverCastlevania from "@assets/game_covers/castlevania.png";
import coverChronoTrigger from "@assets/game_covers/chrono_trigger.png";
import coverContra from "@assets/game_covers/contra.png";
import coverDonkeyKong from "@assets/game_covers/donkey_kong_country.png";
import coverDoubleDragon from "@assets/game_covers/double_dragon.png";
import coverFinalFantasy from "@assets/game_covers/final_fantasy_3.png";
import coverMegaMan from "@assets/game_covers/mega_man_2.png";
import coverMetroid from "@assets/game_covers/metroid.png";
import coverSuperMarioBros from "@assets/game_covers/super_mario_bros.png";
import coverSmashBros from "@assets/game_covers/super_smash_bros.png";
import coverCallOfDuty4 from "@assets/game_covers/call_of_duty_4.png";
import coverZelda from "@assets/game_covers/legend_of_zelda.png";
import platformNes from "@assets/platforms/nes.png";
import platformSnes from "@assets/platforms/snes.png";
import platformGenesis from "@assets/platforms/genesis.png";
import platformN64 from "@assets/platforms/n64.png";
import platformNeogeo from "@assets/platforms/neogeo.png";
import platformPlaystation from "@assets/platforms/playstation.png";
import platformGameboy from "@assets/platforms/gameboy.png";
import platformGba from "@assets/platforms/gba.png";
import platformNds from "@assets/platforms/nds.png";

const PLATFORM_IMAGES: Record<string, string> = {
  nes: platformNes,
  snes: platformSnes,
  genesis: platformGenesis,
  n64: platformN64,
  neogeo: platformNeogeo,
  playstation: platformPlaystation,
  gameboy: platformGameboy,
  gba: platformGba,
  nds: platformNds,
};

const GAME_COVERS: Record<number, string> = {
  44: coverCastlevania,
  233: coverChronoTrigger,
  49: coverContra,
  244: coverDonkeyKong,
  57: coverDoubleDragon,
  255: coverFinalFantasy,
  88: coverMegaMan,
  95: coverMetroid,
  128: coverSuperMarioBros,
  585: coverSmashBros,
  1273: coverCallOfDuty4,
  82: coverZelda,
};

const PLATFORM_COLORS: Record<string, string> = {
  nes: "from-[hsl(0,65%,35%)] to-[hsl(0,65%,25%)]",
  snes: "from-[hsl(280,50%,35%)] to-[hsl(280,50%,25%)]",
  genesis: "from-[hsl(220,60%,35%)] to-[hsl(220,60%,25%)]",
  n64: "from-[hsl(120,40%,30%)] to-[hsl(120,40%,20%)]",
  neogeo: "from-[hsl(43,85%,40%)] to-[hsl(43,85%,30%)]",
  playstation: "from-[hsl(240,40%,35%)] to-[hsl(240,40%,25%)]",
  gameboy: "from-[hsl(142,50%,30%)] to-[hsl(142,50%,20%)]",
  gba: "from-[hsl(190,50%,30%)] to-[hsl(190,50%,20%)]",
  nds: "from-[hsl(330,50%,35%)] to-[hsl(330,50%,25%)]",
};

import imgWargusLogo from "@assets/bossgrudge_1773869616600.png";
import imgMainPageBg from "@assets/mainpage_1773869627345.png";
import imgEngineIcon from "@assets/Screenshot_2026-02-12_195251_1773869920427.png";
import imgTowerDefIcon from "@assets/8ff85a92-729a-4308-93c4-f82aea7f5d1b_1773869962930.png";
import cardBgEngine from "@assets/Screenshot_2026-02-11_192414_1773869743148.png";
import cardBgTowerDef from "@assets/image_1773869734208.png";
import cardBgWargus from "@assets/Screenshot_2026-02-16_163218_1773869761391.png";
import sectionTavern from "@assets/YPyQLCN_1773842399246.png";
import sectionArena from "@assets/AYGbVNN_1773842402818.png";
import sectionMarketplace from "@assets/3KM8nDu_1773842408638.png";
import posterSylara from "@assets/7ZTde2Z_1773841603605.png";
import posterKael from "@assets/Emqj4q4_1773841606900.png";
import posterDurin from "@assets/a6ejwT2_1773841610687.png";
import posterRacalvin from "@assets/P1dQQZH_1773841613336.png";
import posterMalachar from "@assets/t56hW0q_1773841616078.png";

const wantedPosters = [
  { img: posterSylara, name: "Sylara Wildheart", subtitle: "The Forest Spirit", reward: "2,500 GBUX", objective: "Complete 5 Crystal Quest levels without losing a life" },
  { img: posterKael, name: "Kael Shadowblade", subtitle: "The Shadow Blade", reward: "5,000 GBUX", objective: "Win 3 Wargus RTS matches against AI on Hard difficulty" },
  { img: posterDurin, name: "Durin Tunnelwatcher", subtitle: "The Deep Scout", reward: "3,500 GBUX", objective: "Survive 10 waves in Decay Survival without using armor pickups" },
  { img: posterRacalvin, name: "Racalvin the Pirate King", subtitle: "Scourge of the Seas", reward: "10,000 GBUX", objective: "Finish Overdrive Racing in 1st place on every track" },
  { img: posterMalachar, name: "Lord Malachar", subtitle: "The Deathless Knight", reward: "15,000 GBUX", objective: "Defeat all bosses in Avernus 3D on Nightmare difficulty" },
];

const featuredContent = [
  {
    type: "featured",
    title: "Play Classic Retro Games Online",
    description: "Thousands of retro games from NES, SNES, Genesis, N64 and more — all playable in your browser. No downloads required.",
    badge: "Featured",
    link: "/games",
    gradient: "",
    icon: Gamepad2,
    bgImage: imgMainPageBg,
  },
  {
    type: "card",
    title: "Super Engine Studio",
    description: "Build and play games with our advanced game engine technology.",
    badge: "Engine",
    link: "/super-engine",
    gradient: "",
    icon: Zap,
    logoImg: imgEngineIcon,
    cardBg: cardBgEngine,
  },
  {
    type: "card",
    title: "Tower Defense Classic",
    description: "Strategic tower defense gameplay with 3D graphics.",
    badge: "Playable",
    link: "/tower-defense",
    gradient: "",
    icon: Castle,
    logoImg: imgTowerDefIcon,
    cardBg: cardBgTowerDef,
  },
  {
    type: "card",
    title: "Wargus RTS",
    description: "Real-time strategy warfare in your browser.",
    badge: "New",
    link: "/wargus",
    gradient: "",
    icon: Target,
    logoImg: imgWargusLogo,
    cardBg: cardBgWargus,
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [embeddedArticleUrl, setEmbeddedArticleUrl] = useState<string | null>(null);

  const { data: platforms = [] } = useQuery<GamePlatform[]>({
    queryKey: ["/api/platforms"],
  });

  const { data: featuredGames = [] } = useQuery<Game[]>({
    queryKey: ["/api/games/featured"],
    queryFn: async () => {
      const resp = await fetch("/api/games/featured");
      return resp.json();
    },
  });

  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
  });

  const totalGames = platforms.reduce((sum, p) => sum + (p.gameCount || 0), 0);

  const dynamicStats = [
    { label: "Games Available", value: totalGames > 0 ? totalGames.toLocaleString() : "1,000+", icon: Gamepad2 },
    { label: "Platforms", value: platforms.length > 0 ? `${platforms.length}` : "9", icon: Trophy },
    { label: "Game Engines", value: "11", icon: Zap },
    { label: "Articles", value: articles.length > 0 ? articles.length.toString() : "70+", icon: Flame },
  ];

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url(${homeBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[hsl(225,30%,6%)]/70 via-transparent to-[hsl(225,30%,6%)]/90 pointer-events-none" />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(225,35%,12%)] via-[hsl(225,30%,8%)] to-[hsl(225,30%,6%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, hsl(43,85%,55%) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 relative group cursor-pointer rounded-lg overflow-hidden fantasy-panel">
              <Link href={featuredContent[0].link}>
                <div className="relative h-[400px] flex flex-col justify-end p-8 overflow-hidden">
                  <div className="absolute inset-0 z-0" style={{ backgroundImage: `url(${imgMainPageBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(225,30%,5%)] via-[hsl(225,30%,5%)]/60 to-[hsl(225,30%,5%)]/20" />
                  <div className="absolute top-6 left-6 flex items-center gap-3">
                    <img src={grudgeLogo} alt="" className="w-16 h-16 rounded-full ring-2 ring-[hsl(43,85%,55%)]/30 opacity-80" />
                  </div>
                  <div className="relative z-10">
                    <Badge className="gilded-button w-fit mb-3 text-xs">{featuredContent[0].badge}</Badge>
                    <h2 className="text-3xl font-heading mb-2" style={{ WebkitTextFillColor: 'unset' }}>{featuredContent[0].title}</h2>
                    <p className="text-[hsl(45,15%,60%)] text-lg max-w-xl font-body">{featuredContent[0].description}</p>
                    <Button className="mt-4 gilded-button w-fit">
                      <Play className="w-4 h-4 mr-2" /> Start Playing
                    </Button>
                  </div>
                </div>
              </Link>
            </div>

            <div className="space-y-4">
              {featuredContent.slice(1).map((item, i) => (
                <Link key={i} href={item.link}>
                  <div className="group cursor-pointer fantasy-panel overflow-hidden hover:rune-glow transition-all mb-4">
                    <div className="relative p-4">
                      {item.cardBg && <div className="absolute inset-0 z-0" style={{ backgroundImage: `url(${item.cardBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
                      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(225,30%,6%)]/85 via-[hsl(225,30%,6%)]/70 to-[hsl(225,30%,6%)]/50" />
                      <div className="relative flex gap-4 items-start">
                        <div className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0 border border-[hsl(43,60%,30%)]/30 bg-[hsl(225,25%,12%)] overflow-hidden">
                          {item.logoImg ? (
                            <img src={item.logoImg} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <item.icon className="w-6 h-6 text-[hsl(43,85%,55%)]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Badge variant="outline" className="text-xs border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)] mb-1">{item.badge}</Badge>
                          <h3 className="font-heading text-sm text-[hsl(45,30%,90%)] truncate" style={{ WebkitTextFillColor: 'unset' }}>{item.title}</h3>
                          <p className="text-xs text-[hsl(45,15%,60%)] line-clamp-2 mt-1 font-body">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 border-y border-[hsl(43,60%,30%)]/20 relative overflow-hidden" style={{ background: 'hsl(225,30%,7%)' }}>
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: `url(${sectionTavern})`, backgroundSize: 'cover', backgroundPosition: 'center top' }} />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(225,30%,7%)]/80 via-[hsl(225,30%,7%)]/60 to-[hsl(225,30%,7%)]/80" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {dynamicStats.map((stat, i) => (
              <div key={i} className="text-center group">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg stone-panel mb-3 group-hover:animate-gem-glow transition-all">
                  <stat.icon className="w-6 h-6 text-[hsl(43,85%,55%)]" />
                </div>
                <div className="text-2xl font-heading gold-text font-bold">
                  {stat.value}
                </div>
                <div className="text-sm text-[hsl(45,15%,60%)] mt-1 font-body">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {featuredGames.length > 0 && (
        <section className="py-16 relative overflow-hidden" style={{ background: 'hsl(225,30%,6%)' }}>
          <div className="absolute inset-0 z-0 opacity-[0.10]" style={{ backgroundImage: `url(${sectionMarketplace})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-[hsl(225,30%,6%)]/70 via-transparent to-[hsl(225,30%,6%)]/80" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-heading flex items-center gap-2" style={{ WebkitTextFillColor: 'unset', color: 'hsl(43,85%,65%)' }}>
                  <Star className="w-6 h-6 text-[hsl(43,85%,55%)] fill-[hsl(43,85%,55%)]" />
                  Featured Classic Games
                </h2>
                <p className="text-[hsl(45,15%,60%)] mt-1 font-body">Playable right in your browser</p>
              </div>
              <Link href="/games">
                <Button variant="ghost" className="text-[hsl(43,85%,55%)] hover:text-[hsl(43,90%,70%)] hover:bg-[hsl(43,85%,55%)]/10">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {featuredGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => setLocation(`/play/${game.id}`)}
                  className="group text-left fantasy-panel overflow-hidden hover:animate-gem-glow transition-all card-hover"
                >
                  <div className="relative h-36 flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(225,25%,15%), hsl(225,30%,10%))' }}>
                    {GAME_COVERS[game.id] ? (
                      <img src={GAME_COVERS[game.id]} alt={game.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <Gamepad2 className="w-8 h-8 text-[hsl(43,60%,30%)] group-hover:text-[hsl(43,85%,55%)] transition" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40">
                      <Play className="w-10 h-10 text-[hsl(43,85%,55%)] drop-shadow-lg" />
                    </div>
                    <div className="absolute top-2 right-2 bg-[hsl(120,60%,50%)] w-2 h-2 rounded-full animate-pulse" title="Playable" />
                  </div>
                  <div className="p-3">
                    <h3 className="font-heading text-sm text-[hsl(45,30%,90%)] truncate" style={{ WebkitTextFillColor: 'unset' }}>{game.title}</h3>
                    <Badge variant="outline" className="text-[10px] border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)] mt-1">
                      {game.platform?.toUpperCase()}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 relative overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-heading mb-2" style={{ WebkitTextFillColor: 'unset', color: 'hsl(43,85%,65%)' }}>Browse by Platform</h2>
            <p className="text-[hsl(45,15%,60%)] font-body">Choose your favorite console and start playing</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {platforms.length > 0 ? platforms.filter(p => p.slug !== 'custom').map((platform) => (
              <Link key={platform.id} href={`/games?platform=${platform.slug}`}>
                <div className={`group cursor-pointer rounded-lg overflow-hidden border border-[hsl(43,60%,30%)]/20 hover:border-[hsl(43,85%,55%)]/50 transition-all card-hover relative`}>
                  <div className="relative h-40 overflow-hidden">
                    {PLATFORM_IMAGES[platform.slug] ? (
                      <img src={PLATFORM_IMAGES[platform.slug]} alt={platform.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${PLATFORM_COLORS[platform.slug] || "from-[hsl(220,15%,25%)] to-[hsl(220,15%,15%)]"}`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[hsl(225,30%,5%)] via-[hsl(225,30%,5%)]/40 to-transparent" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                    <h3 className="font-heading text-[hsl(45,30%,90%)] text-lg drop-shadow-lg" style={{ WebkitTextFillColor: 'unset' }}>{platform.name}</h3>
                    <p className="text-[hsl(43,85%,55%)] text-sm mt-1 font-heading drop-shadow-lg">
                      {(platform.gameCount || 0).toLocaleString()} games
                    </p>
                  </div>
                </div>
              </Link>
            )) : (
              [
                { name: "NES", slug: "nes" },
                { name: "SNES", slug: "snes" },
                { name: "Genesis", slug: "genesis" },
                { name: "N64", slug: "n64" },
                { name: "Neo Geo", slug: "neogeo" },
                { name: "PlayStation", slug: "playstation" },
                { name: "Game Boy", slug: "gameboy" },
                { name: "GBA", slug: "gba" },
                { name: "NDS", slug: "nds" },
              ].map((p) => (
                <Link key={p.slug} href={`/games?platform=${p.slug}`}>
                  <div className={`group cursor-pointer rounded-lg overflow-hidden border border-[hsl(43,60%,30%)]/20 hover:border-[hsl(43,85%,55%)]/50 transition-all card-hover relative`}>
                    <div className="relative h-40 overflow-hidden">
                      {PLATFORM_IMAGES[p.slug] ? (
                        <img src={PLATFORM_IMAGES[p.slug]} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${PLATFORM_COLORS[p.slug]}`} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(225,30%,5%)] via-[hsl(225,30%,5%)]/40 to-transparent" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                      <h3 className="font-heading text-[hsl(45,30%,90%)] text-lg drop-shadow-lg" style={{ WebkitTextFillColor: 'unset' }}>{p.name}</h3>
                      <p className="text-[hsl(43,85%,55%)]/80 text-xs mt-1 font-body drop-shadow-lg">Play Now</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="py-16 relative overflow-hidden" style={{ background: 'hsl(225,30%,6%)' }}>
        <div className="absolute inset-0 z-0 opacity-[0.15]" style={{ backgroundImage: `url(${sectionTavern})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[hsl(225,30%,6%)]/70 via-[hsl(225,30%,6%)]/40 to-[hsl(225,30%,6%)]/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-heading mb-2" style={{ WebkitTextFillColor: 'unset', color: 'hsl(43,85%,65%)' }}>
              <Swords className="w-6 h-6 inline-block mr-2 text-[hsl(43,85%,55%)]" />
              Bounty Board
            </h2>
            <p className="text-[hsl(45,15%,60%)] font-body">Complete objectives to claim GBUX rewards</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {wantedPosters.map((poster, i) => (
              <div key={i} className="relative group cursor-pointer">
                <div className="rounded-lg overflow-hidden border-2 border-[hsl(43,60%,30%)]/40 group-hover:border-[hsl(43,85%,55%)]/70 transition-all duration-300 shadow-lg group-hover:shadow-[0_0_20px_rgba(218,165,32,0.3)]">
                  <div className="relative aspect-[3/4]">
                    <img src={poster.img} alt={poster.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                      <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                        <div className="flex items-center gap-1 mb-1">
                          <Target className="w-3 h-3 text-red-400 flex-shrink-0" />
                          <span className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Objective</span>
                        </div>
                        <p className="text-xs text-white/90 leading-tight mb-2">{poster.objective}</p>
                        <div className="flex items-center gap-1.5 bg-[hsl(43,85%,55%)]/20 border border-[hsl(43,85%,55%)]/40 rounded px-2 py-1 w-fit">
                          <Trophy className="w-3 h-3 text-[hsl(43,85%,55%)]" />
                          <span className="text-xs font-bold text-[hsl(43,85%,55%)]">{poster.reward}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-center">
                  <h4 className="font-heading text-sm text-[hsl(43,85%,65%)] truncate" style={{ WebkitTextFillColor: 'unset' }}>{poster.name}</h4>
                  <p className="text-[10px] text-[hsl(45,15%,50%)]">{poster.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-[0.18]" style={{ backgroundImage: `url(${sectionArena})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[hsl(225,30%,6%)]/70 via-[hsl(225,30%,6%)]/40 to-[hsl(225,30%,6%)]/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <img src={grudgeLogo} alt="" className="w-16 h-16 rounded-full ring-2 ring-[hsl(43,85%,55%)]/30 mx-auto mb-4" />
            <h2 className="text-3xl font-heading mb-4" style={{ WebkitTextFillColor: 'unset', color: 'hsl(43,85%,65%)' }}>Super Engine Game Studio</h2>
            <p className="text-[hsl(45,15%,60%)] mb-6 font-body">
              Build, play, and share games with our powerful browser-based game engine.
              Featuring Tower Defense, Wargus RTS, Avernus 3D, and RPG Maker Studio.
            </p>
            <Link href="/super-engine">
              <Button size="lg" className="gilded-button text-base px-8">
                Launch Game Studio <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {articles.length > 0 && (
        <section className="py-16 relative overflow-hidden" style={{ background: 'hsl(225,30%,6%)' }}>
          <div className="absolute inset-0 z-0 opacity-[0.08]" style={{ backgroundImage: `url(${sectionMarketplace})`, backgroundSize: 'cover', backgroundPosition: 'top' }} />
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-[hsl(225,30%,6%)]/80 via-transparent to-[hsl(225,30%,6%)]/90" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-heading flex items-center gap-2" style={{ WebkitTextFillColor: 'unset', color: 'hsl(43,85%,65%)' }}>
                  <TrendingUp className="w-6 h-6 text-[hsl(120,60%,50%)]" />
                  Latest Articles
                </h2>
                <p className="text-[hsl(45,15%,60%)] mt-1 font-body">Gaming news and guides</p>
              </div>
              <Link href="/scraping">
                <Button variant="ghost" className="text-[hsl(43,85%,55%)] hover:text-[hsl(43,90%,70%)] hover:bg-[hsl(43,85%,55%)]/10">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>

            {embeddedArticleUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-[hsl(43,60%,30%)]/30">
                <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(225,30%,8%)] border-b border-[hsl(43,60%,30%)]/20">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEmbeddedArticleUrl(null)}
                    className="text-[hsl(43,85%,55%)] hover:text-[hsl(43,90%,70%)] hover:bg-[hsl(43,85%,55%)]/10"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Articles
                  </Button>
                  <span className="text-xs text-[hsl(45,15%,50%)] truncate flex-1">{embeddedArticleUrl}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEmbeddedArticleUrl(null)}
                    className="text-[hsl(45,15%,60%)] hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <iframe
                  src={embeddedArticleUrl}
                  className="w-full border-0 bg-white"
                  style={{ height: '500px' }}
                  title="Article"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {articles.slice(0, 6).map((article) => (
                  <div
                    key={article.id}
                    onClick={() => article.sourceUrl && setEmbeddedArticleUrl(article.sourceUrl)}
                    className="flex items-center gap-4 fantasy-panel p-4 hover:rune-glow transition-all cursor-pointer group"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-sm text-[hsl(45,30%,90%)] truncate group-hover:text-[hsl(43,85%,55%)] transition" style={{ WebkitTextFillColor: 'unset' }}>{article.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {article.category && (
                          <Badge variant="outline" className="text-xs border-[hsl(43,60%,30%)]/50 text-[hsl(45,15%,60%)]">{article.category}</Badge>
                        )}
                        {article.author && <span className="text-xs text-[hsl(45,15%,60%)] font-body">by {article.author}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[hsl(43,60%,30%)] group-hover:text-[hsl(43,85%,55%)] transition" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="border-t border-[hsl(43,60%,30%)]/20 py-12 relative overflow-hidden" style={{ background: 'hsl(225,30%,5%)' }}>
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle, hsl(43,85%,55%) 1px, transparent 1px)', backgroundSize: '35px 35px' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={grudgeLogo} alt="Grudge Studio" className="w-8 h-8 rounded-full ring-2 ring-[hsl(43,85%,55%)]/30" />
                <span className="font-heading gold-text text-lg font-bold">GRUDGE</span>
              </div>
              <p className="text-[hsl(45,15%,60%)] text-sm mb-4 font-body">
                The ultimate retro gaming portal. Play {totalGames > 0 ? totalGames.toLocaleString() : "thousands of"} classic games from NES, SNES, Genesis, N64, and more — all in your browser.
              </p>
              <div className="flex gap-3">
                <a href="https://twitter.com/grudgewarlords" target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center rounded stone-panel hover:animate-gem-glow transition-all">
                  <span className="text-[hsl(43,85%,55%)] text-sm font-bold">X</span>
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-heading text-[hsl(43,85%,55%)] mb-4 text-sm" style={{ WebkitTextFillColor: 'unset' }}>Quick Links</h4>
              <ul className="space-y-2">
                <li><Link href="/" className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Home</Link></li>
                <li><Link href="/games" className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Play Retro Games</Link></li>
                <li><Link href="/super-engine" className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Super Engine</Link></li>
                <li><Link href="/wargus" className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Wargus RTS</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-heading text-[hsl(43,85%,55%)] mb-4 text-sm" style={{ WebkitTextFillColor: 'unset' }}>Platforms</h4>
              <ul className="space-y-2">
                {(platforms.length > 0 ? platforms.filter(p => p.slug !== 'custom').slice(0, 5) : [
                  { id: 1, name: "NES", slug: "nes", iconEmoji: "🎮" },
                  { id: 2, name: "SNES", slug: "snes", iconEmoji: "🕹️" },
                  { id: 3, name: "Genesis", slug: "genesis", iconEmoji: "⚡" },
                  { id: 4, name: "N64", slug: "n64", iconEmoji: "🎯" },
                  { id: 5, name: "Neo Geo", slug: "neogeo", iconEmoji: "🔥" },
                ]).map((p) => (
                  <li key={p.id}>
                    <Link href={`/games?platform=${p.slug}`} className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">
                      {p.iconEmoji} {p.name}
                      {(p as any).gameCount > 0 && <span className="ml-1 text-[hsl(43,60%,30%)]">({(p as any).gameCount})</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-heading text-[hsl(43,85%,55%)] mb-4 text-sm" style={{ WebkitTextFillColor: 'unset' }}>Grudge Studio</h4>
              <ul className="space-y-2">
                <li><a href="https://grudgewarlords.com" target="_blank" rel="noopener noreferrer" className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Grudge Warlords</a></li>
                <li><a href="https://id.grudge-studio.com" target="_blank" rel="noopener noreferrer" className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Auth Gateway</a></li>
                <li><a href="#" className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Privacy Policy</a></li>
                <li><a href="#" className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-[hsl(43,60%,30%)]/20 text-center">
            <p className="text-xs text-[hsl(45,15%,60%)] font-body">
              &copy; 2025 Grudge Studio. Part of the Grudge Warlords universe. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
