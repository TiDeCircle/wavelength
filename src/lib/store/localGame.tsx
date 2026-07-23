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
import type { GameConfig, GameState, Player, TopicCard } from "@/types/game";
import { SHARED_DIAL_KEY } from "@/types/game";
import { createGame, gameReducer, type GameAction } from "@/lib/game/reducer";
import { drawCard } from "@/lib/cards";
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

const STORAGE_KEY = "wavelength:local:v2";

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

/** The random pick lives outside game state — a reroll must not be a game event. */
function pickCard(state: GameState | null): TopicCard {
  return drawCard(state?.usedCardIds ?? []);
}

interface LocalGameContextValue {
  state: GameState | null;
  /** False until localStorage has been read — render a placeholder till then. */
  ready: boolean;
  /** The card currently offered by the random picker. */
  randomCard: TopicCard;
  startGame: (players: Player[], config: GameConfig) => void;
  confirmChooser: () => void;
  reroll: () => void;
  setCard: (card: TopicCard) => void;
  submitSubject: (subject: string) => void;
  setGuess: (value: number) => void;
  lockGuess: () => void;
  reveal: () => void;
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
  const [randomCard, setRandomCard] = useState<TopicCard>(() => drawCard([]));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const restoredState = JSON.parse(raw) as GameState;
        dispatch({ type: "RESTORE", state: restoredState });
        setRandomCard(drawCard(restoredState.usedCardIds));
      }
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
    (players: Player[], config: GameConfig) => {
      dispatch({
        type: "RESTORE",
        state: createGame(players, config, randomTarget()),
      });
      setRandomCard(drawCard([]));
    },
    [],
  );

  const value = useMemo<LocalGameContextValue>(
    () => ({
      state,
      ready,
      randomCard,
      startGame,
      confirmChooser: () => dispatch({ type: "CONFIRM_CHOOSER" }),
      reroll: () => {
        const exclusions: string[] = [...(state?.usedCardIds ?? [])];
        if (randomCard.id) {
          exclusions.push(randomCard.id);
        }
        setRandomCard(drawCard(exclusions));
      },
      setCard: (card) => dispatch({ type: "SET_CARD", card }),
      submitSubject: (subject) => dispatch({ type: "SUBMIT_SUBJECT", subject }),
      setGuess: (value) =>
        dispatch({ type: "SET_GUESS", key: SHARED_DIAL_KEY, value }),
      lockGuess: () => {
        dispatch({ type: "LOCK_GUESS", key: SHARED_DIAL_KEY });
        dispatch({ type: "REVEAL" });
      },
      reveal: () => dispatch({ type: "REVEAL" }),
      showScoreboard: () => dispatch({ type: "SHOW_SCOREBOARD" }),
      nextRound: () => {
        dispatch({ type: "NEXT_ROUND", target: randomTarget() });
        setRandomCard(pickCard(state));
      },
      rematch: () => {
        dispatch({ type: "REMATCH", target: randomTarget() });
        setRandomCard(drawCard([]));
      },
      clear: () => dispatch({ type: "CLEAR" }),
    }),
    [state, ready, randomCard, startGame],
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
