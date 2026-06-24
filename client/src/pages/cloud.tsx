import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { requestPopupToken } from "@/lib/player-auth";

const NEXUS_LIVE = "https://grudachain-rho.vercel.app";
const PER_ACCOUNT_DASHBOARD = `${NEXUS_LIVE}/puter-cloud-dashboard.html`;
const PUTER_ADMIN_CLOUD = "https://grudge-cloud.puter.site/";

function buildDashboardUrl(player: { grudgeId: string; username: string } | null, token: string | null) {
  const url = new URL(PER_ACCOUNT_DASHBOARD);
  if (player && token) {
    url.searchParams.set("token", token);
    url.searchParams.set("username", player.username);
    url.searchParams.set("grudge_id", player.grudgeId);
  }
  return url.toString();
}

export default function CloudPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { player } = useAuth();
  const [iframeReady, setIframeReady] = useState(false);
  const [dashboardUrl, setDashboardUrl] = useState(PER_ACCOUNT_DASHBOARD);

  // Per-account Puter dashboard on Nexus (allowed by frame-src *.vercel.app today).
  // Pass Grudge ID via query params so grudge-sso.js links the signed-in account.
  useEffect(() => {
    if (!player) {
      setDashboardUrl(PER_ACCOUNT_DASHBOARD);
      return;
    }
    (async () => {
      const mint = await requestPopupToken(window.location.origin);
      setDashboardUrl(
        buildDashboardUrl(player, mint.ok ? mint.data.token : null),
      );
    })();
  }, [player]);

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(225,30%,6%)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(43,60%,30%)]/30 bg-[hsl(225,30%,8%)]">
        <div>
          <div className="text-xs uppercase tracking-widest text-[hsl(43,85%,55%)] font-heading">My Grudge Cloud</div>
          <div className="text-[11px] text-[hsl(45,15%,60%)] font-body">Personal Puter cloud · synced with your Grudge ID</div>
        </div>
        <div className="flex items-center gap-2">
          <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)]">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open in new tab
            </Button>
          </a>
          <a href={PUTER_ADMIN_CLOUD} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)]">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Puter admin app
            </Button>
          </a>
        </div>
      </div>
      <div className="relative flex-1">
        {!iframeReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(43,85%,55%)]" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          key={dashboardUrl}
          src={dashboardUrl}
          title="My Grudge Cloud"
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
