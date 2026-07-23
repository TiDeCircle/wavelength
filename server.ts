import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./src/lib/socket/events";
import { SOCKET_PATH } from "./src/lib/socket/events";
import { createHandlers, startRoomSweeper } from "./src/server/handlers";

/**
 * Custom Node entrypoint: Next and Socket.io share one long-lived process.
 *
 * This is why the app cannot deploy to a serverless target — Socket.io needs a
 * process that stays up between requests. See the deploy notes in PROJECT.md.
 */

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    // Answered by this process rather than by Next, so a green health check
    // means the socket server itself is alive — that is what PM2 is watching.
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, uptime: Math.round(process.uptime()) }));
      return;
    }

    handle(req, res).catch((err) => {
      console.error("[next] request failed", err);
      res.statusCode = 500;
      res.end("internal error");
    });
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      path: SOCKET_PATH,
      serveClient: false,
      // Rooms are tiny; the defaults are more than enough headroom.
      pingTimeout: 20_000,
      pingInterval: 10_000,
    },
  );

  io.on("connection", createHandlers(io));
  startRoomSweeper();

  httpServer.listen(port, hostname, () => {
    console.log(`▲ wavelength ready on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
