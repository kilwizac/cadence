import { useState, type FormEvent } from "react";
import { ActionIcon, Button, Group, Paper, Select, Stack, Text, TextInput } from "@mantine/core";
import { IconArrowRight, IconX } from "@tabler/icons-react";
import type { Area, Workspace } from "../../shared/types";
import { newFlow } from "../model";
import type { Update } from "../store";
import { EmptyState } from "./ui";

export function ConnectionsTab({ area, workspace, update }: { area: Area; workspace: Workspace; update: Update }) {
  const [target, setTarget] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const others = workspace.areas.filter((a) => a.id !== area.id);
  const linked = new Set(workspace.flows.filter((flow) => flow.from === area.id).map((flow) => flow.to));
  const targets = others.filter((other) => !linked.has(other.id));
  const nameOf = (id: string) => workspace.areas.find((a) => a.id === id)?.name || "Untitled area";
  const outgoing = workspace.flows.filter((flow) => flow.from === area.id);
  const incoming = workspace.flows.filter((flow) => flow.to === area.id);

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!target) return;
    const flow = newFlow(area.id, target, label.trim());
    update((draft) => void draft.flows.push(flow));
    setLabel("");
    setTarget(null);
  };

  const editFlow = (id: string, recipe: (flows: Workspace["flows"], index: number) => void) =>
    update((draft) => {
      const index = draft.flows.findIndex((f) => f.id === id);
      if (index >= 0) recipe(draft.flows, index);
    });

  if (others.length === 0) {
    return <EmptyState title="Nothing to connect yet" body="Add another area to the map, then show what this one hands off to it: parts, paperwork, information." />;
  }

  return (
    <Stack gap="md" p="md">
      <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-gray-0)">
        <form onSubmit={add}>
          <Stack gap="xs">
            <Select
              label="Feeds into"
              placeholder={targets.length ? "Choose an area" : "Already feeds every area"}
              disabled={targets.length === 0}
              data={targets.map((other) => ({ value: other.id, label: other.name || "Untitled area" }))}
              value={target}
              onChange={setTarget}
            />
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <TextInput style={{ flex: 1 }} label="What moves" value={label} onChange={(event) => setLabel(event.currentTarget.value)} placeholder="e.g. Received material" />
              <Button type="submit" disabled={!target}>
                Connect
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Stack gap={6}>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Feeds into
        </Text>
        {outgoing.length === 0 && (
          <Text size="sm" c="dimmed">
            No outgoing flows.
          </Text>
        )}
        {outgoing.map((flow) => (
          <Group key={flow.id} gap="xs" wrap="nowrap">
            <IconArrowRight size={16} color="var(--mantine-color-dimmed)" />
            <Text fw={600} w={140} truncate>
              {nameOf(flow.to)}
            </Text>
            <TextInput
              size="xs"
              style={{ flex: 1 }}
              aria-label="Flow label"
              placeholder="Label"
              value={flow.label}
              onChange={(event) => {
                const value = event.currentTarget.value;
                editFlow(flow.id, (flows, i) => void (flows[i].label = value));
              }}
            />
            <ActionIcon variant="subtle" color="gray" aria-label="Remove flow" onClick={() => editFlow(flow.id, (flows, i) => void flows.splice(i, 1))}>
              <IconX size={15} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>

      <Stack gap={6}>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Receives from
        </Text>
        {incoming.length === 0 && (
          <Text size="sm" c="dimmed">
            No incoming flows.
          </Text>
        )}
        {incoming.map((flow) => (
          <Group key={flow.id} gap="xs">
            <Text fw={600}>{nameOf(flow.from)}</Text>
            <Text size="sm" c="dimmed">
              {flow.label}
            </Text>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}
