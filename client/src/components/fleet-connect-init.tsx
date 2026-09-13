import { useEffect } from "react";

declare global {
  interface Window {
    GrudgeFleetConnect?: {
      autoMount: (opts?: { mode?: "pill" | "inline"; target?: string | HTMLElement }) => HTMLElement | null;
      refresh: () => void;
      getSession?: () => {
        token: string | null;
        grudgeId: string | null;
        username: string | null;
        signedIn: boolean;
      };
      signIn?: () => void;
      signOut?: () => void;
      version?: string;
    };
    GrudgeFleet?: {
      isLoggedIn?: () => boolean;
      tryAutoAuth?: (opts?: { allowPuterGuest?: boolean }) => Promise<boolean>;
    };
  }
}

/**
 * Mounts the Grudge Fleet Connect pill once the self-hosted SDK loads.
 * Canonical script: /grudge-fleet-connect.js (no broken nexus CDN).
 */
export function FleetConnectInit() {
  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const mount = () => {
      if (cancelled || !window.GrudgeFleetConnect) return false;
      try {
        window.GrudgeFleetConnect.autoMount({ mode: "pill" });
        // Warm session via full fleet bridge when available
        void window.GrudgeFleet?.tryAutoAuth?.({ allowPuterGuest: false });
        return true;
      } catch {
        return false;
      }
    };

    if (mount()) {
      return () => {
        cancelled = true;
      };
    }

    const onReady = () => {
      mount();
    };
    document.addEventListener("grudge-fleet-connect:ready", onReady);

    const onLoad = () => {
      mount();
    };
    window.addEventListener("load", onLoad);

    timer = window.setInterval(() => {
      if (mount()) window.clearInterval(timer);
    }, 400);

    // Give up polling after 15s — script may be blocked on embed pages
    const stop = window.setTimeout(() => window.clearInterval(timer), 15_000);

    return () => {
      cancelled = true;
      document.removeEventListener("grudge-fleet-connect:ready", onReady);
      window.removeEventListener("load", onLoad);
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, []);

  return null;
}
