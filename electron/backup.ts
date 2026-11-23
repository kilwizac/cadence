import { randomUUID } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { crc32 } from "node:zlib";
import { openPromise, type Entry } from "yauzl";
import { ZipFile } from "yazl";
import type { Workspace } from "../src/shared/types";
import { readBackupWorkspace } from "./backup-workspace";

const workspaceFile = "workspace.json";
const attachmentsFolder = "attachments";
const maxWorkspaceSize = 64 * 1024 * 1024;
const maxEntries = 100_000;
const dailyPattern = /^daily-\d{4}-\d{2}-\d{2}\.cadence$/;
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

export const workspacePath = (root: string) => join(root, workspaceFile);
export const attachmentsDir = (root: string) => join(root, attachmentsFolder);
export const validAttachmentName = (name: string) => Boolean(name && !/[<>:"/\\|?*\u0000-\u001f]|[. ]$/.test(name));

async function writeBackup(root: string, target: string, workspace: Buffer) {
  if (workspace.length > maxWorkspaceSize) throw new Error("The workspace file is too large to back up.");
  const attachments = await fs.readdir(attachmentsDir(root), { withFileTypes: true }).catch((error: unknown) => {
    if (missing(error)) return [];
    throw error;
  });
  const files = attachments.filter((entry) => entry.isFile());
  if (files.length + 1 > maxEntries) throw new Error("There are too many attachments to back up.");
  if (files.some((entry) => !validAttachmentName(entry.name))) throw new Error("An attachment has an invalid filename.");

  const temporary = join(dirname(target), `.cadence-${randomUUID()}.tmp`);
  const zip = new ZipFile();
  const output = zip.outputStream as Readable;
  zip.on("error", (error: Error) => output.destroy(error));
  zip.addBuffer(workspace, workspaceFile);
  for (const file of files) zip.addFile(join(attachmentsDir(root), file.name), `${attachmentsFolder}/${file.name}`, { compress: false });
  try {
    const writing = pipeline(output, createWriteStream(temporary, { flags: "wx", mode: 0o600 }));
    zip.end();
    await writing;
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

export async function saveBackup(root: string, target: string, workspace: Workspace) {
  if (extname(target).toLowerCase() !== ".cadence") throw new Error("Save the backup with a .cadence extension.");
  const attachmentRoot = await fs.realpath(attachmentsDir(root)).catch((error: unknown) => {
    if (missing(error)) return attachmentsDir(root);
    throw error;
  });
  const directory = await fs.realpath(dirname(target));
  const inside = relative(attachmentRoot, directory);
  if (!inside || (!inside.startsWith(`..${sep}`) && inside !== ".." && !isAbsolute(inside))) {
    throw new Error("Choose a backup location outside the attachments folder.");
  }
  await writeBackup(root, target, Buffer.from(JSON.stringify(workspace, null, 2)));
}

async function extractBackup(source: string, stage: string) {
  const zip = await openPromise(source, { autoClose: false, strictFileNames: true });
  try {
    if (zip.entryCount > maxEntries) throw new Error("The backup contains too many files.");
    const files = new Map<string, Entry>();
    const attachments = new Set<string>();
    let size = 0;
    for await (const entry of zip.eachEntry()) {
      const name = entry.fileName;
      const type = (entry.externalFileAttributes >>> 16) & 0o170000;
      if (name === `${attachmentsFolder}/` && (type === 0 || type === 0o040000) && entry.uncompressedSize === 0) continue;
      if (type !== 0 && type !== 0o100000) throw new Error("The backup contains an unsupported file type.");
      if (name === workspaceFile) {
        if (entry.uncompressedSize > maxWorkspaceSize) throw new Error("The backup workspace file is too large.");
      } else if (name.startsWith(`${attachmentsFolder}/`) && validAttachmentName(name.slice(attachmentsFolder.length + 1))) {
        attachments.add(name.slice(attachmentsFolder.length + 1));
      } else {
        throw new Error("The backup contains an unexpected file.");
      }
      const key = name.normalize("NFC").toLowerCase();
      if (files.has(key)) throw new Error("The backup contains duplicate filenames.");
      files.set(key, entry);
      size += entry.uncompressedSize;
    }
    if (!files.has(workspaceFile)) throw new Error("The backup doesn't contain workspace.json.");
    const disk = await fs.statfs(stage);
    if (size + maxWorkspaceSize > disk.bavail * disk.bsize) throw new Error("Free some disk space before restoring this backup.");

    await fs.mkdir(attachmentsDir(stage));
    for (const entry of files.values()) {
      const stream = await zip.openReadStreamPromise(entry);
      await pipeline(stream, async function* (chunks) {
        let checksum = 0;
        for await (const chunk of chunks) {
          checksum = crc32(chunk, checksum);
          yield chunk;
        }
        if (checksum !== entry.crc32) throw new Error("The backup contains a damaged file.");
      }, createWriteStream(join(stage, entry.fileName), { flags: "wx", mode: 0o600 }));
    }

    const workspace = readBackupWorkspace(await fs.readFile(workspacePath(stage), "utf8"));
    for (const area of workspace.areas) {
      for (const sop of area.sops) {
        if (sop.attachment && !attachments.has(sop.attachment.storedName)) {
          throw new Error(`The backup is missing an attachment: ${sop.attachment.originalName}.`);
        }
      }
    }
    await fs.writeFile(workspacePath(stage), JSON.stringify(workspace, null, 2));
    return workspace;
  } finally {
    if (zip.isOpen) zip.close();
  }
}

export async function restoreBackup(root: string, source: string, current: Workspace) {
  await fs.mkdir(root, { recursive: true });
  const stage = await fs.mkdtemp(join(root, ".cadence-restore-"));
  let keepStage = false;
  try {
    const workspace = await extractBackup(source, stage);
    const backups = join(root, "backups");
    await fs.mkdir(backups, { recursive: true, mode: 0o700 });
    const safety = join(backups, `before-restore-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.cadence`);
    await writeBackup(root, safety, Buffer.from(JSON.stringify(current, null, 2)));

    const live = attachmentsDir(root);
    const previous = join(stage, "previous-attachments");
    const hadAttachments = await fs.rename(live, previous).then(() => true, (error: unknown) => {
      if (missing(error)) return false;
      throw error;
    });
    let installed = false;
    try {
      await fs.rename(attachmentsDir(stage), live);
      installed = true;
      await fs.rename(workspacePath(stage), workspacePath(root));
    } catch (error) {
      try {
        if (installed) await fs.rename(live, attachmentsDir(stage));
        if (hadAttachments) await fs.rename(previous, live);
      } catch {
        keepStage = true;
        throw new Error(`Restore couldn't finish. Recover the previous workspace from ${basename(safety)} in the backups folder.`);
      }
      throw error;
    }
    return workspace;
  } finally {
    if (!keepStage) await fs.rm(stage, { recursive: true, force: true }).catch((error) => console.warn("Couldn't remove restore staging folder", error));
  }
}

export async function dailyBackup(root: string, now: Date) {
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, "0")).join("-");
  const name = `daily-${date}.cadence`;
  const directory = join(root, "backups");
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const previous = (await fs.readdir(directory)).filter((entry) => dailyPattern.test(entry));
  if (!previous.includes(name)) {
    const workspace = await fs.readFile(workspacePath(root)).catch((error: unknown) => {
      if (missing(error)) return null;
      throw error;
    });
    if (!workspace) return false;
    await writeBackup(root, join(directory, name), workspace);
    previous.push(name);
  }
  for (const stale of previous.sort().reverse().slice(14)) await fs.rm(join(directory, stale), { force: true });
  return true;
}
