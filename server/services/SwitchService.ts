import type { AddSwitchInput, Switch } from "~/domain";
import type { CredentialResolver } from "./CredentialResolver";

export class SwitchService {
  private readonly switches = new Map<string, Switch>([
    [
      "leaf-01",
      {
        id: "leaf-01",
        hostname: "leaf-01",
        mgmtIp: "10.0.10.11",
        status: "online",
        credentialState: "unknown",
      },
    ],
    [
      "leaf-02",
      {
        id: "leaf-02",
        hostname: "leaf-02",
        mgmtIp: "10.0.10.12",
        status: "degraded",
        credentialState: "unknown",
      },
    ],
  ]);

  constructor(private readonly credentials: CredentialResolver) {}

  list(): Switch[] {
    return Array.from(this.switches.values());
  }

  get(switchId: string): Switch | undefined {
    return this.switches.get(switchId);
  }

  async add(input: AddSwitchInput): Promise<Switch> {
    const id = normalizeSwitchId(input.hostname);
    const target: Switch = {
      id,
      hostname: input.hostname.trim(),
      mgmtIp: input.mgmtIp.trim(),
      status: "offline",
      credentialState: "testing",
    };

    this.switches.set(id, target);
    const mapping = await this.credentials.resolve(target);
    const resolved: Switch = {
      ...target,
      status: mapping ? "online" : "offline",
      credentialState: mapping ? "valid" : "invalid",
    };

    this.switches.set(id, resolved);
    return resolved;
  }

  remove(switchId: string): boolean {
    return this.switches.delete(switchId);
  }
}

function normalizeSwitchId(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
