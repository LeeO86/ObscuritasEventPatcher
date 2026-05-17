export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export type CredentialState = "unknown" | "testing" | "valid" | "invalid";
export type SwitchStatus = "online" | "degraded" | "offline";
export type InterfaceMode = "access" | "trunk";
export type InterfaceStatus = "up" | "down";

export interface AuthStatus {
  authenticated: boolean;
  username?: string;
}

export interface Switch {
  id: string;
  hostname: string;
  mgmtIp: string;
  status: SwitchStatus;
  credentialState: CredentialState;
}

export interface SwitchCredentialMapping {
  switchId: string;
  username: string;
  passwordIndex: number;
  lastSuccessAt: string;
  lastValidatedAt: string;
  failureCount: number;
}

export interface VlanConfig {
  accessVlan?: number;
  nativeVlan?: number;
  allowedVlans: number[];
}

export interface TrafficCounters {
  inOctets: number;
  outOctets: number;
  inErrors: number;
  outErrors: number;
}

export interface OpticalMetrics {
  rxPowerDbm: number | null;
  txPowerDbm: number | null;
}

export interface LldpNeighbor {
  systemName: string;
  portId: string;
  chassisId: string;
}

export interface NetworkInterface {
  switchId: string;
  name: string;
  description: string;
  mode: InterfaceMode;
  vlan: VlanConfig;
  status: InterfaceStatus;
  counters: TrafficCounters;
  optics: OpticalMetrics;
  lldp: LldpNeighbor[];
}

export interface AddSwitchInput {
  hostname: string;
  mgmtIp: string;
}

export interface UpdateInterfaceInput {
  switchId: string;
  name: string;
  mode: InterfaceMode;
  vlan: VlanConfig;
  description?: string;
}

export interface DiscoveryResult {
  sourceSwitchId: string;
  neighbors: Array<LldpNeighbor & { candidateMgmtIp?: string }>;
}

export interface TelemetrySubscription {
  switchId: string;
  interfaceName?: string;
}

export interface TelemetryUpdate {
  switchId: string;
  interfaces: NetworkInterface[];
  sampledAt: string;
}
