import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { app, type BrowserWindow, type NativeImage } from "electron";
import type { Workspace } from "../src/shared/types";

const [userData, screenshot, areaName, processName, processId] = process.argv.slice(-5);
const noteText = "Label each pallet before staging.";

async function waitFor<T>(description: string, read: () => Promise<T | false | undefined>) {
  const deadline = Date.now() + 15_000;
  do {
    const result = await read();
    if (result) return result;
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${description}`);
}

async function run() {
  app.setPath("userData", userData);
  if (process.platform === "darwin") app.setActivationPolicy("accessory");
  const { startCadence } = require(join(app.getAppPath(), "dist-electron/main.js")) as {
    startCadence: (options: { offscreen: boolean }) => Promise<BrowserWindow>;
  };
  const window = await startCadence({ offscreen: true });
  const contents = window.webContents;
  assert(contents.isOffscreen() && !window.isVisible(), "The smoke window must be offscreen and hidden");
  contents.on("console-message", ({ level, message }) => {
    if (level === "error") console.error(`Renderer: ${message}`);
  });
  const evaluate = <T, Args extends unknown[]>(fn: (...args: Args) => T, ...args: Args) =>
    contents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`) as Promise<T>;

  await waitFor("the area on the map", () => evaluate((name) => {
    const label = Array.from(document.querySelectorAll<HTMLButtonElement>(".map-label"))
      .find((button) => button.querySelector(".map-label-name")?.textContent === name);
    if (!label) return false;
    label.click();
    return true;
  }, areaName));

  await waitFor("the process in the selected area", () => evaluate((area, name) => {
    const panel = Array.from(document.querySelectorAll("aside")).find((aside) => aside.getAttribute("aria-label") === `${area} details`);
    const button = Array.from(panel?.querySelectorAll<HTMLButtonElement>("button[aria-expanded]") ?? [])
      .find((control) => Array.from(control.querySelectorAll("p")).some((text) => text.textContent === name));
    if (!button) return false;
    button.click();
    return true;
  }, areaName, processName));

  await waitFor("the process note form", () => evaluate((text) => {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="New note"]');
    if (!input?.form || !input.checkVisibility()) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, noteText));
  await evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="New note"]');
    input?.form?.requestSubmit();
  });

  await waitFor("the note on disk", async () => {
    const saved = JSON.parse(await readFile(join(userData, "workspace.json"), "utf8")) as Workspace;
    return saved.areas.find((area) => area.name === areaName)?.notes.some(
      (note) => note.text === noteText && note.processId === processId && note.kind === "improvement" && !note.resolved,
    );
  });
  await waitFor("the Notes tab", () => evaluate(() => {
    const tab = Array.from(document.querySelectorAll<HTMLButtonElement>('aside [role="tab"]'))
      .find((button) => button.textContent?.startsWith("Notes"));
    if (!tab) return false;
    tab.click();
    return true;
  }));
  await waitFor("the saved note in the area", () => evaluate((text) => {
    const note = Array.from(document.querySelectorAll("aside p")).find((item) => item.textContent === text);
    if (!note?.checkVisibility()) return false;
    note.scrollIntoView({ block: "nearest" });
    return true;
  }, noteText));

  await evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const image = await new Promise<NativeImage>((resolve) => {
    contents.once("paint", (_event, _dirty, frame) => resolve(frame));
    contents.invalidate();
  });
  assert(!image.isEmpty(), "The offscreen capture is empty");
  await writeFile(screenshot, image.toPNG());
}

run().then(() => app.exit(0), (error) => {
  console.error(error);
  app.exit(1);
});
