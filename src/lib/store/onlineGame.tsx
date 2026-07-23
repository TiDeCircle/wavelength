"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BetSide, GameConfig } from "@/types/game";
import type { OnlineIdentity, PublicRoom, RoomPlayer } from "@/types/online";
import { getSocket } from "@/lib/socket/client";
import type { JoinResult } from "@/lib/socket/events";

/**
 * Online game store.
 *
 * Mirrors the shape of `localGame.tsx` on purpose: the views take plain props
 * either way, and only the page wiring differs. The important difference is
 * that this store owns no game rules — every action is an intent sent to the
 * server, and the state that comes back is the truth.
 *
 * The target is deliberately kept in its own slot (`privateTarget`) rather than
 * merged into room state, because it arrives on a different, psychic-only
 * channel and must be dropped the moment the round changes.
 */

const IDENTITY_KEY = "wavelength:online:v1";

type Status = "connecting" | "connected" | "disconnected";

interface OnlineGameContextValue {
  status: Status;
  room: PublicRoom | null;
  me: RoomPlayer | null;
  error: string | null;
  clearError: () => void;

  /** Needle position, including this client's own in-progress drag. */
  needle: number;
  /** Target this client is allowed to see, if any. */
  target: number | undefined;

  isHost: boolean;
  isPsychic: boolean;
  isGuessTeam: boolean;
  isBetTeam: boolean;
  canGuess: boolean;
  canBet: boolean;

  createRoom: (name: string) => Promise<JoinResult>;
  joinRoom: (code: string, name: string) => Promise<JoinResult>;
  rejoin: (code: string) => void;
  leaveRoom: () => void;

  setTeam: (playerId: string, teamId: string) => void;
  setConfig: (config: Partial<GameConfig>) => void;
  startGame: () => void;
  submitClue: (clue: string) => void;
  setGuess: (value: number) => void;
  lockGuess: () => void;
  setBet: (side: BetSide) => void;
  lockBet: () => void;
  showScoreboard: () => void;
  nextRound: () => void;
  rematch: () => void;
}

const OnlineGameContext = createContext<OnlineGameContextValue | null>(null);

function loadIdentity(): OnlineIdentity | null {
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as OnlineIdentity) : null;
  } catch {
    return null;
  }
}

function saveIdentity(identity: OnlineIdentity | null): void {
  try {
    if (identity) {
      window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    } else {
      window.localStorage.removeItem(IDENTITY_KEY);
    }
  } catch {
    // Losing the seat on refresh is survivable; crashing is not.
  }
}

