import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface PackageJson {
  name?: string;
  version?: string;
  license?: string | { type?: string };
  repository?: string | { url?: string };
  dependencies?: Record<string, NpmDependency>;
}

interface NpmDependency extends PackageJson {
  dependencies?: Record<string, NpmDependency>;
}

interface NoticePackage {
  name: string;
  version: string;
  license: string;
  repository: string;
  notice: string;
}

const mitLicense = (copyright: string) => `MIT License

${copyright}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const apacheLicense = readFileSync("node_modules/@dimforge/rapier3d-compat/LICENSE", "utf8");
const missingLicenseOverrides: Record<string, string> = {
  "@react-three/fiber@9.8.2": `MIT License

Copyright (c) 2019-2025 Poimandres

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  "maath@0.10.8": `The MIT License

Copyright (c) Isaac Mason

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  "react-compiler-runtime@1.0.0": readFileSync("node_modules/react/LICENSE", "utf8"),
  "@mediapipe/tasks-vision@0.10.17": `Copyright (c) Google LLC\n\n${apacheLicense}`,
  "draco3d@1.5.9": `Copyright (c) The Draco Authors\n\n${apacheLicense}`,
  "react-remove-scroll-bar@2.3.8": mitLicense("Copyright (c) Anton Korzunov"),
  "stats-gl@2.4.2": mitLicense("Copyright (c) Renaud Rohlinger"),
};
const missingLicenseNames: Record<string, string> = {
  "webgl-constants@1.1.1": "MIT",
};

const licensePattern = /^(LICENSE|LICENCE|COPYING|NOTICE)([-.].+)?$/i;
const npmTree = JSON.parse(
  execFileSync("npm", ["ls", "--omit=dev", "--all", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
) as { dependencies?: Record<string, NpmDependency> };

const dependencyIds = new Set<string>();
function collectDependencies(dependencies: Record<string, NpmDependency> | undefined) {
  for (const [name, dependency] of Object.entries(dependencies ?? {})) {
    if (!dependency.version) continue;
    dependencyIds.add(`${name}@${dependency.version}`);
    collectDependencies(dependency.dependencies);
  }
}
collectDependencies(npmTree.dependencies);

const installedPackages = new Map<string, { packageJson: PackageJson; path: string }>();
function scanNodeModules(nodeModulesPath: string) {
  if (!existsSync(nodeModulesPath)) return;
  for (const entry of readdirSync(nodeModulesPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("@")) {
      const scopePath = join(nodeModulesPath, entry.name);
      for (const scopedEntry of readdirSync(scopePath, { withFileTypes: true })) {
        if (scopedEntry.isDirectory()) inspectPackage(join(scopePath, scopedEntry.name));
      }
      continue;
    }
    inspectPackage(join(nodeModulesPath, entry.name));
  }
}

function inspectPackage(packagePath: string) {
  const packageJsonPath = join(packagePath, "package.json");
  if (!existsSync(packageJsonPath)) return;
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
  if (packageJson.name && packageJson.version) {
    const id = `${packageJson.name}@${packageJson.version}`;
    if (dependencyIds.has(id)) installedPackages.set(id, { packageJson, path: packagePath });
  }
  scanNodeModules(join(packagePath, "node_modules"));
}

scanNodeModules("node_modules");

const notices: NoticePackage[] = [];
const missingNotices: string[] = [];
for (const id of [...dependencyIds].sort()) {
  const installed = installedPackages.get(id);
  if (!installed) throw new Error(`Installed package not found for ${id}`);

  const { packageJson, path } = installed;
  const licenseName = typeof packageJson.license === "string"
    ? packageJson.license
    : packageJson.license?.type ?? missingLicenseNames[id];
  if (!licenseName) {
    missingNotices.push(`${id} (no declared SPDX license)`);
    continue;
  }

  const licenseFiles = readdirSync(path).filter((name) => licensePattern.test(name));
  const notice = missingLicenseOverrides[id]
    ?? licenseFiles.map((file) => readFileSync(join(path, file), "utf8").trim()).join("\n\n").trim();
  if (!notice) {
    missingNotices.push(id);
    continue;
  }

  const repositoryValue = typeof packageJson.repository === "string"
    ? packageJson.repository
    : packageJson.repository?.url;
  notices.push({
    name: packageJson.name!,
    version: packageJson.version!,
    license: licenseName,
    repository: repositoryValue?.replace(/^git\+/, "").replace(/^git:\/\//, "https://") ?? "Not specified",
    notice,
  });
}
if (missingNotices.length > 0) {
  throw new Error(`Packages without standalone license notices:\n${missingNotices.join("\n")}`);
}

const electronPackage = JSON.parse(readFileSync("node_modules/electron/package.json", "utf8")) as PackageJson;
const header = `# Cadence third-party notices

This file identifies third-party software included in Cadence. Cadence itself
is licensed under the MIT License in LICENSE. The generated notice contains the
production JavaScript dependency tree used by the application. Runtime
dependencies for the Electron, Chromium, and operating-system components are
covered by the license files packaged under Cadence's Resources/licenses
directory.

Electron ${electronPackage.version} is included as an application runtime and is
licensed under the MIT License:

${readFileSync("node_modules/electron/dist/LICENSE", "utf8").trim()}

Chromium and its bundled components retain their individual licenses in
Chromium-LICENSES.html in the packaged Resources/licenses directory.

Bundled Kenney 3D assets are CC0. Their sources and file checksums are recorded in
models/ASSET_MANIFEST.md inside the renderer bundle.
`;

const body = notices.map((entry) => `## ${entry.name}@${entry.version}

License: ${entry.license}
Source: ${entry.repository}

${entry.notice}
`).join("\n");

writeFileSync("THIRD_PARTY_NOTICES.txt", `${header}\n${body}`);
console.log(`Generated notices for ${notices.length} production packages.`);
