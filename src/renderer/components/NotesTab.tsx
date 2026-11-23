import { useState, type FormEvent } from "react";
import { ActionIcon, Badge, Button, Checkbox, Group, Paper, SegmentedControl, Select, Stack, Text, Textarea } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import type { Area, NoteKind } from "../../shared/types";
import { NOTE_KINDS, findArea, labelOf, newNote, shortDate, toneOf } from "../model";
import type { Update } from "../store";
import { EmptyState } from "./ui";

export function NotesTab({ area, update }: { area: Area; update: Update }) {
  const [kind, setKind] = useState<NoteKind>("improvement");
  const [text, setText] = useState("");
  const [processId, setProcessId] = useState<string>("");
  const [show, setShow] = useState<"open" | "resolved">("open");

  const add = (event?: FormEvent) => {
    event?.preventDefault();
    if (!text.trim()) return;
    const note = newNote(kind, text.trim(), processId || undefined);
    update((draft) => void findArea(draft, area.id).notes.unshift(note));
    setText("");
  };

  const editNote = (id: string, recipe: (notes: Area["notes"], index: number) => void) =>
    update((draft) => {
      const notes = findArea(draft, area.id).notes;
      const index = notes.findIndex((n) => n.id === id);
      if (index >= 0) recipe(notes, index);
    });

  const openCount = area.notes.filter((n) => !n.resolved).length;
  const visible = area.notes.filter((note) => (show === "open" ? !note.resolved : note.resolved));
  const processName = (id?: string) => area.processes.find((p) => p.id === id)?.name;

  return (
    <Stack gap="md" p="md">
      <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-gray-0)">
        <form onSubmit={add}>
          <Stack gap="xs">
            <SegmentedControl size="xs" value={kind} onChange={(value) => setKind(value as NoteKind)} data={NOTE_KINDS} />
            <Textarea
              autosize
              minRows={2}
              value={text}
              aria-label="Note"
              placeholder="What could be better, or what do you need to come back to?"
              onChange={(event) => setText(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) add();
              }}
            />
            <Group gap="xs" wrap="nowrap">
              <Select
                style={{ flex: 1 }}
                aria-label="Related process"
                data={[{ value: "", label: "Whole area" }, ...area.processes.map((p) => ({ value: p.id, label: p.name || "Untitled process" }))]}
                value={processId}
                onChange={(value) => setProcessId(value ?? "")}
              />
              <Button type="submit" disabled={!text.trim()}>
                Add note
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <SegmentedControl
        size="xs"
        value={show}
        onChange={(value) => setShow(value as "open" | "resolved")}
        data={[
          { value: "open", label: `Open (${openCount})` },
          { value: "resolved", label: `Resolved (${area.notes.length - openCount})` },
        ]}
        style={{ alignSelf: "flex-start" }}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={show === "open" ? "Nothing open" : "Nothing resolved yet"}
          body={show === "open" ? "Capture improvements, issues and things to come back to as you map this area." : "Resolved notes show up here."}
        />
      ) : (
        visible.map((note) => (
          <Paper key={note.id} withBorder radius="md" p="sm">
            <Group wrap="nowrap" align="flex-start" gap="sm">
              <Checkbox
                mt={2}
                aria-label={note.resolved ? "Reopen note" : "Resolve note"}
                checked={note.resolved}
                onChange={() => editNote(note.id, (notes, i) => void (notes[i].resolved = !notes[i].resolved))}
              />
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Group gap={8}>
                  <Badge size="sm" color={toneOf(NOTE_KINDS, note.kind)}>
                    {labelOf(NOTE_KINDS, note.kind)}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {processName(note.processId) ?? "Whole area"} · {shortDate(note.createdAt)}
                  </Text>
                </Group>
                <Text size="sm" td={note.resolved ? "line-through" : undefined} c={note.resolved ? "dimmed" : undefined} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {note.text}
                </Text>
              </Stack>
              <ActionIcon variant="subtle" color="gray" aria-label="Delete note" onClick={() => editNote(note.id, (notes, i) => void notes.splice(i, 1))}>
                <IconX size={15} />
              </ActionIcon>
            </Group>
          </Paper>
        ))
      )}
    </Stack>
  );
}
