import type { Socket } from "socket.io-client";
import type {
  AddSwitchInput,
  ApiResponse,
  AuthStatus,
  BulkUpdateInterfaceInput,
  ClientToServerEvents,
  DiscoveryResult,
  NetworkInterface,
  RunningConfigDiff,
  RunningConfigDocument,
  RunningConfigEditInput,
  ServerToClientEvents,
  Switch,
  SwitchUiConfig,
  TelemetryUpdate,
  UpdateInterfaceInput,
  VlanDefinition,
} from "~/domain";

type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type SocketTransport = "polling" | "websocket";

export function useRealtimeNetwork() {
  const socket = useState<RealtimeSocket | null>("realtime-socket", () => null);
  const connected = useState("realtime-connected", () => false);
  const auth = useState<AuthStatus>("realtime-auth", () => ({ authenticated: false }));
  const switches = useState<Switch[]>("switches", () => []);
  const uiConfig = useState<SwitchUiConfig | undefined>("switch-ui-config", () => undefined);
  const selectedSwitchId = useState<string | undefined>("selected-switch-id", () => undefined);
  const interfaces = useState<NetworkInterface[]>("interfaces", () => []);
  const interfaceCache = useState<Record<string, NetworkInterface[]>>("interface-cache", () => ({}));
  const vlans = useState<VlanDefinition[]>("vlans", () => []);
  const discovery = useState<DiscoveryResult | undefined>("discovery", () => undefined);
  const runningConfig = useState<RunningConfigDocument | undefined>("running-config", () => undefined);
  const runningConfigDiff = useState<RunningConfigDiff | undefined>("running-config-diff", () => undefined);
  const lastTelemetryAt = useState<string | undefined>("last-telemetry-at", () => undefined);
  const error = useState<string | undefined>("realtime-error", () => undefined);

  const selectedSwitch = computed(() => switches.value.find((networkSwitch) => networkSwitch.id === selectedSwitchId.value));

  async function connect() {
    if (!import.meta.client || socket.value) {
      return;
    }

    const { io } = await import("socket.io-client");
    const clientConfig = socketClientConfig();
    const client = io(clientConfig.url || undefined, {
      path: clientConfig.path,
      transports: clientConfig.transports,
      upgrade: true,
      timeout: 10_000,
    });
    socket.value = client;

    client.on("connect", async () => {
      connected.value = true;
      await refreshAuth();
      await loadUiConfig();
      await loadSwitches();
    });

    client.on("disconnect", () => {
      connected.value = false;
    });

    client.on("connect_error", (connectionError) => {
      error.value = `Realtime connection failed: ${connectionError.message}`;
    });

    client.on("switches:changed", async (payload) => {
      switches.value = payload;
      selectedSwitchId.value = payload.some((networkSwitch) => networkSwitch.id === selectedSwitchId.value)
        ? selectedSwitchId.value
        : payload[0]?.id;
      await Promise.all(payload.map((networkSwitch) => loadInterfaceCache(networkSwitch.id)));
      if (selectedSwitchId.value) {
        interfaces.value = interfaceCache.value[selectedSwitchId.value] ?? [];
        await loadVlans(selectedSwitchId.value);
      }
    });

    client.on("interfaces:changed", (payload) => {
      const switchId = payload[0]?.switchId;
      if (switchId) {
        interfaceCache.value = { ...interfaceCache.value, [switchId]: payload };
      }
      if (!selectedSwitchId.value || payload.every((item) => item.switchId === selectedSwitchId.value)) {
        interfaces.value = payload;
      }
    });

    client.on("telemetry:update", (payload: TelemetryUpdate) => {
      interfaceCache.value = { ...interfaceCache.value, [payload.switchId]: payload.interfaces };
      if (payload.switchId === selectedSwitchId.value) {
        interfaces.value = payload.interfaces;
        lastTelemetryAt.value = payload.sampledAt;
      }
    });
  }

  function socketClientConfig(): { path: string; transports: SocketTransport[]; url: string } {
    const config = useRuntimeConfig();
    return {
      path: normalizeSocketPath(config.public.socketIoPath),
      transports: parseSocketTransports(config.public.socketIoTransports),
      url: String(config.public.socketIoUrl ?? ""),
    };
  }

  async function refreshAuth() {
    const response = await request<AuthStatus>("auth:status");
    if (response.success) {
      auth.value = response.data;
    }
    return response;
  }

  async function login(username: string, password: string) {
    const response = await request<AuthStatus>("auth:login", { username, password });
    if (response.success) {
      auth.value = response.data;
      error.value = undefined;
    } else {
      error.value = response.error;
    }
    return response;
  }

  async function logout() {
    const response = await request<AuthStatus>("auth:logout");
    if (response.success) {
      auth.value = response.data;
    }
    return response;
  }

  async function loadSwitches() {
    const response = await request<Switch[]>("switches:list");
    if (!response.success) {
      error.value = response.error;
      return response;
    }

    switches.value = response.data;
    selectedSwitchId.value = selectedSwitchId.value ?? response.data[0]?.id;
    await Promise.all(response.data.map((networkSwitch) => loadInterfaceCache(networkSwitch.id)));
    if (selectedSwitchId.value) {
      interfaces.value = interfaceCache.value[selectedSwitchId.value] ?? [];
      await loadVlans(selectedSwitchId.value);
      await subscribeTelemetry(selectedSwitchId.value);
      await discoverLldp(selectedSwitchId.value);
    }
    return response;
  }

  async function selectSwitch(switchId: string) {
    selectedSwitchId.value = switchId;
    runningConfig.value = undefined;
    runningConfigDiff.value = undefined;
    await loadInterfaces(switchId);
    await loadVlans(switchId);
    await subscribeTelemetry(switchId);
    await discoverLldp(switchId);
  }

  async function loadUiConfig() {
    const response = await request<SwitchUiConfig>("ui-config:get");
    if (response.success) {
      uiConfig.value = response.data;
    } else {
      error.value = response.error;
    }
    return response;
  }

  async function addSwitch(input: AddSwitchInput) {
    const response = await request<Switch>("switches:add", input);
    if (response.success) {
      await loadSwitches();
      selectedSwitchId.value = response.data.id;
    } else {
      error.value = response.error;
    }
    return response;
  }

  async function removeSwitch(switchId: string) {
    const response = await request<{ removed: boolean }>("switches:remove", { switchId });
    if (response.success) {
      selectedSwitchId.value = undefined;
      await loadSwitches();
    } else {
      error.value = response.error;
    }
    return response;
  }

  async function loadInterfaces(switchId: string) {
    const response = await request<NetworkInterface[]>("interfaces:list", { switchId });
    if (response.success) {
      interfaces.value = response.data;
      interfaceCache.value = { ...interfaceCache.value, [switchId]: response.data };
    } else {
      error.value = response.error;
    }
    return response;
  }

  async function loadInterfaceCache(switchId: string) {
    const response = await request<NetworkInterface[]>("interfaces:list", { switchId });
    if (response.success) {
      interfaceCache.value = { ...interfaceCache.value, [switchId]: response.data };
    }
    return response;
  }

  async function loadVlans(switchId: string) {
    const response = await request<VlanDefinition[]>("vlans:list", { switchId });
    if (response.success) {
      vlans.value = response.data;
    } else {
      error.value = response.error;
    }
    return response;
  }

  async function updateInterface(input: UpdateInterfaceInput) {
    const response = await request<NetworkInterface>("interfaces:update", input);
    if (response.success) {
      await loadInterfaces(input.switchId);
    } else {
      error.value = response.error;
    }
    return response;
  }

  async function bulkUpdateInterfaces(input: BulkUpdateInterfaceInput) {
    const response = await request<NetworkInterface[]>("interfaces:bulk-update", input);
    if (response.success) {
      await loadInterfaces(input.switchId);
      await loadVlans(input.switchId);
    } else {
      error.value = response.error;
    }
    return response;
  }

  async function loadRunningConfig(switchId: string) {
    const response = await request<RunningConfigDocument>("running-config:get", { switchId });
    if (response.success) {
      runningConfig.value = response.data;
      runningConfigDiff.value = undefined;
    } else {
      error.value = response.error;
    }
    return response;
  }

  async function diffRunningConfig(input: RunningConfigEditInput) {
    const response = await request<RunningConfigDiff>("running-config:diff", input);
    if (response.success) {
      runningConfigDiff.value = response.data;
    } else {
      error.value = response.error;
    }
    return response;
  }

  async function applyRunningConfig(input: RunningConfigEditInput) {
    const response = await request<RunningConfigDocument>("running-config:apply", input);
    if (response.success) {
      runningConfig.value = response.data;
      runningConfigDiff.value = undefined;
    } else {
      error.value = response.error;
    }
    return response;
  }

  async function discoverLldp(switchId: string) {
    const response = await request<DiscoveryResult>("discovery:lldp", { switchId });
    if (response.success) {
      discovery.value = response.data;
    }
    return response;
  }

  async function subscribeTelemetry(switchId: string) {
    return request<{ subscribed: boolean }>("telemetry:subscribe", { switchId });
  }

  function request<T>(event: keyof ClientToServerEvents, payload?: unknown): Promise<ApiResponse<T>> {
    return new Promise((resolve) => {
      const client = socket.value;

      if (!client || !connected.value) {
        resolve({ success: false, error: "Realtime connection is not ready" });
        return;
      }

      const callback = (response: ApiResponse<T>) => resolve(response);
      const rawClient = client as unknown as {
        emit: (eventName: string, ...args: unknown[]) => void;
      };

      if (payload === undefined) {
        rawClient.emit(event, callback);
      } else {
        rawClient.emit(event, payload, callback);
      }
    });
  }

  return {
    addSwitch,
    applyRunningConfig,
    auth,
    bulkUpdateInterfaces,
    connect,
    connected,
    diffRunningConfig,
    discovery,
    error,
    interfaceCache,
    interfaces,
    lastTelemetryAt,
    loadRunningConfig,
    loadSwitches,
    loadUiConfig,
    loadVlans,
    login,
    logout,
    removeSwitch,
    runningConfig,
    runningConfigDiff,
    selectSwitch,
    selectedSwitch,
    selectedSwitchId,
    switches,
    uiConfig,
    updateInterface,
    vlans,
  };
}

function normalizeSocketPath(path: unknown): string {
  const normalizedPath = String(path || "/socket.io").trim() || "/socket.io";
  return normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
}

function parseSocketTransports(transports: unknown): SocketTransport[] {
  const requestedTransports = String(transports || "polling")
    .split(",")
    .map((transport) => transport.trim().toLowerCase())
    .filter(Boolean);

  const supportedTransports = requestedTransports.filter(
    (transport): transport is SocketTransport => transport === "polling" || transport === "websocket",
  );

  if (supportedTransports.length === 0) {
    return ["polling", "websocket"];
  }

  return Array.from(new Set(supportedTransports));
}
