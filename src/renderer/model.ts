import { marked } from "marked";
import type { Area, AreaKind, Attachment, NoteKind, Process, ProcessStatus, Sop, SopStatus, Step, Workspace } from "../shared/types";
import { emptyRaci, newPerson } from "./people/model";

export const GRID_SIZE = 18;
export const FOOTPRINT = 2;

export const HUES = [212, 28, 152, 268, 340, 46, 188, 6];

export type Tone = "gray" | "blue" | "orange" | "green" | "red" | "violet";

export const AREA_KINDS: { value: AreaKind; label: string }[] = [
  { value: "shipping", label: "Shipping & logistics" },
  { value: "inventory", label: "Inventory & storage" },
  { value: "purchasing", label: "Purchasing" },
  { value: "sales", label: "Sales & customer service" },
  { value: "engineering", label: "Engineering & programming" },
  { value: "production", label: "Production" },
  { value: "quality", label: "Quality" },
  { value: "maintenance", label: "Maintenance & facilities" },
  { value: "office", label: "Office & admin" },
];

export const PRESETS: { name: string; hue: number; kind: AreaKind }[] = [
  { name: "Shipping & Receiving", hue: 28, kind: "shipping" },
  { name: "Inventory", hue: 46, kind: "inventory" },
  { name: "Purchasing", hue: 188, kind: "purchasing" },
  { name: "Sales & Quoting", hue: 340, kind: "sales" },
  { name: "Engineering", hue: 268, kind: "engineering" },
  { name: "Production", hue: 212, kind: "production" },
  { name: "Quality", hue: 152, kind: "quality" },
  { name: "Maintenance", hue: 6, kind: "maintenance" },
  { name: "Accounting", hue: 188, kind: "office" },
];

export const PROCESS_STATUSES: { value: ProcessStatus; label: string; tone: Tone }[] = [
  { value: "unmapped", label: "Not mapped", tone: "gray" },
  { value: "mapped", label: "Mapped", tone: "blue" },
  { value: "documented", label: "Documented", tone: "orange" },
  { value: "optimized", label: "Optimized", tone: "green" },
];

export const SOP_STATUSES: { value: SopStatus; label: string; tone: Tone }[] = [
  { value: "draft", label: "Draft", tone: "gray" },
  { value: "review", label: "In review", tone: "orange" },
  { value: "approved", label: "Approved", tone: "green" },
];

export const DEFAULT_SOP_REVIEW_MONTHS = 12;

export const NOTE_KINDS: { value: NoteKind; label: string; tone: Tone }[] = [
  { value: "improvement", label: "Improvement", tone: "green" },
  { value: "revisit", label: "Come back to", tone: "orange" },
  { value: "issue", label: "Issue", tone: "red" },
  { value: "question", label: "Question", tone: "violet" },
];

export const SOP_TEMPLATE = `<h2>Purpose</h2><p>Why this procedure exists.</p>
<h2>Scope</h2><p>Where it applies and where it does not.</p>
<h2>Responsibilities</h2><ul><li><p></p></li></ul>
<h2>Procedure</h2><ol><li><p></p></li></ol>
<h2>Records</h2><p>What gets filed, where, and for how long.</p>`;

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export const emptyWorkspace = (): Workspace => ({ version: 2, name: "My Operations", people: [], areas: [], flows: [] });

const KIND_KEYWORDS: [AreaKind, RegExp][] = [
  ["shipping", /ship|receiv|logistic|dock|freight/i],
  ["inventory", /inventor|stock|warehouse|storage|material/i],
  ["purchasing", /purchas|procure|buy|vendor|supply/i],
  ["sales", /sales|quot|customer|estimat/i],
  ["engineering", /engineer|program|cam|design/i],
  ["production", /produc|machin|manufactur|shop|cnc|assembl/i],
  ["quality", /quality|inspect|qa|qc|metrolog/i],
  ["maintenance", /mainten|facilit|repair/i],
];

export const guessKind = (name: string): AreaKind => KIND_KEYWORDS.find(([, pattern]) => pattern.test(name))?.[0] ?? "office";

