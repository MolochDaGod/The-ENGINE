import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Home, Gamepad2 } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: 'linear-gradient(180deg, hsl(225,30%,6%), hsl(225,28%,10%))' }}>
      <div className="text-center px-4">
        <div className="mb-6">
          <img src="/favicon.png" alt="Grudge Studio" className="w-20 h-20 mx-auto opacity-40" />
        </div>
        <h1 className="text-6xl font-heading gold-text mb-4">404</h1>
        <p className="text-xl text-[hsl(45,15%,55%)] font-body mb-8">
          This page has been lost to the void.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/">
            <Button className="gilded-button">
              <Home className="w-4 h-4 mr-2" />
              Return Home
            </Button>
          </Link>
          <Link href="/games">
            <Button variant="outline" className="border-[hsl(43,60%,30%)] text-[hsl(43,85%,55%)] hover:bg-[hsl(43,85%,55%)]/10">
              <Gamepad2 className="w-4 h-4 mr-2" />
              Play Games
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
