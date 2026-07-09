import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";

/** 2D Smash-style platform fighter (GitHub: MolochDaGod/Grudge-RPG-Sprite-Attack). */
const FIGHTER_URL = "https://grudge-rpg-sprite-attack.vercel.app";

export default function PolyFighter() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { player } = useAuth();

  useEffect(() => {
    document.title = "Grudge Smash — Grudge Studio";
    return () => { document.title = "Rec0deD:88 — Grudge Studio Gaming Portal"; };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      iframeRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-black">
      <div className="flex items-center justify-between px-4 py-2 bg-[hsl(225,25%,10%)] border-b border-[hsl(43,60%,30%)]/30 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/super-engine">
            <Button variant="ghost" size="sm" className="text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <h1 className="text-lg font-bold" style={{ color: '#ff0055' }}>
            🥊 Grudge Smash
          </h1>
          {player && (
            <span className="text-xs text-[hsl(45,15%,60%)] ml-2">
              Playing as {player.displayName || player.username}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a href={FIGHTER_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="text-[hsl(45,30%,90%)]">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-[hsl(45,30%,90%)]"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={FIGHTER_URL}
        className="flex-1 w-full min-h-0 border-0"
        allow="fullscreen; autoplay"
        title="Grudge Smash"
      />
    </div>
  );
}