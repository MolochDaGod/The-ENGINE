/**
 * /auth/callback — Phantom Connect OAuth redirect handler.
 *
 * After a user signs in with Google or Apple via Phantom Connect,
 * they are redirected here. The Phantom SDK auto-reconnects the
 * session, then we finalize auth with the Grudge backend.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { phantomSignIn } from "@/lib/player-auth";

type CallbackState = "connecting" | "success" | "error";

export default function AuthCallback() {
  const [state, setState] = useState<CallbackState>("connecting");
  const [error, setError] = useState("");
  const { refresh } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function finalize() {
      try {
        // The Phantom SDK's autoConnect picks up the OAuth session.
        // We then run the server-side nonce/verify flow to get a Grudge session cookie.
        const result = await phantomSignIn("phantom");

        if (cancelled) return;

        if (result.ok) {
          setState("success");
          await refresh();
          // Redirect to account page after short delay
          setTimeout(() => {
            if (!cancelled) setLocation("/account");
          }, 1200);
        } else {
          setState("error");
          setError(result.error);
        }
      } catch (err: any) {
        if (cancelled) return;
        setState("error");
        setError(err?.message || "Authentication callback failed");
      }
    }

    // Small delay to let the SDK initialize autoConnect
    const timer = setTimeout(finalize, 500);
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
              Connecting wallet…
            </h2>
            <p className="text-sm text-[hsl(45,15%,60%)] font-body">
              Finalizing your Phantom session with Grudge Studio.
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
              Connected!
            </h2>
            <p className="text-sm text-[hsl(45,15%,60%)] font-body">
              Redirecting to your account…
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
              Connection failed
            </h2>
            <p className="text-sm text-[hsl(45,15%,60%)] font-body mb-4">
              {error || "Something went wrong during wallet authentication."}
            </p>
            <button
              onClick={() => setLocation("/login")}
              className="gilded-button px-4 py-2 text-sm"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
