import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyWorkspace, newArea, newFileSop, newWrittenSop } from "../src/renderer/model";
import type { Workspace } from "../src/shared/types";
import { attachmentsDir, dailyBackup, restoreBackup, saveBackup, workspacePath } from "./backup";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "cadence-backup-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test("replaces the workspace and all attachment files, keeping the latest edits in a safety copy", async () => {
  const area = newArea("Quality", 152, "quality", 0, 0);
  area.sops.push(newFileSop({ storedName: "drawing.pdf", originalName: "Drawing.pdf", size: 4 }));
  const original = {
    ...emptyWorkspace(), name: "Original", areas: [area],
    companyProfile: { industry: "Manufacturing", description: "Makes inspection fixtures.", confirmed: true },
  };
  const attachment = join(attachmentsDir(root), "drawing.pdf");
  const archive = join(root, "original.cadence");
  await mkdir(attachmentsDir(root));
  await writeFile(attachment, "ABCD");
  await writeFile(join(attachmentsDir(root), "unlinked.txt"), "Also included");
  await saveBackup(root, archive, original);
  await rm(join(attachmentsDir(root), "unlinked.txt"));
  await writeFile(attachment, "EFGH");
  await writeFile(join(attachmentsDir(root), "not-in-backup.txt"), "Old file");
  await writeFile(workspacePath(root), JSON.stringify(original));
  const current = { ...original, name: "Unsaved name" };

  expect(await restoreBackup(root, archive, current)).toEqual(original);
  expect(JSON.parse(await readFile(workspacePath(root), "utf8"))).toEqual(original);
  expect((await readdir(attachmentsDir(root))).sort()).toEqual(["drawing.pdf", "unlinked.txt"]);
  expect(await readFile(attachment, "utf8")).toBe("ABCD");
  const files = await readdir(join(root, "backups"));
  expect(files).toHaveLength(1);
  expect(files[0]).toStartWith("before-restore-");
  expect(await restoreBackup(root, join(root, "backups", files[0]), original)).toEqual(current);
  expect(await readFile(attachment, "utf8")).toBe("EFGH");
});

test("rejects incomplete backups without changing the live workspace", async () => {
  const area = newArea("Shipping", 28, "shipping", 0, 0);
  area.sops.push(newFileSop({ storedName: "missing.pdf", originalName: "Missing.pdf", size: 3 }));
  const archive = join(root, "incomplete.cadence");
  const current = emptyWorkspace();
  await writeFile(workspacePath(root), JSON.stringify(current));
  await saveBackup(root, archive, { ...current, areas: [area] });

  await expect(restoreBackup(root, archive, current)).rejects.toThrow("missing an attachment");
  expect(JSON.parse(await readFile(workspacePath(root), "utf8"))).toEqual(current);
  expect((await readdir(root)).sort()).toEqual(["incomplete.cadence", "workspace.json"]);
});

test("restores a legacy workspace through the existing migration", async () => {
  const area = newArea("Production", 212, "production", 0, 0);
  area.sops.push({ ...newWrittenSop(), content: "# Check stock" });
  const archive = join(root, "legacy.cadence");
  const current = emptyWorkspace();
  const legacy = { version: 1, name: "Legacy", areas: [{ ...area, kind: undefined }], flows: [] };
  await saveBackup(root, archive, legacy as unknown as Workspace);
  const restored = await restoreBackup(root, archive, current);
  expect(restored.version).toBe(2);
  expect(restored.companyProfile).toEqual({ industry: "", description: "", confirmed: false });
  expect(restored.areas[0].kind).toBe("production");
  expect(restored.areas[0].sops[0].content).toContain("<h1>Check stock</h1>");
});

test("keeps the latest fourteen daily archives without touching safety copies", async () => {
  const workspace = emptyWorkspace();
  const day = (n: number) => new Date(2026, 10, n, 12);
  expect(await dailyBackup(root, day(1))).toBe(false);
  await writeFile(workspacePath(root), JSON.stringify(workspace));
  const directory = join(root, "backups");
  const safety = "before-restore-test.cadence";
  await writeFile(join(directory, safety), "safety");

  for (let i = 1; i <= 16; i++) expect(await dailyBackup(root, day(i))).toBe(true);
  const archive = join(directory, "daily-2026-11-16.cadence");
  const first = await readFile(archive);
  await writeFile(workspacePath(root), JSON.stringify({ ...workspace, name: "Later edit" }));
  expect(await dailyBackup(root, day(16))).toBe(true);
  expect(await readFile(archive)).toEqual(first);
  const names = (await readdir(directory)).sort();
  expect(names).toHaveLength(15);
  expect(names[0]).toBe(safety);
  expect(names[1]).toBe("daily-2026-11-03.cadence");
});
