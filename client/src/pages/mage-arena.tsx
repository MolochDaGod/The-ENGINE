import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";

const MAGE_ARENA_URL = "https://mage-arena-seven.vercel.app";

/**
 * Mage Arena — Foozle Lucifer Edition
 *
 * The game is now a standalone Phaser 3 app deployed to Vercel.
 * This page embeds it in a fullscreen iframe with a navigation header.
 * Heroes: Sorceress, Skeleton Hunter, Warrior, Golem
 * Bosses: Anubis, Medusa, Horus (Mythology 480x480)
 * Assets: Foozle Lucifer packs on R2 CDN
 */
export default function MageArena() {
  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Navigation header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/90 border-b border-gray-800">
        <Link href="/">
          <Button variant="outline" size="sm" className="border-purple-500/50 text-purple-300 hover:bg-purple-900/30">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
        <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400">
          MAGE ARENA
        </h1>
        <span className="text-xs text-gray-500">Foozle Lucifer Edition</span>
        <div className="ml-auto">
          <a href={MAGE_ARENA_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-gray-600 text-gray-400 hover:text-white">
              <ExternalLink className="w-3 h-3 mr-1" /> Open Fullscreen
            </Button>
          </a>
        </div>
      </div>

      {/* Game iframe */}
      <iframe
        src={MAGE_ARENA_URL}
        className="flex-1 w-full border-0"
        allow="fullscreen; autoplay"
        title="Mage Arena — Grudge Studio"
      />
    </div>
  );
}
