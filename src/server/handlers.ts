import type { Server, Socket } from "socket.io";
import { z } from "zod";
import type { GameState, RoundSeed } from "@/types/game";
import type {
  ClientToServerEvents,
  JoinResult,
  ServerToClientEvents,
} from "@/lib/socket/events";
import {
  betSchema,
  clueSchema,
  configSchema,
  createRoomSchema,
  guessSchema,
  joinRoomSchema,
  setTeamSchema,
} from "@/lib/socket/events";
import { drawCardId } from "@/lib/cards";
import { createGame, gameReducer, type GameAction } from "@/lib/game/reducer";
import { randomTarget } from "@/lib/game/target";
import { publicRoom } from "./redact";
import {
  addPlayer,
  buildRoster,
  createRoom,
  deleteRoom,
  getRoom,
  MAX_PLAYERS,
  PSYCHIC_GRACE_MS,
  playerBySocket,
  promoteHost,
  removePlayer,
  rosterIsPlayable,
  sweep,
  TEAM_IDS,
  touch,
  type Room,
  type ServerPlayer,
} from "./rooms";

/**
 * Socket handlers. The server owns every piece of game state; clients only ever
 * send intents, and each one is checked three ways before it lands:
 *
 *   1. Zod-validated payload shape
 *   2. role guard here (is this player the psychic / on the guessing team / host)
 *   3. phase guard inside the pure reducer
 *
 * Nothing is trusted from the client beyond "this socket belongs to player X".
 */

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Timers hung off a room. Kept out of `Room` so room state stays serializable. */
interface RoomTimers {
  guessDeadline?: NodeJS.Timeout;
  psychicGrace?: NodeJS.Timeout;
  guessBroadcast?: NodeJS.Timeout;
  pendingGuess?: number;
}
const timers = new Map<string, RoomTimers>();

const GUESS_BROADCAST_MS = 50;

function timersFor(code: string): RoomTimers {
  let t = timers.get(code);
  if (!t) {
    t = {};
    timers.set(code, t);
  }
  return t;
}

function clearTimers(code: string): void {
  const t = timers.get(code);
  if (!t) return;
  if (t.guessDeadline) clearTimeout(t.guessDeadline);
  if (t.psychicGrace) clearTimeout(t.psychicGrace);
  if (t.guessBroadcast) clearTimeout(t.guessBroadcast);
  timers.delete(code);
}

function nextSeed(game: GameState | null): RoundSeed {
  return {
    cardId: drawCardId(game?.usedCardIds ?? []),
    target: randomTarget(),
  };
}

