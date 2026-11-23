import { describe, expect, test } from "bun:test";
import { canPlace, emptyWorkspace, FOOTPRINT, GRID_SIZE, guessKind, migrate, newArea, newFileSop, newWrittenSop } from "./model";

describe("canPlace", () => {
  const area = newArea("Production", 212, "production", 3, 3);
  const last = GRID_SIZE - FOOTPRINT;

  test("keeps the full area footprint within the grid", () => {
    expect(canPlace([], 0, 0)).toBe(true);
    expect(canPlace([], last, last)).toBe(true);
    expect(canPlace([], -1, 0)).toBe(false);
    expect(canPlace([], 0, -1)).toBe(false);
    expect(canPlace([], last + 1, last)).toBe(false);
    expect(canPlace([], last, last + 1)).toBe(false);
  });

  test("rejects overlap but allows footprints to touch", () => {
    expect(canPlace([area], area.x + 1, area.y + 1)).toBe(false);
    expect(canPlace([area], area.x + FOOTPRINT, area.y)).toBe(true);
    expect(canPlace([area], area.x, area.y - FOOTPRINT)).toBe(true);
  });

  test("ignores only the area being moved", () => {
    const neighbor = newArea("Quality", 152, "quality", area.x + FOOTPRINT, area.y);
    expect(canPlace([area, neighbor], area.x, area.y, area.id)).toBe(true);
    expect(canPlace([area, neighbor], area.x + 1, area.y, area.id)).toBe(false);
  });
});

test.each([
  ["Shipping & Receiving", "shipping"],
  ["RAW STOCK", "inventory"],
  ["Vendor Management", "purchasing"],
  ["Quoting", "sales"],
  ["CAM Programming", "engineering"],
  ["CNC Assembly", "production"],
  ["Metrology", "quality"],
  ["Facilities", "maintenance"],
  ["Accounting", "office"],
] as const)("guesses the kind of %s", (name, kind) => {
  expect(guessKind(name)).toBe(kind);
});

describe("migrate", () => {
  test("converts legacy written SOP markdown to HTML without changing file SOPs", () => {
    const area = newArea("Production", 212, "production", 0, 0);
    const written = { ...newWrittenSop(), content: "# Check stock\n\n- Wear **gloves**." };
    const file = newFileSop({ storedName: "checklist.pdf", originalName: "Checklist.pdf", size: 42 });
    const workspace = migrate({ ...emptyWorkspace(), version: 1, areas: [{ ...area, sops: [written, { ...file }] }] });
    expect(workspace.version).toBe(2);
    const html = "<h1>Check stock</h1>\n<ul>\n<li>Wear <strong>gloves</strong>.</li>\n</ul>\n";
    expect(workspace.areas[0].sops[0].content).toBe(html);
    expect(workspace.areas[0].sops[1]).toEqual(file);
    expect(migrate(workspace).areas[0].sops[0].content).toBe(html);
  });

  test("backfills a missing kind at the current version without replacing explicit kinds or HTML", () => {
    const area = newArea("Metrology", 152, "office", 0, 0);
    const written = { ...newWrittenSop(), content: "<p>Use **as written**.</p>" };
    const workspace = migrate({
      ...emptyWorkspace(),
      areas: [{ ...area, sops: [written] }, { ...newArea("Metrology lab", 152, "office", 2, 0), kind: undefined }],
    });
    expect(workspace.areas.map(({ kind }) => kind)).toEqual(["office", "quality"]);
    expect(workspace.areas[0].sops[0].content).toBe("<p>Use **as written**.</p>");
  });
});
