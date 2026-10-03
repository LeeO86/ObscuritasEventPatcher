import {
  credentials as grpcCredentials,
  Metadata,
  type ClientDuplexStream,
  type ServiceError,
} from "@grpc/grpc-js";
import {
  CapabilityRequest,
  gNMIClient,
  type CapabilityResponse,
  type GetRequest,
  type GetResponse,
  type SetRequest,
  type SetResponse,
  type SubscribeRequest,
  type SubscribeResponse,
} from "~/generated/github.com/openconfig/gnmi/proto/gnmi/gnmi";

export interface GnmiTarget {
  address: string;
  port?: number;
  tls?: boolean;
}

export interface GnmiCredential {
  username: string;
  password: string;
}

export interface GnmiClientService {
  capabilities(target: GnmiTarget, credential: GnmiCredential): Promise<CapabilityResponse>;
  get(target: GnmiTarget, credential: GnmiCredential, request: GetRequest): Promise<GetResponse>;
  set(target: GnmiTarget, credential: GnmiCredential, request: SetRequest): Promise<SetResponse>;
  subscribe(
    target: GnmiTarget,
    credential: GnmiCredential,
    requests: SubscribeRequest[],
    onData: (response: SubscribeResponse) => void,
  ): Promise<() => void>;
}

export class GrpcGnmiClient implements GnmiClientService {
  async capabilities(target: GnmiTarget, credential: GnmiCredential): Promise<CapabilityResponse> {
    return this.withRetry(() =>
      this.unaryCall(target, credential, "capabilities", CapabilityRequest.create()),
    );
  }

  async get(target: GnmiTarget, credential: GnmiCredential, request: GetRequest): Promise<GetResponse> {
    return this.withRetry(() => this.unaryCall<GetRequest, GetResponse>(target, credential, "get", request));
  }

  async set(target: GnmiTarget, credential: GnmiCredential, request: SetRequest): Promise<SetResponse> {
    return this.withRetry(() => this.unaryCall<SetRequest, SetResponse>(target, credential, "set", request));
  }

  async subscribe(
    target: GnmiTarget,
    credential: GnmiCredential,
    requests: SubscribeRequest[],
    onData: (response: SubscribeResponse) => void,
  ): Promise<() => void> {
    const client = this.createClient(target);
    const stream = (client.subscribe as unknown as (metadata: Metadata) => ClientDuplexStream<SubscribeRequest, SubscribeResponse>)(
      this.createMetadata(credential),
    );

    stream.on("data", onData);
    for (const request of requests) {
      stream.write(request);
    }

    return () => stream.end();
  }

  private unaryCall<TRequest, TResponse>(
    target: GnmiTarget,
    credential: GnmiCredential,
    method: "capabilities" | "get" | "set",
    request: TRequest,
  ): Promise<TResponse> {
    const client = this.createClient(target);
    const metadata = this.createMetadata(credential);

    return new Promise((resolve, reject) => {
      const callback = (error: ServiceError | null, response: TResponse) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(response);
      };

      (client[method] as unknown as (request: TRequest, metadata: Metadata, callback: typeof callback) => void)(
        request,
        metadata,
        callback,
      );
    });
  }

  private createClient(target: GnmiTarget): gNMIClient {
    const address = `${target.address}:${target.port ?? 6030}`;
    const channelCredentials = target.tls ? grpcCredentials.createSsl() : grpcCredentials.createInsecure();
    return new gNMIClient(address, channelCredentials);
  }

  private createMetadata(credential: GnmiCredential): Metadata {
    const metadata = new Metadata();
    metadata.set("username", credential.username);
    metadata.set("password", credential.password);
    return metadata;
  }

  private async withRetry<T>(operation: () => Promise<T>, attempts = 2): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }

    throw lastError;
  }
}
