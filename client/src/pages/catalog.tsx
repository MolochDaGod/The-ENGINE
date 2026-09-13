import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Canonical live item catalog — ObjectStore Item Browser (3,400+ items). */
const CATALOG_URL = "https://browse.grudge-studio.com/ItemBrowser";
const CATALOG_ORIGIN = "https://browse.grudge-studio.com";

/** Fleet-wired crafting app — item DB tab with recipes + sprites. */
const CRAFTING_CATALOG_URL = "https://crafting-vdz7h.puter.site/";

export default function CatalogPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const loadedRef = useRef(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [source, setSource] = useState<"objectstore" | "crafting">("objectstore");

  const activeUrl = source === "objectstore" ? CATALOG_URL : CRAFTING_CATALOG_URL;
  const activeOrigin = source === "objectstore" ? CATALOG_ORIGIN : "https://crafting-vdz7h.puter.site";

  useEffect(() => {
    loadedRef.current = false;
    setIframeReady(false);
    setLoadError(false);
    const timer = window.setTimeout(() => {
      if (!loadedRef.current) setLoadError(true);
    }, 20_000);
    return () => window.clearTimeout(timer);
  }, [source]);

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(225,30%,6%)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(43,60%,30%)]/30 bg-[hsl(225,30%,8%)]">
        <div>
          <div className="text-xs uppercase tracking-widest text-[hsl(43,85%,55%)] font-heading">
            Item Catalog
          </div>
          <div className="text-[11px] text-[hsl(45,15%,60%)] font-body">
            {source === "objectstore"
              ? "ObjectStore · tiers, rarities, workstations"
              : "Grudge Crafting · recipes + live sprites"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={source === "objectstore" ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setSource("objectstore")}
          >
            Item Browser
          </Button>
          <Button
            variant={source === "crafting" ? "default" : "outline"}
            size="sm"
            className="text-xs border-[hsl(43,60%,30%)]/40"
            onClick={() => setSource("crafting")}
          >
            Crafting DB
          </Button>
          <a href={activeUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)]">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
            </Button>
          </a>
        </div>
      </div>

      <div className="relative flex-1 min-h-[calc(100vh-64px)]">
        {!iframeReady && !loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(43,85%,55%)]" />
            <p className="text-xs text-[hsl(45,15%,50%)]">Loading catalog from {activeOrigin}…</p>
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 px-6 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <p className="text-sm text-[hsl(45,30%,80%)]">Catalog embed timed out or was blocked.</p>
            <a href={activeUrl} target="_blank" rel="noopener noreferrer">
              <Button>Open catalog in new tab</Button>
            </a>
          </div>
        )}
        <iframe
          key={source}
          ref={iframeRef}
          src={activeUrl}
          title="Grudge Item Catalog"
          className="w-full h-full border-0"
          onLoad={() => {
            loadedRef.current = true;
            setIframeReady(true);
            setLoadError(false);
          }}
          allow="clipboard-read; clipboard-write"
          referrerPolicy="origin-when-cross-origin"
          style={{ minHeight: "calc(100vh - 64px)" }}
        />
      </div>
    </div>
  );
}