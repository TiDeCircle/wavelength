import type { GameConfig, GameState, Player, Team } from "@/types/game";
import { DEFAULT_CONFIG } from "@/lib/game/reducer";
import { generateCode } from "./codes";

/**
 * In-memory room store.
 *
 * Everything lives in this process. That is fine for a single instance; moving
 * to several instances means swapping this module for Redis and nothing else,
 * because handlers only ever touch rooms through the functions below.
 */

export const TEAM_IDS = ["team-0", "team-1"] as const;
export const TEAM_NAMES = ["ทีมชมพู", "ทีมเขียว"] as const;

/** Below this the room plays co-op: one team, no left-right bet. */
export const MIN_PLAYERS_FOR_TEAMS = 4;
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
  teamId: string | null;
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
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function deleteRoom(code: string): void {
  rooms.delete(code.toUpperCase());
}

/** Team with the fewest players, so joins stay balanced without any UI. */
function lightestTeam(room: Room): string {
  const counts = TEAM_IDS.map(
    (id) => room.players.filter((p) => p.teamId === id).length,
  );
  return TEAM_IDS[counts[0] <= counts[1] ? 0 : 1];
}

export function addPlayer(room: Room, name: string): ServerPlayer {
  const player: ServerPlayer = {
    id: nextPlayerId(),
    name,
    teamId: lightestTeam(room),
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

export function coopMode(room: Room): boolean {
  return room.players.length < MIN_PLAYERS_FOR_TEAMS;
}

/**
 * Freeze the lobby into the roster the game runs on.
 *
 * Co-op collapses everyone onto one team; otherwise anybody still unassigned
 * is dropped onto the lighter side so no team can start empty.
 */
export function buildRoster(room: Room): { players: Player[]; teams: Team[] } {
  const coop = coopMode(room);
  const teamIds = coop ? [TEAM_IDS[0]] : [...TEAM_IDS];

  const players: Player[] = room.players.map((p, i) => ({
    id: p.id,
    name: p.name,
    teamId: coop
      ? TEAM_IDS[0]
      : (p.teamId ?? TEAM_IDS[i % TEAM_IDS.length]),
  }));

  const teams: Team[] = teamIds.map((id, i) => ({
    id,
    name: TEAM_NAMES[i],
    score: 0,
    psychicIndex: 0,
  }));

  return { players, teams };
}

export function rosterIsPlayable(room: Room): boolean {
  if (room.players.length < MIN_PLAYERS) return false;
  const { players, teams } = buildRoster(room);
  return teams.every((t) => players.some((p) => p.teamId === t.id));
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
