import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { requestPopupToken } from "@/lib/player-auth";

const LAUNCHER_URL = "https://grudge-launcher-xu9q5.puter.site/";

export default function CatalogPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { player } = useAuth();
  const [iframeReady, setIframeReady] = useState(false);

  // When the iframe loads and a player is signed in, mint a 5-min launch token
  // and postMessage the identity to the launcher. The launcher is expected to
  // accept `{ type: "grudge:identity", grudgeId, username, token }` to sync to
  // the Grudge ID.
  useEffect(() => {
    if (!iframeReady || !player || !iframeRef.current) return;
    (async () => {
      const mint = await requestPopupToken(window.location.origin);
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "grudge:identity",
          grudgeId: player.grudgeId,
          username: player.username,
          displayName: player.displayName,
          token: mint.ok ? mint.data.token : null,
        },
        "https://grudge-launcher-xu9q5.puter.site",
      );
    })();
  }, [iframeReady, player]);

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(225,30%,6%)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(43,60%,30%)]/30 bg-[hsl(225,30%,8%)]">
        <div>
          <div className="text-xs uppercase tracking-widest text-[hsl(43,85%,55%)] font-heading">Item Catalog</div>
          <div className="text-[11px] text-[hsl(45,15%,60%)] font-body">Live feed from grudge-launcher · Puter</div>
        </div>
        <a href={LAUNCHER_URL} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)]">
            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open in new tab
          </Button>
        </a>
      </div>
      <div className="relative flex-1">
        {!iframeReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(43,85%,55%)]" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={LAUNCHER_URL}
          title="Grudge Item Catalog"
          className="w-full h-full border-0"
          onLoad={() => setIframeReady(true)}
          allow="clipboard-read; clipboard-write"
          referrerPolicy="origin-when-cross-origin"
          style={{ minHeight: "calc(100vh - 64px)" }}
        />
      </div>
    </div>
  );
}
