import type { Attachment, Workspace } from "./types";

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
}
