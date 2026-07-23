"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type {
  BetSide,
  GameConfig,
  GameState,
  Player,
  RoundSeed,
  SpectrumCard,
  Team,
} from "@/types/game";
import { createGame, gameReducer, type GameAction } from "@/lib/game/reducer";
import { drawCardId, getCard } from "@/lib/cards";
import { randomTarget } from "@/lib/game/target";

/**
 * Local (hotseat) game store.
 *
 * The state machine itself lives in `lib/game/reducer.ts` and knows nothing
 * about React. This file only adds the three things a local game needs on top
 * of it: a React context, the randomness for each round, and localStorage
 * persistence so a refresh mid-game is survivable.
 *
 * The online mode gets a sibling store with the same public shape, backed by a
 * socket instead of `useReducer` — components consume the context, not this
 * file, so they carry over unchanged.
 */

const STORAGE_KEY = "wavelength:local:v1";

type RootAction = GameAction | { type: "CLEAR" };

function rootReducer(
  state: GameState | null,
  action: RootAction,
): GameState | null {
  if (action.type === "CLEAR") return null;
  if (action.type === "RESTORE") return action.state;
  if (!state) return null;
  return gameReducer(state, action);
}

function nextSeed(usedCardIds: string[]): RoundSeed {
  return { cardId: drawCardId(usedCardIds), target: randomTarget() };
}

interface LocalGameContextValue {
  state: GameState | null;
  /** False until localStorage has been read — render a placeholder till then. */
  ready: boolean;
  startGame: (players: Player[], teams: Team[], config: GameConfig) => void;
  confirmPsychic: () => void;
  submitClue: (clue: string) => void;
  setGuess: (value: number) => void;
  lockGuess: () => void;
  setBet: (side: BetSide) => void;
  lockBet: () => void;
  showScoreboard: () => void;
  nextRound: () => void;
  rematch: () => void;
  clear: () => void;
}

const LocalGameContext = createContext<LocalGameContextValue | null>(null);

export function LocalGameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(rootReducer, null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "RESTORE", state: JSON.parse(raw) as GameState });
    } catch {
      // Corrupt or unavailable storage just means starting fresh.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      if (state) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Persistence is a convenience; never let it break the game.
    }
  }, [state, ready]);

  const startGame = useCallback(
    (players: Player[], teams: Team[], config: GameConfig) => {
      dispatch({
        type: "RESTORE",
        state: createGame(players, teams, config, nextSeed([])),
      });
    },
    [],
  );

  const value = useMemo<LocalGameContextValue>(
    () => ({
      state,
      ready,
      startGame,
      confirmPsychic: () => dispatch({ type: "CONFIRM_PSYCHIC" }),
      submitClue: (clue) => dispatch({ type: "SUBMIT_CLUE", clue }),
      setGuess: (value) => dispatch({ type: "SET_GUESS", value }),
      lockGuess: () => dispatch({ type: "LOCK_GUESS" }),
      setBet: (side) => dispatch({ type: "SET_BET", side }),
      lockBet: () => dispatch({ type: "LOCK_BET" }),
      showScoreboard: () => dispatch({ type: "SHOW_SCOREBOARD" }),
      nextRound: () =>
        dispatch({ type: "NEXT_ROUND", seed: nextSeed(state?.usedCardIds ?? []) }),
      rematch: () => dispatch({ type: "REMATCH", seed: nextSeed([]) }),
      clear: () => dispatch({ type: "CLEAR" }),
    }),
    [state, ready, startGame],
  );

  return (
    <LocalGameContext.Provider value={value}>
      {children}
    </LocalGameContext.Provider>
  );
}

export function useLocalGame(): LocalGameContextValue {
  const ctx = useContext(LocalGameContext);
  if (!ctx) throw new Error("useLocalGame must be used inside <LocalGameProvider>");
  return ctx;
}

/** Convenience selectors — these read only from state, so they port to online. */

export function useCurrentCard(): SpectrumCard | null {
  const { state } = useLocalGame();
  return state?.round ? getCard(state.round.cardId) : null;
}

export function usePlayer(id: string | undefined): Player | null {
  const { state } = useLocalGame();
  if (!id) return null;
  return state?.players.find((p) => p.id === id) ?? null;
}

export function useTeam(id: string | null | undefined): Team | null {
  const { state } = useLocalGame();
  if (!id) return null;
  return state?.teams.find((t) => t.id === id) ?? null;
}
