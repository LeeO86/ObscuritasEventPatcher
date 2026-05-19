import type { BulkUpdateInterfaceInput, NetworkInterface, UpdateInterfaceInput } from "~/domain";

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
          speed: "25G",
          media: "sfp",
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
          speed: "1G",
          media: "copper",
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
          speed: "25G",
          media: "sfp",
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
      speed: input.speed ?? existing[index].speed,
    };

    existing[index] = updated;
    this.interfaces.set(input.switchId, existing);
    return updated;
  }

  bulkUpdate(input: BulkUpdateInterfaceInput): NetworkInterface[] {
    const existing = this.interfaces.get(input.switchId);

    if (!existing) {
      return [];
    }

    const selectedNames = new Set(input.names);
    const updatedInterfaces: NetworkInterface[] = [];
    const updatedList = existing.map((networkInterface) => {
      if (!selectedNames.has(networkInterface.name)) {
        return networkInterface;
      }

      const selectedIndex = input.names.indexOf(networkInterface.name);
      const description = input.descriptionTemplate === undefined
        ? networkInterface.description
        : applyDescriptionTemplate(input.descriptionTemplate, selectedIndex);
      const mode = input.mode ?? networkInterface.mode;
      const updated: NetworkInterface = {
        ...networkInterface,
        description,
        mode,
        speed: input.speed ?? networkInterface.speed,
        vlan: input.vlan ? normalizeVlanConfig({ ...input, mode, vlan: input.vlan, name: networkInterface.name }) : networkInterface.vlan,
      };

      updatedInterfaces.push(updated);
      return updated;
    });

    this.interfaces.set(input.switchId, updatedList);
    return updatedInterfaces;
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

function applyDescriptionTemplate(template: string, selectedIndex: number): string {
  return template.replace(/\{(\d+)\}/g, (_match, start: string) => String(Number(start) + selectedIndex));
}
