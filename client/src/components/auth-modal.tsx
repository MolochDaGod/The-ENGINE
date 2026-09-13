import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, UserCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { completeProfile, requestPopupToken, fleetAuthHeaders } from "@/lib/player-auth";
import { redirectToCanonicalLogin } from "@/lib/canonicalAuth";

type AuthTab = "signin" | "register" | "quick";
type AuthModalOptions = { redirectTo?: string; initialTab?: AuthTab; reason?: string; popupMode?: boolean; audience?: string };

interface AuthModalContextValue {
  open: (opts?: AuthModalOptions) => void;
  close: () => void;
  isOpen: boolean;
}

const AuthModalContext = createContext<AuthModalContextValue>({
  open: () => {},
  close: () => {},
  isOpen: false,
});

export function useAuthModal() {
  return useContext(AuthModalContext);
}

/**
 * ONE TRUTH: unsigned users are sent to id.grudge-studio.com.
 * In-app multi-provider grids (Discord/Google/Phone/etc.) are not used for sign-in.
 * Modal remains only for post-auth profile completion / already-signed-in state.
 */
export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AuthModalOptions>({});
  const { player, loading } = useAuth();

  const open = useCallback(
    (opts: AuthModalOptions = {}) => {
      // Guest / unsigned → hard redirect to canonical Grudge ID (no special modal).
      if (!loading && !player) {
        redirectToCanonicalLogin(opts.redirectTo);
        return;
      }
      setOptions(opts);
      setIsOpen(true);
    },
    [loading, player],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setOptions({});
  }, []);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModalDialog isOpen={isOpen} onClose={close} options={options} />
    </AuthModalContext.Provider>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function AuthModalDialog({ isOpen, onClose, options }: { isOpen: boolean; onClose: () => void; options: AuthModalOptions }) {
  const { player, refresh } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isOpen) return;
    // Belt-and-suspenders: never show the old multi-provider form for unsigned users.
    if (!player) {
      redirectToCanonicalLogin(options.redirectTo);
      onClose();
    }
  }, [isOpen, player, options.redirectTo, onClose]);

  useEffect(() => {
    if (!isOpen || !options.popupMode || !player || !window.opener) return;
    (async () => {
      const audience = options.audience || undefined;
      const mint = await requestPopupToken(audience);
      if (mint.ok) {
        try {
          const meRes = await fetch("/api/auth/me", {
            credentials: "include",
            headers: fleetAuthHeaders(),
          });
          const profile = meRes.ok ? await meRes.json() : null;
          window.opener.postMessage(
            { type: "grudge:auth:success", token: mint.data.token, audience: mint.data.audience, player: profile },
            audience || "*",
          );
        } catch {
          window.opener.postMessage({ type: "grudge:auth:error", error: "Failed to read profile" }, audience || "*");
        }
      } else {
        window.opener.postMessage({ type: "grudge:auth:error", error: mint.error }, options.audience || "*");
      }
      setTimeout(() => window.close(), 150);
    })();
  }, [isOpen, options.popupMode, options.audience, player]);

  const needsProfile = !!player?.needsProfile;

  if (!player) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border"
        style={{
          background: "linear-gradient(180deg, hsl(225,35%,8%), hsl(225,30%,5%))",
          borderColor: "rgba(200,153,26,0.35)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,153,26,0.15) inset",
        }}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: "#c8991a" }} />
            <DialogTitle className="font-heading text-xl tracking-wider" style={{ color: "#c8991a", WebkitTextFillColor: "unset" }}>
              GRUDGE ID
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">{options.reason || "Signed in via id.grudge-studio.com"}</DialogDescription>
        </div>

        {needsProfile ? (
          <div className="px-6 pb-6"><CompleteProfileInline onDone={onClose} /></div>
        ) : (
          <div className="px-6 pb-6"><SignedInInline onClose={() => {
            if (options.redirectTo) setLocation(options.redirectTo);
            onClose();
          }} /></div>
        )}
      </DialogContent>
    </Dialog>
  );
}


function CompleteProfileInline({ onDone }: { onDone: () => void }) {
  const { player, refresh } = useAuth();
  const [username, setUsername] = useState(
    player?.username?.startsWith("guest_") || player?.username?.startsWith("sol_") || player?.username?.startsWith("phone_") ? "" : player?.username || "",
  );
  const [email, setEmail] = useState(player?.email || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await completeProfile({ username: username || undefined, email: email || undefined });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    await refresh();
    onDone();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-[hsl(45,15%,60%)] font-body">
        Pick a username — public name across every Grudge product.
      </p>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <form onSubmit={submit} className="space-y-2">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username (3-30 chars)"
          minLength={3} maxLength={30} required
          className="bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/40"
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className="bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/40"
        />
        <Button
          type="submit"
          disabled={busy}
          className="w-full font-heading tracking-widest uppercase text-sm py-3"
          style={{ background: "linear-gradient(180deg, #d9a829, #b88718)", color: "#1a1005" }}
        >
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Claim Username
        </Button>
      </form>
    </div>
  );
}

function SignedInInline({ onClose }: { onClose: () => void }) {
  const { player, logout } = useAuth();
  return (
    <div className="space-y-3">
      <p className="text-sm text-[hsl(45,30%,90%)] font-body">
        Signed in as <span className="text-[#c8991a] font-medium">{player?.displayName || player?.username}</span>.
      </p>
      <div className="flex gap-2">
        <Button onClick={onClose} className="flex-1 font-heading tracking-widest uppercase text-sm" style={{ background: "linear-gradient(180deg, #d9a829, #b88718)", color: "#1a1005" }}>
          Continue
        </Button>
        <Button variant="outline" onClick={() => { logout(); onClose(); }} className="border-[hsl(43,60%,30%)]/40">
          Sign Out
        </Button>
      </div>
    </div>
  );
}
