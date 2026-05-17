import type { DiscoveryResult } from "~/domain";
import type { InterfaceService } from "./InterfaceService";

export class DiscoveryService {
  constructor(private readonly interfaces: InterfaceService) {}

  discoverLldp(sourceSwitchId: string): DiscoveryResult {
    const neighbors = this.interfaces
      .list(sourceSwitchId)
      .flatMap((networkInterface) => networkInterface.lldp)
      .map((neighbor, index) => ({
        ...neighbor,
        candidateMgmtIp: `10.0.20.${index + 10}`,
      }));

    return {
      sourceSwitchId,
      neighbors,
    };
  }
}
