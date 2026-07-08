import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { VOXGRUDGE_GAMES } from "@/lib/voxgrudge-urls";

export default function GrudgeBrawl() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { player } = useAuth();

  useEffect(() => {
    document.title = "Grudge Brawl — Grudge Studio";
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

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'grudge:game:ready' && e.data.game === 'grudge-brawl') {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'grudge:auth', player, token: localStorage.getItem('grudge_auth_token'),
        }, '*');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [player]);

  return (
    <div className="flex flex-col h-screen bg-[hsl(225,30%,6%)]">
      <div className="flex items-center justify-between px-4 py-2 bg-[hsl(225,25%,10%)] border-b border-[hsl(43,60%,30%)]/30 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/super-engine">
            <Button variant="ghost" size="sm" className="text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-[hsl(0,70%,55%)]">⚔️ Grudge Brawl</h1>
          {player && (
            <span className="text-xs text-[hsl(45,15%,60%)] ml-2">
              {player.displayName || player.username}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="text-[hsl(45,30%,90%)]">
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
      </div>
      <iframe
        ref={iframeRef}
        src={VOXGRUDGE_GAMES.grudgeBrawl}
        className="flex-1 w-full min-h-0 border-0"
        allow="fullscreen; autoplay; pointer-lock"
        title="Grudge Brawl"
      />
    </div>
  );
}