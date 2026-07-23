import type { GameState } from "@/types/game";
import type { PublicGameState, PublicRoom, RoomPlayer } from "@/types/online";
import type { Room } from "./rooms";

/**
 * The one place that decides whether the hidden target leaves the server.
 *
 * Everything broadcast to a room goes through `publicRoom()`. The target is
 * copied into the payload only once the round has reached `reveal`; before
 * that the field is not present at all, so there is nothing for a client to
 * dig out of a devtools panel. The psychic gets their own copy through a
 * direct `round:target` emit in `handlers.ts`.
 *
 * If you add a field to `Round` that could give the target away, strip it here.
 */
export function publicGame(game: GameState | null): PublicGameState | null {
  if (!game) return null;
  if (!game.round) return { ...game, round: null };

  const { target, ...rest } = game.round;
  const revealed = game.phase === "reveal" || game.phase === "gameover";

  return {
    ...game,
    round: revealed ? { ...rest, target } : rest,
  };
}

export function publicRoom(room: Room): PublicRoom {
  const players: RoomPlayer[] = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    teamId: p.teamId,
    connected: p.connected,
  }));

  return {
    code: room.code,
    hostId: room.hostId,
    players,
    config: room.config,
    game: publicGame(room.game),
    guessDeadlineAt: room.guessDeadlineAt,
  };
}
