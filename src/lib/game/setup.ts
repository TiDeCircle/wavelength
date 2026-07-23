import type { Player } from "@/types/game";

/** One chooser plus one guesser. */
export const MIN_PLAYERS = 2;

/** Turn typed names into players, dropping blanks. */
export function buildPlayers(names: string[]): Player[] {
  return names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name, i) => ({ id: `p-${i}`, name, score: 0 }));
}

/**
 * True when the round count divides evenly among players, so everyone gets to
 * choose the same number of times. Only drives a warning — never blocks start.
 */
export function rotationIsEven(playerCount: number, rounds: number): boolean {
  return playerCount > 0 && rounds % playerCount === 0;
}
