import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell, type OpenDialogOptions } from "electron";
import { promises as fs } from "node:fs";
import { basename, extname, join, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import type { Attachment, Workspace } from "../src/shared/types";

app.setName("Cadence");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const workspacePath = () => join(app.getPath("userData"), "workspace.json");
const attachmentsDir = () => join(app.getPath("userData"), "attachments");
const attachmentPath = (storedName: string) => join(attachmentsDir(), basename(storedName));

let saveQueue = Promise.resolve();

ipcMain.handle("workspace:load", async () => {
  try {
    return JSON.parse(await fs.readFile(workspacePath(), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
});

ipcMain.handle("workspace:save", (_event, workspace: Workspace) => {
  saveQueue = saveQueue
    .catch(() => undefined)
    .then(async () => {
      const target = workspacePath();
      await fs.mkdir(app.getPath("userData"), { recursive: true });
      await fs.writeFile(`${target}.tmp`, JSON.stringify(workspace, null, 2));
      await fs.rename(`${target}.tmp`, target);
    });
  return saveQueue;
});

async function importAttachment(source: string): Promise<Attachment> {
  const stats = await fs.stat(source);
  if (!stats.isFile()) throw new Error(`${basename(source)} is not a file`);
  await fs.mkdir(attachmentsDir(), { recursive: true });
  const storedName = `${randomUUID()}${extname(source)}`;
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
  return importAttachment(source);
});

ipcMain.handle("attachment:import", (_event, source: string) => importAttachment(source));
ipcMain.handle("attachment:open", (_event, storedName: string) => shell.openPath(attachmentPath(storedName)));
ipcMain.handle("attachment:reveal", (_event, storedName: string) => shell.showItemInFolder(attachmentPath(storedName)));
ipcMain.handle("attachment:delete", (_event, storedName: string) => fs.rm(attachmentPath(storedName), { force: true }));
ipcMain.handle("data:reveal", () => shell.openPath(app.getPath("userData")));

function serveBundle() {
  const root = join(app.getAppPath(), "dist");
  protocol.handle("app", (request) => {
    const file = join(root, decodeURIComponent(new URL(request.url).pathname));
    const inside = relative(root, file);
    if (inside.startsWith("..") || isAbsolute(inside)) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    title: "Cadence",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#eceef2",
    webPreferences: {
      preload: join(app.getAppPath(), "dist-electron/preload.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  window.loadURL(process.env.VITE_DEV_SERVER_URL ?? "app://bundle/index.html");
}

app.whenReady().then(() => {
  serveBundle();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