export function migrate(raw: unknown): Workspace {
  const workspace = raw as Omit<Workspace, "version" | "areas"> & {
    version: number;
    areas: (Area & { processes: (Process & { owner?: string })[] })[];
  };
  workspace.people ??= [];
  const peopleByName = new Map(workspace.people.map((person) => [person.name.trim().toLowerCase(), person]));
  for (const area of workspace.areas) {
    area.kind ??= guessKind(area.name);
    for (const process of area.processes) {
      process.raci ??= emptyRaci();
      const name = process.owner?.trim();
      if (process.ownerId == null && name) {
        const key = name.toLowerCase();
        let person = peopleByName.get(key);
        if (!person) {
          person = newPerson(name);
          workspace.people.push(person);
          peopleByName.set(key, person);
        }
        if (!person.areaIds.includes(area.id)) person.areaIds.push(area.id);
        process.ownerId = person.id;
      }
      process.ownerId ??= null;
      delete process.owner;
      for (const step of process.steps) {
        step.type ??= "action";
        step.role ??= "";
        step.system ??= "";
        step.durationMinutes ??= 0;
        step.branches ??= [];
        step.sequence ??= "list";
      }
    }
    for (const sop of area.sops) {
      if (workspace.version < 2 && sop.kind === "written") sop.content = marked.parse(sop.content, { async: false }) as string;
      sop.reviewEveryMonths ??= DEFAULT_SOP_REVIEW_MONTHS;
      if (sop.status === "approved") sop.lastReviewedAt ??= sop.updatedAt;
      sop.revision ??= sop.status === "approved" ? 1 : 0;
      sop.training ??= {};
    }
  }
  workspace.version = 2;
  return workspace as Workspace;
}

export const newArea = (name: string, hue: number, kind: AreaKind, x: number, y: number): Area => ({
  id: uid(),
  name,
  kind,
  description: "",
  hue,
  x,
  y,
  processes: [],
  sops: [],
  notes: [],
  createdAt: now(),
});

export const newProcess = (name: string): Process => ({
  id: uid(),
  name,
  ownerId: null,
  raci: emptyRaci(),
  description: "",
  status: "unmapped",
  steps: [],
  sopIds: [],
  createdAt: now(),
});

export const newStep = (text: string): Step => ({ id: uid(), text, type: "action", role: "", system: "", durationMinutes: 0, branches: [], sequence: "list" });

export const newWrittenSop = (): Sop => ({
  id: uid(),
  title: "Untitled SOP",
  status: "draft",
  kind: "written",
  content: SOP_TEMPLATE,
  revision: 0,
  training: {},
  updatedAt: now(),
  reviewEveryMonths: DEFAULT_SOP_REVIEW_MONTHS,
});

export const newFileSop = (attachment: Attachment): Sop => ({
  id: uid(),
  title: attachment.originalName.replace(/\.[^.]+$/, ""),
  status: "draft",
  kind: "file",
  content: "",
  attachment,
  revision: 0,
  training: {},
  updatedAt: now(),
  reviewEveryMonths: DEFAULT_SOP_REVIEW_MONTHS,
});

export const newNote = (kind: NoteKind, text: string, processId?: string) => ({
  id: uid(),
  kind,
  text,
  processId,
  resolved: false,
  createdAt: now(),
});

export const newFlow = (from: string, to: string, label: string) => ({ id: uid(), from, to, label });

export function findArea(workspace: Workspace, id: string): Area {
  const area = workspace.areas.find((a) => a.id === id);
  if (!area) throw new Error(`Unknown area ${id}`);
  return area;
}

export const touch = (sop: Sop) => {
  sop.updatedAt = now();
};

export function setSopStatus(sop: Sop, status: SopStatus) {
  if (status === "approved" && sop.status !== "approved") {
    sop.revision += 1;
    sop.lastReviewedAt = sop.updatedAt;
  }
  sop.status = status;
}

export const openNotes = (area: Area) => area.notes.filter((n) => !n.resolved);

export function canPlace(areas: Area[], x: number, y: number, ignoreId?: string) {
  if (x < 0 || y < 0 || x > GRID_SIZE - FOOTPRINT || y > GRID_SIZE - FOOTPRINT) return false;
  return !areas.some((a) => a.id !== ignoreId && Math.abs(a.x - x) < FOOTPRINT && Math.abs(a.y - y) < FOOTPRINT);
}

export const toneOf = <T extends string>(list: { value: T; tone: Tone }[], value: T) =>
  list.find((item) => item.value === value)?.tone ?? "gray";

export const labelOf = <T extends string>(list: { value: T; label: string }[], value: T) =>
  list.find((item) => item.value === value)?.label ?? value;

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const plural = (count: number, word: string, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

export const hueColor = (hue: number, lightness = 60) => `hsl(${hue} 55% ${lightness}%)`;
