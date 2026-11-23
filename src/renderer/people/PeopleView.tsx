import { useState, type FormEvent } from "react";
import { ActionIcon, Badge, Button, Group, Modal, MultiSelect, Paper, ScrollArea, Stack, Table, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import type { Area, Person, Workspace } from "../../shared/types";
import { EmptyState, confirmDelete } from "../components/ui";
import type { Update } from "../store";
import { RACI_ROLES, newPerson } from "./model";

export function PeopleView({ workspace, update }: { workspace: Workspace; update: Update }) {
  const [editing, setEditing] = useState<Person | "new" | null>(null);
  const people = [...workspace.people].sort((a, b) => a.name.localeCompare(b.name));

  const remove = (person: Person) =>
    confirmDelete(`Delete ${person.name}?`, "This person will be removed from process ownership and RACI assignments.", () =>
      update((draft) => {
        draft.people = draft.people.filter(({ id }) => id !== person.id);
        for (const area of draft.areas) {
          for (const process of area.processes) {
            if (process.ownerId === person.id) process.ownerId = null;
            for (const { value } of RACI_ROLES) process.raci[value] = process.raci[value].filter((id) => id !== person.id);
          }
        }
      }),
    );

  return (
    <ScrollArea type="auto" style={{ flex: 1, minWidth: 0 }}>
      <Stack gap="xl" p="xl" maw={1200} mx="auto">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={1} size="h2">People</Title>
            <Text c="dimmed" size="sm">Manage the people who do the work and the areas they belong to.</Text>
          </Stack>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing("new")}>Add person</Button>
        </Group>
        <Paper withBorder radius="md">
          {people.length === 0 ? (
            <EmptyState title="No people yet" body="Add someone here or create a person when assigning a process owner." />
          ) : (
            <Table.ScrollContainer minWidth={560} type="native">
              <Table verticalSpacing="sm" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th scope="col">Name</Table.Th>
                    <Table.Th scope="col">Role / title</Table.Th>
                    <Table.Th scope="col">Areas</Table.Th>
                    <Table.Th scope="col">Email</Table.Th>
                    <Table.Th scope="col" w={88}><Text size="sm" fw={600}>Actions</Text></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {people.map((person) => (
                    <Table.Tr key={person.id}>
                      <Table.Th scope="row">{person.name}</Table.Th>
                      <Table.Td>{person.role || "—"}</Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {workspace.areas.filter(({ id }) => person.areaIds.includes(id)).map((area) => (
                            <Badge key={area.id} color="gray" variant="light">{area.name || "Untitled area"}</Badge>
                          ))}
                          {person.areaIds.length === 0 && "—"}
                        </Group>
                      </Table.Td>
                      <Table.Td>{person.email || "—"}</Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="Edit person">
                            <ActionIcon variant="subtle" color="gray" aria-label={`Edit ${person.name}`} onClick={() => setEditing(person)}>
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete person">
                            <ActionIcon variant="subtle" color="red" aria-label={`Delete ${person.name}`} onClick={() => remove(person)}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Paper>
      </Stack>
      {editing && (
        <PersonForm
          person={editing === "new" ? undefined : editing}
          areas={workspace.areas}
          onClose={() => setEditing(null)}
          onSave={(person) => {
            update((draft) => {
              const index = draft.people.findIndex(({ id }) => id === person.id);
              if (index === -1) draft.people.push(person);
              else draft.people[index] = person;
            });
            setEditing(null);
          }}
        />
      )}
    </ScrollArea>
  );
}

function PersonForm({ person, areas, onClose, onSave }: { person?: Person; areas: Area[]; onClose: () => void; onSave: (person: Person) => void }) {
  const [name, setName] = useState(person?.name ?? "");
  const [role, setRole] = useState(person?.role ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [areaIds, setAreaIds] = useState(person?.areaIds ?? []);
  const [nameError, setNameError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setNameError("Enter a name");
      event.currentTarget.querySelector("input")?.focus();
      return;
    }
    onSave({ ...(person ?? newPerson(name.trim())), name: name.trim(), role: role.trim(), email: email.trim() || undefined, areaIds });
  };

  return (
    <Modal opened onClose={onClose} title={person ? "Edit person" : "Add person"} radius="lg" size={480}>
      <form onSubmit={submit}>
        <Stack gap="sm">
          <TextInput label="Name" name="name" autoComplete="name" required data-autofocus value={name} error={nameError} onChange={(event) => {
            setName(event.currentTarget.value);
            setNameError("");
          }} />
          <TextInput label="Role / title" name="role" autoComplete="organization-title" value={role} onChange={(event) => setRole(event.currentTarget.value)} />
          <TextInput label="Email" description="Optional" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
          <MultiSelect
            label="Area memberships"
            data={areas.map((area) => ({ value: area.id, label: area.name || "Untitled area" }))}
            value={areaIds}
            onChange={setAreaIds}
            searchable
            nothingFoundMessage={areas.length ? "No matching areas" : "No areas on the map yet"}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save person</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
