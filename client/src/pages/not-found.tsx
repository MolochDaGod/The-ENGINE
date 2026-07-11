import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Home, Gamepad, MessageSquare, ExternalLink } from "lucide-react";

/** Live fleet destinations — only list hosts we keep green. */
const FLEET = [
  { label: "Warlords", href: "https://grudgewarlords.com", external: true },
  { label: "Warstrat / Genesis", href: "https://warstrat.grudge-studio.com", external: true },
  { label: "Arena", href: "https://arena.grudge-studio.com", external: true },
  { label: "Forge", href: "https://forge.grudge-studio.com", external: true },
  { label: "Engine", href: "https://grudge.studio", external: true },
  { label: "Characters", href: "https://character.grudge-studio.com", external: true },
  { label: "Chat", href: "/chat", external: false },
  { label: "Game library", href: "/games", external: false },
] as const;

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: 'linear-gradient(180deg, hsl(225,30%,6%), hsl(225,28%,10%))' }}>
      <div className="text-center px-4 max-w-xl">
        <div className="mb-6">
          <img src="/favicon.png" alt="Grudge Studio" className="w-20 h-20 mx-auto opacity-40" />
        </div>
        <h1 className="text-6xl font-heading gold-text mb-4">404</h1>
        <p className="text-xl text-[hsl(45,15%,55%)] font-body mb-4">
          This portal path is not a live product surface.
        </p>
        <p className="text-sm text-[hsl(45,15%,40%)] font-body mb-8">
          Use a fleet destination below — R3F + Rapier games, Forge editor, Engine gallery, or portal chat.
        </p>
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {FLEET.map((f) =>
            f.external ? (
              <a key={f.href} href={f.href} className="inline-flex">
                <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)] hover:bg-[hsl(43,85%,55%)]/10">
                  {f.label} <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
                </Button>
              </a>
            ) : (
              <Link key={f.href} href={f.href}>
                <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)] hover:bg-[hsl(43,85%,55%)]/10">
                  {f.label}
                </Button>
              </Link>
            ),
          )}
        </div>
        <div className="flex gap-4 justify-center">
          <Link href="/">
            <Button className="gilded-button">
              <Home className="w-4 h-4 mr-2" />
              Portal home
            </Button>
          </Link>
          <Link href="/games">
            <Button variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)] hover:bg-[hsl(43,85%,55%)]/10">
              <Gamepad className="w-4 h-4 mr-2" />
              Games
            </Button>
          </Link>
          <Link href="/chat">
            <Button variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)] hover:bg-[hsl(43,85%,55%)]/10">
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
