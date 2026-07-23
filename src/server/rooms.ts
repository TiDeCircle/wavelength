import type { GameConfig, GameState, Player, TopicCard } from "@/types/game";
import { DEFAULT_CONFIG } from "@/lib/game/reducer";
import { generateCode } from "./codes";

/**
 * In-memory room store.
 *
 * Everything lives in this process. That is fine for a single instance; moving
 * to several instances means swapping this module for Redis and nothing else,
 * because handlers only ever touch rooms through the functions below.
 */

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;

/** How long a disconnected player keeps their seat. */
export const DISCONNECT_GRACE_MS = 60_000;
/** How long the room waits for a vanished psychic before redealing. */
export const PSYCHIC_GRACE_MS = 30_000;
/** Idle rooms are swept after this. */
export const ROOM_TTL_MS = 10 * 60_000;

export interface ServerPlayer {
  id: string;
  name: string;
  connected: boolean;
  socketId: string | null;
  disconnectedAt: number | null;
}

export interface Room {
  code: string;
  hostId: string;
  players: ServerPlayer[];
  config: GameConfig;
  /** null while the room is in the lobby. */
  game: GameState | null;
  guessDeadlineAt: number | null;
  /** Card currently offered to the chooser. Not game state — a reroll replaces it. */
  randomCard: TopicCard | null;
  createdAt: number;
  lastActivityAt: number;
}

const rooms = new Map<string, Room>();
let playerCounter = 0;

export function nextPlayerId(): string {
  playerCounter += 1;
  return `p-${Date.now().toString(36)}-${playerCounter}`;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function touch(room: Room): void {
  room.lastActivityAt = Date.now();
}

export function createRoom(config?: Partial<GameConfig>): Room {
  const code = generateCode((c) => rooms.has(c));
  const room: Room = {
    code,
    hostId: "",
    players: [],
    config: { ...DEFAULT_CONFIG, ...config },
    game: null,
    guessDeadlineAt: null,
    randomCard: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function deleteRoom(code: string): void {
  rooms.delete(code.toUpperCase());
}

export function addPlayer(room: Room, name: string): ServerPlayer {
  const player: ServerPlayer = {
    id: nextPlayerId(),
    name,
    connected: true,
    socketId: null,
    disconnectedAt: null,
  };
  room.players.push(player);
  if (!room.hostId) room.hostId = player.id;
  touch(room);
  return player;
}

export function removePlayer(room: Room, playerId: string): void {
  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.hostId === playerId) promoteHost(room);
  touch(room);
}

/** Hand the room to whoever is still connected and has been here longest. */
export function promoteHost(room: Room): void {
  const next =
    room.players.find((p) => p.connected) ?? room.players[0] ?? null;
  room.hostId = next?.id ?? "";
}

export function playerBySocket(socketId: string): {
  room: Room;
  player: ServerPlayer;
} | null {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.socketId === socketId);
    if (player) return { room, player };
  }
  return null;
}

/** Freeze the lobby into the roster the game runs on. Join order is turn order. */
export function buildPlayers(room: Room): Player[] {
  return room.players.map((p) => ({ id: p.id, name: p.name, score: 0 }));
}

export function rosterIsPlayable(room: Room): boolean {
  return room.players.length >= MIN_PLAYERS;
}

/** Drop idle rooms and players whose grace period ran out. */
export function sweep(now = Date.now()): string[] {
  const closed: string[] = [];
  for (const [code, room] of rooms) {
    for (const player of [...room.players]) {
      if (
        !player.connected &&
        player.disconnectedAt !== null &&
        now - player.disconnectedAt > DISCONNECT_GRACE_MS &&
        !room.game
      ) {
        // Only reap seats while in the lobby; mid-game seats stay reserved.
        removePlayer(room, player.id);
      }
    }
    const empty = room.players.every((p) => !p.connected);
    if (empty && now - room.lastActivityAt > ROOM_TTL_MS) {
      rooms.delete(code);
      closed.push(code);
    }
  }
  return closed;
}

export function roomCount(): number {
  return rooms.size;
}

export function gameState(room: Room): GameState | null {
  return room.game;
}
