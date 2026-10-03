import type {
  NetworkInterface,
  RunningConfigDiff,
  RunningConfigDiffLine,
  RunningConfigDocument,
  RunningConfigEditInput,
  Switch,
  VlanDefinition,
} from "~/domain";
import type { InterfaceService } from "./InterfaceService";
import type { SwitchService } from "./SwitchService";
import type { VlanService } from "./VlanService";

const GNMI_RUNNING_CONFIG_NOTE =
  "The generic OpenConfig gNMI client supports modeled Get/Set paths, but full EOS running-config text is vendor-specific. This screen stages the text in the service cache until EOS-native running-config paths are mapped.";

export class RunningConfigService {
  private readonly documents = new Map<string, RunningConfigDocument>();

  constructor(
    private readonly switches: SwitchService,
    private readonly interfaces: InterfaceService,
    private readonly vlans: VlanService,
  ) {}

  get(switchId: string): RunningConfigDocument | undefined {
    const cached = this.documents.get(switchId);

    if (cached) {
      return cached;
    }

    const networkSwitch = this.switches.get(switchId);

    if (!networkSwitch) {
      return undefined;
    }

    const document = this.createDocument(networkSwitch);
    this.documents.set(switchId, document);
    return document;
  }

  diff(input: RunningConfigEditInput): RunningConfigDiff | undefined {
    const current = this.get(input.switchId);

    if (!current) {
      return undefined;
    }

    return {
      switchId: input.switchId,
      generatedAt: new Date().toISOString(),
      diffLines: createDiff(current.content, input.content),
      supportedByGnmi: false,
      note: GNMI_RUNNING_CONFIG_NOTE,
    };
  }

  apply(input: RunningConfigEditInput): RunningConfigDocument | undefined {
    if (!this.switches.get(input.switchId)) {
      return undefined;
    }

    const document: RunningConfigDocument = {
      switchId: input.switchId,
      content: input.content,
      loadedAt: new Date().toISOString(),
      source: "service-cache",
      warning: GNMI_RUNNING_CONFIG_NOTE,
    };

    this.documents.set(input.switchId, document);
    return document;
  }

  private createDocument(networkSwitch: Switch): RunningConfigDocument {
    return {
      switchId: networkSwitch.id,
      content: renderConfig(
        networkSwitch,
        this.vlans.list(networkSwitch.id),
        this.interfaces.list(networkSwitch.id),
      ),
      loadedAt: new Date().toISOString(),
      source: "service-cache",
      warning: GNMI_RUNNING_CONFIG_NOTE,
    };
  }
}

function renderConfig(networkSwitch: Switch, vlans: VlanDefinition[], interfaces: NetworkInterface[]): string {
  return [
    `hostname ${networkSwitch.hostname}`,
    "!",
    ...vlans.flatMap((vlan) => [`vlan ${vlan.id}`, `   name ${vlan.description}`, "!"]),
    ...interfaces.flatMap((networkInterface) => renderInterface(networkInterface)),
    "end",
  ].join("\n");
}

function renderInterface(networkInterface: NetworkInterface): string[] {
  const vlanLines = networkInterface.mode === "access"
    ? [
        "   switchport mode access",
        `   switchport access vlan ${networkInterface.vlan.accessVlan ?? 1}`,
      ]
    : [
        "   switchport mode trunk",
        `   switchport trunk native vlan ${networkInterface.vlan.nativeVlan ?? 1}`,
        `   switchport trunk allowed vlan ${networkInterface.vlan.allowedVlans.join(",") || "none"}`,
      ];

  return [
    `interface ${networkInterface.name}`,
    `   description ${networkInterface.description || "unset"}`,
    `   speed ${networkInterface.speed}`,
    ...vlanLines,
    "!",
  ];
}

function createDiff(currentContent: string, candidateContent: string): RunningConfigDiffLine[] {
  const currentLines = currentContent.split("\n");
  const candidateLines = candidateContent.split("\n");
  const lines: RunningConfigDiffLine[] = [];
  const maxLength = Math.max(currentLines.length, candidateLines.length);

  for (let index = 0; index < maxLength; index += 1) {
    const currentLine = currentLines[index];
    const candidateLine = candidateLines[index];

    if (currentLine === candidateLine) {
      if (currentLine !== undefined) {
        lines.push({ type: "context", text: currentLine });
      }
      continue;
    }

    if (currentLine !== undefined) {
      lines.push({ type: "remove", text: currentLine });
    }

    if (candidateLine !== undefined) {
      lines.push({ type: "add", text: candidateLine });
    }
  }

  return lines;
}
