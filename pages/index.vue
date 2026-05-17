<template>
  <main class="min-h-screen bg-slate-950 text-slate-100">
    <section class="border-b border-slate-800 bg-slate-900/90 px-6 py-5">
      <div class="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Arista gNMI Portal</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight">Obscuritas Event Patcher</h1>
          <p class="mt-2 max-w-3xl text-sm text-slate-300">
            Status is read-only. Port changes and running-config edits require the portal login.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <span :class="connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'" class="rounded-full px-3 py-1 text-sm">
            {{ connected ? "Socket.IO connected" : "Disconnected" }}
          </span>
          <span :class="canWrite ? 'bg-cyan-500/15 text-cyan-200' : 'bg-amber-500/15 text-amber-200'" class="rounded-full px-3 py-1 text-sm">
            {{ canWrite ? `Logged in as ${auth.username}` : "Read-only session" }}
          </span>
          <button v-if="canWrite" class="btn-secondary" type="button" @click="logout">Logout</button>
          <button v-else class="btn-primary" type="button" @click="showLogin = true">Login to edit</button>
        </div>
      </div>
    </section>

    <section class="mx-auto grid max-w-7xl gap-6 px-6 py-6 xl:grid-cols-[340px_1fr]">
      <aside class="space-y-4">
        <div class="panel">
          <div class="flex items-center justify-between">
            <h2 class="section-title">Switches</h2>
            <span class="text-xs text-slate-400">{{ switches.length }} managed</span>
          </div>

          <div class="mt-4 space-y-3">
            <button
              v-for="networkSwitch in switches"
              :key="networkSwitch.id"
              class="w-full rounded-2xl border p-4 text-left transition"
              :class="networkSwitch.id === selectedSwitchId ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'"
              type="button"
              @click="selectSwitch(networkSwitch.id)"
            >
              <div class="flex items-center justify-between">
                <span class="font-semibold">{{ networkSwitch.hostname }}</span>
                <span class="status-pill" :data-status="networkSwitch.status">{{ networkSwitch.status }}</span>
              </div>
              <p class="mt-1 text-sm text-slate-400">{{ networkSwitch.mgmtIp }} · {{ networkSwitch.model }}</p>
              <div class="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-2">
                <div v-for="(row, rowIndex) in layoutRows(networkSwitch)" :key="`${networkSwitch.id}-${rowIndex}`" class="flex gap-1">
                  <span
                    v-for="portName in row"
                    :key="portName"
                    class="mb-1 h-3 min-w-3 flex-1 rounded-sm border border-slate-700"
                    :style="portStyle(interfaceFor(networkSwitch.id, portName))"
                    :title="`${portName}: ${vlanLabel(interfaceFor(networkSwitch.id, portName))}`"
                  />
                </div>
              </div>
              <p class="mt-2 text-xs uppercase tracking-wide text-slate-500">
                credentials: {{ networkSwitch.credentialState }}
              </p>
            </button>
          </div>
        </div>

        <div class="panel">
          <h2 class="section-title">Add switch</h2>
          <p class="mt-2 text-sm text-slate-400">Uses shared credential combinations from environment variables.</p>
          <form class="mt-4 space-y-3" @submit.prevent="submitAddSwitch">
            <input v-model="addSwitchForm.hostname" class="field" :disabled="!canWrite" placeholder="leaf-03" />
            <input v-model="addSwitchForm.mgmtIp" class="field" :disabled="!canWrite" placeholder="10.0.10.13" />
            <button class="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40" :disabled="!canWrite" type="submit">
              Add switch
            </button>
          </form>
          <p v-if="!canWrite" class="mt-3 text-xs text-amber-200">Login is required for switch changes.</p>
        </div>
      </aside>

      <div class="space-y-6">
        <div v-if="adminWarnings.length" class="rounded-3xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p class="font-semibold">Configuration warning</p>
          <ul class="mt-2 list-disc space-y-1 pl-5">
            <li v-for="warning in adminWarnings" :key="warning">{{ warning }}</li>
          </ul>
        </div>

        <section class="panel">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Selected switch</p>
              <h2 class="mt-1 text-2xl font-bold">{{ selectedSwitch?.hostname ?? "No switch selected" }}</h2>
              <p class="mt-1 text-sm text-slate-400">
                {{ selectedSwitch?.mgmtIp ?? "Select a switch" }} · {{ selectedSwitch?.model ?? "unknown model" }}
              </p>
            </div>
            <div class="grid grid-cols-3 gap-3 text-center text-sm">
              <div class="rounded-2xl bg-slate-950 px-4 py-3">
                <div class="text-slate-500">Ports up</div>
                <div class="text-xl font-bold">{{ portsUp }}/{{ interfaces.length }}</div>
              </div>
              <div class="rounded-2xl bg-slate-950 px-4 py-3">
                <div class="text-slate-500">VLANs</div>
                <div class="text-xl font-bold">{{ vlans.length }}</div>
              </div>
              <div class="rounded-2xl bg-slate-950 px-4 py-3">
                <div class="text-slate-500">Telemetry</div>
                <div class="text-xl font-bold">{{ lastTelemetryAt ? new Date(lastTelemetryAt).toLocaleTimeString() : "waiting" }}</div>
              </div>
            </div>
          </div>

          <div class="mt-5 rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
            <div v-for="(row, rowIndex) in selectedLayoutRows" :key="`selected-${rowIndex}`" class="flex gap-2">
              <button
                v-for="portName in row"
                :key="portName"
                class="mb-2 min-h-12 min-w-12 flex-1 rounded-xl border px-2 py-2 text-xs font-bold text-slate-950 shadow-inner transition hover:scale-[1.02]"
                :class="isPortSelected(portName) ? 'ring-2 ring-cyan-300' : 'ring-0'"
                :style="portStyle(interfaceFor(selectedSwitchId, portName))"
                type="button"
                @click="togglePort(portName)"
              >
                <span class="block">{{ shortPortName(portName) }}</span>
                <span class="mt-1 block text-[10px] font-semibold opacity-80">{{ vlanShortLabel(interfaceFor(selectedSwitchId, portName)) }}</span>
              </button>
            </div>
          </div>
          <p class="mt-3 text-xs text-slate-500">
            Access ports use their VLAN color. Trunks use a gradient from their allowed VLANs.
          </p>
        </section>

        <section class="panel">
          <div class="flex flex-wrap gap-2">
            <button class="tab-button" :class="activeTab === 'status' ? 'tab-button-active' : ''" type="button" @click="activeTab = 'status'">
              Status
            </button>
            <button class="tab-button" :class="activeTab === 'config' ? 'tab-button-active' : 'opacity-50'" type="button" @click="activateProtectedTab('config')">
              Config
            </button>
            <button class="tab-button" :class="activeTab === 'running' ? 'tab-button-active' : 'opacity-50'" type="button" @click="activateProtectedTab('running')">
              Running config
            </button>
          </div>

          <div v-if="activeTab === 'status'" class="mt-5 space-y-5">
            <div class="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div class="overflow-hidden rounded-2xl border border-slate-800">
                <table class="w-full min-w-[780px] text-left text-sm">
                  <thead class="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th class="px-4 py-3">Port</th>
                      <th class="px-4 py-3">Status</th>
                      <th class="px-4 py-3">Speed</th>
                      <th class="px-4 py-3">Assigned VLAN</th>
                      <th class="px-4 py-3">Optics</th>
                      <th class="px-4 py-3">Description</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    <tr v-for="networkInterface in interfaces" :key="networkInterface.name" class="bg-slate-950/40">
                      <td class="px-4 py-3 font-semibold">{{ networkInterface.name }}</td>
                      <td class="px-4 py-3">
                        <span class="status-pill" :data-status="networkInterface.status">{{ networkInterface.status }}</span>
                      </td>
                      <td class="px-4 py-3">{{ networkInterface.speed }}</td>
                      <td class="px-4 py-3">{{ vlanLabel(networkInterface) }}</td>
                      <td class="px-4 py-3">
                        <span v-if="networkInterface.media === 'sfp'">
                          Rx {{ formatPower(networkInterface.optics.rxPowerDbm) }} / Tx {{ formatPower(networkInterface.optics.txPowerDbm) }}
                        </span>
                        <span v-else class="text-slate-500">copper</span>
                      </td>
                      <td class="px-4 py-3 text-slate-300">{{ networkInterface.description }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                <h3 class="font-bold">VLAN inventory</h3>
                <div class="mt-3 space-y-2">
                  <div v-for="vlan in vlans" :key="vlan.id" class="flex items-center gap-3 rounded-xl bg-slate-900 p-2">
                    <span class="h-4 w-4 rounded" :style="{ background: vlanColor(vlan.id) }" />
                    <span class="font-semibold">VLAN {{ vlan.id }}</span>
                    <span class="text-sm text-slate-400">{{ vlan.description }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'config'" class="mt-5">
            <div class="mb-4 flex flex-wrap items-center gap-3">
              <span class="text-sm text-slate-400">{{ selectedPortNames.length }} ports selected from the switch display</span>
              <button class="btn-secondary" type="button" @click="selectAllPorts">Select all</button>
              <button class="btn-secondary" type="button" @click="selectedPortNames = []">Clear</button>
            </div>

            <form class="grid gap-4 md:grid-cols-2" @submit.prevent="saveBulkConfiguration">
              <label class="space-y-2">
                <span class="label">Mode</span>
                <select v-model="configForm.mode" class="field">
                  <option value="access">Access</option>
                  <option value="trunk">Trunk</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="label">Port speed</span>
                <select v-model="configForm.speed" class="field">
                  <option v-for="speed in speedOptions" :key="speed" :value="speed">{{ speed }}</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="label">{{ configForm.mode === "access" ? "Access VLAN" : "Native VLAN" }}</span>
                <input v-model.number="primaryVlan" class="field" min="1" max="4094" type="number" />
              </label>
              <label v-if="configForm.mode === 'trunk'" class="space-y-2">
                <span class="label">Allowed VLANs</span>
                <input v-model="configForm.allowedVlans" class="field" placeholder="10,20,30" />
              </label>
              <label class="space-y-2 md:col-span-2">
                <span class="label">Description template</span>
                <input v-model="configForm.descriptionTemplate" class="field" placeholder="Desk {1} counts up across selected ports" />
              </label>
              <div class="md:col-span-2">
                <button class="btn-primary disabled:cursor-not-allowed disabled:opacity-40" :disabled="!selectedPortNames.length" type="submit">
                  Apply to selected ports
                </button>
              </div>
            </form>
          </div>

          <div v-else class="mt-5 space-y-4">
            <div class="flex flex-wrap items-center gap-3">
              <button class="btn-secondary" type="button" @click="loadRunningConfigForSelected">Reload running config</button>
              <button class="btn-secondary" type="button" @click="showConfigDiff">Show diff</button>
              <button class="btn-primary disabled:cursor-not-allowed disabled:opacity-40" :disabled="!runningConfigDiff" type="button" @click="applyConfig">
                Apply displayed diff
              </button>
            </div>
            <p v-if="runningConfig?.warning" class="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
              {{ runningConfig.warning }}
            </p>
            <textarea v-model="runningConfigDraft" class="field min-h-[360px] font-mono text-xs" spellcheck="false" />
            <div v-if="runningConfigDiff" class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <h3 class="font-bold">Pending diff</h3>
              <pre class="mt-3 max-h-80 overflow-auto text-xs"><span
                v-for="(line, index) in runningConfigDiff.diffLines"
                :key="index"
                :class="diffClass(line.type)"
              >{{ diffPrefix(line.type) }}{{ line.text }}
</span></pre>
            </div>
          </div>
        </section>
      </div>
    </section>

    <div v-if="showLogin" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4">
      <form class="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" @submit.prevent="submitLogin">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-xl font-bold">Portal login</h2>
            <p class="mt-1 text-sm text-slate-400">Uses APP_USERNAME and APP_PASSWORD on the server.</p>
          </div>
          <button class="text-slate-400 hover:text-white" type="button" @click="showLogin = false">x</button>
        </div>
        <div class="mt-5 space-y-3">
          <input v-model="loginForm.username" class="field" autocomplete="username" placeholder="Username" />
          <input v-model="loginForm.password" class="field" autocomplete="current-password" placeholder="Password" type="password" />
        </div>
        <p v-if="error" class="mt-3 text-sm text-red-300">{{ error }}</p>
        <div class="mt-5 flex justify-end gap-3">
          <button class="btn-secondary" type="button" @click="showLogin = false">Cancel</button>
          <button class="btn-primary" type="submit">Login</button>
        </div>
      </form>
    </div>
  </main>
</template>

<script lang="ts" setup>
import type { InterfaceMode, NetworkInterface, RunningConfigDiffLine, Switch } from "~/domain";

type WorkspaceTab = "status" | "config" | "running";

const {
  addSwitch,
  applyRunningConfig,
  auth,
  bulkUpdateInterfaces,
  connect,
  connected,
  diffRunningConfig,
  error,
  interfaceCache,
  interfaces,
  lastTelemetryAt,
  loadRunningConfig,
  login,
  logout,
  runningConfig,
  runningConfigDiff,
  selectSwitch,
  selectedSwitch,
  selectedSwitchId,
  switches,
  uiConfig,
  vlans,
} = useRealtimeNetwork();

const showLogin = ref(false);
const loginForm = reactive({ username: "", password: "" });
const addSwitchForm = reactive({ hostname: "", mgmtIp: "" });
const activeTab = ref<WorkspaceTab>("status");
const selectedPortNames = ref<string[]>([]);
const primaryVlan = ref(20);
const runningConfigDraft = ref("");
const speedOptions = ["auto", "100M", "1G", "10G", "25G", "40G", "100G"];
const configForm = reactive({
  descriptionTemplate: "",
  mode: "access" as InterfaceMode,
  speed: "auto",
  allowedVlans: "10,20,30",
});

const canWrite = computed(() => auth.value.authenticated);
const portsUp = computed(() => interfaces.value.filter((networkInterface) => networkInterface.status === "up").length);
const adminWarnings = computed(() => [
  ...(uiConfig.value?.errors ?? []),
  ...(selectedSwitchIssue.value ? [selectedSwitchIssue.value] : []),
]);
const selectedSwitchIssue = computed(() => {
  if (!selectedSwitch.value) {
    return undefined;
  }

  if (selectedSwitch.value.status === "offline" || selectedSwitch.value.credentialState === "invalid") {
    return `No connection to ${selectedSwitch.value.hostname}. Please contact your administrator.`;
  }

  return undefined;
});
const selectedLayoutRows = computed(() => selectedSwitch.value ? layoutRows(selectedSwitch.value) : []);

watch(runningConfig, (document) => {
  runningConfigDraft.value = document?.content ?? "";
});

watch(selectedSwitchId, () => {
  selectedPortNames.value = [];
  activeTab.value = "status";
});

onMounted(() => {
  connect();
});

async function submitLogin() {
  const response = await login(loginForm.username, loginForm.password);
  if (response.success) {
    showLogin.value = false;
    loginForm.password = "";
  }
}

async function submitAddSwitch() {
  await addSwitch({
    hostname: addSwitchForm.hostname,
    mgmtIp: addSwitchForm.mgmtIp,
  });
  addSwitchForm.hostname = "";
  addSwitchForm.mgmtIp = "";
}

function activateProtectedTab(tab: WorkspaceTab) {
  if (!canWrite.value) {
    showLogin.value = true;
    return;
  }

  activeTab.value = tab;
  if (tab === "running") {
    void loadRunningConfigForSelected();
  }
}

async function saveBulkConfiguration() {
  const switchId = selectedSwitchId.value;

  if (!switchId || selectedPortNames.value.length === 0) {
    return;
  }

  await bulkUpdateInterfaces({
    switchId,
    names: selectedPortNames.value,
    descriptionTemplate: configForm.descriptionTemplate || undefined,
    mode: configForm.mode,
    speed: configForm.speed,
    vlan: configForm.mode === "access"
      ? { accessVlan: primaryVlan.value, allowedVlans: [] }
      : { nativeVlan: primaryVlan.value, allowedVlans: parseVlans(configForm.allowedVlans) },
  });
}

async function loadRunningConfigForSelected() {
  if (selectedSwitchId.value) {
    await loadRunningConfig(selectedSwitchId.value);
  }
}

async function showConfigDiff() {
  if (selectedSwitchId.value) {
    await diffRunningConfig({ switchId: selectedSwitchId.value, content: runningConfigDraft.value });
  }
}

async function applyConfig() {
  if (selectedSwitchId.value && runningConfigDiff.value) {
    await applyRunningConfig({ switchId: selectedSwitchId.value, content: runningConfigDraft.value });
  }
}

function togglePort(portName: string) {
  if (activeTab.value !== "config") {
    selectedPortNames.value = [portName];
    return;
  }

  if (selectedPortNames.value.includes(portName)) {
    selectedPortNames.value = selectedPortNames.value.filter((name) => name !== portName);
  } else {
    selectedPortNames.value = [...selectedPortNames.value, portName];
  }
}

function selectAllPorts() {
  selectedPortNames.value = interfaces.value.map((networkInterface) => networkInterface.name);
}

function isPortSelected(portName: string): boolean {
  return selectedPortNames.value.includes(portName);
}

function layoutRows(networkSwitch: Switch): string[][] {
  const configuredRows = uiConfig.value?.switchLayouts[networkSwitch.model]?.rows;

  if (configuredRows?.length) {
    return addExtraPorts(configuredRows, cachedInterfaces(networkSwitch.id));
  }

  return fallbackRows(cachedInterfaces(networkSwitch.id).map((networkInterface) => networkInterface.name));
}

function addExtraPorts(rows: string[][], cachedPorts: NetworkInterface[]): string[][] {
  const knownPorts = new Set(rows.flat());
  const extraPorts = cachedPorts.map((port) => port.name).filter((name) => !knownPorts.has(name));
  return extraPorts.length ? [...rows, extraPorts] : rows;
}

function fallbackRows(portNames: string[]): string[][] {
  const sortedPorts = [...portNames].sort((left, right) => portNumber(left) - portNumber(right));
  return [
    sortedPorts.filter((_port, index) => index % 2 === 0),
    sortedPorts.filter((_port, index) => index % 2 === 1),
  ];
}

function cachedInterfaces(switchId: string | undefined): NetworkInterface[] {
  return switchId ? interfaceCache.value[switchId] ?? [] : [];
}

function interfaceFor(switchId: string | undefined, portName: string): NetworkInterface | undefined {
  return cachedInterfaces(switchId).find((networkInterface) => networkInterface.name === portName);
}

function portStyle(networkInterface: NetworkInterface | undefined): Record<string, string> {
  if (!networkInterface) {
    return { background: "#1e293b", borderColor: "#334155", color: "#94a3b8" };
  }

  const background = networkInterface.mode === "trunk"
    ? trunkGradient(networkInterface)
    : vlanColor(networkInterface.vlan.accessVlan ?? 1);

  return {
    background,
    borderColor: networkInterface.status === "up" ? "#a7f3d0" : "#475569",
    color: "#020617",
  };
}

function trunkGradient(networkInterface: NetworkInterface): string {
  const vlanIds = networkInterface.vlan.allowedVlans.length
    ? networkInterface.vlan.allowedVlans
    : [networkInterface.vlan.nativeVlan ?? 1];
  const colors = vlanIds.map((vlanId) => vlanColor(vlanId));

  if (colors.length === 1) {
    return colors[0];
  }

  return `linear-gradient(135deg, ${colors.map((color, index) => `${color} ${(index / colors.length) * 100}% ${((index + 1) / colors.length) * 100}%`).join(", ")})`;
}

function vlanColor(vlanId: number): string {
  return uiConfig.value?.vlanColors[String(vlanId)] ?? "#64748b";
}

function vlanLabel(networkInterface: NetworkInterface | undefined): string {
  if (!networkInterface) {
    return "no data";
  }

  if (networkInterface.mode === "access") {
    const vlanId = networkInterface.vlan.accessVlan ?? 1;
    return `access ${vlanId} (${vlanDescription(vlanId)})`;
  }

  return `trunk native ${networkInterface.vlan.nativeVlan ?? 1}; allowed ${networkInterface.vlan.allowedVlans.join(", ") || "none"}`;
}

function vlanShortLabel(networkInterface: NetworkInterface | undefined): string {
  if (!networkInterface) {
    return "-";
  }

  return networkInterface.mode === "access"
    ? `V${networkInterface.vlan.accessVlan ?? 1}`
    : "trunk";
}

function vlanDescription(vlanId: number): string {
  return vlans.value.find((vlan) => vlan.id === vlanId)?.description ?? "unknown";
}

function parseVlans(value: string): number[] {
  return value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0 && entry <= 4094);
}

function shortPortName(portName: string): string {
  return portName.replace("Ethernet", "E");
}

function portNumber(name: string): number {
  return Number(name.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
}

function formatPower(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)} dBm`;
}

function diffPrefix(type: RunningConfigDiffLine["type"]): string {
  return type === "add" ? "+ " : type === "remove" ? "- " : "  ";
}

function diffClass(type: RunningConfigDiffLine["type"]): string {
  return type === "add" ? "block text-emerald-300" : type === "remove" ? "block text-red-300" : "block text-slate-400";
}
</script>
