import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings2, Sun, Camera, Grid3X3, Sparkles } from "lucide-react";
import {
  type ForgeRenderSettings,
  type CameraPresetId,
  type LightingPresetId,
  type ToneMappingId,
  DEFAULT_FORGE_SETTINGS,
} from "@/lib/engine3d";

interface ForgeSystemPanelProps {
  settings: ForgeRenderSettings;
  onChange: (next: ForgeRenderSettings) => void;
  compact?: boolean;
}

const LIGHTING_OPTIONS: { id: LightingPresetId; label: string }[] = [
  { id: "forge", label: "Forge" },
  { id: "day", label: "Day" },
  { id: "night", label: "Night" },
  { id: "sunset", label: "Sunset" },
  { id: "indoor", label: "Indoor" },
  { id: "arena", label: "Arena" },
];

const CAMERA_OPTIONS: { id: CameraPresetId; label: string }[] = [
  { id: "orbit", label: "Orbit" },
  { id: "thirdPerson", label: "Third Person" },
  { id: "rts", label: "RTS" },
  { id: "isometric", label: "Isometric" },
  { id: "fps", label: "FPS" },
  { id: "platformer", label: "Platformer" },
];

const TONE_OPTIONS: { id: ToneMappingId; label: string }[] = [
  { id: "aces", label: "ACES Filmic" },
  { id: "reinhard", label: "Reinhard" },
  { id: "cineon", label: "Cineon" },
  { id: "linear", label: "Linear" },
  { id: "none", label: "None" },
];

export function ForgeSystemPanel({ settings, onChange, compact = false }: ForgeSystemPanelProps) {
  const patch = (partial: Partial<ForgeRenderSettings>) => onChange({ ...settings, ...partial });

  return (
    <div
      className={`rounded-xl border border-gray-700/60 bg-gray-900/80 backdrop-blur-md ${
        compact ? "p-3 space-y-3" : "p-4 space-y-4"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-semibold text-white">Forge Systems</span>
        </div>
        <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30 text-[10px]">
          Three.js
        </Badge>
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400 flex items-center gap-1">
            <Sun className="w-3 h-3" /> Lighting
          </Label>
          <Select value={settings.lighting} onValueChange={(v) => patch({ lighting: v as LightingPresetId })}>
            <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIGHTING_OPTIONS.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400 flex items-center gap-1">
            <Camera className="w-3 h-3" /> Camera
          </Label>
          <Select value={settings.camera} onValueChange={(v) => patch({ camera: v as CameraPresetId })}>
            <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMERA_OPTIONS.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Tone Mapping
          </Label>
          <Select value={settings.toneMapping} onValueChange={(v) => patch({ toneMapping: v as ToneMappingId })}>
            <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400">Exposure ({settings.exposure.toFixed(1)})</Label>
          <Slider
            min={0.4}
            max={2.2}
            step={0.1}
            value={[settings.exposure]}
            onValueChange={([v]) => patch({ exposure: v })}
          />
        </div>
      </div>

      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-800/60 px-2 py-1.5">
          <Label className="text-[11px] text-gray-400 flex items-center gap-1">
            <Grid3X3 className="w-3 h-3" /> Grid
          </Label>
          <Switch checked={settings.showGrid} onCheckedChange={(v) => patch({ showGrid: v })} />
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-800/60 px-2 py-1.5">
          <Label className="text-[11px] text-gray-400">Fog</Label>
          <Switch checked={settings.fogEnabled} onCheckedChange={(v) => patch({ fogEnabled: v })} />
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-800/60 px-2 py-1.5">
          <Label className="text-[11px] text-gray-400">Shadows</Label>
          <Switch checked={settings.shadows} onCheckedChange={(v) => patch({ shadows: v })} />
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-800/60 px-2 py-1.5">
          <Label className="text-[11px] text-gray-400">Auto-rotate</Label>
          <Switch checked={settings.autoRotate} onCheckedChange={(v) => patch({ autoRotate: v })} />
        </div>
      </div>

      {!compact && (
        <button
          type="button"
          className="text-[11px] text-gray-500 hover:text-orange-400 transition-colors"
          onClick={() => onChange({ ...DEFAULT_FORGE_SETTINGS })}
        >
          Reset to Forge defaults
        </button>
      )}
    </div>
  );
}