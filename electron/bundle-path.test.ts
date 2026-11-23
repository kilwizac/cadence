import { expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { resolveBundlePath } from "./bundle-path";

const root = resolve("dist");

test.each([
  ["app://bundle/index.html", "index.html"],
  ["app://bundle/assets/map%20tile.js?version=2", join("assets", "map tile.js")],
  ["app://bundle/..metadata", "..metadata"],
])("resolves %s inside the renderer bundle", (url, file) => {
  expect(resolveBundlePath(root, url)).toBe(join(root, file));
});

test.each([
  "app://bundle/..%2Foutside.txt",
  "app://bundle/assets/%2e%2e%2f%2e%2e%2foutside.txt",
  "app://bundle/..%2Fdist-copy/file.js",
  "app://bundle/invalid%XX",
  "app://bundle/null%00byte",
  "app://bundle/",
  "app://other/index.html",
  "https://bundle/index.html",
  "not a URL",
])("rejects %s", (url) => {
  expect(resolveBundlePath(root, url)).toBeNull();
});
