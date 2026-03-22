import { useState, useEffect } from 'react';
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Menu, X, Home, Store, Settings, Zap,
  ChevronDown, Library, Swords, Crown, LogIn, Play, MessageSquare
} from "lucide-react";
import grudgeLogo from "@assets/uXpJmRe_1773828784729.png";

const navLinks = [
  { name: 'Game Library', href: '/games' },
  { name: 'Super Engine', href: '/super-engine' },
  { name: 'Store', href: '/store' },
  { name: 'Chat', href: '/chat' },
];

const quickLinks = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Game Library', href: '/games', icon: Library },
  { name: 'Super Engine', href: '/super-engine', icon: Zap },
  { name: 'Asset Store', href: '/asset-store', icon: Store },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
];

const platformLinks = [
  { name: 'NES Games', href: '/games?platform=nes', emoji: '🎮' },
  { name: 'SNES Games', href: '/games?platform=snes', emoji: '🕹️' },
  { name: 'Genesis Games', href: '/games?platform=genesis', emoji: '🎯' },
  { name: 'N64 Games', href: '/games?platform=n64', emoji: '🏆' },
  { name: 'Neo Geo Games', href: '/games?platform=neogeo', emoji: '⚡' },
  { name: 'PlayStation Games', href: '/games?platform=playstation', emoji: '🎲' },
  { name: 'Game Boy Games', href: '/games?platform=gameboy', emoji: '📱' },
  { name: 'GBA Games', href: '/games?platform=gba', emoji: '🌟' },
  { name: 'NDS Games', href: '/games?platform=nds', emoji: '📺' },
];

const gameLinks = [
  { name: 'Wargus RTS', href: '/wargus', status: 'new' },
  { name: 'Tower Defense', href: '/tower-defense', status: 'new' },
  { name: 'Avernus 3D', href: '/avernus-3d', status: 'new' },
  { name: 'Avernus Arena', href: '/avernus-arena', status: 'new' },
  { name: 'Decay Survival', href: '/decay-survival', status: 'new' },
  { name: 'Overdrive 3D Racing', href: '/overdrive-3d', status: 'new' },
  { name: 'RPG Maker Studio', href: '/rpg-maker-studio', status: 'active' },
  { name: 'Overdrive Racing', href: '/overdrive-racing', status: 'active' },
  { name: 'Puzzle Platformer', href: '/puzzle-platformer', status: 'active' },
  { name: 'Yahaha 3D World', href: '/yahaha-3d-world', status: 'beta' },
];

const devTools = [
  { name: 'Engine Launcher', href: '/engine-launcher', status: 'stable' },
  { name: 'Advantage Platform', href: '/advantage', status: 'stable' },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'new': return 'bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)]';
    case 'beta': return 'bg-[hsl(280,70%,60%)]/20 text-[hsl(280,70%,60%)]';
    case 'active': return 'bg-[hsl(120,60%,50%)]/20 text-[hsl(120,60%,50%)]';
    default: return 'bg-[hsl(220,15%,25%)]/40 text-[hsl(45,15%,60%)]';
  }
};

