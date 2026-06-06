import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";

export default function PolyFighter() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { player } = useAuth();

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
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[hsl(225,25%,10%)] border-b border-[hsl(43,60%,30%)]/30">
        <div className="flex items-center gap-3">
          <Link href="/super-engine">
            <Button variant="ghost" size="sm" className="text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <h1 className="text-lg font-bold" style={{ color: '#ff0055' }}>
            🥊 Grudge Fighter
          </h1>
          {player && (
            <span className="text-xs text-[hsl(45,15%,60%)] ml-2">
              Playing as {player.displayName || player.username}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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

      {/* Game Canvas */}
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          src="/games/polyfighter.html"
          className="w-full h-full border-0 absolute inset-0"
          allow="fullscreen; autoplay"
          title="Grudge Fighter"
        />
      </div>
    </div>
  );
}
