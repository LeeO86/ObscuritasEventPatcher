import { existsSync, readFileSync } from "node:fs";
import type { SwitchPortLayout, SwitchUiConfig } from "~/domain";

interface RawSwitchUiConfig {
  vlanColors?: Record<string, string>;
  switchLayouts?: Record<string, SwitchPortLayout>;
}

const DEFAULT_VLAN_COLORS: Record<string, string> = {
  "1": "#64748b",
  "10": "#22d3ee",
  "20": "#a78bfa",
  "30": "#34d399",
  "40": "#f59e0b",
  "50": "#fb7185",
  "100": "#60a5fa",
};

const ARISTA_720XP_LAYOUT: SwitchPortLayout = {
  model: "arista-720xp",
  rows: [
    [...numberedPorts(1, 47, 2), "Ethernet49", "Ethernet51"],
    [...numberedPorts(2, 48, 2), "Ethernet50", "Ethernet52"],
  ],
};

const DEFAULT_LAYOUTS: Record<string, SwitchPortLayout> = {
  "arista-720xp": ARISTA_720XP_LAYOUT,
};

export class UiConfigService {
  private readonly configPath = process.env.SWITCH_UI_CONFIG_PATH ?? "/config/switch-ui.json";
  private readonly config = this.loadConfig();

  getConfig(): SwitchUiConfig {
    return this.config;
  }

  getLayout(model: string, portNames: string[]): SwitchPortLayout {
    return this.config.switchLayouts[model] ?? createFallbackLayout(model, portNames);
  }

  private loadConfig(): SwitchUiConfig {
    const errors: string[] = [];
    const raw = this.readConfig(errors);
    const vlanColors = this.validateVlanColors(raw?.vlanColors, errors);
    const switchLayouts = this.validateLayouts(raw?.switchLayouts, errors);

    return {
      configPath: this.configPath,
      vlanColors: { ...DEFAULT_VLAN_COLORS, ...vlanColors },
      switchLayouts: { ...DEFAULT_LAYOUTS, ...switchLayouts },
      errors,
    };
  }

  private readConfig(errors: string[]): RawSwitchUiConfig | undefined {
    if (!existsSync(this.configPath)) {
      errors.push(`Switch UI config file ${this.configPath} was not found. Please contact your administrator.`);
      return undefined;
    }

    try {
      return JSON.parse(readFileSync(this.configPath, "utf8")) as RawSwitchUiConfig;
    } catch (error) {
      errors.push(`Switch UI config file ${this.configPath} is not valid JSON. Please contact your administrator.`);
      errors.push(error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  private validateVlanColors(colors: Record<string, string> | undefined, errors: string[]): Record<string, string> {
    if (!colors) {
      return {};
    }

    const validColors: Record<string, string> = {};

    for (const [vlanId, color] of Object.entries(colors)) {
      if (!isValidVlanId(Number(vlanId))) {
        errors.push(`VLAN color key "${vlanId}" is not a valid VLAN id. Please contact your administrator.`);
        continue;
      }

      if (!/^#[0-9a-f]{6}$/i.test(color)) {
        errors.push(`VLAN ${vlanId} color "${color}" must be a 6-digit hex color. Please contact your administrator.`);
        continue;
      }

      validColors[vlanId] = color;
    }

    return validColors;
  }

  private validateLayouts(layouts: Record<string, SwitchPortLayout> | undefined, errors: string[]): Record<string, SwitchPortLayout> {
    if (!layouts) {
      return {};
    }

    const validLayouts: Record<string, SwitchPortLayout> = {};

    for (const [model, layout] of Object.entries(layouts)) {
      if (!layout?.rows?.length || layout.rows.some((row) => !Array.isArray(row) || row.some((port) => typeof port !== "string" || port.trim() === ""))) {
        errors.push(`Switch layout "${model}" must define non-empty rows of port names. Please contact your administrator.`);
        continue;
      }

      validLayouts[model] = {
        model: layout.model || model,
        rows: layout.rows.map((row) => row.map((port) => port.trim())),
      };
    }

    return validLayouts;
  }
}

function numberedPorts(start: number, end: number, step: number): string[] {
  const ports: string[] = [];

  for (let port = start; port <= end; port += step) {
    ports.push(`Ethernet${port}`);
  }

  return ports;
}

function createFallbackLayout(model: string, portNames: string[]): SwitchPortLayout {
  const sortedPorts = [...portNames].sort((left, right) => portNumber(left) - portNumber(right));
  return {
    model,
    rows: [
      sortedPorts.filter((_port, index) => index % 2 === 0),
      sortedPorts.filter((_port, index) => index % 2 === 1),
    ],
  };
}

function portNumber(name: string): number {
  return Number(name.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
}

function isValidVlanId(vlanId: number): boolean {
  return Number.isInteger(vlanId) && vlanId >= 1 && vlanId <= 4094;
}
