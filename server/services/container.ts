import { GrpcGnmiClient } from "../infrastructure/gnmi/GnmiClient";
import { ActivityLogService } from "./ActivityLogService";
import { AuthService } from "./AuthService";
import { CredentialResolver } from "./CredentialResolver";
import { DiscoveryService } from "./DiscoveryService";
import { InterfaceService } from "./InterfaceService";
import { RunningConfigService } from "./RunningConfigService";
import { SwitchService } from "./SwitchService";
import { UiConfigService } from "./UiConfigService";
import { VlanService } from "./VlanService";

const activityLog = new ActivityLogService();
const gnmiClient = new GrpcGnmiClient();
const credentialResolver = new CredentialResolver(gnmiClient, activityLog);
const interfaceService = new InterfaceService();
const switchService = new SwitchService(credentialResolver, activityLog);
const vlanService = new VlanService(interfaceService);

export const services = {
  activityLog,
  auth: new AuthService(),
  credentials: credentialResolver,
  discovery: new DiscoveryService(interfaceService),
  gnmi: gnmiClient,
  interfaces: interfaceService,
  runningConfig: new RunningConfigService(switchService, interfaceService, vlanService),
  switches: switchService,
  uiConfig: new UiConfigService(),
  vlans: vlanService,
};
