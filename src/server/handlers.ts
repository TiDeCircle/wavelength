import type { Server, Socket } from "socket.io";
import { z } from "zod";
import type {
  ClientToServerEvents,
  JoinResult,
  ServerToClientEvents,
} from "@/lib/socket/events";
import {
  cardSchema,
  configSchema,
  createRoomSchema,
  guessSchema,
  joinRoomSchema,
  subjectSchema,
} from "@/lib/socket/events";
import { drawCard } from "@/lib/cards";
import { createGame, gameReducer, type GameAction } from "@/lib/game/reducer";
import { randomTarget } from "@/lib/game/target";
import { publicRoom } from "./redact";
import {
  addPlayer,
  buildPlayers,
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
  touch,
  type Room,
  type ServerPlayer,
} from "./rooms";

/**
 * Socket handlers. The server owns every piece of game state; clients only ever
 * send intents, and each one is checked three ways before it lands:
 *
 *   1. Zod-validated payload shape
 *   2. role guard here (is this player the chooser / a guesser / host)
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
}
const timers = new Map<string, RoomTimers>();

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
  timers.delete(code);
}

export function createHandlers(io: IO) {
  /** Push the full (target-free) room to everyone, plus a private target emit. */
  function broadcast(room: Room): void {
    for (const player of room.players) {
      if (player.socketId) {
        io.to(player.socketId).emit("room:state", publicRoom(room, player.id));
      }
    }
    sendPrivateToChooser(room);
  }

  /**
   * The target and the pending random card reach exactly one socket: the
   * chooser's. Neither goes into `room:state`, so no other client can read
   * them out of memory or devtools.
   */
  function sendPrivateToChooser(room: Room): void {
    const game = room.game;
    if (!game?.round) return;

    const chooser = room.players.find((p) => p.id === game.round!.chooserId);
    if (!chooser?.socketId) return;

    if (game.phase === "topic" && room.randomCard) {
      io.to(chooser.socketId).emit("round:randomCard", { card: room.randomCard });
    }
    // From `reveal` onwards the target is public and travels in `room:state`.
    if (game.phase === "reveal" || game.phase === "gameover") return;
    io.to(chooser.socketId).emit("round:target", {
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
      game = gameReducer(game, { type: "CONFIRM_CHOOSER" });
    }
    const enteringGuess = room.game.phase !== "guess" && game.phase === "guess";
    const enteringTopic = room.game.phase !== "topic" && game.phase === "topic";
    room.game = game;
    touch(room);

    if (enteringTopic) room.randomCard = drawCard(game.usedCardIds);
    if (enteringGuess) armGuessDeadline(room);
    if (game.phase !== "guess") disarmGuessDeadline(room);

    broadcast(room);
    if (game.phase === "guess") maybeReveal(room);
  }

  /** Everyone with a dial who is still connected. */
  function activeGuessers(room: Room): ServerPlayer[] {
    const round = room.game?.round;
    if (!round) return [];
    return room.players.filter(
      (p) => p.connected && p.id !== round.chooserId,
    );
  }

  /** Move on as soon as every connected guesser has locked. */
  function maybeReveal(room: Room): void {
    const round = room.game?.round;
    if (!round || room.game?.phase !== "guess") return;
    const waiting = activeGuessers(room).filter((p) => !round.locked[p.id]);
    if (waiting.length === 0) apply(room, { type: "REVEAL" });
  }

  function armGuessDeadline(room: Room): void {
    const seconds = room.config.discussionSeconds;
    disarmGuessDeadline(room);
    if (seconds === null) return;

    room.guessDeadlineAt = Date.now() + seconds * 1000;
    timersFor(room.code).guessDeadline = setTimeout(() => {
      // Whatever each dial is on when the clock runs out is that player's answer.
      if (room.game?.phase === "guess") apply(room, { type: "REVEAL" });
    }, seconds * 1000);
  }

  function disarmGuessDeadline(room: Room): void {
    const t = timersFor(room.code);
    if (t.guessDeadline) clearTimeout(t.guessDeadline);
    t.guessDeadline = undefined;
    room.guessDeadlineAt = null;
  }

  /** Give a vanished chooser a moment, then redeal the round to the next player. */
  function watchChooser(room: Room): void {
    const game = room.game;
    const t = timersFor(room.code);
    if (t.psychicGrace) clearTimeout(t.psychicGrace);
    t.psychicGrace = undefined;
    if (!game?.round) return;

    const chooser = room.players.find((p) => p.id === game.round!.chooserId);
    const playing = ["topic", "subject", "guess"].includes(game.phase);
    if (!playing || chooser?.connected) return;

    t.psychicGrace = setTimeout(() => {
      const current = room.game;
      if (!current?.round) return;
      const stillGone = !room.players.find(
        (p) => p.id === current.round!.chooserId,
      )?.connected;
      if (!stillGone) return;
      apply(room, { type: "ABORT_ROUND", target: randomTarget() });
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

      ack({ ok: true, playerId: player.id, room: publicRoom(room, player.id) });
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
        ack({ ok: true, playerId: existing.id, room: publicRoom(room, existing.id) });
        watchChooser(room);
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
      ack({ ok: true, playerId: player.id, room: publicRoom(room, player.id) });
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
      if (!rosterIsPlayable(room)) return fail(socket, "ต้องมีอย่างน้อย 2 คน");

      room.game = createGame(buildPlayers(room), room.config, randomTarget());
      apply(room, { type: "CONFIRM_CHOOSER" });
    });

    socket.on("game:rematch", () => {
      const me = requireHost(socket);
      if (!me?.room.game) return;
      apply(me.room, { type: "REMATCH", target: randomTarget() });
    });

    socket.on("round:reroll", () => {
      const me = whoami(socket);
      const game = me?.room.game;
      if (!me || !game?.round) return;
      if (game.phase !== "topic") return;
      if (game.round.chooserId !== me.player.id) {
        return fail(socket, "เฉพาะคนเลือกเท่านั้น");
      }
      me.room.randomCard = drawCard(game.usedCardIds);
      touch(me.room);
      sendPrivateToChooser(me.room);
    });

    socket.on("round:card", (payload) => {
      const data = parse(socket, cardSchema, payload);
      if (!data) return;
      const me = whoami(socket);
      if (!me?.room.game?.round) return;
      if (me.room.game.round.chooserId !== me.player.id) {
        return fail(socket, "เฉพาะคนเลือกเท่านั้น");
      }
      apply(me.room, { type: "SET_CARD", card: data });
    });

    socket.on("round:subject", (payload) => {
      const data = parse(socket, subjectSchema, payload);
      if (!data) return;
      const me = whoami(socket);
      if (!me?.room.game?.round) return;
      if (me.room.game.round.chooserId !== me.player.id) {
        return fail(socket, "เฉพาะคนเลือกเท่านั้น");
      }
      apply(me.room, { type: "SUBMIT_SUBJECT", subject: data.subject });
    });

    socket.on("round:guess", (payload) => {
      const data = parse(socket, guessSchema, payload);
      if (!data) return;
      const me = whoami(socket);
      const game = me?.room.game;
      if (!me || !game?.round || game.phase !== "guess") return;
      // The chooser knows the answer, so they never get a dial.
      if (me.player.id === game.round.chooserId) return;

      me.room.game = gameReducer(game, {
        type: "SET_GUESS",
        key: me.player.id,
        value: data.value,
      });
      touch(me.room);
      // No broadcast: dials stay hidden from each other until reveal.
    });

    socket.on("round:lockGuess", () => {
      const me = whoami(socket);
      const game = me?.room.game;
      if (!me || !game?.round || game.phase !== "guess") return;
      if (me.player.id === game.round.chooserId) return;
      apply(me.room, { type: "LOCK_GUESS", key: me.player.id });
    });

    socket.on("round:showScoreboard", () => {
      const me = requireHost(socket);
      if (!me?.room.game) return;
      apply(me.room, { type: "SHOW_SCOREBOARD" });
    });

    socket.on("round:next", () => {
      const me = requireHost(socket);
      if (!me?.room.game) return;
      apply(me.room, { type: "NEXT_ROUND", target: randomTarget() });
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

      watchChooser(room);
      // A player dropping can be the last one we were waiting on.
      maybeReveal(room);
      broadcast(room);
    });
  };
}

/** Periodic cleanup of idle rooms; called once from the server entrypoint. */
export function startRoomSweeper(intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    for (const code of sweep()) clearTimers(code);
  }, intervalMs).unref();
}
