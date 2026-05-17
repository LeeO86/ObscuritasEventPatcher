import { closeRealtimeServer, getRealtimeServer } from "../realtime/socketServer";

export default defineNitroPlugin((nitroApp) => {
  getRealtimeServer();
  nitroApp.hooks.hookOnce("close", closeRealtimeServer);
});
