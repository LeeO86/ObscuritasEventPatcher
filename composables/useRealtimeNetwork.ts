import { io, type Socket } from "socket.io-client";
import type {
  AddSwitchInput,
  ApiResponse,
  AuthStatus,
  ClientToServerEvents,
  DiscoveryResult,
  NetworkInterface,
  ServerToClientEvents,
  Switch,
  TelemetryUpdate,
  UpdateInterfaceInput,
} from "~/domain";

type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useRealtimeNetwork() {
  const socket = useState<RealtimeSocket | null>("realtime-socket", () => null);
  const connected = useState("realtime-connected", () => false);
  const auth = useState<AuthStatus>("realtime-auth", () => ({ authenticated: false }));
  const switches = useState<Switch[]>("switches", () => []);
  const selectedSwitchId = useState<string | undefined>("selected-switch-id", () => undefined);
  const interfaces = useState<NetworkInterface[]>("interfaces", () => []);
  const discovery = useState<DiscoveryResult | undefined>("discovery", () => undefined);
  const lastTelemetryAt = useState<string | undefined>("last-telemetry-at", () => undefined);
  const error = useState<string | undefined>("realtime-error", () => undefined);

  const selectedSwitch = computed(() => switches.value.find((networkSwitch) => networkSwitch.id === selectedSwitchId.value));

  function connect() {
    if (!import.meta.client || socket.value) {
      return;
    }

    const client = io({ path: "/socket.io" });
    socket.value = client;

    client.on("connect", async () => {
      connected.value = true;
      await refreshAuth();
      await loadSwitches();
    });

    client.on("disconnect", () => {
      connected.value = false;
    });

    client.on("switches:changed", async (payload) => {
      switches.value = payload;
      selectedSwitchId.value = selectedSwitchId.value ?? payload[0]?.id;
      if (selectedSwitchId.value) {
        await loadInterfaces(selectedSwitchId.value);
      }
    });

    client.on("interfaces:changed", (payload) => {
      if (!selectedSwitchId.value || payload.every((item) => item.switchId === selectedSwitchId.value)) {
        interfaces.value = payload;
      }
    });

    client.on("telemetry:update", (payload: TelemetryUpdate) => {
      if (payload.switchId === selectedSwitchId.value) {
        interfaces.value = payload.interfaces;
        lastTelemetryAt.value = payload.sampledAt;
      }
    });
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
    if (selectedSwitchId.value) {
      await loadInterfaces(selectedSwitchId.value);
      await subscribeTelemetry(selectedSwitchId.value);
      await discoverLldp(selectedSwitchId.value);
    }
    return response;
  }

  async function selectSwitch(switchId: string) {
    selectedSwitchId.value = switchId;
    await loadInterfaces(switchId);
    await subscribeTelemetry(switchId);
    await discoverLldp(switchId);
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
    auth,
    connect,
    connected,
    discovery,
    error,
    interfaces,
    lastTelemetryAt,
    loadSwitches,
    login,
    logout,
    removeSwitch,
    selectSwitch,
    selectedSwitch,
    selectedSwitchId,
    switches,
    updateInterface,
  };
}
