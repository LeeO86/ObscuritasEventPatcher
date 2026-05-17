<template>
  <main class="min-h-screen bg-slate-950 text-slate-100">
    <section class="border-b border-slate-800 bg-slate-900/90 px-6 py-5">
      <div class="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Arista gNMI Portal</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight">Obscuritas Event Patcher</h1>
          <p class="mt-2 max-w-3xl text-sm text-slate-300">
            Read-only telemetry is open to everyone. Switch and interface changes require portal authentication.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <span :class="connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'" class="rounded-full px-3 py-1 text-sm">
            {{ connected ? "Socket.IO connected" : "Disconnected" }}
          </span>
          <span :class="auth.authenticated ? 'bg-cyan-500/15 text-cyan-200' : 'bg-amber-500/15 text-amber-200'" class="rounded-full px-3 py-1 text-sm">
            {{ auth.authenticated ? `Logged in as ${auth.username}` : "Read-only session" }}
          </span>
          <button v-if="auth.authenticated" class="btn-secondary" type="button" @click="logout">Logout</button>
          <button v-else class="btn-primary" type="button" @click="showLogin = true">Login to edit</button>
        </div>
      </div>
    </section>

    <section class="mx-auto grid max-w-7xl gap-6 px-6 py-6 xl:grid-cols-[320px_1fr]">
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
              <p class="mt-1 text-sm text-slate-400">{{ networkSwitch.mgmtIp }}</p>
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
          <p v-if="!canWrite" class="mt-3 text-xs text-amber-200">Login is required for write actions.</p>
        </div>
      </aside>

      <div class="space-y-6">
        <section class="grid gap-4 lg:grid-cols-4">
          <div class="metric-card">
            <span>Selected switch</span>
            <strong>{{ selectedSwitch?.hostname ?? "None" }}</strong>
          </div>
          <div class="metric-card">
            <span>Ports up</span>
            <strong>{{ portsUp }}/{{ interfaces.length }}</strong>
          </div>
          <div class="metric-card">
            <span>LLDP neighbors</span>
            <strong>{{ discovery?.neighbors.length ?? 0 }}</strong>
          </div>
          <div class="metric-card">
            <span>Last telemetry</span>
            <strong>{{ lastTelemetryAt ? new Date(lastTelemetryAt).toLocaleTimeString() : "waiting" }}</strong>
          </div>
        </section>

        <section class="panel">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="section-title">Interface dashboard</h2>
              <p class="mt-1 text-sm text-slate-400">Live status, counters, optics, VLANs, and LLDP neighbors.</p>
            </div>
            <button class="btn-secondary" type="button" @click="selectedSwitchId && selectSwitch(selectedSwitchId)">Refresh</button>
          </div>

          <div class="mt-5 overflow-hidden rounded-2xl border border-slate-800">
            <table class="w-full min-w-[760px] text-left text-sm">
              <thead class="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th class="px-4 py-3">Port</th>
                  <th class="px-4 py-3">Mode</th>
                  <th class="px-4 py-3">VLANs</th>
                  <th class="px-4 py-3">Status</th>
                  <th class="px-4 py-3">Counters</th>
                  <th class="px-4 py-3">Optics</th>
                  <th class="px-4 py-3">LLDP</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800">
                <tr
                  v-for="networkInterface in interfaces"
                  :key="networkInterface.name"
                  class="cursor-pointer bg-slate-950/40 hover:bg-slate-900"
                  :class="networkInterface.name === selectedInterfaceName ? 'outline outline-1 outline-cyan-400' : ''"
                  @click="selectInterface(networkInterface.name)"
                >
                  <td class="px-4 py-3">
                    <div class="font-semibold">{{ networkInterface.name }}</div>
                    <div class="text-xs text-slate-500">{{ networkInterface.description }}</div>
                  </td>
                  <td class="px-4 py-3 uppercase">{{ networkInterface.mode }}</td>
                  <td class="px-4 py-3">{{ vlanLabel(networkInterface) }}</td>
                  <td class="px-4 py-3">
                    <span class="status-pill" :data-status="networkInterface.status">{{ networkInterface.status }}</span>
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ compactNumber(networkInterface.counters.inOctets) }} in /
                    {{ compactNumber(networkInterface.counters.outOctets) }} out
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    Rx {{ formatPower(networkInterface.optics.rxPowerDbm) }} /
                    Tx {{ formatPower(networkInterface.optics.txPowerDbm) }}
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ networkInterface.lldp[0]?.systemName ?? "none" }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div class="panel">
            <h2 class="section-title">Port configuration</h2>
            <p class="mt-1 text-sm text-slate-400">Writes are sent over Socket.IO and blocked server-side unless logged in.</p>

            <form v-if="selectedInterface" class="mt-5 grid gap-4 md:grid-cols-2" @submit.prevent="saveInterface">
              <label class="space-y-2">
                <span class="label">Interface</span>
                <input class="field" :value="selectedInterface.name" disabled />
              </label>
              <label class="space-y-2">
                <span class="label">Description</span>
                <input v-model="configForm.description" class="field" :disabled="!canWrite" />
              </label>
              <label class="space-y-2">
                <span class="label">Mode</span>
                <select v-model="configForm.mode" class="field" :disabled="!canWrite">
                  <option value="access">Access</option>
                  <option value="trunk">Trunk</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="label">{{ configForm.mode === "access" ? "Access VLAN" : "Native VLAN" }}</span>
                <input v-model.number="primaryVlan" class="field" min="1" max="4094" type="number" :disabled="!canWrite" />
              </label>
              <label v-if="configForm.mode === 'trunk'" class="space-y-2 md:col-span-2">
                <span class="label">Allowed VLANs</span>
                <input v-model="configForm.allowedVlans" class="field" :disabled="!canWrite" placeholder="10,20,30" />
              </label>
              <div class="md:col-span-2">
                <button class="btn-primary disabled:cursor-not-allowed disabled:opacity-40" :disabled="!canWrite" type="submit">
                  Apply configuration
                </button>
              </div>
            </form>
          </div>

          <div class="panel">
            <h2 class="section-title">LLDP discovery</h2>
            <div class="mt-4 space-y-3">
              <div v-for="neighbor in discovery?.neighbors" :key="`${neighbor.systemName}-${neighbor.portId}`" class="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div class="font-semibold">{{ neighbor.systemName }}</div>
                <div class="text-sm text-slate-400">{{ neighbor.portId }} · {{ neighbor.chassisId }}</div>
                <div class="mt-2 text-xs text-cyan-200">candidate {{ neighbor.candidateMgmtIp }}</div>
              </div>
              <p v-if="!discovery?.neighbors.length" class="text-sm text-slate-400">No neighbors found on selected switch.</p>
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
import type { InterfaceMode, NetworkInterface } from "~/domain";

