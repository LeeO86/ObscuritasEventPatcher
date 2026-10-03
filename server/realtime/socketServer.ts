import type { Server as HttpServer } from "node:http";
import type { H3Event } from "h3";
import { Server as EngineServer } from "engine.io";
import { Server as SocketServer } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "~/domain";
import { registerSocketHandlers } from "./registerSocketHandlers";

const SOCKET_PATH = normalizeSocketPath(process.env.NUXT_PUBLIC_SOCKET_IO_PATH ?? "/socket.io");
const SOCKET_TRANSPORTS = ["polling", "websocket"] as const;

type RealtimeServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;

interface RealtimeState {
  attachedServers: WeakSet<HttpServer>;
  engine: EngineServer;
  io: RealtimeServer;
}

let state: RealtimeState | undefined;

export function getRealtimeServer(): RealtimeState {
  if (state) {
    return state;
  }

  const engine = new EngineServer({
    path: SOCKET_PATH,
    transports: [...SOCKET_TRANSPORTS],
    allowUpgrades: true,
    cors: {
      origin: process.env.SOCKET_IO_CORS_ORIGIN ?? "*",
    },
  });

  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>({
    path: SOCKET_PATH,
    serveClient: false,
    transports: [...SOCKET_TRANSPORTS],
    allowUpgrades: true,
    cors: {
      origin: process.env.SOCKET_IO_CORS_ORIGIN ?? "*",
    },
  });

  io.bind(engine);
  registerSocketHandlers(io);

  state = { attachedServers: new WeakSet<HttpServer>(), engine, io };
  return state;
}

export async function closeRealtimeServer(): Promise<void> {
  const current = state;
  state = undefined;
  await current?.io.close();
}

export function isSocketRequest(event: H3Event): boolean {
  const url = event.node.req.url ?? "";
  return url === SOCKET_PATH || url.startsWith(`${SOCKET_PATH}/`) || url.startsWith(`${SOCKET_PATH}?`);
}

export function handleSocketRequest(event: H3Event): Promise<void> | undefined {
  attachRealtimeServer(event);

  if (!isSocketRequest(event)) {
    return undefined;
  }

  const { engine } = getRealtimeServer();

  return new Promise((resolve) => {
    event.node.res.once("finish", resolve);
    event.node.res.once("close", resolve);
    // Engine.IO owns this HTTP response. Returning this promise keeps H3 from
    // falling through to Nuxt's SSR renderer when this bootstrap middleware
    // handles the first /socket.io polling request before Engine.IO is attached.
    engine.handleRequest(event.node.req, event.node.res);
  });
}

function attachRealtimeServer(event: H3Event): void {
  const httpServer = getHttpServer(event);

  if (!httpServer) {
    return;
  }

  const realtime = getRealtimeServer();

  if (realtime.attachedServers.has(httpServer)) {
    return;
  }

  realtime.attachedServers.add(httpServer);
  realtime.engine.attach(httpServer, {
    destroyUpgrade: false,
    path: SOCKET_PATH,
  });
}

function getHttpServer(event: H3Event): HttpServer | undefined {
  const socketWithServer = event.node.req.socket as typeof event.node.req.socket & {
    server?: HttpServer;
  };

  return socketWithServer.server;
}

function normalizeSocketPath(path: string): string {
  const trimmed = path.trim() || "/socket.io";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
