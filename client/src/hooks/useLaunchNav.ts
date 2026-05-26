import { useAuth } from "@/components/auth-provider";
import { useAuthModal } from "@/components/auth-modal";

/**
 * Provides `navigateExternal` — opens an external URL in a new tab.
 * When `authRequired` is true and the player is signed in, a 5-minute
 * Grudge ID launch token is appended as `?grudge_token=<jwt>` so the
 * target site can exchange it for a session cookie via
 * POST /api/auth/session/exchange on the Grudge backend.
 *
 * If the player is NOT signed in and `authRequired` is true, the auth
 * modal is opened instead of navigating.
 */
export function useLaunchNav() {
  const { player } = useAuth();
  const { open: openAuthModal } = useAuthModal();

  async function navigateExternal(href: string, authRequired = false) {
    if (authRequired && !player) {
      openAuthModal({ initialTab: "signin" });
      return;
    }

    if (authRequired && player) {
      try {
        const origin = new URL(href).origin;
        const resp = await fetch("/api/auth/popup-token", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audience: origin }),
        });
        if (resp.ok) {
          const { token } = (await resp.json()) as { token: string };
          const sep = href.includes("?") ? "&" : "?";
          window.open(
            `${href}${sep}grudge_token=${encodeURIComponent(token)}`,
            "_blank",
            "noopener,noreferrer",
          );
          return;
        }
      } catch {
        // If token fetch fails, fall through to plain navigation
      }
    }

    window.open(href, "_blank", "noopener,noreferrer");
  }

  return { navigateExternal, player };
}
