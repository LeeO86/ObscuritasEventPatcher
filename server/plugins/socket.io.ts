import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "~/domain";
import { registerSocketHandlers } from "../realtime/registerSocketHandlers";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hookOnce("listen", (server) => {
    const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
      path: "/socket.io",
      cors: {
        origin: "*",
      },
    });

    registerSocketHandlers(io);
  });
});
