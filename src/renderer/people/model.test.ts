import { describe, expect, test } from "bun:test";
import { emptyWorkspace, migrate, newArea, newFileSop, newProcess, newWrittenSop, setSopStatus } from "../model";
import { emptyRaci, newPerson, recordTraining, trainingStatus } from "./model";

describe("people migration", () => {
  test("reuses owners by name across areas and links their memberships", () => {
    const quality = newArea("Quality", 152, "quality", 0, 0);
    const production = newArea("Production", 212, "production", 2, 0);
    const existing = newPerson("Avery Smith");
    const workspace = migrate({
      ...emptyWorkspace(),
      people: [existing],
      areas: [
        { ...quality, processes: [{ ...newProcess("Inspect"), owner: " Avery Smith ", raci: undefined }] },
        { ...production, processes: [
          { ...newProcess("Machine"), owner: "avery smith", ownerId: undefined },
          { ...newProcess("Deburr"), owner: "Megan Patel", ownerId: undefined },
          { ...newProcess("Clean"), owner: " ", ownerId: undefined },
        ] },
      ],
    });

    expect(workspace.people.map((person) => person.name)).toEqual(["Avery Smith", "Megan Patel"]);
    expect(workspace.people[0].areaIds).toEqual([quality.id, production.id]);
    expect(workspace.people[1].areaIds).toEqual([production.id]);
    expect(workspace.areas.flatMap((area) => area.processes.map((process) => process.ownerId))).toEqual([
      existing.id, existing.id, workspace.people[1].id, null,
    ]);
    expect(workspace.areas[0].processes[0].raci).toEqual(emptyRaci());
    expect(workspace.areas[0].processes[0]).not.toHaveProperty("owner");
    expect(migrate(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace);
  });

  test("creates a directory when loading a workspace without people", () => {
    const area = newArea("Quality", 152, "quality", 0, 0);
    const workspace = migrate({
      ...emptyWorkspace(),
      people: undefined,
      areas: [{ ...area, processes: [{ ...newProcess("Inspect"), owner: "Avery Smith", ownerId: undefined }] }],
    });
    expect(workspace.people).toHaveLength(1);
    expect(workspace.areas[0].processes[0].ownerId).toBe(workspace.people[0].id);
  });
});

describe("SOP training", () => {
  test("backfills the first revision only for previously approved SOPs", () => {
    const area = newArea("Quality", 152, "quality", 0, 0);
    const approved = { ...newWrittenSop(), status: "approved", revision: undefined, training: undefined };
    const draft = { ...newFileSop({ originalName: "Procedure.pdf", storedName: "file.pdf", size: 42 }), revision: undefined, training: undefined };
    const workspace = migrate({ ...emptyWorkspace(), areas: [{ ...area, sops: [approved, draft] }] });

    expect(workspace.areas[0].sops.map((sop) => sop.revision)).toEqual([1, 0]);
    expect(workspace.areas[0].sops.map((sop) => sop.training)).toEqual([{}, {}]);
  });

  test("moves training from missing to current to outdated as approvals change", () => {
    const sop = newWrittenSop();
    const person = newPerson("Avery Smith");
    const trainedAt = "2026-11-22T18:00:00.000Z";
    const status = () => trainingStatus(sop.revision, sop.training[person.id]);

    recordTraining(sop, person.id, trainedAt);
    expect(status()).toBe("missing");
    setSopStatus(sop, "approved");
    expect(sop.revision).toBe(1);
    expect(sop.lastReviewedAt).toBe(sop.updatedAt);
    recordTraining(sop, person.id, trainedAt);
    expect(sop.training[person.id]).toEqual({ revision: 1, trainedAt });
    setSopStatus(sop, "approved");
    expect(status()).toBe("current");

    setSopStatus(sop, "review");
    expect(status()).toBe("current");
    setSopStatus(sop, "approved");
    expect(sop.revision).toBe(2);
    expect(status()).toBe("outdated");
    recordTraining(sop, person.id, trainedAt);
    expect(status()).toBe("current");
    expect(trainingStatus(sop.revision, sop.training["another-person"])).toBe("missing");
  });
});
