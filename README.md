# Obscuritas Event Patcher

Nuxt 3 prototype for managing Arista switches through a Socket.IO realtime API and an OpenConfig gNMI infrastructure boundary.

## Architecture

- `pages` and `composables`: UI layer.
- `server/realtime`: Socket.IO API handlers. No REST endpoints are used for application logic.
- `server/services`: business logic for auth, switches, interfaces, discovery, and credentials.
- `server/infrastructure`: gNMI client implementation using `@grpc/grpc-js`.
- `domain`: shared TypeScript models and Socket.IO event contracts.
- `generated`: `ts-proto` output from the OpenConfig gNMI protobuf submodule.

## Environment

```bash
APP_USERNAME=admin
APP_PASSWORD=secret
SWITCH_USERNAMES=admin,operator,automation
SWITCH_PASSWORDS=secret1,secret2,secret3
SWITCH_UI_CONFIG_PATH=/config/switch-ui.json
NUXT_PUBLIC_SOCKET_IO_PATH=/socket.io
NUXT_PUBLIC_SOCKET_IO_TRANSPORTS=polling
SOCKET_IO_CORS_ORIGIN=*
PORT=3000
```

Reads are allowed without login. Writes require portal login and are independent from switch credentials.

Switch passwords are never stored per device. The server tries all username/password combinations and caches only the username plus password index for the working credential.

The optional switch UI config file defines VLAN colors and model-specific port layouts. If it is missing or invalid, the app keeps running with defaults and shows a "please contact your administrator" warning. See `config/switch-ui.example.json`.

## Realtime transport

The app serves Socket.IO on the same Nuxt/Nitro origin at `NUXT_PUBLIC_SOCKET_IO_PATH` and intentionally uses Engine.IO long-polling. WebSocket upgrade requests do not pass through H3 middleware, so same-port WebSocket transport is not enabled in this integration. If a deployment requires WebSockets, run Socket.IO on a dedicated Node listener and proxy upgrade requests to it.

## Setup

```bash
git submodule update --init --recursive
npm ci
npm run generate:gnmi
```

## Development

```bash
npm run dev
```

The app starts on `http://localhost:3000`.

## Build

```bash
npm run generate:gnmi
npm run build
```

## CI

GitHub Actions checks out submodules, installs Node.js 22, installs `protobuf-compiler`, runs `npm ci`, regenerates gNMI TypeScript, validates `generated` has no drift, and builds the Nuxt app.
