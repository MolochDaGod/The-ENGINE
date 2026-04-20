import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Github, Loader2, MessageCircle, Phone as PhoneIcon, Shield, ShieldAlert, Sparkles, UserCircle, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  completeProfile,
  discordSignIn,
  githubSignIn,
  googleSignIn,
  guestSignIn,
  loginPlayer,
  phantomSignIn,
  puterSSO,
  registerPlayer,
  requestPopupToken,
  twilioStart,
  twilioVerify,
} from "@/lib/player-auth";

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

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AuthModalOptions>({});

  const open = useCallback((opts: AuthModalOptions = {}) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

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
  const [tab, setTab] = useState<"signin" | "register">(options.initialTab === "register" ? "register" : "signin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [phoneStep, setPhoneStep] = useState<"hidden" | "idle" | "sent">("hidden");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setTab(options.initialTab === "register" ? "register" : "signin");
    setError("");
    setBusy(null);
    setPhoneStep("hidden");
    setPhone(""); setPhoneCode(""); setPhoneHint(null);
    setIdentifier(""); setPassword("");
    setRegEmail(""); setRegUsername(""); setRegPassword("");
  }, [isOpen, options.initialTab]);

  const afterAuth = useCallback(async () => {
    await refresh();
    if (options.popupMode && window.opener) {
      const audience = options.audience || undefined;
      const mint = await requestPopupToken(audience);
      if (mint.ok) {
        try {
          const meRes = await fetch("/api/auth/me", { credentials: "include" });
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
      return;
    }
    if (options.redirectTo && options.redirectTo !== window.location.pathname) {
      setLocation(options.redirectTo);
    }
  }, [refresh, options.popupMode, options.audience, options.redirectTo, setLocation]);

  const needsProfile = !!player?.needsProfile;

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key); setError("");
    const r = await fn();
    setBusy(null);
    if (!r.ok) return setError(r.error || "Failed");
    await afterAuth();
  };
  const handleDiscord = () => discordSignIn(options.redirectTo || window.location.pathname);
  const handleGoogle = () => googleSignIn(options.redirectTo || window.location.pathname);
  const handleGithub = () => githubSignIn(options.redirectTo || window.location.pathname);
  const handlePhantom = () => run("phantom", phantomSignIn);
  const handlePuter = () => run("puter", async () => {
    const puter = (window as any).puter;
    if (!puter?.auth?.signIn) return { ok: false, error: "Puter SDK not loaded." };
    try {
      await puter.auth.signIn();
      const u = await puter.auth.getUser();
      if (!u?.uuid) return { ok: false, error: "Puter sign-in did not return a user." };
      return await puterSSO({ puterId: u.uuid, puterUsername: u.username, email: u.email });
    } catch (err: any) {
      return { ok: false, error: err?.message || "Puter sign-in failed" };
    }
  });
  const handleGuest = () => run("guest", guestSignIn);
  const handlePhoneStart = async () => {
    if (!phone.trim()) return setError("Enter a phone number in E.164 format, e.g. +15551234567");
    setBusy("phone-start"); setError(""); setPhoneHint(null);
    const r = await twilioStart(phone.trim());
    setBusy(null);
    if (!r.ok) return setError(r.error);
    if (r.dev) setPhoneHint("Dev mode: SMS not sent. Check server logs for the code.");
    setPhoneStep("sent");
  };
  const handlePhoneVerify = async () => {
    setBusy("phone-verify"); setError("");
    const r = await twilioVerify(phone.trim(), phoneCode.trim());
    setBusy(null);
    if (!r.ok) return setError(r.error);
    await afterAuth();
  };

  const submitSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("signin"); setError("");
    const r = await loginPlayer({ username: identifier, password });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    await afterAuth();
  };
  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("register"); setError("");
    const r = await registerPlayer({ username: regUsername, password: regPassword, email: regEmail || undefined });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    await afterAuth();
  };

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
          <DialogDescription className="sr-only">{options.reason || "Sign in to Grudge Studio"}</DialogDescription>
        </div>

        {player && needsProfile ? (
          <div className="px-6 pb-6"><CompleteProfileInline onDone={onClose} /></div>
        ) : player ? (
          <div className="px-6 pb-6"><SignedInInline onClose={onClose} /></div>
        ) : (
          <div className="px-6 pb-6 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <ProviderButton label="Discord" icon={<MessageCircle className="w-3.5 h-3.5" />} onClick={handleDiscord} disabled={!!busy} style={{ background: "#5865F2", color: "white", borderColor: "#4752C4" }} />
              <ProviderButton label="Google" icon={<GoogleMark />} onClick={handleGoogle} disabled={!!busy} style={{ background: "#ffffff", color: "#202124", borderColor: "#dadce0" }} />
              <ProviderButton label="GitHub" icon={<Github className="w-3.5 h-3.5" />} onClick={handleGithub} disabled={!!busy} style={{ background: "#0d1117", color: "white", borderColor: "#30363d" }} />
              <ProviderButton label="Phantom" icon={<Wallet className="w-3.5 h-3.5" />} onClick={handlePhantom} disabled={!!busy} busy={busy === "phantom"} style={{ background: "#ab9ff2", color: "#2d1a5f", borderColor: "#8f84d6" }} />
              <ProviderButton label="Puter" icon={<Sparkles className="w-3.5 h-3.5" />} onClick={handlePuter} disabled={!!busy} busy={busy === "puter"} style={{ background: "#2b6cb0", color: "white", borderColor: "#1e4b7e" }} />
              <ProviderButton label="Phone" icon={<PhoneIcon className="w-3.5 h-3.5" />} onClick={() => setPhoneStep(phoneStep === "hidden" ? "idle" : "hidden")} disabled={!!busy} style={{ background: "#14b869", color: "white", borderColor: "#0f8c50" }} />
            </div>

            {phoneStep !== "hidden" && (
              <PhoneForm
                phone={phone} setPhone={setPhone}
                code={phoneCode} setCode={setPhoneCode}
                step={phoneStep} busy={busy}
                onStart={handlePhoneStart}
                onVerify={handlePhoneVerify}
                onReset={() => { setPhoneStep("idle"); setPhoneCode(""); setPhoneHint(null); }}
                hint={phoneHint}
              />
            )}

            {error && (
              <div className="flex items-start gap-2 p-2 rounded bg-[hsl(0,60%,30%)]/15 border border-[hsl(0,60%,45%)]/40 text-[hsl(0,70%,80%)] text-sm">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-[hsl(45,15%,45%)] font-body">
              <div className="flex-1 h-px bg-[hsl(43,60%,30%)]/30" />
              or
              <div className="flex-1 h-px bg-[hsl(43,60%,30%)]/30" />
            </div>

            <div className="grid grid-cols-2 gap-0 rounded overflow-hidden" style={{ border: "1px solid rgba(200,153,26,0.25)" }}>
              <TabBtn active={tab === "signin"} onClick={() => { setTab("signin"); setError(""); }}>Sign In</TabBtn>
              <TabBtn active={tab === "register"} onClick={() => { setTab("register"); setError(""); }}>Create Account</TabBtn>
            </div>

            {tab === "signin" ? (
              <form onSubmit={submitSignIn} className="space-y-2">
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email, username, or Grudge ID"
                  autoComplete="username"
                  required
                  className="bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/40"
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                  className="bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/40"
                />
                <Button
                  type="submit"
                  disabled={!!busy}
                  className="w-full font-heading tracking-widest uppercase text-sm py-3"
                  style={{ background: "linear-gradient(180deg, #d9a829, #b88718)", color: "#1a1005", border: "1px solid #7a5c0e" }}
                >
                  {busy === "signin" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Sign In
                </Button>
              </form>
            ) : (
              <form onSubmit={submitRegister} className="space-y-2">
                <Input
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Username (required, 3-30 chars)"
                  minLength={3} maxLength={30} required
                  className="bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/40"
                />
                <Input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/40"
                />
                <Input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Password (min 6 chars)"
                  minLength={6} required
                  className="bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/40"
                />
                <Button
                  type="submit"
                  disabled={!!busy}
                  className="w-full font-heading tracking-widest uppercase text-sm py-3"
                  style={{ background: "linear-gradient(180deg, #d9a829, #b88718)", color: "#1a1005", border: "1px solid #7a5c0e" }}
                >
                  {busy === "register" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Account
                </Button>
              </form>
            )}

            <Button
              variant="outline"
              onClick={handleGuest}
              disabled={!!busy}
              className="w-full font-heading tracking-widest uppercase text-xs border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,85%)] hover:bg-[hsl(225,25%,16%)]"
            >
              {busy === "guest" ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <UserCircle className="w-3.5 h-3.5 mr-2" />}
              Continue as Guest
            </Button>

            <div className="pt-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[hsl(45,15%,45%)] font-body">
                Every account gets a Puter Cloud ID for sync &amp; storage
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

function ProviderButton({
  label, icon, onClick, disabled, busy, style,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-1.5 rounded text-[11px] font-bold uppercase tracking-wider py-2 border transition disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110"
      style={style}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="py-2 text-xs uppercase tracking-widest font-heading transition-colors"
      style={{
        background: active ? "linear-gradient(180deg, #8c6a17, #6e5410)" : "transparent",
        color: active ? "#f0c040" : "hsl(45,15%,55%)",
      }}
    >
      {children}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="14" height="14" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function PhoneForm({
  phone, setPhone, code, setCode, step, busy, onStart, onVerify, onReset, hint,
}: {
  phone: string; setPhone: (v: string) => void;
  code: string; setCode: (v: string) => void;
  step: "hidden" | "idle" | "sent";
  busy: string | null;
  onStart: () => void;
  onVerify: () => void;
  onReset: () => void;
  hint: string | null;
}) {
  return (
    <div className="rounded border border-[hsl(43,60%,30%)]/30 bg-[hsl(225,25%,10%)] p-3 space-y-2">
      {step !== "sent" ? (
        <div className="flex gap-2">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
            className="bg-[hsl(225,25%,8%)] border-[hsl(43,60%,30%)]/40"
          />
          <Button onClick={onStart} disabled={!!busy} className="font-heading tracking-wider uppercase text-xs" style={{ background: "linear-gradient(180deg, #d9a829, #b88718)", color: "#1a1005" }}>
            {busy === "phone-start" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Code"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[11px] text-[hsl(45,15%,60%)] font-body uppercase tracking-widest">Code sent to {phone}</div>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              className="bg-[hsl(225,25%,8%)] border-[hsl(43,60%,30%)]/40"
            />
            <Button onClick={onVerify} disabled={!!busy} className="font-heading tracking-wider uppercase text-xs" style={{ background: "linear-gradient(180deg, #d9a829, #b88718)", color: "#1a1005" }}>
              {busy === "phone-verify" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
            </Button>
          </div>
          {hint && <p className="text-[11px] text-[hsl(43,85%,65%)] font-body">{hint}</p>}
          <button onClick={onReset} className="text-[11px] text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] font-body underline">
            Use a different number
          </button>
        </div>
      )}
    </div>
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
