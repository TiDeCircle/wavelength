import type { BetSide } from "@/types/game";

/**
 * Scoring band half-widths, from the target outwards.
 *
 *      2  |  3  |  4  |  3  |  2
 *   -12.5 -7.5  -2.5  +2.5  +7.5  +12.5
 *                  ^ target
 */
export const BAND_EDGES = [2.5, 7.5, 12.5] as const;
export const BAND_POINTS = [4, 3, 2] as const;

/** Total width of the scoring band, used to keep targets away from the rim. */
export const BAND_HALF_WIDTH = BAND_EDGES[BAND_EDGES.length - 1];

/** Points for the guessing team: 4, 3, 2 or 0. */
export function scoreGuess(guess: number, target: number): number {
  const d = Math.abs(guess - target);
  for (let i = 0; i < BAND_EDGES.length; i++) {
    if (d <= BAND_EDGES[i]) return BAND_POINTS[i];
  }
  return 0;
}

/** Which side of the guess the target actually fell on. `null` on an exact hit. */
export function actualSide(guess: number, target: number): BetSide | null {
  if (target < guess) return "left";
  if (target > guess) return "right";
  return null;
}

/**
 * Points for the opposing team's left-right bet.
 *
 * A bullseye (4 points) leaves no side to bet on, so the bet scores nothing.
 */
export function scoreBet(
  guess: number,
  target: number,
  bet: BetSide | null,
): number {
  if (bet === null) return 0;
  if (scoreGuess(guess, target) === 4) return 0;
  return bet === actualSide(guess, target) ? 1 : 0;
}

/**
 * The five scoring wedges as `[from, to, points]` triples in dial units,
 * clamped to the dial. Used to draw the band and nothing else.
 */
export function bandSegments(
  target: number,
): { from: number; to: number; points: number }[] {
  const segments: { from: number; to: number; points: number }[] = [];
  const edges = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
  const points = [2, 3, 4, 3, 2];
  for (let i = 0; i < points.length; i++) {
    segments.push({
      from: Math.max(0, target + edges[i]),
      to: Math.min(100, target + edges[i + 1]),
      points: points[i],
    });
  }
  return segments.filter((s) => s.to > s.from);
}
