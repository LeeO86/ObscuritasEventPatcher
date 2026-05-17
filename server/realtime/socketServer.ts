import type { H3Event } from "h3";
import { Server as EngineServer } from "engine.io";
import { Server as SocketServer } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "~/domain";
import { registerSocketHandlers } from "./registerSocketHandlers";

const SOCKET_PATH = "/socket.io";

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
    transports: ["polling"],
    allowUpgrades: false,
    cors: {
      origin: "*",
    },
  });

  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>({
    path: SOCKET_PATH,
    serveClient: false,
    transports: ["polling"],
    allowUpgrades: false,
    cors: {
      origin: "*",
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
  // Engine.IO owns the Node response for this request; stop Nuxt from rendering SPA HTML.
  const handledEvent = event as H3Event & { _handled: boolean };
  handledEvent._handled = true;

  return new Promise((resolve) => {
    event.node.res.once("finish", resolve);
    event.node.res.once("close", resolve);
    engine.handleRequest(event.node.req, event.node.res);
  });
}