export default function Header() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPlatforms, setShowPlatforms] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[hsl(43,60%,30%)]/30" style={{ background: 'linear-gradient(135deg, hsl(225,30%,8%), hsl(225,25%,6%))' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)] transition-colors p-1"
                aria-label="Toggle menu"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <Link href="/" className="flex items-center gap-2">
                <img src={grudgeLogo} alt="Grudge Studio" className="w-8 h-8 rounded-full ring-2 ring-[hsl(43,85%,55%)]/30" />
                <span className="text-lg font-heading gold-text font-bold hidden sm:inline">GRUDGE</span>
                <span className="text-xs text-[hsl(45,15%,60%)] font-body hidden lg:inline">Rec0deD:88</span>
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className={`transition-colors font-body text-sm ${
                  isActive(link.href) ? 'text-[hsl(43,85%,55%)]' : 'text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)]'
                }`}>
                  {link.name}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <a href="https://id.grudge-studio.com" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)] hover:bg-[hsl(225,25%,15%)] hidden sm:flex">
                  <LogIn className="w-4 h-4 mr-1" /> Sign In
                </Button>
              </a>
              <Link href="/games">
                <Button size="sm" className="gilded-button">
                  <Play className="w-4 h-4 mr-1" /> Play Games
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={(e) => { if (e.target === e.currentTarget) setMenuOpen(false); }}
        >
          <div className="fantasy-panel border-r w-80 h-full overflow-y-auto shadow-2xl" style={{ borderRadius: 0 }}>
            <div className="p-4 border-b border-[hsl(43,60%,30%)]" style={{ background: 'linear-gradient(135deg, hsl(225,30%,12%), hsl(225,25%,8%))' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={grudgeLogo} alt="Grudge Studio" className="w-8 h-8 rounded" />
                  <h2 className="font-heading text-lg gold-text">Grudge Studio</h2>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] transition-colors p-1"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[hsl(45,15%,60%)] text-xs font-body mt-1">Rec0deD:88 Gaming Portal</p>
            </div>

            <div className="p-4 border-b border-[hsl(43,60%,30%)]/30">
              <div className="text-xs text-[hsl(43,85%,55%)] uppercase tracking-widest mb-3 font-heading">Quick Access</div>
              <div className="space-y-1">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  const active = location === link.href;
                  return (
                    <Link key={link.href} href={link.href}>
                      <Button
                        variant="ghost"
                        className={`w-full justify-start text-left h-9 ${active ? 'bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border border-[hsl(43,60%,30%)]' : 'text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)]'}`}
                        onClick={() => setMenuOpen(false)}
                      >
                        <Icon className="w-4 h-4 mr-3" />
                        {link.name}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-b border-[hsl(43,60%,30%)]/30">
              <Button variant="ghost" onClick={() => setShowPlatforms(!showPlatforms)} className="w-full justify-between text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)] mb-2 h-8">
                <span className="text-xs uppercase tracking-widest font-heading flex items-center gap-2"><Crown className="w-3 h-3 text-[hsl(43,85%,55%)]" /> Retro Games</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showPlatforms ? 'rotate-180' : ''}`} />
              </Button>
              {showPlatforms && (
                <div className="space-y-1 ml-2">
                  {platformLinks.map((link) => (
                    <Link key={link.href} href={link.href}>
                      <div className="flex items-center gap-2 p-2 rounded cursor-pointer text-[hsl(45,15%,60%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,90%,70%)] text-sm transition-colors" onClick={() => setMenuOpen(false)}>
                        <span>{link.emoji}</span>
                        <span>{link.name}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-b border-[hsl(43,60%,30%)]/30">
              <Button variant="ghost" onClick={() => setShowGames(!showGames)} className="w-full justify-between text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)] mb-2 h-8">
                <span className="text-xs uppercase tracking-widest font-heading flex items-center gap-2"><Swords className="w-3 h-3 text-[hsl(43,85%,55%)]" /> Custom Games</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showGames ? 'rotate-180' : ''}`} />
              </Button>
              {showGames && (
                <div className="space-y-1 ml-2">
                  {gameLinks.map((link) => (
                    <Link key={link.href} href={link.href}>
                      <div className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-sm ${location === link.href ? 'bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)]' : 'text-[hsl(45,15%,60%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,90%,70%)]'}`} onClick={() => setMenuOpen(false)}>
                        <span>{link.name}</span>
                        <Badge className={`text-xs ${getStatusColor(link.status)}`}>{link.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4">
              <Button variant="ghost" onClick={() => setShowDevTools(!showDevTools)} className="w-full justify-between text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,85%,55%)] mb-2 h-8">
                <span className="text-xs uppercase tracking-widest font-heading flex items-center gap-2"><Settings className="w-3 h-3 text-[hsl(43,85%,55%)]" /> Dev Tools</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDevTools ? 'rotate-180' : ''}`} />
              </Button>
              {showDevTools && (
                <div className="space-y-1 ml-2">
                  {devTools.map((link) => (
                    <Link key={link.href} href={link.href}>
                      <div className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-sm ${location === link.href ? 'bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)]' : 'text-[hsl(45,15%,60%)] hover:bg-[hsl(225,25%,20%)] hover:text-[hsl(43,90%,70%)]'}`} onClick={() => setMenuOpen(false)}>
                        <span>{link.name}</span>
                        <Badge className={`text-xs ${getStatusColor(link.status)}`}>{link.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[hsl(43,60%,30%)]/30" style={{ background: 'hsl(225,30%,6%)' }}>
              <div className="flex items-center justify-center gap-2">
                <img src={grudgeLogo} alt="" className="w-4 h-4 rounded opacity-60" />
                <span className="text-xs text-[hsl(45,15%,60%)] font-body">Grudge Studio &middot; Rec0deD:88 v2.0</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
