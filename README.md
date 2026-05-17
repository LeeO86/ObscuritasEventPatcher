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
NUXT_PORT=3000
```

Reads are allowed without login. Writes require portal login and are independent from switch credentials.

Switch passwords are never stored per device. The server tries all username/password combinations and caches only the username plus password index for the working credential.

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