export function OnlineGameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("connecting");
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needle, setNeedle] = useState(50);
  const [privateTarget, setPrivateTarget] = useState<{
    roundNumber: number;
    target: number;
  } | null>(null);

  const identity = useRef<OnlineIdentity | null>(null);

  useEffect(() => {
    identity.current = loadIdentity();
    const socket = getSocket();

    const onConnect = () => {
      setStatus("connected");
      // Reclaim the same seat after a drop instead of joining as a new player.
      const id = identity.current;
      if (id) {
        socket.emit(
          "room:join",
          { code: id.code, name: id.name, playerId: id.playerId },
          (result) => {
            if (!result.ok) {
              identity.current = null;
              saveIdentity(null);
              setError(result.error);
              return;
            }
            setRoom(result.room);
          },
        );
      }
    };

    const onDisconnect = () => setStatus("disconnected");
    const onState = (next: PublicRoom) => {
      setRoom(next);
      const guess = next.game?.round?.guess;
      if (typeof guess === "number") setNeedle(guess);
    };
    const onTarget = (payload: { roundNumber: number; target: number }) =>
      setPrivateTarget(payload);
    const onMoved = (payload: { value: number }) => setNeedle(payload.value);
    const onError = (payload: { message: string }) => setError(payload.message);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onState);
    socket.on("round:target", onTarget);
    socket.on("round:guessMoved", onMoved);
    socket.on("room:error", onError);
    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:state", onState);
      socket.off("round:target", onTarget);
      socket.off("round:guessMoved", onMoved);
      socket.off("room:error", onError);
    };
  }, []);

  const me = useMemo(
    () =>
      room?.players.find((p) => p.id === identity.current?.playerId) ?? null,
    [room],
  );

  const round = room?.game?.round ?? null;
  const phase = room?.game?.phase;

  /**
   * Team to judge this player by.
   *
   * Once a game starts the roster is frozen, and that roster is the authority
   * — not the lobby assignment. They differ in co-op, where the server folds
   * everyone onto one team while their lobby chips keep the side they were
   * auto-balanced onto. Reading the lobby value here left every co-op player
   * but the first unable to touch the dial.
   */
  const myTeamId =
    (me && room?.game?.players.find((p) => p.id === me.id)?.teamId) ??
    me?.teamId ??
    null;

  const isHost = Boolean(me && room && room.hostId === me.id);
  const isPsychic = Boolean(me && round && round.psychicId === me.id);
  const isGuessTeam = Boolean(round && myTeamId === round.guessTeamId);
  const isBetTeam = Boolean(round && myTeamId === round.betTeamId);
  // The psychic already knows the answer, so they never steer the needle.
  const canGuess = isGuessTeam && !isPsychic && phase === "guess";
  const canBet = isBetTeam && phase === "bet";

  /**
   * Two ways a target legitimately reaches this client: the public reveal that
   * everyone gets, or the private emit only the psychic receives. A stale
   * private target from an earlier round is ignored.
   */
  const target =
    round?.target ??
    (isPsychic && privateTarget && privateTarget.roundNumber === round?.number
      ? privateTarget.target
      : undefined);

  const emit = useCallback(getSocket, []);

  const enterRoom = useCallback(
    (result: JoinResult, code: string, name: string) => {
      if (!result.ok) {
        setError(result.error);
        return result;
      }
      identity.current = { code, playerId: result.playerId, name };
      saveIdentity(identity.current);
      setRoom(result.room);
      setError(null);
      return result;
    },
    [],
  );

  const createRoom = useCallback(
    (name: string) =>
      new Promise<JoinResult>((resolve) => {
        emit().emit("room:create", { name }, (result) => {
          resolve(
            enterRoom(result, result.ok ? result.room.code : "", name),
          );
        });
      }),
    [emit, enterRoom],
  );

  const joinRoom = useCallback(
    (code: string, name: string) =>
      new Promise<JoinResult>((resolve) => {
        const upper = code.trim().toUpperCase();
        emit().emit("room:join", { code: upper, name }, (result) => {
          resolve(enterRoom(result, upper, name));
        });
      }),
    [emit, enterRoom],
  );

  /** Re-enter a room the browser already has an identity for (refresh, deep link). */
  const rejoin = useCallback(
    (code: string) => {
      const id = identity.current;
      if (!id || id.code !== code.toUpperCase()) return;
      emit().emit(
        "room:join",
        { code: id.code, name: id.name, playerId: id.playerId },
        (result) => {
          if (result.ok) setRoom(result.room);
          else setError(result.error);
        },
      );
    },
    [emit],
  );

  const leaveRoom = useCallback(() => {
    emit().emit("room:leave");
    identity.current = null;
    saveIdentity(null);
    setRoom(null);
    setPrivateTarget(null);
  }, [emit]);

  const setGuess = useCallback(
    (value: number) => {
      setNeedle(value);
      emit().emit("round:guess", { value });
    },
    [emit],
  );

  const value = useMemo<OnlineGameContextValue>(
    () => ({
      status,
      room,
      me,
      error,
      clearError: () => setError(null),
      needle,
      target,
      isHost,
      isPsychic,
      isGuessTeam,
      isBetTeam,
      canGuess,
      canBet,
      createRoom,
      joinRoom,
      rejoin,
      leaveRoom,
      setTeam: (playerId, teamId) =>
        emit().emit("room:setTeam", { playerId, teamId }),
      setConfig: (config) => emit().emit("room:setConfig", config),
      startGame: () => emit().emit("game:start"),
      submitClue: (clue) => emit().emit("round:clue", { clue }),
      setGuess,
      lockGuess: () => emit().emit("round:lockGuess"),
      setBet: (side) => emit().emit("round:bet", { side }),
      lockBet: () => emit().emit("round:lockBet"),
      showScoreboard: () => emit().emit("round:showScoreboard"),
      nextRound: () => emit().emit("round:next"),
      rematch: () => emit().emit("game:rematch"),
    }),
    [
      status,
      room,
      me,
      error,
      needle,
      target,
      isHost,
      isPsychic,
      isGuessTeam,
      isBetTeam,
      canGuess,
      canBet,
      createRoom,
      joinRoom,
      rejoin,
      leaveRoom,
      setGuess,
      emit,
    ],
  );

  return (
    <OnlineGameContext.Provider value={value}>
      {children}
    </OnlineGameContext.Provider>
  );
}

export function useOnlineGame(): OnlineGameContextValue {
  const ctx = useContext(OnlineGameContext);
  if (!ctx) {
    throw new Error("useOnlineGame must be used inside <OnlineGameProvider>");
  }
  return ctx;
}
