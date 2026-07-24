import { useEffect, useMemo, useState, type ImgHTMLAttributes, type ReactNode } from "react";

// Cover-art rendering for libretro-thumbnails Named_Boxarts URLs.
//
// The thumbnailUrl values we ship in api/_games.json are generated from the
// rec0ded88 catalog by stripping the No-Intro region suffix that the
// libretro-thumbnails CDN actually uses on disk. So bare files like
// `Castlevania.png` return 403 while `Castlevania (USA).png` returns 200.
//
// This component walks a short fallback chain when an <img> errors, before
// falling back to a caller-supplied placeholder.

const REGION_SUFFIXES = [
  ' (USA)',
  ' (USA, Europe)',
  ' (Europe)',
  ' (Japan)',
  ' (Japan, USA)',
  ' (World)',
];

const NAMED_BOXARTS_MARKER = '/Named_Boxarts/';

/** Build the candidate URL chain for a libretro-thumbnails Named_Boxarts URL. */
export function buildCoverFallbacks(url: string): string[] {
  const idx = url.indexOf(NAMED_BOXARTS_MARKER);
  if (idx === -1) return [url];
  const prefix = url.slice(0, idx + NAMED_BOXARTS_MARKER.length);
  const tail = url.slice(idx + NAMED_BOXARTS_MARKER.length);
  const qIdx = tail.indexOf('?');
  const query = qIdx === -1 ? '' : tail.slice(qIdx);
  const tailNoQuery = qIdx === -1 ? tail : tail.slice(0, qIdx);
  const dot = tailNoQuery.lastIndexOf('.');
  if (dot === -1) return [url];
  const baseEncoded = tailNoQuery.slice(0, dot);
  const ext = tailNoQuery.slice(dot);
  let baseDecoded: string;
  try {
    baseDecoded = decodeURIComponent(baseEncoded);
  } catch {
    return [url];
  }
  // Already region-suffixed? Trust the input.
  if (/\([^)]+\)\s*$/.test(baseDecoded)) return [url];
  const list = [url];
  for (const suffix of REGION_SUFFIXES) {
    list.push(`${prefix}${encodeURIComponent(baseDecoded + suffix)}${ext}${query}`);
  }
  return list;
}

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'>;

export interface GameCoverProps extends ImgProps {
  src: string | null | undefined;
  alt: string;
  /** Rendered when src is empty or every candidate URL fails to load. */
  placeholder?: ReactNode;
}

/**
 * <GameCover> renders a libretro-thumbnails cover with a region-suffix
 * fallback chain. If all candidates fail (or src is missing) it renders the
 * supplied placeholder, or null.
 */
function DefaultArtPlaceholder({ alt, className }: { alt: string; className?: string }) {
  const letter = (alt || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(145deg, hsl(225,30%,14%) 0%, hsl(43,40%,18%) 50%, hsl(225,30%,10%) 100%)",
        color: "hsl(43,85%,55%)",
        fontFamily: "inherit",
        fontWeight: 700,
        fontSize: "1.75rem",
        letterSpacing: "0.04em",
        width: "100%",
        height: "100%",
        minHeight: 48,
      }}
      aria-label={alt}
      role="img"
    >
      {letter}
    </div>
  );
}

export function GameCover({ src, alt, placeholder = null, className, loading = 'lazy', ...rest }: GameCoverProps) {
  const candidates = useMemo(() => (src ? buildCoverFallbacks(src) : []), [src]);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setIdx(0);
    setFailed(false);
  }, [src]);
  const fallback = placeholder ?? <DefaultArtPlaceholder alt={alt} className={className} />;
  if (!src || failed) return <>{fallback}</>;
  return (
    <img
      {...rest}
      src={candidates[idx]}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        if (idx + 1 < candidates.length) setIdx(idx + 1);
        else setFailed(true);
      }}
    />
  );
}

export default GameCover;
