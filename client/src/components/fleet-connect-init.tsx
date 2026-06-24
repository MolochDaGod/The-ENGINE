import { useEffect } from "react";

declare global {
  interface Window {
    GrudgeFleetConnect?: {
      autoMount: (opts?: { mode?: "pill" | "inline" }) => void;
      refresh: () => void;
    };
  }
}

/** Mounts the GrudaChain fleet-connect pill once the SDK script loads. */
export function FleetConnectInit() {
  useEffect(() => {
    let cancelled = false;

    const mount = () => {
      if (cancelled || !window.GrudgeFleetConnect) return;
      window.GrudgeFleetConnect.autoMount({ mode: "pill" });
    };

    if (window.GrudgeFleetConnect) {
      mount();
      return () => {
        cancelled = true;
      };
    }

    const onLoad = () => mount();
    window.addEventListener("load", onLoad);
    const timer = window.setInterval(() => {
      if (window.GrudgeFleetConnect) {
        window.clearInterval(timer);
        mount();
      }
    }, 500);

    return () => {
      cancelled = true;
      window.removeEventListener("load", onLoad);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}