export function createHandlers(io: IO) {
  /** Push the full (target-free) room to everyone, plus a private target emit. */
  function broadcast(room: Room): void {
    io.to(room.code).emit("room:state", publicRoom(room));
    sendTargetToPsychic(room);
  }

  /**
   * The target reaches exactly one socket: the psychic's. It never goes into
   * `room:state`, so no other client can read it out of memory or devtools.
   */
  function sendTargetToPsychic(room: Room): void {
    const game = room.game;
    if (!game?.round) return;
    // From `reveal` onwards the target is public and travels in `room:state`.
    if (game.phase === "reveal" || game.phase === "gameover") return;

    const psychic = room.players.find((p) => p.id === game.round!.psychicId);
    if (!psychic?.socketId) return;
    io.to(psychic.socketId).emit("round:target", {
      roundNumber: game.round.number,
      target: game.round.target,
    });
  }

  function fail(socket: ClientSocket, message: string): void {
    socket.emit("room:error", { message });
  }

  /**
   * Run an action through the reducer and settle the side effects: online has
   * no pass-the-device step, so `pass` is walked through immediately, and the
   * guess clock is (re)armed whenever the guess phase opens.
   */
  function apply(room: Room, action: GameAction): void {
    if (!room.game) return;
    let game = gameReducer(room.game, action);
    if (game.phase === "pass") {
      game = gameReducer(game, { type: "CONFIRM_PSYCHIC" });
    }
    const enteringGuess = room.game.phase !== "guess" && game.phase === "guess";
    room.game = game;
    touch(room);

    if (enteringGuess) armGuessDeadline(room);
    if (game.phase !== "guess") disarmGuessDeadline(room);

    broadcast(room);
  }

  function armGuessDeadline(room: Room): void {
    const seconds = room.config.discussionSeconds;
    disarmGuessDeadline(room);
    if (seconds === null) return;

    room.guessDeadlineAt = Date.now() + seconds * 1000;
    timersFor(room.code).guessDeadline = setTimeout(() => {
      // Whatever the needle is on when the clock runs out is the answer.
      if (room.game?.phase === "guess") apply(room, { type: "LOCK_GUESS" });
    }, seconds * 1000);
  }

  function disarmGuessDeadline(room: Room): void {
    const t = timersFor(room.code);
    if (t.guessDeadline) clearTimeout(t.guessDeadline);
    t.guessDeadline = undefined;
    room.guessDeadlineAt = null;
  }

  /** Give a vanished psychic a moment, then redeal the round to their teammate. */
  function watchPsychic(room: Room): void {
    const game = room.game;
    const t = timersFor(room.code);
    if (t.psychicGrace) clearTimeout(t.psychicGrace);
    t.psychicGrace = undefined;
    if (!game?.round) return;

    const psychic = room.players.find((p) => p.id === game.round!.psychicId);
    const playing = ["psychic", "guess", "bet"].includes(game.phase);
    if (!playing || psychic?.connected) return;

    t.psychicGrace = setTimeout(() => {
      const current = room.game;
      if (!current?.round) return;
      const stillGone = !room.players.find(
        (p) => p.id === current.round!.psychicId,
      )?.connected;
      if (!stillGone) return;
      apply(room, { type: "ABORT_ROUND", seed: nextSeed(current) });
    }, PSYCHIC_GRACE_MS);
  }

  function bind(socket: ClientSocket, room: Room, player: ServerPlayer): void {
    player.socketId = socket.id;
    player.connected = true;
    player.disconnectedAt = null;
    socket.join(room.code);
    touch(room);
  }

  function parse<T extends z.ZodType>(
    socket: ClientSocket,
    schema: T,
    payload: unknown,
  ): z.infer<T> | null {
    const result = schema.safeParse(payload);
    if (!result.success) {
      fail(socket, "ข้อมูลไม่ถูกต้อง");
      return null;
    }
    return result.data;
  }

  /** Resolve which room and player this socket is acting as. */
  function whoami(
    socket: ClientSocket,
  ): { room: Room; player: ServerPlayer } | null {
    const found = playerBySocket(socket.id);
    if (!found) {
      fail(socket, "ไม่ได้อยู่ในห้อง");
      return null;
    }
    return found;
  }

  function requireHost(
    socket: ClientSocket,
  ): { room: Room; player: ServerPlayer } | null {
    const me = whoami(socket);
    if (!me) return null;
    if (me.room.hostId !== me.player.id) {
      fail(socket, "เฉพาะ host เท่านั้น");
      return null;
    }
    return me;
  }

  return function onConnection(socket: ClientSocket): void {
    socket.on("room:create", (payload, ack) => {
      const data = parse(socket, createRoomSchema, payload);
      if (!data) return ack({ ok: false, error: "ข้อมูลไม่ถูกต้อง" });

      const config = data.config
        ? configSchema.partial().parse(data.config)
        : undefined;
      const room = createRoom(config);
      const player = addPlayer(room, data.name);
      bind(socket, room, player);

      ack({ ok: true, playerId: player.id, room: publicRoom(room) });
      broadcast(room);
    });

    socket.on("room:join", (payload, ack) => {
      const data = parse(socket, joinRoomSchema, payload);
      if (!data) return ack({ ok: false, error: "ข้อมูลไม่ถูกต้อง" });

      const room = getRoom(data.code);
      if (!room) return ack({ ok: false, error: "ไม่พบห้องนี้" });

      // Reclaiming a seat after a drop takes priority over joining as new.
      const existing = data.playerId
        ? room.players.find((p) => p.id === data.playerId)
        : undefined;

      if (existing) {
        existing.name = data.name;
        bind(socket, room, existing);
        ack({ ok: true, playerId: existing.id, room: publicRoom(room) });
        watchPsychic(room);
        broadcast(room);
        return;
      }

      if (room.game) {
        return ack({ ok: false, error: "ห้องนี้เริ่มเล่นไปแล้ว" });
      }
      if (room.players.length >= MAX_PLAYERS) {
        return ack({ ok: false, error: "ห้องเต็ม" });
      }

      const player = addPlayer(room, data.name);
      bind(socket, room, player);
      ack({ ok: true, playerId: player.id, room: publicRoom(room) });
      broadcast(room);
    });

    socket.on("room:setTeam", (payload) => {
      const data = parse(socket, setTeamSchema, payload);
      if (!data) return;
      const me = whoami(socket);
      if (!me) return;
      const { room, player } = me;
      if (room.game) return fail(socket, "เกมเริ่มแล้ว ย้ายทีมไม่ได้");
      // Anyone may move themselves; only the host may move someone else.
      if (data.playerId !== player.id && room.hostId !== player.id) {
        return fail(socket, "เฉพาะ host เท่านั้น");
      }
      if (!TEAM_IDS.includes(data.teamId as (typeof TEAM_IDS)[number])) {
        return fail(socket, "ทีมไม่ถูกต้อง");
      }
      const target = room.players.find((p) => p.id === data.playerId);
      if (!target) return;
      target.teamId = data.teamId;
      touch(room);
      broadcast(room);
    });

    socket.on("room:setConfig", (payload) => {
      const me = requireHost(socket);
      if (!me) return;
      if (me.room.game) return fail(socket, "เกมเริ่มแล้ว");
      const data = parse(socket, configSchema.partial(), payload ?? {});
      if (!data) return;
      me.room.config = { ...me.room.config, ...data };
      touch(me.room);
      broadcast(me.room);
    });

    socket.on("game:start", () => {
      const me = requireHost(socket);
      if (!me) return;
      const { room } = me;
      if (room.game) return fail(socket, "เกมเริ่มไปแล้ว");
      if (!rosterIsPlayable(room)) {
        return fail(socket, "ผู้เล่นยังไม่พอ หรือมีทีมที่ยังไม่มีคน");
      }

      const { players, teams } = buildRoster(room);
      room.game = createGame(players, teams, room.config, nextSeed(null));
      // Online has no hand-the-device step.
      apply(room, { type: "CONFIRM_PSYCHIC" });
    });

    socket.on("game:rematch", () => {
      const me = requireHost(socket);
      if (!me?.room.game) return;
      apply(me.room, { type: "REMATCH", seed: nextSeed(null) });
    });

    socket.on("round:clue", (payload) => {
      const data = parse(socket, clueSchema, payload);
      if (!data) return;
      const me = whoami(socket);
      if (!me?.room.game?.round) return;
      if (me.room.game.round.psychicId !== me.player.id) {
        return fail(socket, "เฉพาะ psychic เท่านั้น");
      }
      apply(me.room, { type: "SUBMIT_CLUE", clue: data.clue });
    });

    socket.on("round:guess", (payload) => {
      const data = parse(socket, guessSchema, payload);
      if (!data) return;
      const me = whoami(socket);
      const game = me?.room.game;
      if (!me || !game?.round) return;
      if (game.phase !== "guess") return;
      // The psychic knows the answer, so they never touch the needle.
      if (
        me.player.teamId !== game.round.guessTeamId ||
        me.player.id === game.round.psychicId
      ) {
        return;
      }

      me.room.game = gameReducer(game, { type: "SET_GUESS", value: data.value });
      touch(me.room);
      throttledGuessBroadcast(me.room, socket.id);
    });

    socket.on("round:lockGuess", () => {
      const me = whoami(socket);
      const game = me?.room.game;
      if (!me || !game?.round) return;
      if (me.player.teamId !== game.round.guessTeamId) return;
      apply(me.room, { type: "LOCK_GUESS" });
    });

    socket.on("round:bet", (payload) => {
      const data = parse(socket, betSchema, payload);
      if (!data) return;
      const me = whoami(socket);
      const game = me?.room.game;
      if (!me || !game?.round) return;
      if (me.player.teamId !== game.round.betTeamId) return;
      apply(me.room, { type: "SET_BET", side: data.side });
    });

    socket.on("round:lockBet", () => {
      const me = whoami(socket);
      const game = me?.room.game;
      if (!me || !game?.round) return;
      if (me.player.teamId !== game.round.betTeamId) return;
      apply(me.room, { type: "LOCK_BET" });
    });

    socket.on("round:showScoreboard", () => {
      const me = requireHost(socket);
      if (!me?.room.game) return;
      apply(me.room, { type: "SHOW_SCOREBOARD" });
    });

    socket.on("round:next", () => {
      const me = requireHost(socket);
      if (!me?.room.game) return;
      apply(me.room, { type: "NEXT_ROUND", seed: nextSeed(me.room.game) });
    });

    socket.on("room:leave", () => {
      const me = whoami(socket);
      if (!me) return;
      socket.leave(me.room.code);
      removePlayer(me.room, me.player.id);
      if (me.room.players.length === 0) {
        clearTimers(me.room.code);
        deleteRoom(me.room.code);
        return;
      }
      broadcast(me.room);
    });

    socket.on("disconnect", () => {
      const found = playerBySocket(socket.id);
      if (!found) return;
      const { room, player } = found;

      player.connected = false;
      player.socketId = null;
      player.disconnectedAt = Date.now();
      if (room.hostId === player.id) promoteHost(room);
      touch(room);

      watchPsychic(room);
      broadcast(room);
    });
  };

  /**
   * Needle updates are the only high-frequency event, so they go out on their
   * own light-weight channel at most every 50ms instead of a full snapshot.
   * The dragger is excluded — their own needle is already where they put it,
   * and echoing it back would fight their finger.
   */
  function throttledGuessBroadcast(room: Room, fromSocketId: string): void {
    const t = timersFor(room.code);
    t.pendingGuess = room.game?.round?.guess;
    if (t.guessBroadcast) return;

    const flush = () => {
      const value = t.pendingGuess;
      t.guessBroadcast = undefined;
      t.pendingGuess = undefined;
      if (value === undefined) return;
      io.to(room.code).except(fromSocketId).emit("round:guessMoved", { value });
    };

    flush();
    t.guessBroadcast = setTimeout(flush, GUESS_BROADCAST_MS);
  }
}

/** Periodic cleanup of idle rooms; called once from the server entrypoint. */
export function startRoomSweeper(intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    for (const code of sweep()) clearTimers(code);
  }, intervalMs).unref();
}
