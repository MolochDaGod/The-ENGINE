/**
 * /auth/callback — canonical Grudge ID SSO handoff + legacy Phantom fallback.
 *
 * Preferred path: return from id.grudge-studio.com with ?grudge_token= / ?sso_token=
 * Optional: ?next=/chat?room=trading to land back on the intended surface.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { phantomSignIn } from "@/lib/player-auth";

type CallbackState = "connecting" | "success" | "error";

const TOKEN_KEYS = ["grudge_token", "sso_token", "token"] as const;

function takeTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  for (const key of TOKEN_KEYS) {
    const q = url.searchParams.get(key);
    if (q) return q;
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const h = hash.get(key);
    if (h) return h;
  }
  return null;
}

function nextPathFromUrl(): string {
  if (typeof window === "undefined") return "/";
  const n = new URLSearchParams(window.location.search).get("next");
  if (n && n.startsWith("/") && !n.startsWith("//")) return n;
  return "/chat";
}

function storeToken(token: string) {
  try {
    localStorage.setItem("grudge_auth_token", token);
    localStorage.setItem("grudge_token", token);
    localStorage.setItem("sso_token", token);
  } catch {
    /* ignore */
  }
  // Also set cookie for same-origin API
  try {
    document.cookie = `grudge_auth_token=${encodeURIComponent(token)}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export default function AuthCallback() {
  const [state, setState] = useState<CallbackState>("connecting");
  const [error, setError] = useState("");
  const { refresh } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function finalize() {
      try {
        const token = takeTokenFromUrl();
        if (token) {
          storeToken(token);
          // Strip tokens from URL
          try {
            const url = new URL(window.location.href);
            for (const k of TOKEN_KEYS) url.searchParams.delete(k);
            window.history.replaceState({}, "", url.pathname + url.search);
          } catch {
            /* ignore */
          }
          await refresh();
          if (cancelled) return;
          setState("success");
          const next = nextPathFromUrl();
          setTimeout(() => {
            if (!cancelled) setLocation(next);
          }, 600);
          return;
        }

        // Legacy Phantom Connect OAuth path only if no Grudge token present
        const result = await phantomSignIn("phantom");
        if (cancelled) return;
        if (result.ok) {
          setState("success");
          await refresh();
          setTimeout(() => {
            if (!cancelled) setLocation(nextPathFromUrl());
          }, 800);
        } else {
          setState("error");
          setError(result.error || "No session token received from Grudge ID.");
        }
      } catch (err: any) {
        if (cancelled) return;
        setState("error");
        setError(err?.message || "Authentication callback failed");
      }
    }

    const timer = setTimeout(finalize, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh, setLocation]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "hsl(225,30%,6%)" }}
    >
      <div className="fantasy-panel p-8 max-w-sm w-full text-center">
        {state === "connecting" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-[hsl(43,85%,55%)] mx-auto mb-4" />
            <h2
              className="font-heading text-lg text-[hsl(43,85%,65%)] mb-2"
              style={{ WebkitTextFillColor: "unset" }}
            >
              Signing in with Grudge ID…
            </h2>
            <p className="text-sm text-[hsl(45,15%,60%)] font-body">
              Completing secure handoff from id.grudge-studio.com.
            </p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-[hsl(120,60%,50%)] mx-auto mb-4" />
            <h2
              className="font-heading text-lg text-[hsl(43,85%,65%)] mb-2"
              style={{ WebkitTextFillColor: "unset" }}
            >
              Signed in
            </h2>
            <p className="text-sm text-[hsl(45,15%,60%)] font-body">
              Returning you to chat…
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className="w-10 h-10 text-[hsl(0,65%,50%)] mx-auto mb-4" />
            <h2
              className="font-heading text-lg text-[hsl(0,70%,65%)] mb-2"
              style={{ WebkitTextFillColor: "unset" }}
            >
              Sign-in failed
            </h2>
            <p className="text-sm text-[hsl(45,15%,60%)] font-body mb-4">
              {error || "Something went wrong during Grudge ID authentication."}
            </p>
            <button
              onClick={() => {
                window.location.assign(
                  `https://id.grudge-studio.com/login?redirect_uri=${encodeURIComponent(
                    `${window.location.origin}/auth/callback?next=/chat`,
                  )}`,
                );
              }}
              className="gilded-button px-4 py-2 text-sm"
            >
              Try Grudge ID again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
