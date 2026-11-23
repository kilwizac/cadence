import type { OpsApi } from "../shared/api";

const KEY = "cadence:workspace";

export const hasDesktopFiles = Boolean(window.ops);

const unavailable = () => Promise.reject(new Error("Attachments are only available in the desktop app."));

export const storage: OpsApi = window.ops ?? {
  async loadWorkspace() {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  },
  async saveWorkspace(workspace) {
    localStorage.setItem(KEY, JSON.stringify(workspace));
  },
  async pickAttachment() {
    return null;
  },
  importAttachment: unavailable,
  pathForFile: () => "",
  async openAttachment() {
    return "Attachments are only available in the desktop app.";
  },
  async revealAttachment() {},
  async deleteAttachment() {},
  async revealDataFolder() {
    return "";
  },
  exportSop: () => Promise.reject(new Error("SOP exports are only available in the desktop app.")),
  exportManual: () => Promise.reject(new Error("Manual exports are only available in the desktop app.")),
  backupWorkspace: () => Promise.reject(new Error("Workspace backups are only available in the desktop app.")),
  async pickBackup() {
    return null;
  },
  restoreBackup: () => Promise.reject(new Error("Restoring backups is only available in the desktop app.")),
};
