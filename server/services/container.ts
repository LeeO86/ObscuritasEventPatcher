import { GrpcGnmiClient } from "../infrastructure/gnmi/GnmiClient";
import { AuthService } from "./AuthService";
import { CredentialResolver } from "./CredentialResolver";
import { DiscoveryService } from "./DiscoveryService";
import { InterfaceService } from "./InterfaceService";
import { RunningConfigService } from "./RunningConfigService";
import { SwitchService } from "./SwitchService";
import { UiConfigService } from "./UiConfigService";
import { VlanService } from "./VlanService";

const gnmiClient = new GrpcGnmiClient();
const credentialResolver = new CredentialResolver(gnmiClient);
const interfaceService = new InterfaceService();
const switchService = new SwitchService(credentialResolver);
const vlanService = new VlanService(interfaceService);

export const services = {
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
