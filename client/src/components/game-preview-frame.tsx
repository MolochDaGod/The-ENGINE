import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import type { FleetGameCard } from '@/data/fleetGames';
import { openGameTab, resolveGameLaunch } from '@/lib/game-launch';

interface GamePreviewFrameProps {
  game: FleetGameCard;
  className?: string;
  title?: string;
}

export function GamePreviewFrame({ game, className = '', title }: GamePreviewFrameProps) {
  const launch = resolveGameLaunch(game);
  const [blocked, setBlocked] = useState(launch.mode === 'tab');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    readyRef.current = false;
    setBlocked(launch.mode === 'tab');
  }, [launch.embedUrl, launch.mode]);

  useEffect(() => {
    if (blocked || !launch.embedUrl) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'grudge:game:ready') {
        readyRef.current = true;
      }
    };
    window.addEventListener('message', onMessage);

    const watchdog = window.setTimeout(() => {
      if (readyRef.current) return;
      try {
        const doc = iframeRef.current?.contentDocument;
        if (doc && doc.body && doc.body.childElementCount === 0) {
          setBlocked(true);
        }
      } catch {
        /* cross-origin — cannot inspect; keep iframe visible */
      }
    }, 12_000);

    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(watchdog);
    };
  }, [blocked, launch.embedUrl]);

  if (blocked || !launch.embedUrl) {
    return (
      <div className={`flex flex-col items-center justify-center h-full min-h-[200px] bg-black/85 p-8 text-center ${className}`}>
        <p className="text-gray-300 mb-2 max-w-md">
          {game.name} opens in a dedicated window — embedded preview is not available from this portal host.
        </p>
        {game.disambiguation && (
          <p className="text-xs text-gray-500 mb-4">{game.disambiguation}</p>
        )}
        <Button
          className="bg-orange-500 hover:bg-orange-600 text-white"
          onClick={() => openGameTab(launch.playUrl)}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open {game.name}
        </Button>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full min-h-[200px] overflow-hidden ${className}`}>
      <iframe
        ref={iframeRef}
        src={launch.embedUrl}
        className="absolute inset-0 block h-full w-full border-0"
        title={title ?? game.name}
        allow="autoplay; fullscreen; gamepad; xr-spatial-tracking; accelerometer; gyroscope; clipboard-write; pointer-lock"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="eager"
      />
    </div>
  );
}