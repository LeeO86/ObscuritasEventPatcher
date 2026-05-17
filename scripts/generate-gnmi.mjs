import { mkdir, rm, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const includeRoot = join(root, ".proto-includes");
const openConfigProtoRoot = join(includeRoot, "github.com/openconfig/gnmi/proto");
const generatedRoot = join(root, "generated");
const protocPlugin = join(root, "node_modules/.bin/protoc-gen-ts_proto");

await rm(includeRoot, { recursive: true, force: true });
await rm(generatedRoot, { recursive: true, force: true });
await mkdir(openConfigProtoRoot, { recursive: true });
await mkdir(generatedRoot, { recursive: true });

for (const directory of ["gnmi", "gnmi_ext"]) {
  const target = join(root, "gnmi/proto", directory);
  const link = join(openConfigProtoRoot, directory);
  await mkdir(dirname(link), { recursive: true });
  await symlink(target, link, "dir");
}

const args = [
  `--plugin=${protocPlugin}`,
  "--ts_proto_out=generated",
  "--ts_proto_opt=outputServices=grpc-js,esModuleInterop=true,forceLong=string,useOptionals=messages,env=node",
  `--proto_path=${includeRoot}`,
  "github.com/openconfig/gnmi/proto/gnmi/gnmi.proto",
  "github.com/openconfig/gnmi/proto/gnmi_ext/gnmi_ext.proto",
];

const result = spawnSync("protoc", args, {
  cwd: root,
  stdio: "inherit",
});

await rm(includeRoot, { recursive: true, force: true });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
