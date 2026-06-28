import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FLEET_OPERATORS = new Set(["grudachain", "molochdadev"]);
const FLEET_OPERATOR_EMAILS = new Set(["grugedev@gmail.com", "jonbemmons@gmail.com"]);

declare global {
  interface Window {
    puter?: {
      auth: {
        isSignedIn: () => boolean;
        getUser: () => Promise<{ username?: string; email?: string; uuid?: string }>;
        signIn: () => Promise<{ success?: boolean } | void>;
        signOut: () => Promise<void>;
      };
    };
  }
}

function isFleetOperator(user: { username?: string; email?: string } | null | undefined) {
  if (!user) return false;
  const username = String(user.username || "").toLowerCase();
  const email = String(user.email || "").toLowerCase();
  return FLEET_OPERATORS.has(username) || FLEET_OPERATOR_EMAILS.has(email);
}

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || "https://dash.grudge-studio.com/";
}

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dash = getRedirectTarget();
    if (dash.startsWith("http")) {
      window.location.replace(dash);
      return;
    }
    setLocation(dash);
  }, [setLocation]);

  const onPuterSignIn = async () => {
    setSubmitting(true);
    setError("");
    try {
      const puter = window.puter;
      if (!puter?.auth) {
        setError("Puter SDK not loaded");
        return;
      }
      let user;
      if (puter.auth.isSignedIn()) {
        user = await puter.auth.getUser();
      } else {
        const result = await puter.auth.signIn();
        if (result && "success" in result && result.success === false) {
          setError("Puter sign-in cancelled");
          return;
        }
        user = await puter.auth.getUser();
      }
      if (!isFleetOperator(user)) {
        try {
          await puter.auth.signOut();
        } catch {
          // ignore
        }
        setError("Only grudachain and molochdadev fleet operators may access the console.");
        return;
      }
      window.location.href = getRedirectTarget();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Puter sign-in failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[hsl(225,30%,6%)] px-4 py-10 text-[hsl(45,30%,90%)]">
      <div className="mx-auto max-w-md">
        <Card className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,10%)]">
          <CardHeader>
            <CardTitle className="text-[hsl(43,85%,55%)]">Fleet Console</CardTitle>
            <CardDescription className="text-[hsl(45,15%,60%)]">
              Sign in with Puter as <strong>grudachain</strong> or <strong>molochdadev</strong>.
              Passcode admin login has been removed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" className="w-full gilded-button" disabled={submitting} onClick={onPuterSignIn}>
              {submitting ? "Connecting…" : "☁️ Sign in with Puter"}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => { window.location.href = "https://dash.grudge-studio.com/"; }}>
              Open Harbor Map
            </Button>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}