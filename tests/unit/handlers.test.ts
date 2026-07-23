import { describe, expect, it, vi } from "vitest";
import type { Server } from "socket.io";
import { createHandlers } from "@/server/handlers";
import type {
  CardPayload,
  ClientToServerEvents,
  CreateRoomPayload,
  JoinResult,
  JoinRoomPayload,
  ServerToClientEvents,
} from "@/lib/socket/events";

/**
 * Handler-level test: drives `createHandlers(io)` through the real client
 * events (the same path a browser would take) against a fake Socket.io `io`,
 * so it exercises the actual emit path instead of reaching into room/reducer
 * internals the way `redact.test.ts` does.
 */

// The target is random by nature; pin it so assertions can check the exact
// value that reaches the chooser's socket.
const FIXED_TARGET = 42.5;
vi.mock("@/lib/game/target", () => ({ randomTarget: () => FIXED_TARGET }));

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type Handler = (...args: never[]) => void;

interface EmitRecord {
  socketId: string;
  event: string;
  payload: unknown;
}

/** Minimal fake client socket: records `socket.emit`, stores `socket.on` handlers. */
class FakeSocket {
  readonly id: string;
  private readonly handlers = new Map<string, Handler>();
  readonly emitted: { event: string; payload: unknown }[] = [];

  constructor(id: string) {
    this.id = id;
  }

  on(event: string, handler: Handler): void {
    this.handlers.set(event, handler);
  }

  emit(event: string, payload?: unknown): void {
    this.emitted.push({ event, payload });
  }

  join(_room: string): void {
    // Room membership isn't needed for these assertions: the handlers only
    // ever address individual sockets via `io.to(socketId)`, never rooms.
  }

  /** Invoke a handler this socket registered via `socket.on(event, ...)`. */
  trigger(event: string, ...args: unknown[]): void {
    const handler = this.handlers.get(event);
    if (!handler) {
      throw new Error(`FakeSocket has no handler bound for "${event}"`);
    }
    (handler as (...a: unknown[]) => void)(...args);
  }
}

/** Minimal fake `io`: only the surface `handlers.ts` actually calls. */
class FakeIO {
  private connectionHandler: ((socket: FakeSocket) => void) | null = null;
  private counter = 0;
  readonly emitted: EmitRecord[] = [];

  on(event: string, handler: (socket: FakeSocket) => void): void {
    if (event === "connection") this.connectionHandler = handler;
  }

  to(socketId: string): { emit: (event: string, payload?: unknown) => void } {
    return {
      emit: (event: string, payload?: unknown) => {
        this.emitted.push({ socketId, event, payload });
      },
    };
  }

  /** Simulate a new client connecting: creates a socket and fires `connection`. */
  connect(): FakeSocket {
    this.counter += 1;
    const socket = new FakeSocket(`socket-${this.counter}`);
    if (!this.connectionHandler) {
      throw new Error("FakeIO.connect() called before onConnection was registered");
    }
    this.connectionHandler(socket);
    return socket;
  }
}

const CARD: CardPayload = {
  id: null,
  category: "Test Category",
  left: "Low",
  right: "High",
  custom: true,
};

/** Build a 2-player room and drive it to the moment the chooser confirms the card. */
function setUpRoomAtTopic(): {
  io: FakeIO;
  hostSocket: FakeSocket;
  guestSocket: FakeSocket;
} {
  const io = new FakeIO();
  const onConnection = createHandlers(io as unknown as IO);
  // `onConnection` is typed against the real `Socket`; a `FakeSocket` stands
  // in for it here, so bridge the two only at this registration boundary.
  io.on("connection", onConnection as unknown as (socket: FakeSocket) => void);

  const hostSocket = io.connect();
  let hostAck: JoinResult | undefined;
  hostSocket.trigger(
    "room:create",
    { name: "Host" } satisfies CreateRoomPayload,
    (result: JoinResult) => {
      hostAck = result;
    },
  );
  if (!hostAck?.ok) throw new Error("room:create failed in test setup");
  const code = hostAck.room.code;

  const guestSocket = io.connect();
  let guestAck: JoinResult | undefined;
  guestSocket.trigger(
    "room:join",
    { code, name: "Guest" } satisfies JoinRoomPayload,
    (result: JoinResult) => {
      guestAck = result;
    },
  );
  if (!guestAck?.ok) throw new Error("room:join failed in test setup");

  // Round 1's chooser is players[0] in join order, i.e. the host who created
  // the room and therefore joined first.
  hostSocket.trigger("game:start");

  return { io, hostSocket, guestSocket };
}

describe("createHandlers: target timing", () => {
  it("never emits round:target while the phase is topic", () => {
    const { io } = setUpRoomAtTopic();

    const targetEmits = io.emitted.filter((e) => e.event === "round:target");
    expect(targetEmits).toHaveLength(0);
  });

  it("emits round:target exactly once, only to the chooser, on entering subject", () => {
    const { io, hostSocket, guestSocket } = setUpRoomAtTopic();

    // The chooser confirms their card, moving pass -> topic -> subject.
    hostSocket.trigger("round:card", CARD);

    const targetEmits = io.emitted.filter((e) => e.event === "round:target");
    expect(targetEmits).toHaveLength(1);
    expect(targetEmits[0]?.socketId).toBe(hostSocket.id);
    expect(targetEmits[0]?.socketId).not.toBe(guestSocket.id);
    expect(targetEmits[0]?.payload).toEqual({
      roundNumber: 1,
      target: FIXED_TARGET,
    });
  });
});
