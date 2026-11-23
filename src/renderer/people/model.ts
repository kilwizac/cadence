import type { Person, Raci, RaciRole, Sop, SopTrainingRecord } from "../../shared/types";

export const RACI_ROLES: { value: RaciRole; label: string }[] = [
  { value: "responsible", label: "Responsible" },
  { value: "accountable", label: "Accountable" },
  { value: "consulted", label: "Consulted" },
  { value: "informed", label: "Informed" },
];

export const emptyRaci = (): Raci => ({ responsible: [], accountable: [], consulted: [], informed: [] });

export const newPerson = (name: string, areaIds: string[] = []): Person => ({
  id: crypto.randomUUID(),
  name,
  role: "",
  areaIds,
});

export const trainingStatus = (revision: number, record?: SopTrainingRecord) =>
  !record ? "missing" : record.revision === revision ? "current" : "outdated";

export function recordTraining(sop: Sop, personId: string, trainedAt: string) {
  if (sop.status === "approved" && sop.revision > 0) {
    sop.training[personId] = { revision: sop.revision, trainedAt };
  }
}
