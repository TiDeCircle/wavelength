import type { GameState } from "@/types/game";
import type { PublicGameState, PublicRoom, RoomPlayer } from "@/types/online";
import type { Room } from "./rooms";

/**
 * The one place that decides what leaves the server.
 *
 * Two secrets travel in room state, and both are held back until the reveal:
 * the target, which is dropped from the payload entirely, and every other
 * player's dial, which would let a late guesser copy an early one. The chooser
 * gets their target through a direct `round:target` emit instead.
 *
 * If you add a field to `Round` that could give either away, strip it here.
 */
export function publicGame(
  game: GameState | null,
  viewerId: string,
): PublicGameState | null {
  if (!game) return null;
  if (!game.round) return { ...game, round: null };

  const { target, ...rest } = game.round;
  const revealed = game.phase === "reveal" || game.phase === "gameover";

  if (revealed) {
    return { ...game, round: { ...rest, target } };
  }

  // Before reveal a viewer sees their own dial and nobody else's.
  const own = Object.hasOwn(rest.guesses, viewerId)
    ? { [viewerId]: rest.guesses[viewerId] }
    : {};

  return { ...game, round: { ...rest, guesses: own } };
}

export function publicRoom(room: Room, viewerId: string): PublicRoom {
  const players: RoomPlayer[] = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    connected: p.connected,
  }));

  return {
    code: room.code,
    hostId: room.hostId,
    players,
    config: room.config,
    game: publicGame(room.game, viewerId),
    guessDeadlineAt: room.guessDeadlineAt,
  };
}