const {
  addSwitch,
  auth,
  connect,
  connected,
  discovery,
  error,
  interfaces,
  lastTelemetryAt,
  login,
  logout,
  selectSwitch,
  selectedSwitch,
  selectedSwitchId,
  switches,
  updateInterface,
} = useRealtimeNetwork();

const showLogin = ref(false);
const loginForm = reactive({ username: "", password: "" });
const addSwitchForm = reactive({ hostname: "", mgmtIp: "" });
const selectedInterfaceName = ref("");
const primaryVlan = ref(1);
const configForm = reactive({
  description: "",
  mode: "access" as InterfaceMode,
  allowedVlans: "",
});

const canWrite = computed(() => auth.value.authenticated);
const portsUp = computed(() => interfaces.value.filter((networkInterface) => networkInterface.status === "up").length);
const selectedInterface = computed(() =>
  interfaces.value.find((networkInterface) => networkInterface.name === selectedInterfaceName.value),
);

watch(
  interfaces,
  (currentInterfaces) => {
    if (!selectedInterfaceName.value || !currentInterfaces.some((networkInterface) => networkInterface.name === selectedInterfaceName.value)) {
      selectedInterfaceName.value = currentInterfaces[0]?.name ?? "";
      syncInterfaceForm();
    }
  },
);

watch(selectedInterfaceName, syncInterfaceForm);

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

async function saveInterface() {
  const networkInterface = selectedInterface.value;
  const switchId = selectedSwitchId.value;

  if (!networkInterface || !switchId) {
    return;
  }

  await updateInterface({
    switchId,
    name: networkInterface.name,
    description: configForm.description,
    mode: configForm.mode,
    vlan:
      configForm.mode === "access"
        ? { accessVlan: primaryVlan.value, allowedVlans: [] }
        : {
            nativeVlan: primaryVlan.value,
            allowedVlans: parseVlans(configForm.allowedVlans),
          },
  });
}

function selectInterface(name: string) {
  selectedInterfaceName.value = name;
}

function syncInterfaceForm() {
  const networkInterface = selectedInterface.value;

  if (!networkInterface) {
    return;
  }

  configForm.description = networkInterface.description;
  configForm.mode = networkInterface.mode;
  primaryVlan.value = networkInterface.mode === "access" ? networkInterface.vlan.accessVlan ?? 1 : networkInterface.vlan.nativeVlan ?? 1;
  configForm.allowedVlans = networkInterface.vlan.allowedVlans.join(",");
}

function vlanLabel(networkInterface: NetworkInterface): string {
  if (networkInterface.mode === "access") {
    return `access ${networkInterface.vlan.accessVlan ?? "unset"}`;
  }

  return `native ${networkInterface.vlan.nativeVlan ?? 1}; allowed ${networkInterface.vlan.allowedVlans.join(", ")}`;
}

function parseVlans(value: string): number[] {
  return value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0 && entry <= 4094);
}

function compactNumber(value: number): string {
  return Intl.NumberFormat(undefined, { notation: "compact" }).format(value);
}

function formatPower(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)} dBm`;
}
</script>
