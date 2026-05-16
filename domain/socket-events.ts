import type {
  AddSwitchInput,
  ApiResponse,
  AuthStatus,
  DiscoveryResult,
  NetworkInterface,
  Switch,
  TelemetrySubscription,
  TelemetryUpdate,
  UpdateInterfaceInput,
} from "./models";

export type ResponseCallback<T> = (response: ApiResponse<T>) => void;

export interface LoginInput {
  username: string;
  password: string;
}

export interface SwitchIdInput {
  switchId: string;
}

export interface InterfaceIdInput extends SwitchIdInput {
  name: string;
}

export interface ClientToServerEvents {
  "auth:login": (payload: LoginInput, callback: ResponseCallback<AuthStatus>) => void;
  "auth:logout": (callback: ResponseCallback<AuthStatus>) => void;
  "auth:status": (callback: ResponseCallback<AuthStatus>) => void;
  "switches:list": (callback: ResponseCallback<Switch[]>) => void;
  "switches:get": (payload: SwitchIdInput, callback: ResponseCallback<Switch>) => void;
  "switches:add": (payload: AddSwitchInput, callback: ResponseCallback<Switch>) => void;
  "switches:remove": (payload: SwitchIdInput, callback: ResponseCallback<{ removed: boolean }>) => void;
  "interfaces:list": (payload: SwitchIdInput, callback: ResponseCallback<NetworkInterface[]>) => void;
  "interfaces:get": (payload: InterfaceIdInput, callback: ResponseCallback<NetworkInterface>) => void;
  "interfaces:update": (payload: UpdateInterfaceInput, callback: ResponseCallback<NetworkInterface>) => void;
  "discovery:lldp": (payload: SwitchIdInput, callback: ResponseCallback<DiscoveryResult>) => void;
  "telemetry:subscribe": (payload: TelemetrySubscription, callback: ResponseCallback<{ subscribed: boolean }>) => void;
  "telemetry:unsubscribe": (payload: TelemetrySubscription, callback: ResponseCallback<{ subscribed: boolean }>) => void;
}

export interface ServerToClientEvents {
  "switches:changed": (payload: Switch[]) => void;
  "interfaces:changed": (payload: NetworkInterface[]) => void;
  "telemetry:update": (payload: TelemetryUpdate) => void;
}

export const WRITE_EVENTS = new Set<keyof ClientToServerEvents>([
  "switches:add",
  "switches:remove",
  "interfaces:update",
]);
