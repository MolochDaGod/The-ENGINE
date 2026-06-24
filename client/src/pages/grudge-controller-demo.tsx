/**
 * Grudge Controller Demo — grudge-control + artifact animator combat model
 * Third-person grudge6 races from CDN with BVH locomotion.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Gamepad2, Users } from 'lucide-react';
import * as THREE from 'three';
import { GrudgeEngine } from '@/engine';
import {
  GrudgePlayerController,
  GRUDGE_CHARACTERS,
  type GrudgeCharacterEntry,
} from '@/engine/controller';

export default function GrudgeControllerDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef<GrudgePlayerController | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [characterId, setCharacterId] = useState(GRUDGE_CHARACTERS[0].id);

  const boot = useCallback(async (char: GrudgeCharacterEntry) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLoading(true);
    setError(null);

    try {
      ctrlRef.current?.dispose();
      GrudgeEngine.getInstance().destroy();

      const engine = GrudgeEngine.getInstance();
      engine.init(canvas);
      engine.addGround(0x1a1428, 120);

      const ground = engine.scene.children.find(
        (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.PlaneGeometry,
      ) as THREE.Mesh | undefined;

      const ctrl = new GrudgePlayerController();
      await ctrl.init({
        canvas,
        character: char,
        initPosition: new THREE.Vector3(0, 0, 0),
        staticCollider: ground,
        thirdMouseMode: 1,
        enableMobile: true,
      });

      ctrlRef.current = ctrl;
      engine.addToUpdate(ctrl);
      engine.start();
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load controller');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const char = GRUDGE_CHARACTERS.find((c) => c.id === characterId) ?? GRUDGE_CHARACTERS[0];
    boot(char);
    return () => {
      ctrlRef.current?.dispose();
      GrudgeEngine.getInstance().destroy();
      ctrlRef.current = null;
    };
  }, [boot, characterId]);

  const onRaceChange = async (id: string) => {
    setCharacterId(id);
    const char = GRUDGE_CHARACTERS.find((c) => c.id === id);
    if (char && ctrlRef.current && ready) {
      setLoading(true);
      try {
        await ctrlRef.current.switchCharacter(char);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8dfc8] flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3a] bg-[#12121a]/90 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <Link href="/super-engine">
            <Button variant="ghost" size="sm" className="text-[#d4af37]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Super Engine
            </Button>
          </Link>
          <Badge className="bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/40">
            <Gamepad2 className="w-3 h-3 mr-1" /> Grudge Controller
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#888]" />
          <select
            className="bg-[#1a1a25] border border-[#2a2a3a] rounded px-2 py-1 text-sm"
            value={characterId}
            onChange={(e) => onRaceChange(e.target.value)}
          >
            {GRUDGE_CHARACTERS.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="relative flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
        {(loading || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
            <p className="text-sm text-[#d4af37]">{error ?? 'Loading grudge6 character…'}</p>
          </div>
        )}
        <div className="absolute bottom-4 left-4 right-4 max-w-md p-3 rounded-lg bg-[#12121a]/90 border border-[#2a2a3a] text-xs text-[#888] pointer-events-none">
          <strong className="text-[#d4af37]">Controls:</strong> WASD move · Shift sprint · Space jump · V toggle view · F fly · Mouse look
          <br />
          <span className="text-[#666]">grudge-control BVH + artifact animator combat/OWR + grudge6 CDN</span>
        </div>
      </div>
    </div>
  );
}