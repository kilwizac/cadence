import { NumberInput, Select, SimpleGrid, TextInput } from "@mantine/core";
import type { Step, StepType } from "../../../shared/types";
import type { Tone } from "../../model";

export const STEP_TYPES: Record<StepType, { label: string; tone: Tone }> = {
  action: { label: "Action", tone: "blue" },
  decision: { label: "Decision", tone: "violet" },
  handoff: { label: "Handoff", tone: "orange" },
  wait: { label: "Wait", tone: "gray" },
};

const stepTypeOptions = Object.entries(STEP_TYPES).map(([value, { label }]) => ({ value, label }));

export function StepFields({ step, onChange }: { step: Step; onChange: (changes: Partial<Step>) => void }) {
  return (
    <SimpleGrid cols={2} spacing={6}>
      <Select
        label="Type"
        size="xs"
        data={stepTypeOptions}
        value={step.type ?? "action"}
        onChange={(value) => value && onChange({ type: value as StepType })}
      />
      <NumberInput
        label="Duration (min)"
        size="xs"
        value={step.durationMinutes ?? ""}
        placeholder="0"
        min={0}
        allowDecimal={false}
        clampBehavior="strict"
        onChange={(value) => onChange({ durationMinutes: typeof value === "number" ? value : undefined })}
      />
      <TextInput label="Role" size="xs" placeholder="Who does it" value={step.role ?? ""} onChange={(event) => onChange({ role: event.currentTarget.value })} />
      <TextInput label="System" size="xs" placeholder="JobBOSS, email, paper…" value={step.system ?? ""} onChange={(event) => onChange({ system: event.currentTarget.value })} />
    </SimpleGrid>
  );
}
