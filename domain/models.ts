export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export type CredentialState = "unknown" | "testing" | "valid" | "invalid";
export type SwitchStatus = "online" | "degraded" | "offline";
export type InterfaceMode = "access" | "trunk";
export type InterfaceStatus = "up" | "down";
export type InterfaceMedia = "copper" | "sfp";

export interface AuthStatus {
  authenticated: boolean;
  username?: string;
}

export interface Switch {
  id: string;
  hostname: string;
  mgmtIp: string;
  model: string;
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

export interface VlanDefinition {
  id: number;
  description: string;
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
  speed: string;
  media: InterfaceMedia;
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
  speed?: string;
}

export interface BulkUpdateInterfaceInput {
  switchId: string;
  names: string[];
  mode?: InterfaceMode;
  vlan?: VlanConfig;
  descriptionTemplate?: string;
  speed?: string;
}

export interface SwitchPortLayout {
  model: string;
  rows: string[][];
}

export interface SwitchUiConfig {
  configPath: string;
  vlanColors: Record<string, string>;
  switchLayouts: Record<string, SwitchPortLayout>;
  errors: string[];
}

export interface RunningConfigDocument {
  switchId: string;
  content: string;
  loadedAt: string;
  source: "gnmi" | "service-cache";
  warning?: string;
}

export interface RunningConfigDiffLine {
  type: "context" | "add" | "remove";
  text: string;
}

export interface RunningConfigDiff {
  switchId: string;
  generatedAt: string;
  diffLines: RunningConfigDiffLine[];
  supportedByGnmi: boolean;
  note: string;
}

export interface RunningConfigEditInput {
  switchId: string;
  content: string;
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
