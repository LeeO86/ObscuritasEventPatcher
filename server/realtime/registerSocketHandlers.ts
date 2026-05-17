import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  NetworkInterface,
  ServerToClientEvents,
  TelemetrySubscription,
} from "~/domain";
import { services } from "../services/container";
import { fail, ok } from "./responses";

interface SocketData {
  auth: {
    authenticated: boolean;
    username?: string;
  };
  telemetry: Map<string, NodeJS.Timeout>;
}

type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerSocketHandlers(io: RealtimeServer): void {
  io.use((socket, next) => {
    socket.data.auth = { authenticated: false };
    socket.data.telemetry = new Map();
    next();
  });

  io.on("connection", (socket) => {
    registerAuthHandlers(socket);
    registerConfigHandlers(socket);
    registerSwitchHandlers(io, socket);
    registerInterfaceHandlers(io, socket);
    registerRunningConfigHandlers(socket);
    registerDiscoveryHandlers(socket);
    registerTelemetryHandlers(socket);

    socket.on("disconnect", () => {
      for (const timer of socket.data.telemetry.values()) {
        clearInterval(timer);
      }
      socket.data.telemetry.clear();
    });
  });
}

function registerConfigHandlers(socket: RealtimeSocket): void {
  socket.on("ui-config:get", (callback) => {
    callback(ok(services.uiConfig.getConfig()));
  });

  socket.on("vlans:list", (payload, callback) => {
    callback(ok(services.vlans.list(payload.switchId)));
  });
}

function registerAuthHandlers(socket: RealtimeSocket): void {
  socket.on("auth:login", (payload, callback) => {
    const status = services.auth.validate(payload.username, payload.password);

    if (!status) {
      callback(fail("Invalid portal credentials"));
      return;
    }

    socket.data.auth = status;
    callback(ok(status));
  });

  socket.on("auth:logout", (callback) => {
    socket.data.auth = { authenticated: false };
    callback(ok(socket.data.auth));
  });

  socket.on("auth:status", (callback) => {
    callback(ok(socket.data.auth));
  });
}

function registerSwitchHandlers(io: RealtimeServer, socket: RealtimeSocket): void {
  socket.on("switches:list", (callback) => {
    callback(ok(services.switches.list()));
  });

  socket.on("switches:get", (payload, callback) => {
    const target = services.switches.get(payload.switchId);
    callback(target ? ok(target) : fail("Switch not found"));
  });

  socket.on("switches:add", async (payload, callback) => {
    if (!isAuthenticated(socket)) {
      callback(fail("Login required for switch changes"));
      return;
    }

    const created = await services.switches.add(payload);
    io.emit("switches:changed", services.switches.list());
    callback(ok(created));
  });

  socket.on("switches:remove", (payload, callback) => {
    if (!isAuthenticated(socket)) {
      callback(fail("Login required for switch changes"));
      return;
    }

    const removed = services.switches.remove(payload.switchId);
    io.emit("switches:changed", services.switches.list());
    callback(ok({ removed }));
  });
}

function registerInterfaceHandlers(io: RealtimeServer, socket: RealtimeSocket): void {
  socket.on("interfaces:list", (payload, callback) => {
    callback(ok(services.interfaces.list(payload.switchId)));
  });

  socket.on("interfaces:get", (payload, callback) => {
    const networkInterface = services.interfaces.get(payload.switchId, payload.name);
    callback(networkInterface ? ok(networkInterface) : fail("Interface not found"));
  });

  socket.on("interfaces:update", (payload, callback) => {
    if (!isAuthenticated(socket)) {
      callback(fail("Login required for interface changes"));
      return;
    }

    const updated = services.interfaces.update(payload);

    if (!updated) {
      callback(fail("Interface not found"));
      return;
    }

    const interfaces = services.interfaces.list(payload.switchId);
    io.emit("interfaces:changed", interfaces);
    callback(ok(updated));
  });

  socket.on("interfaces:bulk-update", (payload, callback) => {
    if (!isAuthenticated(socket)) {
      callback(fail("Login required for interface changes"));
      return;
    }

    const updated = services.interfaces.bulkUpdate(payload);

    if (updated.length === 0) {
      callback(fail("No matching interfaces found"));
      return;
    }

    const interfaces = services.interfaces.list(payload.switchId);
    io.emit("interfaces:changed", interfaces);
    callback(ok(updated));
  });
}

function registerRunningConfigHandlers(socket: RealtimeSocket): void {
  socket.on("running-config:get", (payload, callback) => {
    if (!isAuthenticated(socket)) {
      callback(fail("Login required for running config"));
      return;
    }

    const document = services.runningConfig.get(payload.switchId);
    callback(document ? ok(document) : fail("Switch not found"));
  });

  socket.on("running-config:diff", (payload, callback) => {
    if (!isAuthenticated(socket)) {
      callback(fail("Login required for running config"));
      return;
    }

    const diff = services.runningConfig.diff(payload);
    callback(diff ? ok(diff) : fail("Switch not found"));
  });

  socket.on("running-config:apply", (payload, callback) => {
    if (!isAuthenticated(socket)) {
      callback(fail("Login required for running config changes"));
      return;
    }

    const document = services.runningConfig.apply(payload);
    callback(document ? ok(document) : fail("Switch not found"));
  });
}

function registerDiscoveryHandlers(socket: RealtimeSocket): void {
  socket.on("discovery:lldp", (payload, callback) => {
    callback(ok(services.discovery.discoverLldp(payload.switchId)));
  });
}

function registerTelemetryHandlers(socket: RealtimeSocket): void {
  socket.on("telemetry:subscribe", (payload, callback) => {
    const key = telemetryKey(payload);

    if (socket.data.telemetry.has(key)) {
      callback(ok({ subscribed: true }));
      return;
    }

    const timer = setInterval(() => {
      socket.emit("telemetry:update", {
        switchId: payload.switchId,
        interfaces: sampleInterfaces(services.interfaces.list(payload.switchId)),
        sampledAt: new Date().toISOString(),
      });
    }, 2_000);

    socket.data.telemetry.set(key, timer);
    callback(ok({ subscribed: true }));
  });

  socket.on("telemetry:unsubscribe", (payload, callback) => {
    const key = telemetryKey(payload);
    const timer = socket.data.telemetry.get(key);

    if (timer) {
      clearInterval(timer);
      socket.data.telemetry.delete(key);
    }

    callback(ok({ subscribed: false }));
  });
}

function sampleInterfaces(interfaces: NetworkInterface[]): NetworkInterface[] {
  return interfaces.map((networkInterface) => ({
    ...networkInterface,
    counters: {
      ...networkInterface.counters,
      inOctets: networkInterface.counters.inOctets + Math.floor(Math.random() * 4096),
      outOctets: networkInterface.counters.outOctets + Math.floor(Math.random() * 4096),
    },
  }));
}

function telemetryKey(payload: TelemetrySubscription): string {
  return `${payload.switchId}:${payload.interfaceName ?? "*"}`;
}

function isAuthenticated(socket: RealtimeSocket): boolean {
  return socket.data.auth.authenticated;
}
