import { useState, type FormEvent } from "react";
import { Accordion, ActionIcon, Badge, Button, Chip, Group, MultiSelect, Paper, Select, SimpleGrid, Stack, Text, TextInput, Textarea, Tooltip } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconX } from "@tabler/icons-react";
import type { Area, NoteKind, Person, Process, ProcessStatus } from "../../shared/types";
import { NOTE_KINDS, PROCESS_STATUSES, findArea, labelOf, newNote, newProcess, newStep, plural, toneOf } from "../model";
import { OwnerPicker } from "../people/OwnerPicker";
import { RACI_ROLES, newPerson } from "../people/model";
import type { Update } from "../store";
import { StepFields } from "./process/StepFields";
import { EmptyState, confirmDelete } from "./ui";

export function ProcessesTab({ area, people, update, initialOpenId }: { area: Area; people: Person[]; update: Update; initialOpenId: string | null }) {
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpenId);

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const process = newProcess(name.trim());
    update((draft) => void findArea(draft, area.id).processes.push(process));
    setName("");
    setOpenId(process.id);
  };

  return (
    <Stack gap="md" p="md">
      <form onSubmit={add}>
        <Group gap={6} wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            placeholder="Add a process, e.g. Receive inbound freight"
            aria-label="New process name"
          />
          <Button type="submit" variant="default" disabled={!name.trim()}>
            Add
          </Button>
        </Group>
      </form>
      {area.processes.length === 0 ? (
        <EmptyState title="No processes yet" body="Break this area into the work that happens here. Each process adds equipment to this area on the map." />
      ) : (
        <Accordion variant="separated" radius="md" value={openId} onChange={setOpenId} chevronPosition="left">
          {area.processes.map((process, index) => (
            <ProcessItem key={process.id} area={area} people={people} process={process} index={index} update={update} />
          ))}
        </Accordion>
      )}
    </Stack>
  );
}

