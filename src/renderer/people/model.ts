import type { Person, Raci, RaciRole } from "../../shared/types";

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
