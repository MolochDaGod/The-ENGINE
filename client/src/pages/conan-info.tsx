/**
 * Grudge Exiles — public Conan Exiles server info
 * conan.grudge-studio.com (community landing; admin stays on admin.conan4869.com)
 */

import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Copy, ExternalLink, MessageCircle, Server, Shield, Swords, Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SERVER_NAME = "Grudge Exiles";
/** Update when VPS is live — Conan default query port is often 27015 */
const CONNECT_HOST = "conan.grudge-studio.com";
const GAME_PORT = "7777";
const QUERY_PORT = "27015";
const DISCORD_INVITE = "https://discord.gg/grudgewarlords";

const RULES = [
  "No griefing bases you are not at war with.",
  "Respect clan alliances and server events.",
  "No hate speech or harassment — instant ban.",
  "Report exploits to staff; do not abuse bugs.",
  "Admin decisions are final.",
];

export default function ConanInfoPage() {
  const { toast } = useToast();

  function copyConnect() {
    const text = `${CONNECT_HOST}:${GAME_PORT}`;
    void navigator.clipboard.writeText(text);
    toast({ title: "Copied connect string", description: text });
  }
  const isDedicatedHost =
    typeof window !== "undefined" &&
    window.location.hostname === "conan.grudge-studio.com";

  return (
    <div
      className="min-h-screen text-[hsl(45,30%,92%)]"
      style={{ background: "linear-gradient(180deg, hsl(225,30%,6%), hsl(20,35%,10%))" }}
    >
      <div
        className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "url(/assets/games/conan-exiles-card.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-10 sm:py-14">
        {!isDedicatedHost && (
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 text-[hsl(45,15%,60%)]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Grudge Studio
            </Button>
          </Link>
        )}

        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge className="bg-[hsl(20,70%,45%)]/20 text-[hsl(20,80%,65%)] border-[hsl(20,60%,35%)]/40">
              Conan Exiles
            </Badge>
            <Badge variant="outline" className="border-[hsl(43,60%,30%)]/40 text-[hsl(45,15%,55%)]">
              PvPvE · Community
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading text-[hsl(43,85%,55%)] flex items-center gap-3">
            <Swords className="w-8 h-8 shrink-0" />
            {SERVER_NAME}
          </h1>
          <p className="mt-3 text-[hsl(45,15%,70%)] leading-relaxed max-w-2xl">
            Official Grudge Studio Conan Exiles dedicated server — build, raid, and survive on the GRUDGEYONKO VPS.
            This page is the public info hub; server operators use the separate admin console.
          </p>
        </header>

        <section className="rounded-xl border border-[hsl(43,60%,30%)]/30 bg-[hsl(225,25%,8%)]/90 p-6 mb-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(43,85%,55%)] flex items-center gap-2">
            <Server size={16} /> How to connect
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-[hsl(43,60%,30%)]/20 p-4">
              <div className="text-[hsl(45,15%,50%)] text-xs mb-1">Direct connect</div>
              <code className="text-[hsl(43,85%,55%)] font-mono text-base">
                {CONNECT_HOST}:{GAME_PORT}
              </code>
              <Button size="sm" variant="outline" className="mt-3 w-full border-[hsl(43,60%,30%)]/40" onClick={copyConnect}>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copy
              </Button>
            </div>
            <div className="rounded-lg border border-[hsl(43,60%,30%)]/20 p-4">
              <div className="text-[hsl(45,15%,50%)] text-xs mb-1">Steam / in-game</div>
              <p className="text-[hsl(45,15%,75%)] text-xs leading-relaxed">
                Conan Exiles → Play → Search <strong className="text-[hsl(45,30%,90%)]">{SERVER_NAME}</strong> in the community server list,
                or use Direct Connect with the host above.
              </p>
              <div className="text-[10px] text-[hsl(45,15%,45%)] mt-2">Query port: {QUERY_PORT}</div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[hsl(43,60%,30%)]/30 bg-[hsl(225,25%,8%)]/90 p-6 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(43,85%,55%)] flex items-center gap-2 mb-3">
            <Users size={16} /> Community
          </h2>
          <div className="flex flex-wrap gap-3">
            <a href={DISCORD_INVITE} target="_blank" rel="noreferrer">
              <Button className="bg-[hsl(235,60%,50%)] hover:bg-[hsl(235,60%,45%)]">
                <MessageCircle className="w-4 h-4 mr-2" /> Discord
              </Button>
            </a>
            <Link href="/pvp">
              <Button variant="outline" className="border-[hsl(43,60%,30%)]/40">
                Grudge PvP Portal
              </Button>
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-[hsl(43,60%,30%)]/30 bg-[hsl(225,25%,8%)]/90 p-6 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(43,85%,55%)] flex items-center gap-2 mb-3">
            <Shield size={16} /> Server rules
          </h2>
          <ul className="space-y-2 text-sm text-[hsl(45,15%,70%)]">
            {RULES.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-[hsl(43,85%,55%)]">•</span>
                {r}
              </li>
            ))}
          </ul>
        </section>

        <footer className="text-[10px] text-[hsl(45,15%,45%)] border-t border-[hsl(43,60%,30%)]/20 pt-4 flex flex-wrap gap-x-4 gap-y-2 justify-between">
          <span>Hosted on GRUDGEYONKO VPS · Grudge Studio</span>
          <a
            href="https://admin.conan4869.com/"
            target="_blank"
            rel="noreferrer"
            className="text-[hsl(45,15%,50%)] hover:text-[hsl(43,85%,55%)] inline-flex items-center gap-1"
          >
            Server admin <ExternalLink className="w-3 h-3" /> (staff only)
          </a>
        </footer>
      </div>
    </div>
  );
}