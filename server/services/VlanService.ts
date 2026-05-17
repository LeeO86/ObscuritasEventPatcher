import type { NetworkInterface, VlanDefinition } from "~/domain";
import type { InterfaceService } from "./InterfaceService";

const DEFAULT_DESCRIPTIONS = new Map<number, string>([
  [1, "Default"],
  [10, "Users"],
  [20, "Workstations"],
  [30, "Voice"],
  [40, "Cameras"],
  [50, "IoT"],
  [100, "Infrastructure"],
]);

export class VlanService {
  constructor(private readonly interfaces: InterfaceService) {}

  list(switchId: string): VlanDefinition[] {
    const vlanIds = new Set<number>();

    for (const networkInterface of this.interfaces.list(switchId)) {
      for (const vlanId of interfaceVlans(networkInterface)) {
        vlanIds.add(vlanId);
      }
    }

    return Array.from(vlanIds)
      .sort((left, right) => left - right)
      .map((id) => ({
        id,
        description: DEFAULT_DESCRIPTIONS.get(id) ?? `VLAN ${id}`,
      }));
  }
}

function interfaceVlans(networkInterface: NetworkInterface): number[] {
  if (networkInterface.mode === "access") {
    return networkInterface.vlan.accessVlan ? [networkInterface.vlan.accessVlan] : [];
  }

  return [
    networkInterface.vlan.nativeVlan,
    ...networkInterface.vlan.allowedVlans,
  ].filter((vlanId): vlanId is number => Number.isInteger(vlanId));
}
