import { useEffect, useMemo, useState } from "react";
import { useAuthModal } from "@/components/auth-modal";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AuthPopup() {
  const { open, isOpen } = useAuthModal();
  const [status, setStatus] = useState<"checking" | "blocked" | "ready">("checking");
  const [error, setError] = useState<string | null>(null);

  const audience = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("audience") || (window.opener ? document.referrer || "*" : "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/auth/allowed-origins", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { origins: string[] };
        if (cancelled) return;
        if (!audience) {
          setStatus("blocked");
          setError("This page must be opened as a popup from an allowlisted Grudge frontend.");
          return;
        }
        if (!json.origins.includes(audience)) {
          setStatus("blocked");
          setError(`Origin ${audience} is not allowlisted. Ask an admin to add it to AUTH_ALLOWED_ORIGINS.`);
          return;
        }
        setStatus("ready");
        open({
          initialTab: "quick",
          popupMode: true,
          audience,
          reason: `Sign in to continue to ${new URL(audience).host}`,
        });
      } catch (err: any) {
        if (cancelled) return;
        setStatus("blocked");
        setError(err?.message || "Failed to verify allowed origins");
      }
    }
    check();
    return () => { cancelled = true; };
  }, [audience, open]);

  // If the user closes the modal without signing in, tell the opener.
  useEffect(() => {
    if (status !== "ready") return;
    if (!isOpen && window.opener) {
      try {
        window.opener.postMessage({ type: "grudge:auth:cancel" }, audience || "*");
      } catch { /* ignore */ }
      setTimeout(() => window.close(), 100);
    }
  }, [isOpen, status, audience]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-[hsl(45,30%,90%)] bg-[hsl(225,30%,6%)]">
      {status === "checking" && (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(43,85%,55%)]" />
          <p className="text-sm text-[hsl(45,15%,60%)] font-body">Verifying popup origin…</p>
        </div>
      )}
      {status === "blocked" && (
        <div className="max-w-md text-center space-y-3">
          <ShieldAlert className="w-8 h-8 mx-auto text-[hsl(0,70%,65%)]" />
          <h1 className="text-xl font-heading gold-text" style={{ WebkitTextFillColor: "unset" }}>Popup blocked</h1>
          <p className="text-sm text-[hsl(45,15%,60%)] font-body">{error}</p>
        </div>
      )}
      {status === "ready" && (
        <p className="text-sm text-[hsl(45,15%,60%)] font-body">Continue in the sign-in dialog…</p>
      )}
    </div>
  );
}
