"use client";

import { io, type Socket } from "socket.io-client";
import {
  SOCKET_PATH,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "./events";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

/**
 * One socket per browser tab, created lazily.
 *
 * Reconnection is left to Socket.io; re-entering the room afterwards is the
 * store's job, since only it knows which seat to reclaim.
 */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io({
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
