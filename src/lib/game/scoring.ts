import { SHARED_DIAL_KEY } from "@/types/game";

/**
 * Scoring band half-widths, from the target outwards.
 *
 *      2  |  3  |  4  |  3  |  2
 *   -12.5 -7.5  -2.5  +2.5  +7.5  +12.5
 *                  ^ target
 */
export const BAND_EDGES = [2.5, 7.5, 12.5] as const;
export const BAND_POINTS = [4, 3, 2] as const;

/** Total half-width of the band, used to keep targets away from the rim. */
export const BAND_HALF_WIDTH = BAND_EDGES[BAND_EDGES.length - 1];

/** Points for one dial: 4, 3, 2 or 0. */
export function scoreGuess(guess: number, target: number): number {
  const d = Math.abs(guess - target);
  for (let i = 0; i < BAND_EDGES.length; i++) {
    if (d <= BAND_EDGES[i]) return BAND_POINTS[i];
  }
  return 0;
}

/**
 * Points for everyone this round.
 *
 * Shared dial: one entry, the group's. Individual dials: one entry per
 * guesser plus the chooser, who earns the rounded average of what their
 * subject got everyone else — a subject nobody can place scores nothing.
 * The chooser's own dial, if present, is ignored when computing the average.
 */
export function scoreRound(
  guesses: Record<string, number>,
  target: number,
  chooserId: string,
  sharedDial: boolean,
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [key, value] of Object.entries(guesses)) {
    scores[key] = scoreGuess(value, target);
  }
  if (sharedDial) return scores;

  const earned = Object.entries(scores)
    .filter(([key]) => key !== chooserId)
    .map(([, score]) => score);
  const average =
    earned.length === 0
      ? 0
      : Math.round(earned.reduce((sum, n) => sum + n, 0) / earned.length);
  scores[chooserId] = average;
  return scores;
}

/**
 * The five scoring wedges as dial ranges, clamped to the dial. Used only for
 * drawing the band.
 */
export function bandSegments(
  target: number,
): { from: number; to: number; points: number }[] {
  const edges = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
  const points = [2, 3, 4, 3, 2];
  return points
    .map((p, i) => ({
      from: Math.max(0, target + edges[i]),
      to: Math.min(100, target + edges[i + 1]),
      points: p,
    }))
    .filter((s) => s.to > s.from);
}

/** Re-exported so callers do not need two imports to key a shared guess. */
export { SHARED_DIAL_KEY };
