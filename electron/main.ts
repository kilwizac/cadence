import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell, type OpenDialogOptions, type WebContents } from "electron";
import { promises as fs } from "node:fs";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import type { Attachment, Sop, Workspace } from "../src/shared/types";
import { attachmentsDir, dailyBackup, restoreBackup, saveBackup, validAttachmentName, workspacePath } from "./backup";
import { resolveBundlePath } from "./bundle-path";
import { chooseSavePath, safeFileName } from "./dialogs";
import { exportManual, exportSop } from "./export";

app.setName("Cadence");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const dataRoot = () => app.getPath("userData");
const attachmentPath = (storedName: string) => {
  if (!validAttachmentName(storedName)) throw new Error("Invalid attachment filename.");
  return join(attachmentsDir(dataRoot()), storedName);
};

let dataQueue: Promise<unknown> = Promise.resolve();
let dailyBackupPending = false;
let lastBackupDay = "";
const attachmentDeletes = new Set<string>();
const selectedBackups = new WeakMap<WebContents, string>();

function withData<T>(operation: () => Promise<T>): Promise<T> {
  const next = dataQueue.then(operation, operation);
  dataQueue = next;
  return next;
}

function scheduleDailyBackup() {
  const now = new Date();
  const day = now.toDateString();
  if (dailyBackupPending || lastBackupDay === day) return;
  dailyBackupPending = true;
  void withData(() => dailyBackup(dataRoot(), now)).then(
    (saved) => { if (saved) lastBackupDay = day; },
    (error) => console.error("Couldn't make the daily backup:", error),
  ).finally(() => { dailyBackupPending = false; });
}

ipcMain.handle("workspace:load", async () => {
  try {
    return JSON.parse(await fs.readFile(workspacePath(dataRoot()), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
});

ipcMain.handle("workspace:save", async (_event, workspace: Workspace) => {
  await withData(async () => {
    const root = dataRoot();
    const target = workspacePath(root);
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(`${target}.tmp`, JSON.stringify(workspace, null, 2));
    await fs.rename(`${target}.tmp`, target);
    if (attachmentDeletes.size) {
      const used = new Set(workspace.areas.flatMap((area) => area.sops.map((sop) => sop.attachment?.storedName)));
      for (const name of attachmentDeletes) {
        if (used.has(name)) continue;
        await fs.rm(attachmentPath(name), { force: true });
        attachmentDeletes.delete(name);
      }
    }
  });
  scheduleDailyBackup();
});

async function importAttachment(source: string): Promise<Attachment> {
  const stats = await fs.stat(source);
  if (!stats.isFile()) throw new Error(`${basename(source)} is not a file`);
  await fs.mkdir(attachmentsDir(dataRoot()), { recursive: true });
  const id = randomUUID();
  const candidate = `${id}${extname(source)}`;
  const storedName = validAttachmentName(candidate) ? candidate : id;
  await fs.copyFile(source, attachmentPath(storedName));
  return { storedName, originalName: basename(source), size: stats.size };
}

ipcMain.handle("attachment:pick", async (event) => {
  const options: OpenDialogOptions = {
    title: "Attach an SOP",
    properties: ["openFile"],
    filters: [
      { name: "Documents", extensions: ["pdf", "doc", "docx", "xls", "xlsx", "csv", "md", "txt", "png", "jpg", "jpeg"] },
      { name: "All files", extensions: ["*"] },
    ],
  };
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  const source = result.filePaths[0];
  if (result.canceled || !source) return null;
  return withData(() => importAttachment(source));
});

ipcMain.handle("attachment:import", (_event, source: string) => withData(() => importAttachment(source)));
ipcMain.handle("attachment:open", (_event, storedName: string) => shell.openPath(attachmentPath(storedName)));
ipcMain.handle("attachment:reveal", (_event, storedName: string) => shell.showItemInFolder(attachmentPath(storedName)));
ipcMain.handle("attachment:delete", (_event, storedName: string) => withData(async () => {
  if (!validAttachmentName(storedName)) throw new Error("Invalid attachment filename.");
  attachmentDeletes.add(storedName);
}));
ipcMain.handle("data:reveal", () => shell.openPath(dataRoot()));
ipcMain.handle("export:sop", (event, sop: Sop, area: string, format: "pdf" | "docx") =>
  exportSop(BrowserWindow.fromWebContents(event.sender), sop, area, format),
);
ipcMain.handle("export:manual", (event, workspace: Workspace) => exportManual(BrowserWindow.fromWebContents(event.sender), workspace));
ipcMain.handle("backup:save", async (event, workspace: Workspace) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const name = safeFileName(workspace.name, "Workspace");
  const path = await chooseSavePath(window, "Back up workspace", `${name} - Backup`, "cadence", "Cadence backup");
  if (!path) return false;
  await withData(() => saveBackup(dataRoot(), path, workspace));
  return true;
});
ipcMain.handle("backup:pick", async (event) => {
  selectedBackups.delete(event.sender);
  const options: OpenDialogOptions = {
    title: "Choose a Cadence backup",
    properties: ["openFile"],
    filters: [{ name: "Cadence backup", extensions: ["cadence"] }],
  };
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  const path = result.filePaths[0];
  if (result.canceled || !path) return null;
  selectedBackups.set(event.sender, path);
  return basename(path);
});
ipcMain.handle("backup:restore", (event, current: Workspace) => {
  const path = selectedBackups.get(event.sender);
  selectedBackups.delete(event.sender);
  if (!path) throw new Error("Choose a backup to restore.");
  return withData(async () => {
    const workspace = await restoreBackup(dataRoot(), path, current);
    attachmentDeletes.clear();
    return workspace;
  });
});

function serveBundle() {
  const root = join(app.getAppPath(), "dist");
  protocol.handle("app", (request) => {
    const file = resolveBundlePath(root, request.url);
    if (file === null) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow(offscreen: boolean) {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    title: "Cadence",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#eceef2",
    show: !offscreen,
    webPreferences: {
      preload: join(app.getAppPath(), "dist-electron/preload.js"),
      contextIsolation: true,
      sandbox: true,
      offscreen,
      backgroundThrottling: !offscreen,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  return { window, loaded: window.loadURL(process.env.VITE_DEV_SERVER_URL ?? "app://bundle/index.html") };
}

export async function startCadence({ offscreen = false } = {}) {
  await app.whenReady();
  serveBundle();
  if (!offscreen) {
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(false).loaded.catch(console.error);
      }
    });
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") app.quit();
    });
  }
  const { window, loaded } = createWindow(offscreen);
  scheduleDailyBackup();
  setInterval(scheduleDailyBackup, 60 * 60 * 1000).unref();
  await loaded;
  return window;
}
