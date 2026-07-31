/**
 * Robust hero / race portrait image with CDN fallbacks.
 * Never leave a blank circle when icons 404.
 */
import { useMemo, useState } from "react";
import {
  prefabPortraitCandidates,
  type CharacterPrefab,
  type ClassId,
  type RaceId,
} from "@shared/character-prefabs";
import { cdnAssetUrl } from "@/lib/api-config";

const CLASS_EMOJI: Record<string, string> = {
  warrior: "⚔️",
  mage: "🔮",
  ranger: "🏹",
  worge: "🐺",
};

type Props = {
  race?: RaceId;
  classId?: ClassId;
  prefab?: CharacterPrefab;
  alt?: string;
  className?: string;
  size?: number;
};

export function HeroPortrait({ race, classId, prefab, alt = "", className = "", size }: Props) {
  const r = prefab?.race ?? race ?? "human";
  const c = prefab?.classId ?? classId ?? "warrior";
  const candidates = useMemo(() => {
    const list = prefabPortraitCandidates(r, c);
    if (prefab?.iconUrl) list.unshift(prefab.iconUrl);
    if (prefab?.raceIconUrl) list.push(prefab.raceIconUrl);
    // Normalize any absolute URLs through CDN host fix
    return [...new Set(list.map((u) => cdnAssetUrl(u)).filter(Boolean))];
  }, [r, c, prefab]);

  const [idx, setIdx] = useState(0);
  const src = candidates[idx];
  const style = size ? { width: size, height: size } : undefined;

  if (!src || idx >= candidates.length) {
    return (
      <span
        className={`inline-flex items-center justify-center bg-black/40 text-base ${className}`}
        style={style}
        aria-hidden
      >
        {CLASS_EMOJI[c] || "🧍"}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt || prefab?.name || r}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onError={() => setIdx((i) => i + 1)}
    />
  );
}

export default HeroPortrait;
