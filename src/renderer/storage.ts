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
};
