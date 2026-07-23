/**
 * Shared game types.
 *
 * Nothing here is specific to local or online play — the server runs the same
 * reducer over the same state that a React context does locally.
 */

/** Key that shared-dial (local) play stores its single guess under. */
export const SHARED_DIAL_KEY = "__shared__";

/** A category plus the spectrum its subjects are placed on. */
export interface TopicCard {
  /** Deck id, used to avoid repeats. `null` when the chooser wrote it. */
  id: string | null;
  /** The bucket subjects must come from, e.g. "Movie". */
  category: string;
  /** Sits at dial 0. */
  left: string;
  /** Sits at dial 100. */
  right: string;
  custom: boolean;
}

export interface Player {
  id: string;
  name: string;
  /** Individual score. Unused while `config.sharedDial` is on. */
  score: number;
}

export interface Round {
  number: number;
  /** Player who picks the card and names the subject this round. */
  chooserId: string;
  /** null until the chooser confirms a card. */
  card: TopicCard | null;
  /**
   * Hidden dial position, 0-100.
   *
   * SECURITY: never serialize this into a payload broadcast to a whole room
   * before the reveal phase. See `src/server/redact.ts`.
   */
  target: number;
  /** What the chooser named. "" until submitted. */
  subject: string;
  /** Keyed by player id online, by `SHARED_DIAL_KEY` locally. */
  guesses: Record<string, number>;
  /** Same keys as `guesses`. */
  locked: Record<string, boolean>;
  /** Points earned this round, same keys plus the chooser. null until reveal. */
  scores: Record<string, number> | null;
}

export type Phase =
  /** Local only: "hand the device to <chooser>". */
  | "pass"
  /** Chooser picks random or custom card. */
  | "topic"
  /** Chooser sees the target and names a subject. */
  | "subject"
  /** Everyone else places the dial. */
  | "guess"
  /** Target and every dial revealed together. */
  | "reveal"
  /** Running totals between rounds. */
  | "scoreboard"
  /** All configured rounds played. */
  | "gameover";

export interface GameConfig {
  /** Total rounds in the game. */
  rounds: number;
  /** Seconds to guess, or null for no clock. */
  discussionSeconds: number | null;
  /** One dial and one group score, for a device passed around a table. */
  sharedDial: boolean;
}

export interface GameState {
  config: GameConfig;
  players: Player[];
  phase: Phase;
  round: Round | null;
  /** Cumulative score when `config.sharedDial` is on. */
  groupScore: number;
  /** Deck ids already confirmed this game. Rerolls do not count. */
  usedCardIds: string[];
}
