import { GameTerminal } from "@/components/game-terminal";

/**
 * /super-engine — unified Grudge game terminal.
 * Single viewport: catalog sidebar + one iframe player for the full fleet.
 */
export default function SuperEngine() {
  return <GameTerminal defaultGameId="threeflow" />;
}