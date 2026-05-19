import type { AddSwitchInput, Switch } from "~/domain";
import { gnmiTargetFromSwitch, resolveGnmiAddress } from "../infrastructure/gnmi/gnmiTarget";
import type { ActivityLogService } from "./ActivityLogService";
import type { CredentialResolver } from "./CredentialResolver";

export class SwitchService {
  private readonly switches = new Map<string, Switch>([
    [
      "leaf-01",
      {
        id: "leaf-01",
        hostname: "leaf-01",
        mgmtIp: "10.0.10.11",
        mgmtPort: 6030,
        gnmiTls: true,
        model: "arista-720xp",
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
        mgmtPort: 6030,
        gnmiTls: true,
        model: "fallback",
        status: "degraded",
        credentialState: "unknown",
      },
    ],
  ]);

  constructor(
    private readonly credentials: CredentialResolver,
    private readonly activityLog: ActivityLogService,
  ) {}

  list(): Switch[] {
    return Array.from(this.switches.values());
  }

  get(switchId: string): Switch | undefined {
    return this.switches.get(switchId);
  }

  async add(input: AddSwitchInput): Promise<Switch> {
    const id = normalizeSwitchId(input.hostname);
    const mgmtPort = normalizePort(input.mgmtPort);
    const target: Switch = {
      id,
      hostname: input.hostname.trim(),
      mgmtIp: input.mgmtIp.trim(),
      mgmtPort,
      gnmiTls: Boolean(input.gnmiTls),
      model: "fallback",
      status: "offline",
      credentialState: "testing",
    };

    const resolvedAddress = resolveGnmiAddress(target.mgmtIp);
    const gnmiTarget = gnmiTargetFromSwitch(target);
    this.activityLog.append({
      level: "info",
      category: "switch",
      message: `Adding switch ${target.hostname}`,
      details: `gNMI ${gnmiTarget.tls ? "TLS" : "insecure"} → ${resolvedAddress}:${gnmiTarget.port ?? 6030}`,
    });

    this.switches.set(id, target);
    const mapping = await this.credentials.resolve(target);
    const resolved: Switch = {
      ...target,
      status: mapping ? "online" : "offline",
      credentialState: mapping ? "valid" : "invalid",
    };

    this.switches.set(id, resolved);
    this.activityLog.append({
      level: mapping ? "success" : "error",
      category: "switch",
      message: mapping
        ? `Switch ${resolved.hostname} is online`
        : `Switch ${resolved.hostname} is offline`,
      details: mapping
        ? `Using credential user ${mapping.username}`
        : "No matching SWITCH_USERNAMES / SWITCH_PASSWORDS combination succeeded",
    });

    return resolved;
  }

  remove(switchId: string): boolean {
    const removed = this.switches.delete(switchId);

    if (removed) {
      this.activityLog.append({
        level: "info",
        category: "switch",
        message: `Removed switch ${switchId}`,
      });
    }

    return removed;
  }
}

function normalizeSwitchId(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizePort(port: number): number {
  if (!Number.isFinite(port) || port < 1 || port > 65_535) {
    return 6030;
  }

  return Math.trunc(port);
}
