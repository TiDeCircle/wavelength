/**
 * Shared game types.
 *
 * These describe the game only — nothing here is specific to local (hotseat)
 * or online play. The online mode in the next phase reuses this file as-is,
 * with the server owning `GameState` instead of a React context.
 */

/** A pair of opposing concepts. `left` sits at dial 0, `right` at dial 100. */
export interface SpectrumCard {
  id: string;
  left: string;
  right: string;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
}

export interface Team {
  id: string;
  name: string;
  score: number;
  /** Index into this team's players — drives psychic round-robin. */
  psychicIndex: number;
}

/** Which side of the guess the opposing team bets the target is on. */
export type BetSide = "left" | "right";

export interface RoundScores {
  /** Points for the guessing team (4 / 3 / 2 / 0). */
  guess: number;
  /** Points for the opposing team's left-right bet (1 / 0). */
  bet: number;
  /** Team that earned `guess` points. */
  guessTeamId: string;
  /** Team that earned `bet` points. `null` in co-op mode. */
  betTeamId: string | null;
}

export interface Round {
  number: number;
  cardId: string;
  psychicId: string;
  /** Team the psychic belongs to — the team that gets to guess. */
  guessTeamId: string;
  /** Team making the left-right bet. `null` in co-op mode. */
  betTeamId: string | null;
  /**
   * Hidden dial position, 0-100.
   *
   * SECURITY (online phase): this field must never be serialized into a
   * payload broadcast to the whole room before the `reveal` phase. See
   * `src/lib/game/redact.ts` when that phase lands.
   */
  target: number;
  clue: string;
  /** Current needle position of the guessing team, 0-100. */
  guess: number;
  guessLocked: boolean;
  bet: BetSide | null;
  scores: RoundScores | null;
}

export type Phase =
  /** "Hand the device to <psychic>" gate. Nothing secret is on screen. */
  | "pass"
  /** Psychic sees the target and writes a clue. */
  | "psychic"
  /** Team drags the dial. Target is not rendered. */
  | "guess"
  /** Opposing team bets left or right. Target is not rendered. */
  | "bet"
  /** Target revealed, points shown. */
  | "reveal"
  /** Running totals between rounds. */
  | "scoreboard"
  /** A team hit the target score. */
  | "gameover";

export interface GameConfig {
  /** Points needed to win. */
  targetScore: number;
  /** Seconds the team gets to discuss, or `null` for no timer. */
  discussionSeconds: number | null;
  /** Left-right bet enabled. Always off in co-op mode. */
  leftRightBet: boolean;
  /** Co-op only: rounds available to reach `targetScore`. */
  coopRounds: number;
}

export interface GameState {
  config: GameConfig;
  players: Player[];
  teams: Team[];
  /** True when there is only one team (2-3 players). No bet phase. */
  coop: boolean;
  phase: Phase;
  round: Round | null;
  /** Cards already played this game, so the deck does not repeat. */
  usedCardIds: string[];
  winningTeamId: string | null;
}

/** Card id + target for an upcoming round. Supplied by the caller so the
 *  reducer stays pure — in online mode the server generates this instead. */
export interface RoundSeed {
  cardId: string;
  target: number;
}