function ProcessItem({ area, people, process, index, update }: { area: Area; people: Person[]; process: Process; index: number; update: Update }) {
  const [stepText, setStepText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteKind, setNoteKind] = useState<NoteKind>("improvement");

  const edit = (recipe: (draft: Process) => void) =>
    update((draft) => {
      const target = findArea(draft, area.id).processes.find((p) => p.id === process.id);
      if (target) recipe(target);
    });

  const notes = area.notes.filter((note) => note.processId === process.id && !note.resolved);
  const duration = process.steps.reduce((sum, step) => sum + (step.durationMinutes ?? 0), 0);
  const handoffs = process.steps.filter((step) => step.type === "handoff").length;
  const owner = people.find((person) => person.id === process.ownerId);
  const peopleOptions = people.map((person) => ({ value: person.id, label: person.name }));

  const createOwner = (name: string) => {
    const person = newPerson(name, [area.id]);
    update((draft) => {
      const target = findArea(draft, area.id).processes.find((p) => p.id === process.id);
      if (!target) return;
      draft.people.push(person);
      target.ownerId = person.id;
    });
  };

  const move = (offset: number) =>
    update((draft) => {
      const list = findArea(draft, area.id).processes;
      const [item] = list.splice(index, 1);
      list.splice(index + offset, 0, item);
    });

  const remove = () =>
    confirmDelete(`Delete ${process.name || "this process"}?`, "Its steps go with it. Notes tied to it stay on the area.", () =>
      update((draft) => {
        const owner = findArea(draft, area.id);
        owner.processes = owner.processes.filter((p) => p.id !== process.id);
        for (const note of owner.notes) if (note.processId === process.id) delete note.processId;
      }),
    );

  const addStep = (event: FormEvent) => {
    event.preventDefault();
    if (!stepText.trim()) return;
    const step = newStep(stepText.trim());
    edit((p) => void p.steps.push(step));
    setStepText("");
  };

  const moveStep = (from: number, to: number) =>
    edit((p) => {
      const [item] = p.steps.splice(from, 1);
      p.steps.splice(to, 0, item);
    });

  const addNote = (event: FormEvent) => {
    event.preventDefault();
    if (!noteText.trim()) return;
    const note = newNote(noteKind, noteText.trim(), process.id);
    update((draft) => void findArea(draft, area.id).notes.unshift(note));
    setNoteText("");
  };

  return (
    <Accordion.Item value={process.id}>
      <Accordion.Control>
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text fw={600} truncate>
              {process.name || "Untitled process"}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {plural(process.steps.length, "step")} · {plural(process.sopIds.length, "SOP")}
              {notes.length > 0 && ` · ${plural(notes.length, "open note")}`}
              {owner && ` · ${owner.name}`}
            </Text>
            <Text size="xs" c="dimmed">
              {duration} min estimated · {plural(handoffs, "handoff")}
            </Text>
          </Stack>
          <Badge color={toneOf(PROCESS_STATUSES, process.status)} style={{ flex: "none" }}>
            {labelOf(PROCESS_STATUSES, process.status)}
          </Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="md">
          <TextInput label="Name" value={process.name} onChange={(event) => edit((p) => void (p.name = event.currentTarget.value))} />
          <Group grow>
            <Select
              label="Status"
              data={PROCESS_STATUSES}
              value={process.status}
              onChange={(value) => value && edit((p) => void (p.status = value as ProcessStatus))}
            />
            <OwnerPicker options={peopleOptions} value={process.ownerId} onChange={(id) => edit((p) => void (p.ownerId = id))} onCreate={createOwner} />
          </Group>
          <Textarea
            label="Description"
            placeholder="Trigger, inputs and outputs"
            autosize
            minRows={2}
            value={process.description}
            onChange={(event) => edit((p) => void (p.description = event.currentTarget.value))}
          />

          <Stack gap={6}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              RACI
            </Text>
            <SimpleGrid cols={2} spacing="xs">
              {RACI_ROLES.map(({ value, label }) => (
                <MultiSelect
                  key={value}
                  label={label}
                  size="xs"
                  searchable
                  data={peopleOptions}
                  value={process.raci[value]}
                  onChange={(ids) => edit((p) => void (p.raci[value] = ids))}
                  placeholder={process.raci[value].length === 0 ? "Select people" : undefined}
                  nothingFoundMessage={people.length ? "No matching people" : "Add someone in People first"}
                />
              ))}
            </SimpleGrid>
          </Stack>

          <Stack gap={6}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              Steps
            </Text>
            {process.steps.map((step, stepIndex) => (
              <Paper key={step.id} withBorder p="xs">
                <Stack gap={6}>
                  <Group gap={4} wrap="nowrap">
                    <span className="step-number">{stepIndex + 1}</span>
                    <TextInput
                      style={{ flex: 1 }}
                      size="xs"
                      aria-label={`Step ${stepIndex + 1}`}
                      value={step.text}
                      onChange={(event) => {
                        const text = event.currentTarget.value;
                        edit((p) => void (p.steps[stepIndex].text = text));
                      }}
                    />
                    <ActionIcon variant="subtle" color="gray" aria-label="Move step up" disabled={stepIndex === 0} onClick={() => moveStep(stepIndex, stepIndex - 1)}>
                      <IconArrowUp size={15} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="Move step down"
                      disabled={stepIndex === process.steps.length - 1}
                      onClick={() => moveStep(stepIndex, stepIndex + 1)}
                    >
                      <IconArrowDown size={15} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="gray" aria-label="Remove step" onClick={() => edit((p) => void p.steps.splice(stepIndex, 1))}>
                      <IconX size={15} />
                    </ActionIcon>
                  </Group>
                  <StepFields step={step} onChange={(changes) => edit((p) => void Object.assign(p.steps[stepIndex], changes))} />
                </Stack>
              </Paper>
            ))}
            <form onSubmit={addStep}>
              <TextInput size="xs" value={stepText} onChange={(event) => setStepText(event.currentTarget.value)} placeholder="Add a step and press Return" aria-label="New step" />
            </form>
          </Stack>

          <Stack gap={6}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              SOPs
            </Text>
            {area.sops.length === 0 ? (
              <Text size="xs" c="dimmed">
                Write or attach SOPs in the SOPs tab, then link them here.
              </Text>
            ) : (
              <Chip.Group multiple value={process.sopIds} onChange={(ids) => edit((p) => void (p.sopIds = ids))}>
                <Group gap={6}>
                  {area.sops.map((sop) => (
                    <Chip key={sop.id} value={sop.id} size="xs">
                      {sop.title || "Untitled SOP"}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
            )}
          </Stack>

          <Stack gap={6}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              Open notes
            </Text>
            {notes.map((note) => (
              <Group key={note.id} gap={8} wrap="nowrap" align="flex-start">
                <Badge size="sm" color={toneOf(NOTE_KINDS, note.kind)} style={{ flex: "none" }}>
                  {labelOf(NOTE_KINDS, note.kind)}
                </Badge>
                <Text size="sm">{note.text}</Text>
              </Group>
            ))}
            <form onSubmit={addNote}>
              <Group gap={6} wrap="nowrap">
                <Select size="xs" w={140} aria-label="Note type" data={NOTE_KINDS} value={noteKind} onChange={(value) => value && setNoteKind(value as NoteKind)} />
                <TextInput
                  size="xs"
                  style={{ flex: 1 }}
                  value={noteText}
                  onChange={(event) => setNoteText(event.currentTarget.value)}
                  placeholder="Note something to improve or revisit"
                  aria-label="New note"
                />
              </Group>
            </form>
          </Stack>

          <Group gap={4} pt={4} className="item-footer">
            <Button variant="subtle" color="gray" size="xs" disabled={index === 0} onClick={() => move(-1)}>
              Move up
            </Button>
            <Button variant="subtle" color="gray" size="xs" disabled={index === area.processes.length - 1} onClick={() => move(1)}>
              Move down
            </Button>
            <Tooltip label="Delete process">
              <Button variant="subtle" color="red" size="xs" ml="auto" onClick={remove}>
                Delete
              </Button>
            </Tooltip>
          </Group>
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
