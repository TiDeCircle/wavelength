import type { Player } from "@/types/game";

/**
 * Who chooses this round.
 *
 * Straight round-robin over join order — with no teams there is nothing to
 * alternate between.
 *
 * @param roundNumber 1-based.
 */
export function chooserForRound(players: Player[], roundNumber: number): string {
  return players[(roundNumber - 1) % players.length].id;
}
