import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronDown, ChevronRight, Github, Gamepad2, Loader2, MessageCircle, Phone, ShieldAlert, Sparkles, Wallet } from "lucide-react";
import grudgeLogo from "@assets/uXpJmRe_1773828784729.png";
import { useAuth } from "@/components/auth-provider";
import {
  completeProfile,
  discordSignIn,
  githubSignIn,
  guestSignIn,
  loginPlayer,
  phantomSignIn,
  puterSSO,
  registerPlayer,
  requestPopupToken,
  twilioStart,
  twilioVerify,
} from "@/lib/player-auth";

type AuthModalOptions = { redirectTo?: string; initialTab?: AuthTab; reason?: string; popupMode?: boolean; audience?: string };
type AuthTab = "signin" | "register" | "quick";
type Screen = "landing" | "grudge" | "more";

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

// ── Modal ──────────────────────────────────────────────────────────

function AuthModalDialog({ isOpen, onClose, options }: { isOpen: boolean; onClose: () => void; options: AuthModalOptions }) {
  const { player, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<AuthTab>(options.initialTab === "register" ? "register" : "signin");
  const [screen, setScreen] = useState<Screen>(
    options.initialTab === "quick" ? "more" : options.initialTab === "register" || options.initialTab === "signin" ? "grudge" : "landing",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initial = options.initialTab;
      setTab(initial === "register" ? "register" : "signin");
      setScreen(
        initial === "quick" ? "more" : initial === "register" || initial === "signin" ? "grudge" : "landing",
      );
      setError("");
      setBusy(null);
    }
  }, [isOpen, options.initialTab]);

  const afterAuth = useCallback(async () => {
    await refresh();
    // If we're running as an embedded popup for another frontend, mint a
    // short-lived launch token and postMessage it back to window.opener.
    if (options.popupMode && window.opener) {
      const audience = options.audience || undefined;
      const mint = await requestPopupToken(audience);
      if (mint.ok) {
        // Fetch our own /api/auth/me so we include the fresh profile in the payload.
        try {
          const meRes = await fetch("/api/auth/me", { credentials: "include" });
          const profile = meRes.ok ? await meRes.json() : null;
          window.opener.postMessage(
            { type: "grudge:auth:success", token: mint.data.token, audience: mint.data.audience, player: profile },
            audience || "*",
          );
        } catch {
          window.opener.postMessage(
            { type: "grudge:auth:error", error: "Failed to read profile" },
            audience || "*",
          );
        }
      } else {
        window.opener.postMessage(
          { type: "grudge:auth:error", error: mint.error },
          options.audience || "*",
        );
      }
      // Give the browser a tick to deliver the message, then close.
      setTimeout(() => window.close(), 150);
      return;
    }
    if (options.redirectTo && options.redirectTo !== window.location.pathname) {
      setLocation(options.redirectTo);
    }
    // If profile is incomplete the modal stays open on "complete" step.
  }, [refresh, options.popupMode, options.audience, options.redirectTo, setLocation]);

  const needsProfile = !!player?.needsProfile;

  const handleDiscord = () => discordSignIn(options.redirectTo || window.location.pathname);
  const handleGuest = async () => {
    setBusy("guest"); setError("");
    const res = await guestSignIn();
    setBusy(null);
    if (!res.ok) return setError(res.error);
    await afterAuth();
  };

  const errorBanner = error ? (
    <div className="mb-3 flex items-start gap-2 p-2 rounded bg-[hsl(0,60%,30%)]/15 border border-[hsl(0,60%,45%)]/40 text-[hsl(0,70%,80%)] text-sm">
      <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{error}</span>
    </div>
  ) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-[hsl(225,30%,6%)] border-[hsl(43,60%,30%)]">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 15%, hsl(43,85%,55%) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          <div className="relative px-6 pt-8 pb-5 text-center" style={{ background: "linear-gradient(180deg, hsl(225,35%,10%), hsl(225,30%,6%))" }}>
            <div className="flex flex-col items-center gap-2">
              <img src={grudgeLogo} alt="Grudge Studio" className="w-14 h-14 rounded-full ring-2 ring-[hsl(43,85%,55%)]/40" />
              <DialogHeader className="space-y-1">
                <DialogTitle className="font-heading text-2xl gold-text tracking-wider" style={{ WebkitTextFillColor: "unset" }}>
                  GRUDGE STUDIO
                </DialogTitle>
                <DialogDescription className="text-xs uppercase tracking-[0.22em] text-[hsl(45,15%,60%)]">
                  {options.reason || "One account · every Grudge product"}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        <div className="p-5">
          {errorBanner}
          {player && needsProfile ? (
            <CompleteProfileStep onDone={onClose} onError={setError} error="" />
          ) : player ? (
            <SignedInStep onClose={onClose} />
          ) : screen === "landing" ? (
            <LandingScreen
              onGrudge={() => { setScreen("grudge"); setTab("signin"); setError(""); }}
              onDiscord={handleDiscord}
              onGuest={handleGuest}
              onMore={() => { setScreen("more"); setError(""); }}
              busy={busy}
            />
          ) : screen === "grudge" ? (
            <GrudgeSignInScreen
              tab={tab}
              setTab={setTab}
              busy={busy}
              setBusy={setBusy}
              onError={setError}
              onSuccess={afterAuth}
              onBack={() => { setScreen("landing"); setError(""); }}
            />
          ) : (
            <MoreLinksScreen
              busy={busy}
              setBusy={setBusy}
              onError={setError}
              onSuccess={afterAuth}
              redirectTo={options.redirectTo}
              onBack={() => { setScreen("landing"); setError(""); }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Landing screen (the grudgewarlords.com card style) ────────────────────

function ActionCard({
  title, subtitle, icon, onClick, accent, busy, busyKey,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  onClick: () => void;
  accent: string;
  busy: string | null;
  busyKey?: string;
}) {
  const isBusy = busyKey && busy === busyKey;
  return (
    <button
      onClick={onClick}
      disabled={!!busy}
      className="w-full text-left rounded-lg border transition-all group hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ borderColor: `${accent}55`, background: "linear-gradient(180deg, hsl(225,25%,13%), hsl(225,25%,9%))" }}
    >
      <div className="flex items-center gap-4 p-4">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}>
          {isBusy ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: accent }} /> : icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-heading text-sm tracking-wider uppercase" style={{ color: accent }}>{title}</div>
          <div className="text-xs text-[hsl(45,15%,65%)] font-body mt-0.5">{subtitle}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-[hsl(45,15%,50%)] group-hover:text-[hsl(43,85%,55%)] transition-colors" />
      </div>
    </button>
  );
}

function LandingScreen({
  onGrudge, onDiscord, onGuest, onMore, busy,
}: {
  onGrudge: () => void;
  onDiscord: () => void;
  onGuest: () => void;
  onMore: () => void;
  busy: string | null;
}) {
  return (
    <div className="space-y-3">
      <ActionCard
        title="Login with Grudge"
        subtitle="Sign in to save progress"
        icon={<Sparkles className="w-5 h-5" style={{ color: "hsl(43,85%,55%)" }} />}
        accent="hsl(43,85%,55%)"
        onClick={onGrudge}
        busy={busy}
      />
      <ActionCard
        title="Login with Discord"
        subtitle="Sync community & leaderboards"
        icon={<MessageCircle className="w-5 h-5" style={{ color: "hsl(235,70%,70%)" }} />}
        accent="hsl(235,70%,60%)"
        onClick={onDiscord}
        busy={busy}
      />
      <ActionCard
        title="Play as Guest"
        subtitle="No account needed"
        icon={<Gamepad2 className="w-5 h-5" style={{ color: "hsl(120,60%,60%)" }} />}
        accent="hsl(120,60%,55%)"
        onClick={onGuest}
        busy={busy}
        busyKey="guest"
      />
      <button
        onClick={onMore}
        className="w-full flex items-center justify-center gap-1 mt-2 py-2 text-xs uppercase tracking-widest text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] font-body transition-colors"
      >
        More ways to sign in <ChevronDown className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Grudge (username/password) screen ───────────────────────────────

function GrudgeSignInScreen({
  tab, setTab, busy, setBusy, onError, onSuccess, onBack,
}: {
  tab: AuthTab;
  setTab: (t: AuthTab) => void;
  busy: string | null;
  setBusy: (s: string | null) => void;
  onError: (e: string) => void;
  onSuccess: () => Promise<void>;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs uppercase tracking-widest text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] font-body">
        <ArrowLeft className="w-3 h-3" /> Back
      </button>
      <Tabs value={tab} onValueChange={(v) => setTab(v as AuthTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-[hsl(225,25%,15%)]">
          <TabsTrigger value="signin">Sign In</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>
        <TabsContent value="signin" className="pt-4">
          <SignInForm busy={busy} setBusy={setBusy} onError={onError} onSuccess={onSuccess} />
        </TabsContent>
        <TabsContent value="register" className="pt-4">
          <RegisterForm busy={busy} setBusy={setBusy} onError={onError} onSuccess={onSuccess} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── More ways wrapper ──────────────────────────────────────────

function MoreLinksScreen({
  busy, setBusy, onError, onSuccess, redirectTo, onBack,
}: {
  busy: string | null;
  setBusy: (s: string | null) => void;
  onError: (e: string) => void;
  onSuccess: () => Promise<void>;
  redirectTo?: string;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs uppercase tracking-widest text-[hsl(45,15%,55%)] hover:text-[hsl(43,85%,55%)] font-body">
        <ArrowLeft className="w-3 h-3" /> Back
      </button>
      <QuickLinks busy={busy} setBusy={setBusy} onError={onError} onSuccess={onSuccess} redirectTo={redirectTo} />
    </div>
  );
}

// ── Sign In (username + password) ──────────────────────────────────

function SignInForm({
  busy, setBusy, onError, onSuccess,
}: { busy: string | null; setBusy: (s: string | null) => void; onError: (e: string) => void; onSuccess: () => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const submitting = busy === "signin";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("signin");
    onError("");
    const result = await loginPlayer({ username, password });
    setBusy(null);
    if (!result.ok) return onError(result.error);
    await onSuccess();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        autoComplete="username"
        required
        className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        required
        className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
      />
      <Button type="submit" className="w-full gilded-button" disabled={submitting}>
        {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Sign In
      </Button>
    </form>
  );
}

// ── Register (username required) ───────────────────────────────────

function RegisterForm({
  busy, setBusy, onError, onSuccess,
}: { busy: string | null; setBusy: (s: string | null) => void; onError: (e: string) => void; onSuccess: () => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const submitting = busy === "register";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("register");
    onError("");
    const result = await registerPlayer({ username, password, email: email || undefined, displayName: displayName || undefined });
    setBusy(null);
    if (!result.ok) return onError(result.error);
    await onSuccess();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username (required, 3-30 chars)"
        minLength={3}
        maxLength={30}
        required
        className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 6 chars)"
        minLength={6}
        required
        className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
      />
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)"
        className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
      />
      <Input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Display name (optional)"
        maxLength={60}
        className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
      />
      <Button type="submit" className="w-full gilded-button" disabled={submitting}>
        {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Create account
      </Button>
      <p className="text-xs text-[hsl(45,15%,55%)] font-body">
        One Grudge ID across Warlords, Launcher, Dashboard, AI, and Assets.
      </p>
    </form>
  );
}

// ── Quick links (Phantom, Discord, Puter, Phone, Guest) ────────────

function QuickLinks({
  busy, setBusy, onError, onSuccess, redirectTo,
}: {
  busy: string | null;
  setBusy: (s: string | null) => void;
  onError: (e: string) => void;
  onSuccess: () => Promise<void>;
  redirectTo?: string;
}) {
  const [phoneStep, setPhoneStep] = useState<"idle" | "sent">("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneHint, setPhoneHint] = useState<string | null>(null);

  const handlePhantom = async () => {
    setBusy("phantom");
    onError("");
    const res = await phantomSignIn();
    setBusy(null);
    if (!res.ok) return onError(res.error);
    await onSuccess();
  };

  const handleGuest = async () => {
    setBusy("guest");
    onError("");
    const res = await guestSignIn();
    setBusy(null);
    if (!res.ok) return onError(res.error);
    await onSuccess();
  };

  const handlePuter = async () => {
    setBusy("puter");
    onError("");
    const puter = (window as any).puter;
    if (!puter?.auth?.signIn) {
      setBusy(null);
      return onError("Puter SDK not loaded. Add the Puter script tag to index.html.");
    }
    try {
      await puter.auth.signIn();
      const user = await puter.auth.getUser();
      if (!user?.uuid) {
        setBusy(null);
        return onError("Puter sign-in did not return a user.");
      }
      const result = await puterSSO({ puterId: user.uuid, puterUsername: user.username, email: user.email });
      setBusy(null);
      if (!result.ok) return onError(result.error);
      await onSuccess();
    } catch (err: any) {
      setBusy(null);
      onError(err?.message || "Puter sign-in failed");
    }
  };

  const handleDiscord = () => {
    discordSignIn(redirectTo || window.location.pathname);
  };

  const handlePhoneStart = async () => {
    setBusy("phone-start");
    onError("");
    setPhoneHint(null);
    const res = await twilioStart(phone);
    setBusy(null);
    if (!res.ok) return onError(res.error);
    if (res.dev) setPhoneHint("Dev mode: SMS not sent. Your 6-digit code is in the server logs.");
    setPhoneStep("sent");
  };

  const handlePhoneVerify = async () => {
    setBusy("phone-verify");
    onError("");
    const res = await twilioVerify(phone, code);
    setBusy(null);
    if (!res.ok) return onError(res.error);
    await onSuccess();
  };

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="w-full justify-between border-[hsl(280,60%,45%)] text-[hsl(280,70%,85%)] hover:bg-[hsl(280,60%,30%)]/30"
        onClick={handlePhantom}
        disabled={!!busy}
      >
        <span className="flex items-center gap-2"><Wallet className="w-4 h-4" /> Phantom (Solana)</span>
        {busy === "phantom" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Badge variant="outline" className="text-[10px]">web3</Badge>}
      </Button>

      <Button
        variant="outline"
        className="w-full justify-between border-[hsl(235,60%,50%)] text-[hsl(235,70%,80%)] hover:bg-[hsl(235,60%,30%)]/30"
        onClick={handleDiscord}
        disabled={!!busy}
      >
        <span className="flex items-center gap-2">Continue with Discord</span>
        <Badge variant="outline" className="text-[10px]">OAuth</Badge>
      </Button>

      <Button
        variant="outline"
        className="w-full justify-between border-[hsl(220,10%,35%)] text-[hsl(45,30%,90%)] hover:bg-[hsl(220,10%,15%)]"
        onClick={() => githubSignIn(window.location.pathname)}
        disabled={!!busy}
      >
        <span className="flex items-center gap-2"><Github className="w-4 h-4" /> Continue with GitHub</span>
        <Badge variant="outline" className="text-[10px]">OAuth</Badge>
      </Button>

      <Button
        variant="outline"
        className="w-full justify-between border-[hsl(43,60%,30%)] text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,18%)]"
        onClick={handlePuter}
        disabled={!!busy}
      >
        <span className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[hsl(43,85%,55%)]" /> Continue with Puter
        </span>
        {busy === "puter" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Badge variant="outline" className="text-[10px]">google/email</Badge>}
      </Button>

      <div className="rounded border border-[hsl(43,60%,30%)]/40 p-3 space-y-2 bg-[hsl(225,25%,12%)]">
        <div className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-[hsl(43,85%,55%)]" /> Continue with phone (SMS)
        </div>
        {phoneStep === "idle" ? (
          <div className="flex gap-2">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
              className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,10%)]"
            />
            <Button onClick={handlePhoneStart} disabled={!!busy} className="gilded-button">
              {busy === "phone-start" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send code"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-[hsl(45,15%,60%)] font-body">Code sent to {phone}.</div>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,10%)]"
              />
              <Button onClick={handlePhoneVerify} disabled={!!busy} className="gilded-button">
                {busy === "phone-verify" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
              </Button>
            </div>
            {phoneHint && <p className="text-xs text-[hsl(43,85%,65%)] font-body">{phoneHint}</p>}
            <button
              className="text-xs text-[hsl(45,15%,60%)] hover:text-[hsl(43,85%,55%)] font-body underline"
              onClick={() => { setPhoneStep("idle"); setCode(""); }}
            >Use a different number</button>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        className="w-full text-[hsl(45,15%,70%)] hover:text-[hsl(43,85%,55%)]"
        onClick={handleGuest}
        disabled={!!busy}
      >
        <Gamepad2 className="w-4 h-4 mr-2" />
        {busy === "guest" ? "Creating guest..." : "Continue as guest"}
      </Button>
      <p className="text-[11px] text-[hsl(45,15%,55%)] font-body text-center">
        Quick links create a Grudge ID automatically. You'll pick a username next.
      </p>
    </div>
  );
}

// ── Complete Profile step (shown after quick-link signup) ──────────

function CompleteProfileStep({
  onDone, onError, error,
}: { onDone: () => void; onError: (e: string) => void; error: string }) {
  const { player, refresh } = useAuth();
  const [username, setUsername] = useState(player?.username?.startsWith("guest_") || player?.username?.startsWith("sol_") || player?.username?.startsWith("phone_") ? "" : player?.username || "");
  const [displayName, setDisplayName] = useState(player?.displayName || "");
  const [email, setEmail] = useState(player?.email || "");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    onError("");
    const res = await completeProfile({ username: username || undefined, displayName: displayName || undefined, email: email || undefined });
    setBusy(false);
    if (!res.ok) return onError(res.error);
    await refresh();
    onDone();
  };

  return (
    <div className="p-5 space-y-3">
      <p className="text-sm text-[hsl(45,15%,60%)] font-body">
        Pick a username — this is your public name across all Grudge Studio products. You can change your display name any time.
      </p>
      {error && (
        <div className="flex items-start gap-2 p-2 rounded bg-[hsl(0,60%,30%)]/15 border border-[hsl(0,60%,45%)]/40 text-[hsl(0,70%,80%)] text-sm">
          <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username (3-30 chars)"
          minLength={3}
          maxLength={30}
          required
          className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
        />
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name (optional)"
          maxLength={60}
          className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
        />
        <Button type="submit" className="w-full gilded-button" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Claim username
        </Button>
      </form>
    </div>
  );
}

function SignedInStep({ onClose }: { onClose: () => void }) {
  const { player, logout } = useAuth();
  return (
    <div className="p-5 space-y-3">
      <p className="text-sm text-[hsl(45,30%,90%)] font-body">
        You're signed in as <span className="text-[hsl(43,85%,55%)] font-medium">{player?.displayName || player?.username}</span>.
      </p>
      <div className="flex gap-2">
        <Button className="flex-1 gilded-button" onClick={onClose}>Continue</Button>
        <Button variant="outline" className="border-[hsl(43,60%,30%)]" onClick={() => { logout(); onClose(); }}>Sign out</Button>
      </div>
    </div>
  );
}
