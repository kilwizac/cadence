import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { OpsApi } from "../src/shared/api";

const api: OpsApi = {
  loadWorkspace: () => ipcRenderer.invoke("workspace:load"),
  saveWorkspace: (workspace) => ipcRenderer.invoke("workspace:save", workspace),
  pickAttachment: () => ipcRenderer.invoke("attachment:pick"),
  importAttachment: (sourcePath) => ipcRenderer.invoke("attachment:import", sourcePath),
  pathForFile: (file) => webUtils.getPathForFile(file),
  openAttachment: (storedName) => ipcRenderer.invoke("attachment:open", storedName),
  revealAttachment: (storedName) => ipcRenderer.invoke("attachment:reveal", storedName),
  deleteAttachment: (storedName) => ipcRenderer.invoke("attachment:delete", storedName),
  revealDataFolder: () => ipcRenderer.invoke("data:reveal"),
  exportSop: (sop, area, format) => ipcRenderer.invoke("export:sop", sop, area, format),
  exportManual: (workspace) => ipcRenderer.invoke("export:manual", workspace),
  backupWorkspace: (workspace) => ipcRenderer.invoke("backup:save", workspace),
  pickBackup: () => ipcRenderer.invoke("backup:pick"),
  restoreBackup: (workspace) => ipcRenderer.invoke("backup:restore", workspace),
};

contextBridge.exposeInMainWorld("ops", api);
