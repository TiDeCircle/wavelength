import type { GameConfig, GameState, Round } from "./game";

/** A person in a room. */
export interface RoomPlayer {
  id: string;
  name: string;
  connected: boolean;
}

/**
 * The round as everyone in the room may see it.
 *
 * `target` is absent until reveal, and `guesses` holds only the entries this
 * client is allowed to see. Both are stripped in `src/server/redact.ts` — the
 * only place allowed to decide otherwise.
 */
export type PublicRound = Omit<Round, "target"> & { target?: number };

export type PublicGameState = Omit<GameState, "round"> & {
  round: PublicRound | null;
};

export interface PublicRoom {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  config: GameConfig;
  /** null while the room is still in the lobby. */
  game: PublicGameState | null;
  /** Epoch ms the guess phase closes, or null when no timer is running. */
  guessDeadlineAt: number | null;
}

/** Identity a client keeps so it can rejoin its seat after a disconnect. */
export interface OnlineIdentity {
  code: string;
  playerId: string;
  name: string;
}
