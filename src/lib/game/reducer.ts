import type {
  GameConfig,
  GameState,
  Player,
  Round,
  TopicCard,
} from "@/types/game";
import { SHARED_DIAL_KEY } from "@/types/game";
import { chooserForRound } from "./rotation";
import { scoreRound } from "./scoring";

/**
 * The whole game as one pure reducer.
 *
 * Local play drives it from a React context; the server runs this exact
 * function and broadcasts the result minus the target. Keep it free of React,
 * timers, randomness and I/O — each round's target arrives in the action.
 */

export type GameAction =
  /** Pass screen: the named chooser has the device. Local only. */
  | { type: "CONFIRM_CHOOSER" }
  | { type: "SET_CARD"; card: TopicCard }
  | { type: "SUBMIT_SUBJECT"; subject: string }
  | { type: "SET_GUESS"; key: string; value: number }
  | { type: "LOCK_GUESS"; key: string }
  | { type: "REVEAL" }
  | { type: "SHOW_SCOREBOARD" }
  | { type: "NEXT_ROUND"; target: number }
  | { type: "REMATCH"; target: number }
  /** Bin the round and redeal it to the next chooser. Nobody scores. */
  | { type: "ABORT_ROUND"; target: number }
  | { type: "RESTORE"; state: GameState };

export const DEFAULT_CONFIG: GameConfig = {
  rounds: 10,
  discussionSeconds: 90,
  sharedDial: false,
};

function buildRound(
  players: Player[],
  roundNumber: number,
  target: number,
): Round {
  return {
    number: roundNumber,
    chooserId: chooserForRound(players, roundNumber),
    card: null,
    target,
    subject: "",
    guesses: {},
    locked: {},
    scores: null,
  };
}

/** Build a fresh game at round 1. Called by the store and by the server. */
export function createGame(
  players: Player[],
  config: GameConfig,
  target: number,
): GameState {
  return {
    config,
    players: players.map((p) => ({ ...p, score: 0 })),
    phase: "pass",
    round: buildRound(players, 1, target),
    groupScore: 0,
    usedCardIds: [],
  };
}

/** Everyone who is allowed a dial this round. */
function guessKeys(state: GameState): string[] {
  if (state.config.sharedDial) return [SHARED_DIAL_KEY];
  return state.players
    .filter((p) => p.id !== state.round?.chooserId)
    .map((p) => p.id);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "RESTORE":
      return action.state;

    case "CONFIRM_CHOOSER":
      if (state.phase !== "pass") return state;
      return { ...state, phase: "topic" };

    case "SET_CARD": {
      if (state.phase !== "topic" || !state.round) return state;
      const { card } = action;
      if (!card.category.trim() || !card.left.trim() || !card.right.trim()) {
        return state;
      }
      return {
        ...state,
        phase: "subject",
        round: { ...state.round, card },
        usedCardIds:
          card.id && !state.usedCardIds.includes(card.id)
            ? [...state.usedCardIds, card.id]
            : state.usedCardIds,
      };
    }

    case "SUBMIT_SUBJECT": {
      if (state.phase !== "subject" || !state.round) return state;
      const subject = action.subject.trim();
      if (!subject) return state;
      return { ...state, phase: "guess", round: { ...state.round, subject } };
    }

    case "SET_GUESS": {
      if (state.phase !== "guess" || !state.round) return state;
      if (state.round.locked[action.key]) return state;
      const value = Math.min(100, Math.max(0, action.value));
      return {
        ...state,
        round: {
          ...state.round,
          guesses: { ...state.round.guesses, [action.key]: value },
        },
      };
    }

    case "LOCK_GUESS": {
      if (state.phase !== "guess" || !state.round) return state;
      return {
        ...state,
        round: {
          ...state.round,
          locked: { ...state.round.locked, [action.key]: true },
        },
      };
    }

    case "REVEAL": {
      if (state.phase !== "guess" || !state.round) return state;
      const round = state.round;

      // A dial nobody touched still counts, from where it started.
      const guesses: Record<string, number> = {};
      for (const key of guessKeys(state)) {
        guesses[key] = round.guesses[key] ?? 50;
      }

      const scores = scoreRound(
        guesses,
        round.target,
        round.chooserId,
        state.config.sharedDial,
      );

      if (state.config.sharedDial) {
        return {
          ...state,
          phase: "reveal",
          groupScore: state.groupScore + (scores[SHARED_DIAL_KEY] ?? 0),
          round: { ...round, guesses, scores },
        };
      }

      return {
        ...state,
        phase: "reveal",
        players: state.players.map((p) => ({
          ...p,
          score: p.score + (scores[p.id] ?? 0),
        })),
        round: { ...round, guesses, scores },
      };
    }

    case "SHOW_SCOREBOARD": {
      if (state.phase !== "reveal" || !state.round) return state;
      const over = state.round.number >= state.config.rounds;
      return { ...state, phase: over ? "gameover" : "scoreboard" };
    }

    case "NEXT_ROUND": {
      if (state.phase !== "scoreboard" || !state.round) return state;
      return {
        ...state,
        phase: "pass",
        round: buildRound(state.players, state.round.number + 1, action.target),
      };
    }

    case "ABORT_ROUND": {
      if (!state.round || state.phase === "gameover") return state;
      // Same round number, next person in the roster takes it over.
      const rotated = [...state.players.slice(1), state.players[0]];
      return {
        ...state,
        players: rotated,
        phase: "pass",
        round: buildRound(rotated, state.round.number, action.target),
      };
    }

    case "REMATCH":
      return createGame(state.players, state.config, action.target);

    default:
      return state;
  }
}
