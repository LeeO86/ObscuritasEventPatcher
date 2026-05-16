import type { Switch, SwitchCredentialMapping } from "~/domain";
import type { GnmiClientService, GnmiCredential } from "../infrastructure/gnmi/GnmiClient";

export class CredentialResolver {
  private readonly mappings = new Map<string, SwitchCredentialMapping>();

  constructor(private readonly gnmiClient: GnmiClientService) {}

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
      return undefined;
    }

    for (const username of usernames) {
      for (const [passwordIndex, password] of passwords.entries()) {
        try {
          await this.gnmiClient.capabilities(
            { address: target.mgmtIp, tls: true },
            { username, password },
          );

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
          return mapping;
        } catch {
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
