import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Maximize2, Minimize2, Settings } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";

interface GameSettings {
  crosshairStyle: 'dot' | 'circle' | 'cross' | 'dynamic';
  crosshairColor: string;
  crosshairSize: number;
  mouseInvert: boolean;
  mouseSensitivity: number;
  runMode: 'hold' | 'toggle';
  drawDistance: number;
  enableNPC: boolean;
  hostileNPC: boolean;
  enableShadows: boolean;
  textureMode: 'simple' | 'texture' | 'hd';
  firstPerson: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  crosshairStyle: 'dot',
  crosshairColor: '#ff0000',
  crosshairSize: 4,
  mouseInvert: false,
  mouseSensitivity: 1.0,
  runMode: 'hold',
  drawDistance: 100,
  enableNPC: true,
  hostileNPC: true,
  enableShadows: false,
  textureMode: 'simple',
  firstPerson: false,
};

export default function TerraForge() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem('terraforge_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const { player } = useAuth();

  useEffect(() => {
    document.title = "TerraForge — Grudge Studio";
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

  const updateSetting = useCallback(<K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('terraforge_settings', JSON.stringify(next));
      // Send to iframe
      iframeRef.current?.contentWindow?.postMessage({
        type: 'grudge:settings', settings: next,
      }, '*');
      return next;
    });
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Send auth + settings to iframe when ready
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'grudge:game:ready' && e.data.game === 'terraforge') {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'grudge:auth', player, token: localStorage.getItem('grudge_auth_token'),
        }, '*');
        iframeRef.current?.contentWindow?.postMessage({
          type: 'grudge:settings', settings,
        }, '*');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [player, settings]);

  return (
    <div className="flex flex-col h-screen bg-[hsl(225,30%,6%)]">
      <div className="flex items-center justify-between px-4 py-2 bg-[hsl(225,25%,10%)] border-b border-[hsl(43,60%,30%)]/30 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/super-engine">
            <Button variant="ghost" size="sm" className="text-[hsl(45,30%,90%)] hover:text-[hsl(43,85%,55%)]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-[hsl(120,60%,50%)]">🌍 TerraForge</h1>
          {player && (
            <span className="text-xs text-[hsl(45,15%,60%)] ml-2">
              {player.displayName || player.username}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}
            className={showSettings ? "text-[hsl(43,85%,55%)]" : "text-[hsl(45,30%,90%)]"}>
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="text-[hsl(45,30%,90%)]">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute right-0 top-12 w-72 bg-[hsl(225,25%,10%)] border border-[hsl(43,60%,30%)]/40 rounded-bl-lg p-4 z-40 text-sm text-[hsl(45,30%,90%)] space-y-3 max-h-[80vh] overflow-y-auto">
          <h3 className="text-[hsl(43,85%,55%)] font-bold border-b border-[hsl(43,60%,30%)]/30 pb-1">Crosshair</h3>
          <label className="flex justify-between items-center">
            Style
            <select value={settings.crosshairStyle} onChange={e => updateSetting('crosshairStyle', e.target.value as any)}
              className="bg-[hsl(225,25%,15%)] border border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)] px-2 py-1 rounded text-xs">
              <option value="dot">Dot</option>
              <option value="circle">Circle</option>
              <option value="cross">Cross</option>
              <option value="dynamic">Dynamic</option>
            </select>
          </label>
          <label className="flex justify-between items-center">
            Color
            <input type="color" value={settings.crosshairColor} onChange={e => updateSetting('crosshairColor', e.target.value)}
              className="w-8 h-6 border-0 bg-transparent cursor-pointer" />
          </label>
          <label className="flex justify-between items-center">
            Size <span className="text-xs text-[hsl(45,15%,60%)]">{settings.crosshairSize}px</span>
            <input type="range" min={2} max={12} value={settings.crosshairSize} onChange={e => updateSetting('crosshairSize', +e.target.value)}
              className="w-24 accent-[hsl(43,85%,55%)]" />
          </label>

          <h3 className="text-[hsl(43,85%,55%)] font-bold border-b border-[hsl(43,60%,30%)]/30 pb-1 pt-2">Controls</h3>
          <label className="flex justify-between items-center">
            Mouse Invert
            <input type="checkbox" checked={settings.mouseInvert} onChange={e => updateSetting('mouseInvert', e.target.checked)}
              className="accent-[hsl(43,85%,55%)]" />
          </label>
          <label className="flex justify-between items-center">
            Sensitivity <span className="text-xs text-[hsl(45,15%,60%)]">{settings.mouseSensitivity.toFixed(1)}</span>
            <input type="range" min={0.2} max={3.0} step={0.1} value={settings.mouseSensitivity}
              onChange={e => updateSetting('mouseSensitivity', +e.target.value)}
              className="w-24 accent-[hsl(43,85%,55%)]" />
          </label>
          <label className="flex justify-between items-center">
            Run Mode
            <select value={settings.runMode} onChange={e => updateSetting('runMode', e.target.value as any)}
              className="bg-[hsl(225,25%,15%)] border border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)] px-2 py-1 rounded text-xs">
              <option value="hold">Hold Shift</option>
              <option value="toggle">Toggle</option>
            </select>
          </label>

          <h3 className="text-[hsl(43,85%,55%)] font-bold border-b border-[hsl(43,60%,30%)]/30 pb-1 pt-2">Graphics</h3>
          <label className="flex justify-between items-center">
            Draw Distance <span className="text-xs text-[hsl(45,15%,60%)]">{settings.drawDistance}</span>
            <input type="range" min={40} max={200} value={settings.drawDistance}
              onChange={e => updateSetting('drawDistance', +e.target.value)}
              className="w-24 accent-[hsl(43,85%,55%)]" />
          </label>
          <label className="flex justify-between items-center">
            Texture Mode
            <select value={settings.textureMode} onChange={e => updateSetting('textureMode', e.target.value as any)}
              className="bg-[hsl(225,25%,15%)] border border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)] px-2 py-1 rounded text-xs">
              <option value="simple">Simple</option>
              <option value="texture">Pixel</option>
              <option value="hd">HD</option>
            </select>
          </label>
          <label className="flex justify-between items-center">
            Shadows
            <input type="checkbox" checked={settings.enableShadows} onChange={e => updateSetting('enableShadows', e.target.checked)}
              className="accent-[hsl(43,85%,55%)]" />
          </label>
          <label className="flex justify-between items-center">
            First Person
            <input type="checkbox" checked={settings.firstPerson} onChange={e => updateSetting('firstPerson', e.target.checked)}
              className="accent-[hsl(43,85%,55%)]" />
          </label>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src="/games/terraforge.html"
        className="flex-1 w-full min-h-0 border-0"
        allow="fullscreen; autoplay; pointer-lock"
        title="TerraForge"
      />
    </div>
  );
}
