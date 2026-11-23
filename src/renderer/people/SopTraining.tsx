import { Accordion, ActionIcon, Button, Group, ScrollArea, Stack, Table, Text, Tooltip } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import type { Person, Sop } from "../../shared/types";
import { confirmDelete } from "../components/ui";
import { findArea } from "../model";
import type { Update } from "../store";
import { TrainingBadge } from "./TrainingBadge";
import { recordTraining, trainingStatus } from "./model";

export function SopTraining({ areaId, sop, people, update }: { areaId: string; sop: Sop; people: Person[]; update: Update }) {
  const current = people.filter(({ id }) => trainingStatus(sop.revision, sop.training[id]) === "current").length;
  const canRecord = sop.status === "approved" && sop.revision > 0;
  const edit = (recipe: (target: Sop) => void) =>
    update((draft) => {
      const target = findArea(draft, areaId).sops.find(({ id }) => id === sop.id);
      if (target) recipe(target);
    });

  return (
    <Accordion variant="separated" radius="md">
      <Accordion.Item value="training">
        <Accordion.Control>
          <Group gap="sm">
            <Text size="sm" fw={600}>Training</Text>
            <Text size="xs" c="dimmed">{current} of {people.length} current</Text>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            {people.length === 0 ? (
              <Text size="sm" c="dimmed">Add someone in People to record their training.</Text>
            ) : (
              <>
                {!canRecord && <Text size="sm" c="dimmed">Approve the SOP before recording training.</Text>}
                <ScrollArea.Autosize type="auto" mah={280}>
                  <Table verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th scope="col">Person</Table.Th>
                        <Table.Th scope="col">Status</Table.Th>
                        <Table.Th scope="col">Last trained</Table.Th>
                        <Table.Th scope="col">Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {[...people].sort((a, b) => a.name.localeCompare(b.name)).map((person) => {
                        const record = sop.training[person.id];
                        const status = trainingStatus(sop.revision, record);
                        return (
                          <Table.Tr key={person.id}>
                            <Table.Th scope="row">
                              <Text size="sm" fw={600}>{person.name}</Text>
                              {person.role && <Text size="xs" c="dimmed">{person.role}</Text>}
                            </Table.Th>
                            <Table.Td><TrainingBadge status={status} /></Table.Td>
                            <Table.Td>
                              {record ? (
                                <Text size="xs">
                                  Rev {record.revision} · {new Date(record.trainedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                                </Text>
                              ) : "—"}
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4} wrap="nowrap">
                                {canRecord && status !== "current" && (
                                  <Button
                                    size="compact-xs"
                                    variant="light"
                                    aria-label={`Record training for ${person.name}`}
                                    onClick={() => {
                                      const trainedAt = new Date().toISOString();
                                      edit((target) => recordTraining(target, person.id, trainedAt));
                                    }}
                                  >
                                    Record training
                                  </Button>
                                )}
                                {record && (
                                  <Tooltip label="Remove training record">
                                    <ActionIcon
                                      variant="subtle"
                                      color="gray"
                                      size="sm"
                                      aria-label={`Remove training record for ${person.name}`}
                                      onClick={() => confirmDelete(
                                        `Remove training for ${person.name}?`,
                                        "This SOP will show their training as missing.",
                                        () => edit((target) => void delete target.training[person.id]),
                                      )}
                                    >
                                      <IconX size={15} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea.Autosize>
              </>
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
