import type { H3Event } from "h3";
import { Server as EngineServer } from "engine.io";
import { Server as SocketServer } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "~/domain";
import { registerSocketHandlers } from "./registerSocketHandlers";

const SOCKET_PATH = normalizeSocketPath(process.env.NUXT_PUBLIC_SOCKET_IO_PATH ?? "/socket.io");
const SOCKET_TRANSPORTS = ["polling"] as const;

type RealtimeServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;

interface RealtimeState {
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
    allowUpgrades: false,
    cors: {
      origin: process.env.SOCKET_IO_CORS_ORIGIN ?? "*",
    },
  });

  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>({
    path: SOCKET_PATH,
    serveClient: false,
    transports: [...SOCKET_TRANSPORTS],
    allowUpgrades: false,
    cors: {
      origin: process.env.SOCKET_IO_CORS_ORIGIN ?? "*",
    },
  });

  io.bind(engine);
  registerSocketHandlers(io);

  state = { engine, io };
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
  if (!isSocketRequest(event)) {
    return undefined;
  }

  const { engine } = getRealtimeServer();

  return new Promise((resolve) => {
    event.node.res.once("finish", resolve);
    event.node.res.once("close", resolve);
    // Engine.IO owns this HTTP response. Returning this promise keeps H3 from
    // falling through to Nuxt's SSR renderer for /socket.io polling requests.
    engine.handleRequest(event.node.req, event.node.res);
  });
}

function normalizeSocketPath(path: string): string {
  const trimmed = path.trim() || "/socket.io";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
