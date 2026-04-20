import { Link } from "wouter";
import { useAuthModal } from "@/components/auth-modal";

export default function Footer() {
  const { open: openAuthModal } = useAuthModal();
  return (
    <footer className="border-t border-[hsl(43,60%,30%)]/30 py-16" style={{ background: 'linear-gradient(180deg, hsl(225,30%,6%), hsl(225,30%,4%))' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/favicon.png" alt="Grudge Studio" className="w-8 h-8" />
              <h3 className="text-xl font-heading gold-text">
                Grudge Studio
              </h3>
            </div>
            <p className="text-[hsl(45,15%,55%)] mb-6 text-sm font-body">
              Retro gaming portal with custom game engines and 1,360+ playable classic games.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-[hsl(43,85%,55%)] text-sm uppercase tracking-wider mb-4">Play</h4>
            <ul className="space-y-2">
              <li><Link href="/games" className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Game Library</Link></li>
              <li><Link href="/wargus" className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Wargus RTS</Link></li>
              <li><Link href="/tower-defense" className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Tower Defense</Link></li>
              <li><Link href="/avernus-3d" className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Avernus 3D</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-[hsl(43,85%,55%)] text-sm uppercase tracking-wider mb-4">Create</h4>
            <ul className="space-y-2">
              <li><Link href="/super-engine" className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Super Engine</Link></li>
              <li><Link href="/advantage" className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Advantage Platform</Link></li>
              <li><Link href="/store" className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Asset Store</Link></li>
              <li><Link href="/scraping" className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Dev Tools</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-[hsl(43,85%,55%)] text-sm uppercase tracking-wider mb-4">Connect</h4>
            <ul className="space-y-2">
              <li><a href="https://grudgewarlords.com" target="_blank" rel="noopener noreferrer" className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">Grudge Warlords</a></li>
              <li><button onClick={() => openAuthModal({ initialTab: "signin" })} className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body text-left">Sign In</button></li>
              <li><Link href="/account" className="text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] text-sm transition-colors font-body">My Account</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[hsl(43,60%,30%)]/20 mt-12 pt-8 text-center">
          <p className="text-[hsl(45,15%,45%)] text-sm font-body">&copy; 2026 Grudge Studio &middot; Rec0deD:88 Gaming Portal</p>
        </div>
      </div>
    </footer>
  );
}
