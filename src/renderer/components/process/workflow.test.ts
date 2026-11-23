import { describe, expect, test } from "bun:test";
import type { Step } from "../../../shared/types";
import { emptyWorkspace, migrate, newArea, newProcess } from "../../model";
import { removeProcessStep, workflowEdges } from "./workflow";

describe("process workflow", () => {
  test("backfills version 2 list steps without replacing authored workflow fields", () => {
    const area = newArea("Quality", 152, "quality", 0, 0);
    const process = newProcess("Inspect inbound parts");
    const legacy = { id: "receive", text: "Receive the parts" };
    const decision: Step = {
      id: "inspect",
      text: "Do the parts pass inspection?",
      type: "decision",
      role: "Inspector",
      system: "JobBOSS",
      durationMinutes: 15,
      sequence: "end",
      branches: [{ id: "yes", label: "Yes", targetStepId: "receive" }],
    };
    process.steps = [legacy, decision];
    area.processes.push(process);
    const workspace = migrate({ ...emptyWorkspace(), areas: [area] });

    expect(workspace.version).toBe(2);
    expect(process.steps).toEqual([
      { ...legacy, type: "action", role: "", system: "", durationMinutes: 0, sequence: "list", branches: [] },
      decision,
    ]);
    expect(workflowEdges(process.steps)).toEqual([
      { source: "receive", target: "inspect" },
      { source: "inspect", target: "receive", label: "Yes" },
    ]);
  });

  test("follows list moves for automatic edges and keeps explicit routes and path endings", () => {
    const first = { id: "first", text: "Start" };
    const handoff: Step = { id: "handoff", type: "handoff", text: "Send to Quality", sequence: "end" };
    const wait: Step = { id: "wait", type: "wait", text: "Wait for results", sequence: { targetStepId: handoff.id } };
    expect(workflowEdges([first, handoff, wait])).toEqual([
      { source: first.id, target: handoff.id },
      { source: wait.id, target: handoff.id },
    ]);
    expect(workflowEdges([first, wait, handoff])).toEqual([
      { source: first.id, target: wait.id },
      { source: wait.id, target: handoff.id },
    ]);
  });

  test("keeps decision outcomes visible when they share a destination and ignores missing targets", () => {
    const steps: Step[] = [
      { id: "review", text: "Review parts", type: "decision", branches: [
        { id: "a", label: "Yes", targetStepId: "log" },
        { id: "b", label: "Rework", targetStepId: "log" },
        { id: "c", label: "Hold", targetStepId: "removed" },
      ] },
      { id: "log", text: "Log the result" },
    ];
    expect(workflowEdges(steps)).toEqual([{ source: "review", target: "log", label: "Yes / Rework" }]);
    steps[0].branches = [];
    expect(workflowEdges(steps)).toEqual([]);
  });

  test("removing a step clears inbound connections without silently rerouting explicit paths", () => {
    const process = newProcess("Inspect");
    process.steps = [
      { id: "review", text: "Review parts", type: "decision", branches: [
        { id: "a", label: "Yes", targetStepId: "removed" },
        { id: "b", label: "No", targetStepId: "hold" },
      ] },
      { id: "start", text: "Start" },
      { id: "removed", text: "Delete me" },
      { id: "hold", text: "Hold for review", sequence: { targetStepId: "removed" } },
    ];
    removeProcessStep(process, "removed");

    expect(process.steps[2].sequence).toBe("end");
    expect(process.steps[0].branches?.map((branch) => branch.id)).toEqual(["b"]);
    expect(workflowEdges(process.steps)).toEqual([
      { source: "review", target: "hold", label: "No" },
      { source: "start", target: "hold" },
    ]);
  });
});
