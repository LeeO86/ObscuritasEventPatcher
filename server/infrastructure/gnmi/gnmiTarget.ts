import type { Switch } from "~/domain";
import type { GnmiTarget } from "./GnmiClient";

/** Rewrites loopback when the app runs in a devcontainer but gNMI is reached via the host/LAN. */
export function resolveGnmiAddress(mgmtIp: string): string {
  const address = mgmtIp.trim();
  const rewrite = process.env.GNMI_LOCALHOST_REWRITE?.trim();

  if (rewrite && (address === "127.0.0.1" || address === "localhost")) {
    return rewrite;
  }

  return address;
}

export function gnmiTargetFromSwitch(networkSwitch: Switch): GnmiTarget {
  return {
    address: resolveGnmiAddress(networkSwitch.mgmtIp),
    port: networkSwitch.mgmtPort,
    tls: networkSwitch.gnmiTls,
  };
}
