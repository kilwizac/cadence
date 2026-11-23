import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { app, type BrowserWindow, type NativeImage } from "electron";
import type { Workspace } from "../src/shared/types";

const [userData, screenshot, companyName] = process.argv.slice(-3);
const areaName = "Shipping & Receiving";
const processName = "Receive inbound freight";
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
  const readWorkspace = async () => JSON.parse(await readFile(join(userData, "workspace.json"), "utf8")) as Workspace;
  const submit = async (description: string, selector: string, value: string) => {
    await waitFor(description, () => evaluate((selector, text) => {
      const input = document.querySelector<HTMLInputElement>(selector);
      if (!input?.form || !input.checkVisibility()) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }, selector, value));
    await evaluate((selector) => document.querySelector<HTMLInputElement>(selector)?.form?.requestSubmit(), selector);
  };
  const verifyCompanyMap = async (description: string) => {
    await waitFor(description, () => evaluate(
      (name) => document.querySelector(".workspace-name span")?.textContent === name && Boolean(document.querySelector("canvas")),
      companyName,
    ));
    assert(await evaluate(() => !document.querySelector('main form, [role="dialog"]')), "The map must open without an area form");
  };

  await waitFor("company setup for the placeholder workspace", () => evaluate(() =>
    document.querySelector("main h1")?.textContent === "Create your company profile" && !document.querySelector("canvas"),
  ));
  await submit("the company name input", ".company-setup input[required]", companyName);
  await waitFor("the explicitly saved company profile", async () => {
    const saved = await readWorkspace();
    return saved.companyProfile?.confirmed && saved.name === companyName && saved.areas.length === 0;
  });
  await verifyCompanyMap("the company map after setup");

  await contents.loadURL(contents.getURL());
  await verifyCompanyMap("the company map after reopening");

  await waitFor("the Add area button", () => evaluate(() => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>("header button"))
      .find((item) => item.textContent?.trim() === "Add area");
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }));
  await submit("the area form", '[role="dialog"] input[placeholder="e.g. Shipping & Receiving"]', areaName);
  const point = await waitFor("the map placement prompt", () => evaluate(() => {
    if (!document.querySelector(".hint") || document.querySelector('[role="dialog"]')?.checkVisibility()) return false;
    const canvas = document.querySelector("canvas");
    if (!canvas) return false;
    const { x, y, width, height } = canvas.getBoundingClientRect();
    return { x: Math.round(x + width / 2), y: Math.round(y + height / 2) };
  }));
  contents.sendInputEvent({ type: "mouseMove", ...point });
  contents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, ...point });
  contents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, ...point });

  await waitFor("the area on the map", () => evaluate((name) => {
    const label = Array.from(document.querySelectorAll<HTMLButtonElement>(".map-label"))
      .find((button) => button.querySelector(".map-label-name")?.textContent === name);
    if (!label) return false;
    label.click();
    return true;
  }, areaName));

  await submit("the process form", 'input[aria-label="New process name"]', processName);
  await submit("the process note form", 'input[aria-label="New note"]', noteText);

  await waitFor("the note on disk", async () => {
    const saved = await readWorkspace();
    const area = saved.areas.find((area) => area.name === areaName);
    const process = area?.processes.find((process) => process.name === processName);
    return process && area?.notes.some(
      (note) => note.text === noteText && note.processId === process.id && note.kind === "improvement" && !note.resolved,
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
