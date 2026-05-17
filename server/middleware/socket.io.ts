import { handleSocketRequest } from "../realtime/socketServer";

export default defineEventHandler((event) => handleSocketRequest(event));
