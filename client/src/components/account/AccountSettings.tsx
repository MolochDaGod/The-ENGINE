import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Gamepad2, Loader2, Save, User } from "lucide-react";
import type { PlayerProfile } from "@/lib/player-auth";
import { useAuth } from "@/components/auth-provider";

type PlaySettings = {
  graphics?: { quality?: string; shadows?: boolean; maxDpr?: number };
  audio?: { master?: number; music?: number; sfx?: number; muted?: boolean };
  controls?: { mouseSensitivity?: number; mouseInvertY?: boolean };
  accessibility?: { reduceMotion?: boolean; subtitles?: boolean };
};

interface Connections {
  discord: string | null;
  google: string | null;
  github: string | null;
  solana: string | null;
  puter: string | null;
  email: string | null;
  phone: string | null;
  wallets: unknown[];
}

const PROVIDERS = [
  { key: "discord", icon: "🎮", label: "Discord", linkable: true },
  { key: "google", icon: "🔴", label: "Google", linkable: true },
  { key: "github", icon: "🐙", label: "GitHub", linkable: true },
  { key: "solana", icon: "◎", label: "Phantom Wallet", linkable: false },
  { key: "puter", icon: "☁", label: "Puter", linkable: false },
  { key: "email", icon: "📧", label: "Email", linkable: false },
  { key: "phone", icon: "📱", label: "Phone", linkable: false },
] as const;

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function AccountSettings({ player }: { player: PlayerProfile }) {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(player.displayName || "");
  const [bio, setBio] = useState(player.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(player.avatarUrl || "");

  const connectionsQuery = useQuery<Connections>({
    queryKey: ["/api/me/connections"],
    queryFn: () => fetchJSON<Connections>("/api/me/connections"),
  });

  const profileMutation = useMutation({
    mutationFn: async (data: { displayName?: string; bio?: string; avatarUrl?: string }) => {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      refresh(); // re-fetch auth state so header updates
    },
  });

  const handleSave = () => {
    const updates: Record<string, string> = {};
    if (displayName.trim() && displayName !== player.displayName) updates.displayName = displayName.trim();
    if (bio !== (player.bio || "")) updates.bio = bio;
    if (avatarUrl !== (player.avatarUrl || "")) updates.avatarUrl = avatarUrl;
    if (Object.keys(updates).length > 0) profileMutation.mutate(updates);
  };

  const handleConnect = (provider: string) => {
    // OAuth redirect — will come back to /account after login
    window.location.href = `/api/auth/${provider}/start?redirect=/account`;
  };

  const playQ = useQuery<{ settings: PlaySettings }>({
    queryKey: ["/api/me/play-settings"],
    queryFn: () => fetchJSON("/api/me/play-settings"),
  });

  const [play, setPlay] = useState<PlaySettings>({});
  useEffect(() => {
    if (playQ.data?.settings) setPlay(playQ.data.settings);
  }, [playQ.data]);

  const playMutation = useMutation({
    mutationFn: async (settings: PlaySettings) => {
      const res = await fetch("/api/me/play-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to save play settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/play-settings"] });
    },
  });

  const conn = connectionsQuery.data;

  return (
    <div className="space-y-6">
      {/* Edit Profile — merged from WCS Settings account section */}
      <section className="fantasy-panel p-6">
        <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>
          <User className="w-4 h-4 inline mr-2 text-[hsl(43,85%,55%)]" />
          Edit Profile
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="text-[hsl(45,15%,60%)] text-xs uppercase tracking-wider">Display Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              className="mt-1 bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/25 text-[hsl(45,30%,90%)] placeholder:text-[hsl(45,15%,30%)]"
              placeholder="Your display name"
            />
          </div>
          <div>
            <Label className="text-[hsl(45,15%,60%)] text-xs uppercase tracking-wider">Bio</Label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded-md bg-[hsl(225,25%,12%)] border border-[hsl(43,60%,30%)]/25 text-[hsl(45,30%,90%)] placeholder:text-[hsl(45,15%,30%)] px-3 py-2 text-sm font-body focus:outline-none focus:ring-1 focus:ring-[hsl(43,85%,55%)]"
              placeholder="Tell the world about yourself..."
            />
            <div className="text-[10px] text-[hsl(45,15%,45%)] text-right mt-0.5">{bio.length}/500</div>
          </div>
          <div>
            <Label className="text-[hsl(45,15%,60%)] text-xs uppercase tracking-wider">Avatar URL</Label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              maxLength={500}
              className="mt-1 bg-[hsl(225,25%,12%)] border-[hsl(43,60%,30%)]/25 text-[hsl(45,30%,90%)] placeholder:text-[hsl(45,15%,30%)]"
              placeholder="https://... (or upload via Puter Cloud)"
            />
            {avatarUrl && (
              <img src={avatarUrl} alt="Preview" className="w-12 h-12 rounded-lg mt-2 object-cover ring-1 ring-[hsl(43,60%,30%)]/30"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={profileMutation.isPending}
            className="gilded-button"
          >
            {profileMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
          {profileMutation.isSuccess && (
            <span className="text-xs text-[hsl(120,60%,60%)] ml-3">✓ Saved</span>
          )}
          {profileMutation.isError && (
            <span className="text-xs text-[hsl(0,70%,60%)] ml-3">{(profileMutation.error as Error).message}</span>
          )}
        </div>
      </section>

      {/* Cross-game play settings */}
      <section className="fantasy-panel p-6">
        <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-2" style={{ WebkitTextFillColor: "unset" }}>
          <Gamepad2 className="w-4 h-4 inline mr-2 text-[hsl(43,85%,55%)]" />
          Gameplay Settings
        </h3>
        <p className="text-xs text-[hsl(45,15%,55%)] font-body mb-4">
          Stored on your Grudge account — fleet games can hydrate via{" "}
          <code className="text-[hsl(43,85%,55%)]">GET /api/me/play-settings</code>.
        </p>
        {playQ.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-[hsl(45,15%,60%)] text-xs uppercase tracking-wider">Graphics quality</Label>
              <select
                className="mt-1 w-full h-10 rounded-md bg-[hsl(225,25%,12%)] border border-[hsl(43,60%,30%)]/25 text-sm px-2"
                value={play.graphics?.quality ?? "high"}
                onChange={(e) =>
                  setPlay((p) => ({ ...p, graphics: { ...p.graphics, quality: e.target.value } }))
                }
              >
                {["low", "medium", "high", "ultra"].map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[hsl(45,15%,60%)] text-xs uppercase tracking-wider">
                Mouse sensitivity ({(play.controls?.mouseSensitivity ?? 1).toFixed(1)})
              </Label>
              <input
                type="range"
                min={0.3}
                max={2.5}
                step={0.1}
                className="mt-3 w-full"
                value={play.controls?.mouseSensitivity ?? 1}
                onChange={(e) =>
                  setPlay((p) => ({
                    ...p,
                    controls: { ...p.controls, mouseSensitivity: parseFloat(e.target.value) },
                  }))
                }
              />
            </div>
            <div>
              <Label className="text-[hsl(45,15%,60%)] text-xs uppercase tracking-wider">
                Master volume ({Math.round((play.audio?.master ?? 0.8) * 100)}%)
              </Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                className="mt-3 w-full"
                value={play.audio?.master ?? 0.8}
                onChange={(e) =>
                  setPlay((p) => ({
                    ...p,
                    audio: { ...p.audio, master: parseFloat(e.target.value) },
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2 justify-end">
              <label className="flex items-center gap-2 text-sm text-[hsl(45,15%,70%)]">
                <input
                  type="checkbox"
                  checked={!!play.graphics?.shadows}
                  onChange={(e) =>
                    setPlay((p) => ({ ...p, graphics: { ...p.graphics, shadows: e.target.checked } }))
                  }
                />
                Shadows
              </label>
              <label className="flex items-center gap-2 text-sm text-[hsl(45,15%,70%)]">
                <input
                  type="checkbox"
                  checked={!!play.controls?.mouseInvertY}
                  onChange={(e) =>
                    setPlay((p) => ({
                      ...p,
                      controls: { ...p.controls, mouseInvertY: e.target.checked },
                    }))
                  }
                />
                Invert mouse Y
              </label>
              <label className="flex items-center gap-2 text-sm text-[hsl(45,15%,70%)]">
                <input
                  type="checkbox"
                  checked={!!play.accessibility?.reduceMotion}
                  onChange={(e) =>
                    setPlay((p) => ({
                      ...p,
                      accessibility: { ...p.accessibility, reduceMotion: e.target.checked },
                    }))
                  }
                />
                Reduce motion
              </label>
            </div>
            <div className="sm:col-span-2">
              <Button
                className="gilded-button"
                disabled={playMutation.isPending}
                onClick={() => playMutation.mutate(play)}
              >
                {playMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save gameplay settings
              </Button>
              {playMutation.isSuccess && (
                <span className="text-xs text-[hsl(120,60%,60%)] ml-3">✓ Saved to account</span>
              )}
              {playMutation.isError && (
                <span className="text-xs text-[hsl(0,70%,60%)] ml-3">
                  {(playMutation.error as Error).message}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Connected Accounts — based on GrudgeBuilder connector list + WCS connector section */}
      <section className="fantasy-panel p-5">
        <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-4" style={{ WebkitTextFillColor: "unset" }}>
          Connected Accounts
        </h3>
        {connectionsQuery.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(43,85%,55%)]" />
        ) : (
          <div className="space-y-2">
            {PROVIDERS.map((p) => {
              const value = conn?.[p.key as keyof Connections] as string | null;
              const connected = !!value;
              return (
                <div key={p.key} className="flex items-center justify-between p-3 rounded border border-[hsl(43,60%,30%)]/12 bg-black/15">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{p.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-[hsl(45,30%,90%)]">{p.label}</div>
                      <div className={`text-[10px] font-body ${connected ? "text-[hsl(120,60%,60%)]" : "text-[hsl(45,15%,40%)]"}`}>
                        {connected ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" />
                            {typeof value === "string" && value.length > 20 ? value.slice(0, 12) + "…" : value || "Connected"}
                          </span>
                        ) : "Not connected"}
                      </div>
                    </div>
                  </div>
                  {p.linkable && !connected && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-[hsl(43,60%,30%)]/30 text-[hsl(43,85%,55%)] h-7"
                      onClick={() => handleConnect(p.key)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Account Info */}
      <section className="fantasy-panel p-5">
        <h3 className="font-heading text-base text-[hsl(45,30%,92%)] mb-3" style={{ WebkitTextFillColor: "unset" }}>
          Account Info
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[10px] text-[hsl(45,15%,50%)] uppercase tracking-wider font-body">Username</div>
            <div className="text-[hsl(45,30%,90%)]">@{player.username}</div>
          </div>
          <div>
            <div className="text-[10px] text-[hsl(45,15%,50%)] uppercase tracking-wider font-body">Role</div>
            <div className="text-[hsl(45,30%,90%)] capitalize">{player.role}</div>
          </div>
          <div>
            <div className="text-[10px] text-[hsl(45,15%,50%)] uppercase tracking-wider font-body">Member Since</div>
            <div className="text-[hsl(45,30%,90%)]">{player.createdAt ? new Date(player.createdAt).toLocaleDateString() : "—"}</div>
          </div>
          <div>
            <div className="text-[10px] text-[hsl(45,15%,50%)] uppercase tracking-wider font-body">Grudge ID</div>
            <div className="text-[hsl(43,85%,55%)] font-mono text-xs">{player.grudgeId}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
