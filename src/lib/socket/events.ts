import { z } from "zod";
import type { PublicRoom } from "@/types/online";
import type { TopicCard } from "@/types/game";

/**
 * The socket contract, shared by client and server.
 *
 * Every client -> server payload has a Zod schema here and the server validates
 * with it before touching room state. Types are inferred from the schemas so
 * the two sides cannot drift apart.
 */

export const SOCKET_PATH = "/socket.io";

export const configSchema = z.object({
  rounds: z.number().int().min(1).max(50),
  discussionSeconds: z.number().int().min(10).max(600).nullable(),
  sharedDial: z.boolean(),
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

export const cardSchema = z.object({
  id: z.string().min(1).max(32).nullable(),
  category: z.string().trim().min(1).max(24),
  left: z.string().trim().min(1).max(24),
  right: z.string().trim().min(1).max(24),
  custom: z.boolean(),
});

export const subjectSchema = z.object({
  subject: z.string().trim().min(1).max(40),
});

export const guessSchema = z.object({ value: z.number().min(0).max(100) });

export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type CardPayload = z.infer<typeof cardSchema>;
export type SubjectPayload = z.infer<typeof subjectSchema>;
export type GuessPayload = z.infer<typeof guessSchema>;

export type JoinResult =
  | { ok: true; playerId: string; room: PublicRoom }
  | { ok: false; error: string };

export interface ServerToClientEvents {
  /** Full room snapshot. Always target-free except during reveal. */
  "room:state": (room: PublicRoom) => void;
  /** Sent only to the chooser's socket, never broadcast. */
  "round:target": (payload: { roundNumber: number; target: number }) => void;
  /** The random card on offer. Chooser only — it is not part of game state. */
  "round:randomCard": (payload: { card: TopicCard }) => void;
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
  "room:setConfig": (payload: Partial<CreateRoomPayload["config"]>) => void;
  "room:leave": () => void;
  "game:start": () => void;
  "game:rematch": () => void;
  "round:reroll": () => void;
  "round:card": (payload: CardPayload) => void;
  "round:subject": (payload: SubjectPayload) => void;
  "round:guess": (payload: GuessPayload) => void;
  "round:lockGuess": () => void;
  "round:showScoreboard": () => void;
  "round:next": () => void;
}
