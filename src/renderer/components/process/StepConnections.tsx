import { ActionIcon, Group, NativeSelect, Paper, Stack, Text, TextInput } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import type { Step } from "../../../shared/types";

export function StepConnections({
  step,
  steps,
  edit,
  onConnect,
}: {
  step: Step;
  steps: Step[];
  edit: (recipe: (draft: Step) => void) => void;
  onConnect: (targetId: string) => void;
}) {
  const targets = steps
    .map((candidate, index) => ({ value: `step:${candidate.id}`, label: `${index + 1}. ${candidate.text.trim() || "Untitled step"}` }))
    .filter((target) => target.value !== `step:${step.id}`);

  if (step.type === "decision") {
    return (
      <Stack gap="xs">
        <Text size="sm" fw={600}>Decision branches</Text>
        <Text size="xs" c="dimmed">A decision only leads to the steps you connect here.</Text>
        {(step.branches ?? []).map((branch, index) => (
          <Paper key={branch.id} withBorder p="xs">
            <Stack gap={6}>
              <Group align="flex-end" wrap="nowrap" gap={6}>
                <TextInput
                  size="xs"
                  label={`Branch ${index + 1} label`}
                  value={branch.label}
                  onChange={(event) => {
                    const label = event.currentTarget.value;
                    edit((draft) => {
                      const match = draft.branches?.find((item) => item.id === branch.id);
                      if (match) match.label = label;
                    });
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="input-xs"
                  aria-label={`Remove branch ${index + 1}`}
                  onClick={() => edit((draft) => void (draft.branches = draft.branches?.filter((item) => item.id !== branch.id)))}
                >
                  <IconX size={15} />
                </ActionIcon>
              </Group>
              <NativeSelect
                size="xs"
                label={`Branch ${index + 1} destination`}
                data={targets}
                value={`step:${branch.targetStepId}`}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  edit((draft) => {
                    const match = draft.branches?.find((item) => item.id === branch.id);
                    if (match) match.targetStepId = value.slice(5);
                  });
                }}
              />
            </Stack>
          </Paper>
        ))}
        {targets.length ? (
          <NativeSelect
            size="xs"
            label="Add a branch"
            data={[{ value: "", label: "Choose a destination", disabled: true }, ...targets]}
            value=""
            onChange={(event) => onConnect(event.currentTarget.value.slice(5))}
          />
        ) : (
          <Text size="xs" c="dimmed">Add another step to connect a branch.</Text>
        )}
      </Stack>
    );
  }

  const sequence = step.sequence ?? "list";
  return (
    <NativeSelect
      size="xs"
      label="Next step"
      description="Follow the list order or choose a destination."
      data={[{ value: "list", label: "Follow list order" }, { value: "end", label: "End this path" }, ...targets]}
      value={typeof sequence === "object" ? `step:${sequence.targetStepId}` : sequence}
      onChange={(event) => {
        const value = event.currentTarget.value;
        edit((draft) => void (draft.sequence = value === "list" || value === "end" ? value : { targetStepId: value.slice(5) }));
      }}
    />
  );
}
