import { Paper, Stack, Table, Text, Title } from "@mantine/core";
import type { Area, Person } from "../../shared/types";
import { EmptyState } from "../components/ui";
import { TrainingBadge } from "./TrainingBadge";
import { trainingStatus } from "./model";

const rowHeader = { position: "sticky", left: 0, background: "var(--mantine-color-body)", zIndex: 1 } as const;

export function TrainingMatrix({ people, areas }: { people: Person[]; areas: Area[] }) {
  const sops = areas.flatMap((area) => area.sops.map((sop) => ({ area, sop })));

  return (
    <Stack gap="sm">
      <Stack gap={4}>
        <Title order={2} size="h3">SOP training matrix</Title>
        <Text c="dimmed" size="sm">Training is current when it matches the latest approved revision. Record training in the SOP editor.</Text>
      </Stack>
      <Paper withBorder radius="md">
        {people.length === 0 || sops.length === 0 ? (
          <EmptyState
            title="No training matrix yet"
            body={people.length === 0 ? "Add people to the directory to see their training here." : "Write or attach an SOP in any area to start tracking training."}
          />
        ) : (
          <Table.ScrollContainer minWidth={240} type="native" role="region" aria-label="SOP training matrix" tabIndex={0}>
            <Table aria-label="Training by person and SOP" verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th scope="col" miw={160} style={rowHeader}>Person</Table.Th>
                  {sops.map(({ area, sop }) => (
                    <Table.Th key={sop.id} scope="col" miw={150}>
                      <Text size="sm" fw={600}>{sop.title || "Untitled SOP"}</Text>
                      <Text size="xs" c="dimmed">{area.name || "Untitled area"} · {sop.revision > 0 ? `Rev ${sop.revision}` : "Not approved"}</Text>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {people.map((person) => (
                  <Table.Tr key={person.id}>
                    <Table.Th scope="row" style={rowHeader}>
                      <Text size="sm" fw={600}>{person.name}</Text>
                      {person.role && <Text size="xs" c="dimmed">{person.role}</Text>}
                    </Table.Th>
                    {sops.map(({ sop }) => (
                      <Table.Td key={sop.id}><TrainingBadge status={trainingStatus(sop.revision, sop.training[person.id])} /></Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>
    </Stack>
  );
}
