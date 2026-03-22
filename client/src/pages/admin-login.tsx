import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ADMIN_AUTH_KEY = "grudge_admin_authenticated";
const FALLBACK_ADMIN_PASSCODE = "grudge-admin";

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || "/analytics-dashboard";
}

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");

  const expectedPasscode = import.meta.env.VITE_ADMIN_PASSCODE || FALLBACK_ADMIN_PASSCODE;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (passcode !== expectedPasscode) {
      setError("Invalid passcode");
      return;
    }

    localStorage.setItem(ADMIN_AUTH_KEY, "true");
    setError("");
    setLocation(getRedirectTarget());
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[hsl(225,30%,6%)] px-4 py-10 text-[hsl(45,30%,90%)]">
      <div className="mx-auto max-w-md">
        <Card className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,10%)]">
          <CardHeader>
            <CardTitle className="text-[hsl(43,85%,55%)]">Admin Login</CardTitle>
            <CardDescription className="text-[hsl(45,15%,60%)]">
              Enter admin passcode to access protected routes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter admin passcode"
                className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" className="w-full gilded-button">
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
