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
GNMI_LOCALHOST_REWRITE=192.168.215.1
SWITCH_UI_CONFIG_PATH=/config/switch-ui.json
NUXT_PUBLIC_SOCKET_IO_PATH=/socket.io
NUXT_PUBLIC_SOCKET_IO_TRANSPORTS=polling,websocket
SOCKET_IO_CORS_ORIGIN=*
PORT=3000
```

Reads are allowed without login. Writes require portal login and are independent from switch credentials.

Switch passwords are never stored per device. The server tries all username/password combinations and caches only the username plus password index for the working credential.

When adding a switch, specify management IP, gNMI port, and whether to use TLS. Many Arista lab switches expose gNMI on port 6031 without TLS (`gnmic --insecure`). If you enter `127.0.0.1` from a devcontainer, set `GNMI_LOCALHOST_REWRITE` to the IP the container can reach (for example the host gateway or switch management address).

Logged-in users see an activity log (sidebar) with gNMI probes, auth events, and configuration changes.

The optional switch UI config file defines VLAN colors and model-specific port layouts. If it is missing or invalid, the app keeps running with defaults and shows a "please contact your administrator" warning. See `config/switch-ui.example.json`.

## Realtime transport

The app serves Socket.IO on the same Nuxt/Nitro origin at `NUXT_PUBLIC_SOCKET_IO_PATH`. Engine.IO starts with HTTP long-polling and automatically upgrades to WebSocket when the browser and proxy path support it. The Nitro middleware bootstraps the Engine.IO server, then Engine.IO attaches to the underlying Node HTTP server so both polling requests and WebSocket upgrades use the same path.

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
