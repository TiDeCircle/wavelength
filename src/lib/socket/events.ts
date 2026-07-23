import { z } from "zod";
import type { PublicRoom } from "@/types/online";

/**
 * The socket contract, shared by client and server.
 *
 * Every client -> server payload has a Zod schema here and the server validates
 * with it before touching room state. Types are inferred from the schemas so
 * the two sides cannot drift apart.
 */

export const SOCKET_PATH = "/socket.io";

export const configSchema = z.object({
  targetScore: z.number().int().min(1).max(50),
  discussionSeconds: z.number().int().min(10).max(600).nullable(),
  leftRightBet: z.boolean(),
  coopRounds: z.number().int().min(1).max(50),
});

export const nameSchema = z.string().trim().min(1).max(20);
export const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,6}$/);

export const createRoomSchema = z.object({
  name: nameSchema,
  config: configSchema.partial().optional(),
});

export const joinRoomSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  /** Present when reclaiming a seat after a disconnect. */
  playerId: z.string().min(1).max(64).optional(),
});

export const setTeamSchema = z.object({
  playerId: z.string().min(1).max(64),
  teamId: z.string().min(1).max(32),
});

export const clueSchema = z.object({ clue: z.string().trim().min(1).max(60) });
export const guessSchema = z.object({ value: z.number().min(0).max(100) });
export const betSchema = z.object({ side: z.enum(["left", "right"]) });

export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type SetTeamPayload = z.infer<typeof setTeamSchema>;
export type CluePayload = z.infer<typeof clueSchema>;
export type GuessPayload = z.infer<typeof guessSchema>;
export type BetPayload = z.infer<typeof betSchema>;

export type JoinResult =
  | { ok: true; playerId: string; room: PublicRoom }
  | { ok: false; error: string };

export interface ServerToClientEvents {
  /** Full room snapshot. Always target-free except during reveal. */
  "room:state": (room: PublicRoom) => void;
  /** Sent only to the psychic's socket, never broadcast. */
  "round:target": (payload: { roundNumber: number; target: number }) => void;
  /** High-frequency needle updates between full snapshots. */
  "round:guessMoved": (payload: { value: number }) => void;
  "room:error": (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  "room:create": (
    payload: CreateRoomPayload,
    ack: (result: JoinResult) => void,
  ) => void;
  "room:join": (
    payload: JoinRoomPayload,
    ack: (result: JoinResult) => void,
  ) => void;
  "room:setTeam": (payload: SetTeamPayload) => void;
  "room:setConfig": (payload: Partial<CreateRoomPayload["config"]>) => void;
  "room:leave": () => void;
  "game:start": () => void;
  "game:rematch": () => void;
  "round:clue": (payload: CluePayload) => void;
  "round:guess": (payload: GuessPayload) => void;
  "round:lockGuess": () => void;
  "round:bet": (payload: BetPayload) => void;
  "round:lockBet": () => void;
  "round:showScoreboard": () => void;
  "round:next": () => void;
}
