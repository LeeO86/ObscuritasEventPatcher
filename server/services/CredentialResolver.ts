import type { Switch, SwitchCredentialMapping } from "~/domain";
import { gnmiTargetFromSwitch } from "../infrastructure/gnmi/gnmiTarget";
import type { GnmiClientService, GnmiCredential } from "../infrastructure/gnmi/GnmiClient";
import type { ActivityLogService } from "./ActivityLogService";

export class CredentialResolver {
  private readonly mappings = new Map<string, SwitchCredentialMapping>();

  constructor(
    private readonly gnmiClient: GnmiClientService,
    private readonly activityLog: ActivityLogService,
  ) {}

  getMapping(switchId: string): SwitchCredentialMapping | undefined {
    return this.mappings.get(switchId);
  }

  getCredential(switchId: string): GnmiCredential | undefined {
    const mapping = this.mappings.get(switchId);
    const passwords = this.passwords;

    if (!mapping || !passwords[mapping.passwordIndex]) {
      return undefined;
    }

    return {
      username: mapping.username,
      password: passwords[mapping.passwordIndex],
    };
  }

  async resolve(target: Switch): Promise<SwitchCredentialMapping | undefined> {
    const usernames = this.usernames;
    const passwords = this.passwords;

    if (usernames.length === 0 || passwords.length === 0) {
      this.activityLog.append({
        level: "error",
        category: "gnmi",
        message: `Credential probe skipped for ${target.hostname}`,
        details: "SWITCH_USERNAMES or SWITCH_PASSWORDS is empty",
      });
      return undefined;
    }

    const gnmiTarget = gnmiTargetFromSwitch(target);
    const dialAddress = `${gnmiTarget.address}:${gnmiTarget.port ?? 6030}`;

    this.activityLog.append({
      level: "info",
      category: "gnmi",
      message: `Probing gNMI for ${target.hostname}`,
      details: `${gnmiTarget.tls ? "TLS" : "insecure"} ${dialAddress}${target.mgmtIp !== gnmiTarget.address ? ` (rewrote ${target.mgmtIp})` : ""}`,
    });

    for (const username of usernames) {
      for (const [passwordIndex, password] of passwords.entries()) {
        try {
          const response = await this.gnmiClient.capabilities(gnmiTarget, { username, password });

          const now = new Date().toISOString();
          const mapping: SwitchCredentialMapping = {
            switchId: target.id,
            username,
            passwordIndex,
            lastSuccessAt: now,
            lastValidatedAt: now,
            failureCount: 0,
          };
          this.mappings.set(target.id, mapping);

          this.activityLog.append({
            level: "success",
            category: "gnmi",
            message: `gNMI capabilities OK for ${target.hostname}`,
            details: `User ${username}, version ${response.gNMIVersion || "unknown"}`,
          });

          return mapping;
        } catch (error) {
          const message = formatGrpcError(error);
          this.activityLog.append({
            level: "warn",
            category: "gnmi",
            message: `gNMI probe failed for ${target.hostname}`,
            details: `User ${username} @ ${dialAddress}: ${message}`,
          });

          const previous = this.mappings.get(target.id);
          if (previous) {
            this.mappings.set(target.id, {
              ...previous,
              lastValidatedAt: new Date().toISOString(),
              failureCount: previous.failureCount + 1,
            });
          }
        }
      }
    }

    return undefined;
  }

  seed(mapping: SwitchCredentialMapping): void {
    this.mappings.set(mapping.switchId, mapping);
  }

  private get usernames(): string[] {
    return splitEnvList(process.env.SWITCH_USERNAMES);
  }

  private get passwords(): string[] {
    return splitEnvList(process.env.SWITCH_PASSWORDS);
  }
}

function splitEnvList(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function formatGrpcError(error: unknown): string {
  if (error && typeof error === "object") {
    const grpcError = error as { code?: number; details?: string; message?: string };
    const parts = [grpcError.code !== undefined ? `code ${grpcError.code}` : undefined, grpcError.details, grpcError.message]
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" — ");
    }
  }

  return String(error);
}
