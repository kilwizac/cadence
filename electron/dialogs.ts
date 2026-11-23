import { dialog, type BrowserWindow, type SaveDialogOptions } from "electron";

export function safeFileName(name: string, fallback: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim().replace(/[. ]+$/, "").slice(0, 120) || fallback;
}

export async function chooseSavePath(owner: BrowserWindow | null, title: string, name: string, extension: string, type: string) {
  const options: SaveDialogOptions = { title, defaultPath: `${name}.${extension}`, filters: [{ name: type, extensions: [extension] }] };
  const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
  return result.canceled ? null : result.filePath || null;
}
