import type { ProcessStatus, Workspace } from "../../shared/types";
import { DEFAULT_SOP_REVIEW_MONTHS, NOTE_KINDS } from "../model";

const DAY = 24 * 60 * 60 * 1000;
export const REVIEW_WINDOW_DAYS = 30;

export function getInsights(workspace: Workspace, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const reviewWindowEnd = new Date(today);
  reviewWindowEnd.setDate(today.getDate() + REVIEW_WINDOW_DAYS);
  const areaRows = workspace.areas.map((area) => {
    const approved = new Set(area.sops.filter((sop) => sop.status === "approved").map((sop) => sop.id));
    const statuses: Record<ProcessStatus, number> = { unmapped: 0, mapped: 0, documented: 0, optimized: 0 };
    let covered = 0;
    for (const process of area.processes) {
      statuses[process.status]++;
      if (process.sopIds.some((id) => approved.has(id))) covered++;
    }
    const total = area.processes.length;
    return {
      id: area.id,
      area: area.name || "Untitled area",
      ...statuses,
      covered,
      total,
      coverage: total ? Math.round((covered / total) * 100) : 0,
      incoming: 0,
      outgoing: 0,
    };
  });
  const rowsById = new Map(areaRows.map((row) => [row.id, row]));
  let handoffs = 0;
  for (const flow of workspace.flows) {
    const from = rowsById.get(flow.from);
    const to = rowsById.get(flow.to);
    if (!from || !to) continue;
    from.outgoing++;
    to.incoming++;
    handoffs++;
  }

  const open = workspace.areas.flatMap((area) =>
    area.notes.filter((note) => !note.resolved).map((note) => {
      const timestamp = Date.parse(note.createdAt);
      const age = Number.isFinite(timestamp) ? Math.max(0, Math.floor((now.getTime() - timestamp) / DAY)) : null;
      return { area, note, age };
    }),
  );
  const noteKinds = NOTE_KINDS.map((kind) => ({
    name: kind.label,
    value: open.filter(({ note }) => note.kind === kind.value).length,
    color: `${kind.tone}.6`,
  }));
  const noteAges = [
    { label: "Under 7 days", count: 0 },
    { label: "7–29 days", count: 0 },
    { label: "30–89 days", count: 0 },
    { label: "90+ days", count: 0 },
    { label: "Unknown", count: 0 },
  ];
  for (const { age } of open) {
    noteAges[age === null ? 4 : age < 7 ? 0 : age < 30 ? 1 : age < 90 ? 2 : 3].count++;
  }
  if (!noteAges[4].count) noteAges.pop();

  const reviews = workspace.areas.flatMap((area) => area.sops.flatMap((sop) => {
    if (sop.status !== "approved") return [];
    const due = new Date(sop.lastReviewedAt ?? sop.updatedAt);
    const months = sop.reviewEveryMonths ?? DEFAULT_SOP_REVIEW_MONTHS;
    if (!Number.isInteger(months) || months < 1 || !Number.isFinite(due.getTime())) return [];
    const day = due.getDate();
    due.setMonth(due.getMonth() + months + 1, 0);
    due.setDate(Math.min(day, due.getDate()));
    due.setHours(0, 0, 0, 0);
    if (!(due <= reviewWindowEnd)) return [];
    return [{ area, sop, due, overdue: due < today }];
  })).sort((a, b) => a.due.getTime() - b.due.getTime());

  return {
    areaRows,
    processes: areaRows.reduce((sum, area) => sum + area.total, 0),
    covered: areaRows.reduce((sum, area) => sum + area.covered, 0),
    handoffs,
    connected: areaRows.filter((area) => area.incoming || area.outgoing).length,
    openNotes: open.length,
    noteKinds,
    noteAges,
    reviews,
    opportunities: open.filter(({ note }) => note.kind === "issue" || note.kind === "improvement")
      .sort((a, b) => Number(b.note.kind === "issue") - Number(a.note.kind === "issue")
        || (b.age ?? -1) - (a.age ?? -1) || Date.parse(a.note.createdAt) - Date.parse(b.note.createdAt)),
  };
}

export type InsightsData = ReturnType<typeof getInsights>;
