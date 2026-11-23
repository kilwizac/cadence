import { expect, test } from "bun:test";
import { emptyWorkspace, newArea, newFlow, newNote, newProcess, newWrittenSop } from "../model";
import { getInsights } from "./metrics";

test("counts processes with approved links once and summarizes valid handoffs", () => {
  const production = newArea("Production", 212, "production", 0, 0);
  const quality = newArea("Quality", 152, "quality", 2, 0);
  const approved = { ...newWrittenSop(), status: "approved" as const };
  const draft = newWrittenSop();
  production.sops.push(approved, draft);
  production.processes.push(
    { ...newProcess("Prepare mill"), status: "documented", sopIds: [approved.id, draft.id, approved.id] },
    { ...newProcess("Run mill"), status: "mapped", sopIds: [draft.id, "removed"] },
  );
  quality.processes.push(newProcess("Check parts"));
  const result = getInsights({
    ...emptyWorkspace(),
    areas: [production, quality],
    flows: [newFlow(production.id, quality.id, "Inspect"), newFlow(quality.id, "removed", "Ship")],
  });

  expect(result).toMatchObject({ processes: 3, covered: 1, handoffs: 1, connected: 2 });
  expect(result.areaRows).toMatchObject([
    { area: "Production", documented: 1, mapped: 1, coverage: 50, incoming: 0, outgoing: 1 },
    { area: "Quality", unmapped: 1, coverage: 0, incoming: 1, outgoing: 0 },
  ]);
});

test("groups unresolved notes by age and ranks issues before improvements", () => {
  const area = newArea("Quality", 152, "quality", 0, 0);
  const now = new Date("2026-11-22T21:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
  area.notes.push(
    { ...newNote("improvement", "Old improvement"), createdAt: ago(90) },
    { ...newNote("issue", "New issue"), createdAt: ago(7) },
    { ...newNote("issue", "Old issue"), createdAt: ago(89) },
    { ...newNote("question", "Recent question"), createdAt: ago(6) },
    { ...newNote("revisit", "Resolved"), createdAt: ago(35), resolved: true },
  );
  const result = getInsights({ ...emptyWorkspace(), areas: [area] }, now);

  expect(result.openNotes).toBe(4);
  expect(result.noteKinds.map(({ value }) => value)).toEqual([1, 0, 2, 1]);
  expect(result.noteAges.map(({ count }) => count)).toEqual([1, 1, 1, 1]);
  expect(result.opportunities.map(({ note }) => note.text)).toEqual(["Old issue", "New issue", "Old improvement"]);
});

test("clamps review dates to the end of the due month and includes only approved SOPs in the window", () => {
  const area = newArea("Quality", 152, "quality", 0, 0);
  const january = new Date(2026, 0, 31, 12).toISOString();
  const approved = { ...newWrittenSop(), status: "approved" as const, updatedAt: january };
  area.sops.push(
    { ...approved, id: "overdue", reviewEveryMonths: 1 },
    { ...approved, id: "soon", reviewEveryMonths: 2, lastReviewedAt: january },
    { ...approved, id: "later", reviewEveryMonths: 3 },
    { ...approved, id: "draft", status: "draft", reviewEveryMonths: 1 },
  );
  const result = getInsights({ ...emptyWorkspace(), areas: [area] }, new Date(2026, 2, 1, 12));

  expect(result.reviews.map(({ sop, due, overdue }) => [sop.id, due, overdue])).toEqual([
    ["overdue", new Date(2026, 1, 28), true],
    ["soon", new Date(2026, 2, 31), false],
  ]);
});
