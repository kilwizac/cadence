import type { Attachment, Sop, Workspace } from "./types";

export interface OpsApi {
  loadWorkspace(): Promise<unknown>;
  saveWorkspace(workspace: Workspace): Promise<void>;
  pickAttachment(): Promise<Attachment | null>;
  importAttachment(sourcePath: string): Promise<Attachment>;
  pathForFile(file: File): string;
  openAttachment(storedName: string): Promise<string>;
  revealAttachment(storedName: string): Promise<void>;
  deleteAttachment(storedName: string): Promise<void>;
  revealDataFolder(): Promise<string>;
  exportSop(sop: Sop, area: string, format: "pdf" | "docx"): Promise<boolean>;
  exportManual(workspace: Workspace): Promise<boolean>;
  backupWorkspace(workspace: Workspace): Promise<boolean>;
  pickBackup(): Promise<string | null>;
  restoreBackup(workspace: Workspace): Promise<Workspace>;
}
