import type { Process, Step } from "../../../shared/types";

export function workflowEdges(steps: Step[]): { source: string; target: string; label?: string }[] {
  const ids = new Set(steps.map((step) => step.id));
  return steps.flatMap<{ source: string; target: string; label?: string }>((step, index) => {
    if (step.type === "decision") {
      const labelsByTarget = new Map<string, string[]>();
      for (const branch of step.branches ?? []) {
        if (branch.targetStepId === step.id || !ids.has(branch.targetStepId)) continue;
        const labels = labelsByTarget.get(branch.targetStepId) ?? [];
        labels.push(branch.label.trim() || "Unlabeled");
        labelsByTarget.set(branch.targetStepId, labels);
      }
      return [...labelsByTarget].map(([target, labels]) => ({ source: step.id, target, label: labels.join(" / ") }));
    }
    const sequence = step.sequence ?? "list";
    const target = sequence === "list" ? steps[index + 1]?.id : sequence === "end" ? undefined : sequence.targetStepId;
    return target && target !== step.id && ids.has(target) ? [{ source: step.id, target }] : [];
  });
}

export function removeProcessStep(process: Process, id: string) {
  process.steps = process.steps.filter((step) => step.id !== id);
  for (const step of process.steps) {
    if (typeof step.sequence === "object" && step.sequence.targetStepId === id) step.sequence = "end";
    if (step.branches?.some((branch) => branch.targetStepId === id)) {
      step.branches = step.branches.filter((branch) => branch.targetStepId !== id);
    }
  }
}
