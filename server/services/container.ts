import { GrpcGnmiClient } from "../infrastructure/gnmi/GnmiClient";
import { AuthService } from "./AuthService";
import { CredentialResolver } from "./CredentialResolver";
import { DiscoveryService } from "./DiscoveryService";
import { InterfaceService } from "./InterfaceService";
import { SwitchService } from "./SwitchService";

const gnmiClient = new GrpcGnmiClient();
const credentialResolver = new CredentialResolver(gnmiClient);
const interfaceService = new InterfaceService();

export const services = {
  auth: new AuthService(),
  credentials: credentialResolver,
  discovery: new DiscoveryService(interfaceService),
  gnmi: gnmiClient,
  interfaces: interfaceService,
  switches: new SwitchService(credentialResolver),
};
