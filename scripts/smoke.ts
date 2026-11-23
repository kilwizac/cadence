import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { emptyWorkspace } from "../src/renderer/model";

const root = resolve(import.meta.dir, "..");
const temp = await mkdtemp(join(tmpdir(), "cadence-smoke-"));
const userData = join(temp, "user-data");
const screenshot = join(temp, "cadence.png");
const workspace = { ...emptyWorkspace(), companyProfile: { industry: "", description: "" } };

await mkdir(userData);
await writeFile(join(userData, "workspace.json"), JSON.stringify(workspace));
await symlink(join(root, "dist"), join(temp, "dist"), "dir");
await symlink(join(root, "dist-electron"), join(temp, "dist-electron"), "dir");
await Bun.build({
  entrypoints: [join(import.meta.dir, "smoke-driver.ts")],
  outdir: temp,
  target: "node",
  format: "cjs",
  external: ["electron"],
});

const electron = Bun.spawn([
  join(root, "node_modules/.bin/electron"),
  join(temp, "smoke-driver.js"),
  userData, screenshot, workspace.name,
], {
  env: { ...process.env, VITE_DEV_SERVER_URL: undefined, ELECTRON_RUN_AS_NODE: undefined },
  stdio: ["ignore", "inherit", "inherit"],
  timeout: 60_000,
  killSignal: "SIGKILL",
});

const code = await electron.exited;
if (code !== 0) throw new Error(`Offscreen smoke test exited with code ${code}; scratch directory: ${temp}`);
console.log(`Offscreen smoke test passed. Screenshot: ${screenshot}`);
