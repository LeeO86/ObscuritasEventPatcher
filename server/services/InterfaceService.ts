import type { NetworkInterface, UpdateInterfaceInput } from "~/domain";

export class InterfaceService {
  private readonly interfaces = new Map<string, NetworkInterface[]>([
    [
      "leaf-01",
      [
        {
          switchId: "leaf-01",
          name: "Ethernet1",
          description: "Uplink to spine-01",
          mode: "trunk",
          vlan: { nativeVlan: 1, allowedVlans: [10, 20, 30, 100] },
          status: "up",
          counters: { inOctets: 1849203301, outOctets: 2039211440, inErrors: 0, outErrors: 0 },
          optics: { rxPowerDbm: -2.1, txPowerDbm: -1.7 },
          lldp: [{ systemName: "spine-01", portId: "Ethernet3", chassisId: "44:38:39:ff:00:01" }],
        },
        {
          switchId: "leaf-01",
          name: "Ethernet2",
          description: "Workstation access",
          mode: "access",
          vlan: { accessVlan: 20, allowedVlans: [] },
          status: "down",
          counters: { inOctets: 918233, outOctets: 1283930, inErrors: 0, outErrors: 2 },
          optics: { rxPowerDbm: null, txPowerDbm: null },
          lldp: [],
        },
      ],
    ],
    [
      "leaf-02",
      [
        {
          switchId: "leaf-02",
          name: "Ethernet1",
          description: "Uplink to spine-02",
          mode: "trunk",
          vlan: { nativeVlan: 1, allowedVlans: [10, 40, 50] },
          status: "up",
          counters: { inOctets: 884921103, outOctets: 1000392101, inErrors: 1, outErrors: 0 },
          optics: { rxPowerDbm: -2.8, txPowerDbm: -2.0 },
          lldp: [{ systemName: "spine-02", portId: "Ethernet4", chassisId: "44:38:39:ff:00:02" }],
        },
      ],
    ],
  ]);

  list(switchId: string): NetworkInterface[] {
    return [...(this.interfaces.get(switchId) ?? [])];
  }

  get(switchId: string, name: string): NetworkInterface | undefined {
    return this.interfaces.get(switchId)?.find((networkInterface) => networkInterface.name === name);
  }

  update(input: UpdateInterfaceInput): NetworkInterface | undefined {
    const existing = this.interfaces.get(input.switchId);
    const index = existing?.findIndex((networkInterface) => networkInterface.name === input.name) ?? -1;

    if (!existing || index < 0) {
      return undefined;
    }

    const updated: NetworkInterface = {
      ...existing[index],
      description: input.description ?? existing[index].description,
      mode: input.mode,
      vlan: normalizeVlanConfig(input),
    };

    existing[index] = updated;
    this.interfaces.set(input.switchId, existing);
    return updated;
  }
}

function normalizeVlanConfig(input: UpdateInterfaceInput): NetworkInterface["vlan"] {
  if (input.mode === "access") {
    return {
      accessVlan: input.vlan.accessVlan ?? input.vlan.allowedVlans[0] ?? 1,
      allowedVlans: [],
    };
  }

  return {
    nativeVlan: input.vlan.nativeVlan ?? 1,
    allowedVlans: Array.from(new Set(input.vlan.allowedVlans)).sort((left, right) => left - right),
  };
}
