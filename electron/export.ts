import { app, BrowserWindow, dialog, type SaveDialogOptions } from "electron";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import sanitizeHtml from "sanitize-html";
import type { Area, ProcessStatus, Sop, SopStatus, Workspace } from "../src/shared/types";
import { sopDocx } from "./sop-docx";

const sopStatuses: Record<SopStatus, string> = { draft: "Draft", review: "In review", approved: "Approved" };
const processStatuses: Record<ProcessStatus, string> = {
  unmapped: "Not mapped", mapped: "Mapped", documented: "Documented", optimized: "Optimized",
};
const date = (value: Date) => Number.isNaN(value.getTime()) ? "Unknown" : new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(value);
const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);

const cleanContent = (content: string) => sanitizeHtml(content, {
  allowedTags: ["p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "s", "del", "strike", "u", "a", "blockquote", "code", "pre", "hr", "ol", "ul", "li", "table", "thead", "tbody", "tr", "th", "td"],
  allowedAttributes: { a: ["href"], ol: ["start"] },
  allowedSchemes: ["https", "http", "mailto"],
  allowProtocolRelative: false,
});

const sopTitle = (sop: Sop) => sop.title || "Untitled SOP";
const areaName = (area: Area) => area.name || "Untitled area";
const sopMeta = (sop: Sop) => [sopStatuses[sop.status] ?? sop.status, `Updated ${date(new Date(sop.updatedAt))}`].join(" · ");
const attachmentLabel = (sop: Sop) => sop.attachment ? `Attached file: ${sop.attachment.originalName}` : "No file attached.";

function documentHtml(title: string, body: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'">
<title>${escape(title)}</title>
<style>
  @page { size: Letter; margin: 0.75in; }
  body { font: 10.5pt/1.5 system-ui, sans-serif; color: #252e3d; overflow-wrap: anywhere; }
  h1, h2, h3, h4, h5, h6 { color: #192334; line-height: 1.2; break-after: avoid; }
  h1 { font-size: 27pt; margin: 14pt 0 4pt; }
  h2 { font-size: 16pt; margin: 18pt 0 5pt; }
  h3 { font-size: 12pt; margin: 12pt 0 4pt; }
  p { margin: 0 0 8pt; orphans: 2; widows: 2; white-space: pre-line; }
  ol, ul { padding-left: 22pt; }
  li { margin-bottom: 3pt; }
  li p { margin: 0; }
  blockquote { margin-left: 0; padding-left: 12pt; border-left: 2pt solid #c4cedd; }
  pre { white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4pt; border: 1px solid #c4cedd; text-align: left; }
  a { color: #173e72; }
  .brand { color: #173e72; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 2px solid #173e72; padding-bottom: 8pt; }
  .meta { color: #4a5669; margin-bottom: 14pt; }
  .cover { padding-top: 2.2in; }
  .cover h1 { font-size: 36pt; }
  .cover p { font-size: 15pt; }
  .page { break-before: page; }
  .rich { margin-bottom: 16pt; }
  .rich h1, .rich h2 { font-size: 13pt; margin-top: 11pt; }
  .rich h3, .rich h4, .rich h5, .rich h6 { font-size: 11pt; margin-top: 9pt; }
</style></head><body>${body}</body></html>`;
}

export function sopPrintHtml(sop: Sop, area: string) {
  return documentHtml(sopTitle(sop), `<header class="brand">Cadence</header><main>
    <h1>${escape(sopTitle(sop))}</h1>
    <p class="meta">${escape(area || "Untitled area")} · ${escape(sopMeta(sop))}</p>
    ${sop.kind === "written" ? `<div class="rich">${cleanContent(sop.content)}</div>` : `<p>${escape(attachmentLabel(sop))}</p><p>The attachment is not included in this export.</p>`}
  </main>`);
}

export function manualPrintHtml(workspace: Workspace) {
  const name = workspace.name || "Untitled workspace";
  const people = new Map(workspace.people.map((person) => [person.id, person.name]));
  const contents = workspace.areas.map((area, index) => `<li><a href="#area-${index}">${escape(areaName(area))}</a></li>`).join("");
  const areas = workspace.areas.map((area, index) => `<section class="page" id="area-${index}">
    <h1>${escape(areaName(area))}</h1>${area.description ? `<p>${escape(area.description)}</p>` : ""}
    <h2>Processes</h2>${area.processes.map((process) => `<section>
      <h3>${escape(process.name || "Untitled process")}</h3>
      <p class="meta">Owner: ${escape(people.get(process.ownerId ?? "") || "Unassigned")} · ${escape(processStatuses[process.status] ?? process.status)}</p>
      ${process.description ? `<p>${escape(process.description)}</p>` : ""}
      ${process.steps.length ? `<ol>${process.steps.map((step) => `<li>${escape(step.text)}</li>`).join("")}</ol>` : "<p>No steps recorded.</p>"}
    </section>`).join("") || "<p>No processes recorded.</p>"}
    <h2>Written SOPs</h2>${area.sops.filter((sop) => sop.kind === "written").map((sop) => `<section>
      <h3>${escape(sopTitle(sop))}</h3><p class="meta">${escape(sopMeta(sop))}</p>
      <div class="rich">${cleanContent(sop.content)}</div>
    </section>`).join("") || "<p>No written SOPs recorded.</p>"}
    <h2>Attached SOPs</h2>${area.sops.some((sop) => sop.kind === "file") ? `<ul>${area.sops.filter((sop) => sop.kind === "file")
      .map((sop) => `<li><strong>${escape(sopTitle(sop))}</strong> — ${escape(attachmentLabel(sop))} · ${escape(sopMeta(sop))}</li>`).join("")}</ul>` : "<p>No attached SOPs recorded.</p>"}
  </section>`).join("");
  const notes = workspace.areas.map((area) => {
    const open = area.notes.filter((note) => note.kind === "improvement" && !note.resolved);
    if (!open.length) return "";
    return `<section><h2>${escape(areaName(area))}</h2><ul>${open.map((note) => {
      const process = area.processes.find((item) => item.id === note.processId);
      return `<li>${process ? `<strong>${escape(process.name || "Untitled process")}:</strong> ` : ""}${escape(note.text)}</li>`;
    }).join("")}</ul></section>`;
  }).join("");
  return documentHtml(`${name} — Operations manual`, `<header class="brand">Cadence</header><main>
    <section class="cover"><h1>Operations manual</h1><p>${escape(name)}</p><p class="meta">${escape(date(new Date()))}</p></section>
    <section class="page"><h1>Table of contents</h1><ol>${contents}<li><a href="#appendix">Appendix: Open improvement notes</a></li></ol></section>
    ${areas}
    <section class="page" id="appendix"><h1>Appendix: Open improvement notes</h1>${notes || "<p>No open improvement notes.</p>"}</section>
  </main>`);
}

async function printPdf(html: string) {
  const directory = await fs.mkdtemp(join(app.getPath("temp"), "cadence-print-"));
  try {
    const page = join(directory, "print.html");
    await fs.writeFile(page, html, { mode: 0o600 });
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, javascript: false },
    });
    try {
      await printWindow.loadFile(page);
      return await printWindow.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
    } finally {
      if (!printWindow.isDestroyed()) printWindow.destroy();
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

export function safeFileName(name: string, fallback: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim().replace(/[. ]+$/, "").slice(0, 120) || fallback;
}

export async function chooseSavePath(owner: BrowserWindow | null, title: string, name: string, extension: string, type: string) {
  const options: SaveDialogOptions = { title, defaultPath: `${name}.${extension}`, filters: [{ name: type, extensions: [extension] }] };
  const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
  return result.canceled ? null : result.filePath || null;
}

export async function exportSop(owner: BrowserWindow | null, sop: Sop, area: string, format: "pdf" | "docx") {
  if (format !== "pdf" && format !== "docx") throw new Error("Unknown SOP export format.");
  const path = await chooseSavePath(owner, "Export SOP", safeFileName(sopTitle(sop), "SOP"), format, format === "pdf" ? "PDF" : "Word document");
  if (!path) return false;
  const data = format === "pdf"
    ? await printPdf(sopPrintHtml(sop, area))
    : await sopDocx(sopTitle(sop), `${area || "Untitled area"} · ${sopMeta(sop)}`, sop.kind === "written"
      ? cleanContent(sop.content)
      : `<p>${escape(attachmentLabel(sop))}</p><p>The attachment is not included in this export.</p>`);
  await fs.writeFile(path, data);
  return true;
}

export async function exportManual(owner: BrowserWindow | null, workspace: Workspace) {
  const name = safeFileName(workspace.name, "Workspace");
  const path = await chooseSavePath(owner, "Export operations manual", `${name} - Operations manual`, "pdf", "PDF");
  if (!path) return false;
  await fs.writeFile(path, await printPdf(manualPrintHtml(workspace)));
  return true;
}
