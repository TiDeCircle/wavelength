import type {
  BetSide,
  GameConfig,
  GameState,
  Player,
  Round,
  RoundSeed,
  Team,
} from "@/types/game";
import { advancePsychic, rolesForRound } from "./rotation";
import { scoreBet, scoreGuess } from "./scoring";

/**
 * The whole game as one pure reducer.
 *
 * Local mode drives it from a React context; in the online phase the server
 * runs this exact function and broadcasts the resulting state (minus the
 * target). Keep it free of React, timers, randomness and I/O — anything
 * random arrives through a `RoundSeed` in the action payload.
 */

export type GameAction =
  /** Pass screen: the named psychic has taken the device. */
  | { type: "CONFIRM_PSYCHIC" }
  | { type: "SUBMIT_CLUE"; clue: string }
  | { type: "SET_GUESS"; value: number }
  | { type: "LOCK_GUESS" }
  | { type: "SET_BET"; side: BetSide }
  | { type: "LOCK_BET" }
  | { type: "SHOW_SCOREBOARD" }
  | { type: "NEXT_ROUND"; seed: RoundSeed }
  | { type: "REMATCH"; seed: RoundSeed }
  /**
   * Throw the current round away and redeal it to the next psychic on the same
   * team. Nobody scores. Used online when the psychic drops out mid-round.
   */
  | { type: "ABORT_ROUND"; seed: RoundSeed }
  | { type: "RESTORE"; state: GameState };

export const DEFAULT_CONFIG: GameConfig = {
  targetScore: 10,
  discussionSeconds: 90,
  leftRightBet: true,
  coopRounds: 8,
};

function buildRound(
  state: Pick<GameState, "players" | "teams" | "coop" | "config">,
  roundNumber: number,
  seed: RoundSeed,
): Round {
  const roles = rolesForRound(state.players, state.teams, roundNumber);
  const wantsBet = !state.coop && state.config.leftRightBet;
  return {
    number: roundNumber,
    cardId: seed.cardId,
    psychicId: roles.psychicId,
    guessTeamId: roles.guessTeamId,
    betTeamId: wantsBet ? roles.betTeamId : null,
    target: seed.target,
    clue: "",
    guess: 50,
    guessLocked: false,
    bet: null,
    scores: null,
  };
}

/** Apply this round's points and move the psychic pointer along. */
function settle(state: GameState): GameState {
  const round = state.round;
  if (!round || round.scores) return state;

  const guessPoints = scoreGuess(round.guess, round.target);
  const betPoints = round.betTeamId
    ? scoreBet(round.guess, round.target, round.bet)
    : 0;

  const teams = advancePsychic(
    state.teams.map((t) => {
      if (t.id === round.guessTeamId) return { ...t, score: t.score + guessPoints };
      if (t.id === round.betTeamId) return { ...t, score: t.score + betPoints };
      return t;
    }),
    round.guessTeamId,
  );

  return {
    ...state,
    teams,
    phase: "reveal",
    round: {
      ...round,
      guessLocked: true,
      scores: {
        guess: guessPoints,
        bet: betPoints,
        guessTeamId: round.guessTeamId,
        betTeamId: round.betTeamId,
      },
    },
  };
}

/** Build a fresh game at round 1. Called by the store (and later the server). */
export function createGame(
  players: Player[],
  teams: Team[],
  config: GameConfig,
  seed: RoundSeed,
): GameState {
  const coop = teams.length < 2;
  const base = { players, teams, coop, config };
  return {
    config,
    players,
    teams,
    coop,
    phase: "pass",
    round: buildRound(base, 1, seed),
    usedCardIds: [seed.cardId],
    winningTeamId: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "RESTORE":
      return action.state;

    case "CONFIRM_PSYCHIC":
      if (state.phase !== "pass") return state;
      return { ...state, phase: "psychic" };

    case "SUBMIT_CLUE": {
      if (state.phase !== "psychic" || !state.round) return state;
      const clue = action.clue.trim();
      if (!clue) return state;
      return { ...state, phase: "guess", round: { ...state.round, clue } };
    }

    case "SET_GUESS": {
      if (state.phase !== "guess" || !state.round || state.round.guessLocked) {
        return state;
      }
      const value = Math.min(100, Math.max(0, action.value));
      return { ...state, round: { ...state.round, guess: value } };
    }

    case "LOCK_GUESS": {
      if (state.phase !== "guess" || !state.round) return state;
      const locked = { ...state.round, guessLocked: true };
      // No opposing team to bet: score straight away.
      if (!locked.betTeamId) return settle({ ...state, round: locked });
      return { ...state, phase: "bet", round: locked };
    }

    case "SET_BET":
      if (state.phase !== "bet" || !state.round) return state;
      return { ...state, round: { ...state.round, bet: action.side } };

    case "LOCK_BET":
      if (state.phase !== "bet" || !state.round || !state.round.bet) return state;
      return settle(state);

    case "SHOW_SCOREBOARD": {
      if (state.phase !== "reveal" || !state.round) return state;
      const winner =
        state.teams.find((t) => t.score >= state.config.targetScore) ?? null;
      const outOfRounds =
        state.coop && state.round.number >= state.config.coopRounds;

      if (winner || outOfRounds) {
        return { ...state, phase: "gameover", winningTeamId: winner?.id ?? null };
      }
      return { ...state, phase: "scoreboard" };
    }

    case "NEXT_ROUND": {
      if (state.phase !== "scoreboard" || !state.round) return state;
      return {
        ...state,
        phase: "pass",
        round: buildRound(state, state.round.number + 1, action.seed),
        usedCardIds: [...state.usedCardIds, action.seed.cardId],
      };
    }

    case "ABORT_ROUND": {
      if (!state.round || state.phase === "gameover") return state;
      const teams = advancePsychic(state.teams, state.round.guessTeamId);
      const next = { ...state, teams };
      return {
        ...next,
        phase: "pass",
        round: buildRound(next, state.round.number, action.seed),
        usedCardIds: [...state.usedCardIds, action.seed.cardId],
      };
    }

    case "REMATCH": {
      const teams = state.teams.map((t) => ({ ...t, score: 0, psychicIndex: 0 }));
      return createGame(state.players, teams, state.config, action.seed);
    }

    default:
      return state;
  }
}
