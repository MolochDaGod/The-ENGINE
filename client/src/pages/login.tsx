import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/auth-provider";
import { loginPlayer, registerPlayer } from "@/lib/player-auth";
import { Gamepad2 } from "lucide-react";

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || "/";
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { refresh } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Login fields
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register fields
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regDisplayName, setRegDisplayName] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await loginPlayer({ username: loginUsername, password: loginPassword });
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    await refresh();
    setLocation(getRedirectTarget());
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await registerPlayer({
      username: regUsername,
      password: regPassword,
      email: regEmail || undefined,
      displayName: regDisplayName || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    await refresh();
    setLocation(getRedirectTarget());
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[hsl(225,30%,6%)] px-4 py-10 text-[hsl(45,30%,90%)]">
      <div className="mx-auto max-w-md">
        <div className="flex flex-col items-center mb-6">
          <Gamepad2 className="w-12 h-12 text-[hsl(43,85%,55%)] mb-2" />
          <h1 className="text-2xl font-heading gold-text">Grudge Studio</h1>
          <p className="text-sm text-[hsl(45,15%,55%)]">Sign in to access games, leaderboards & PvP</p>
        </div>

        <Card className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,10%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[hsl(43,85%,55%)]">Player Account</CardTitle>
            <CardDescription className="text-[hsl(45,15%,60%)]">
              Log in or create a new account to get your Grudge ID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-[hsl(225,25%,15%)]">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <Input
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Username"
                    className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
                    required
                  />
                  <Input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Password"
                    className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
                    required
                  />
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <Button type="submit" className="w-full gilded-button" disabled={submitting}>
                    {submitting ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4 mt-4">
                  <Input
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Username (3-30 chars)"
                    className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
                    required
                    minLength={3}
                    maxLength={30}
                  />
                  <Input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Password (min 6 chars)"
                    className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
                    required
                    minLength={6}
                  />
                  <Input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Email (optional)"
                    className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
                  />
                  <Input
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    placeholder="Display name (optional)"
                    className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
                  />
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <Button type="submit" className="w-full gilded-button" disabled={submitting}>
                    {submitting ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
