import { ActionIcon, Badge, Checkbox, Group, Paper, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import type { Workspace } from "../../shared/types";
import { NOTE_KINDS, hueColor, shortDate } from "../model";
import type { Update } from "../store";
import { EmptyState } from "./ui";

export function FollowUps({ workspace, update, onJump, onClose }: { workspace: Workspace; update: Update; onJump: (areaId: string) => void; onClose: () => void }) {
  const open = workspace.areas.flatMap((area) => area.notes.filter((note) => !note.resolved).map((note) => ({ area, note })));

  const resolve = (areaId: string, noteId: string) =>
    update((draft) => {
      const note = draft.areas.find((a) => a.id === areaId)?.notes.find((n) => n.id === noteId);
      if (note) note.resolved = true;
    });

  return (
    <Paper className="followups" shadow="lg" withBorder radius="lg">
      <Group justify="space-between" px="md" py="sm" className="followups-header">
        <Text fw={700}>Follow-ups</Text>
        <ActionIcon variant="subtle" color="gray" aria-label="Close follow-ups" onClick={onClose}>
          <IconX size={16} />
        </ActionIcon>
      </Group>
      <ScrollArea style={{ flex: 1 }} type="auto">
        <Stack gap="md" p="sm">
          {open.length === 0 && <EmptyState title="All clear" body="Open notes from every area collect here so nothing slips." />}
          {NOTE_KINDS.map((kind) => {
            const items = open.filter(({ note }) => note.kind === kind.value);
            if (items.length === 0) return null;
            return (
              <Stack key={kind.value} gap={2}>
                <Group gap={6} px={6} pb={4}>
                  <Badge size="sm" color={kind.tone}>
                    {kind.label}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {items.length}
                  </Text>
                </Group>
                {items.map(({ area, note }) => (
                  <Group key={note.id} gap="sm" wrap="nowrap" align="flex-start" className="followup">
                    <Checkbox size="xs" mt={3} aria-label="Resolve note" onChange={() => resolve(area.id, note.id)} />
                    <UnstyledButton onClick={() => onJump(area.id)} style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                        {note.text}
                      </Text>
                      <Group gap={5} wrap="nowrap">
                        <span className="area-dot" style={{ background: hueColor(area.hue) }} />
                        <Text size="xs" c="dimmed" truncate>
                          {area.name || "Untitled area"}
                          {note.processId && ` · ${area.processes.find((p) => p.id === note.processId)?.name ?? ""}`} · {shortDate(note.createdAt)}
                        </Text>
                      </Group>
                    </UnstyledButton>
                  </Group>
                ))}
              </Stack>
            );
          })}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}
