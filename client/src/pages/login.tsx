import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Gamepad, Loader2 } from "lucide-react";
import { redirectToCanonicalLogin } from "@/lib/canonicalAuth";

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || "/";
}

/** /login always goes to id.grudge-studio.com — no in-app multi-provider modal. */
export default function Login() {
  const { player, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    const target = getRedirectTarget();
    if (player && !player.needsProfile) {
      setLocation(target);
      return;
    }
    if (!player) {
      redirectToCanonicalLogin(target);
    }
  }, [loading, player, setLocation]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-10 text-[hsl(45,30%,90%)]">
      <Gamepad className="w-10 h-10 text-[hsl(43,85%,55%)] mb-3" />
      <h1 className="text-2xl font-heading gold-text" style={{ WebkitTextFillColor: "unset" }}>
        Grudge Studio Sign In
      </h1>
      <p className="text-sm text-[hsl(45,15%,60%)] font-body mt-2 max-w-md flex items-center gap-2 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        Redirecting to id.grudge-studio.com…
      </p>
      <Button
        className="gilded-button mt-4"
        onClick={() => redirectToCanonicalLogin(getRedirectTarget())}
      >
        Continue to Grudge ID
      </Button>
    </div>
  );
}

