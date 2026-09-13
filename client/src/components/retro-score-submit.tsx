/**
 * Manual score submit for Rec0deD emulator plays (EmulatorJS does not auto-report scores).
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, LogIn, Trophy } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useAuthModal } from "@/components/auth-modal";
import { submitScore, startScoreListener, fetchLeaderboard } from "@/lib/engine-sdk";
import { getCompetitiveMeta } from "@/data/retroCompetitive";

interface LbRow {
  score: number;
  username?: string;
  displayName?: string | null;
  isGlobalRecord?: boolean;
}

export function RetroScoreSubmit({ gameId, gameTitle }: { gameId: number; gameTitle: string }) {
  const { player } = useAuth();
  const { open: openAuth } = useAuthModal();
  const qc = useQueryClient();
  const meta = getCompetitiveMeta(gameId);
  const [score, setScore] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const boardQ = useQuery<LbRow[]>({
    queryKey: ["/api/leaderboards", gameId, "mini"],
    queryFn: () => fetchLeaderboard(gameId, 5),
    staleTime: 15_000,
  });

  useEffect(() => {
    const stop = startScoreListener(gameId, (data) => {
      setStatus(
        data.isGlobalRecord
          ? `World record! ${data.score.toLocaleString()}`
          : data.isPersonalBest
            ? `Personal best! ${data.score.toLocaleString()}`
            : `Score ${data.score.toLocaleString()} submitted`,
      );
      qc.invalidateQueries({ queryKey: ["/api/leaderboards", gameId] });
      boardQ.refetch();
    });
    return () => {
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const onSubmit = async () => {
    setStatus(null);
    const n = parseInt(score.replace(/[,\s]/g, ""), 10);
    if (!Number.isFinite(n) || n < 0) {
      setStatus("Enter a valid non-negative score.");
      return;
    }
    if (!player) {
      openAuth({
        redirectTo: `/play/${gameId}`,
        initialTab: "signin",
        reason: "Sign in to post scores to Rec0deD leaderboards.",
      });
      return;
    }
    setPending(true);
    try {
      const result = await submitScore(gameId, n);
      if (!result) {
        setStatus("Submit failed — check sign-in and try again.");
        return;
      }
      setStatus(
        result.isGlobalRecord
          ? `World record! ${n.toLocaleString()}`
          : result.isPersonalBest
            ? `Personal best! ${n.toLocaleString()}`
            : `Score ${n.toLocaleString()} recorded`,
      );
      setScore("");
      qc.invalidateQueries({ queryKey: ["/api/leaderboards"] });
      qc.invalidateQueries({ queryKey: ["/api/me/scores"] });
      boardQ.refetch();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fantasy-panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3
          className="text-sm font-heading text-[hsl(43,85%,55%)] uppercase tracking-wider"
          style={{ WebkitTextFillColor: "unset" }}
        >
          <Trophy className="w-4 h-4 inline mr-1" />
          Score · Leaderboard
        </h3>
        {meta && (
          <div className="flex gap-1">
            {meta.modes.map((m) => (
              <Badge key={m} variant="outline" className="text-[9px] uppercase">
                {m}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-[hsl(45,15%,60%)] font-body">
        {meta?.scoreHint ||
          `Play ${gameTitle}, then enter your score. Emulators do not auto-upload — manual submit is required for Rec0deD boards.`}
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[8rem]">
          <label className="text-[10px] text-[hsl(45,15%,55%)] font-body">Your score</label>
          <Input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="e.g. 125000"
            inputMode="numeric"
            className="border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]"
          />
        </div>
        {player ? (
          <Button className="gilded-button" onClick={onSubmit} disabled={pending}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
          </Button>
        ) : (
          <Button
            className="gilded-button"
            onClick={() =>
              openAuth({
                redirectTo: `/play/${gameId}`,
                initialTab: "signin",
                reason: "Sign in to submit Rec0deD scores.",
              })
            }
          >
            <LogIn className="w-4 h-4 mr-1" /> Sign in to submit
          </Button>
        )}
        <Link href={`/leaderboards?game=${gameId}`}>
          <Button variant="outline" className="border-[hsl(43,60%,30%)]">
            Full board
          </Button>
        </Link>
        <Link href={`/pvp?game=${gameId}`}>
          <Button variant="outline" className="border-[hsl(0,50%,40%)] text-[hsl(0,70%,70%)]">
            Challenge
          </Button>
        </Link>
      </div>
      {status && <p className="text-sm text-[hsl(43,85%,55%)] font-body">{status}</p>}
      <div>
        <div className="text-[10px] uppercase text-[hsl(45,15%,50%)] mb-1">Top 5</div>
        {boardQ.isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[hsl(43,85%,55%)]" />
        ) : !boardQ.data?.length ? (
          <p className="text-xs text-[hsl(45,15%,55%)] font-body">No scores yet — be first.</p>
        ) : (
          <ol className="space-y-1">
            {boardQ.data.map((row, i) => (
              <li
                key={`${row.score}-${i}`}
                className="flex justify-between text-xs font-body border border-[hsl(43,60%,30%)]/15 rounded px-2 py-1"
              >
                <span className="truncate">
                  #{i + 1} {row.displayName || row.username || "Player"}
                  {row.isGlobalRecord ? " · WR" : ""}
                </span>
                <span className="font-heading text-[hsl(43,85%,55%)]">{row.score.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
