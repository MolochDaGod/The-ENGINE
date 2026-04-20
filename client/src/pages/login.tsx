import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { useAuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { Gamepad2 } from "lucide-react";

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || "/";
}

export default function Login() {
  const { player, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { open, isOpen } = useAuthModal();
  const openedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    const target = getRedirectTarget();
    if (player && !player.needsProfile) {
      setLocation(target);
      return;
    }
    if (!openedRef.current) {
      openedRef.current = true;
      open({ redirectTo: target, initialTab: "signin", reason: "Sign in to sync stats, leaderboards and PvP across Grudge Studio." });
    }
  }, [loading, player, open, setLocation]);

  // When the modal closes without a session, bounce back to home.
  useEffect(() => {
    if (!isOpen && openedRef.current && !player) {
      setLocation("/");
    }
  }, [isOpen, player, setLocation]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-10 text-[hsl(45,30%,90%)]">
      <Gamepad2 className="w-10 h-10 text-[hsl(43,85%,55%)] mb-3" />
      <h1 className="text-2xl font-heading gold-text" style={{ WebkitTextFillColor: "unset" }}>Grudge Studio Sign In</h1>
      <p className="text-sm text-[hsl(45,15%,60%)] font-body mt-2 max-w-md">
        The sign-in dialog should have opened automatically. If it didn't, tap the button below.
      </p>
      <Button
        className="gilded-button mt-4"
        onClick={() => open({ redirectTo: getRedirectTarget(), initialTab: "signin" })}
      >
        Open sign-in
      </Button>
    </div>
  );
}

