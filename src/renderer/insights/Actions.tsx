import { useState } from "react";
import { Anchor, Badge, Group, Paper, Select, Stack, Table, Text, Title } from "@mantine/core";
import type { Area } from "../../shared/types";
import { NOTE_KINDS, labelOf, plural, toneOf } from "../model";
import { EmptyState } from "../components/ui";
import { REVIEW_WINDOW_DAYS, type InsightsData } from "./metrics";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const OPPORTUNITY_KINDS = NOTE_KINDS.filter(({ value }) => value === "issue" || value === "improvement");

export function SopReviews({ reviews, onOpenSop }: { reviews: InsightsData["reviews"]; onOpenSop: (areaId: string, sopId: string) => void }) {
  return (
    <Paper component="section" aria-label="SOP reviews" withBorder radius="lg" p="lg">
      <Stack gap="md">
        <div>
          <Title order={2} size="h4">SOP reviews</Title>
          <Text size="sm" c="dimmed">Approved SOPs overdue or due within {REVIEW_WINDOW_DAYS} days.</Text>
        </div>
        {[
          { title: "Overdue", rows: reviews.filter((review) => review.overdue), color: "red" },
          { title: "Due soon", rows: reviews.filter((review) => !review.overdue), color: "orange" },
        ].map(({ title, rows, color }) => (
          <Stack key={title} gap={4}>
            <Group gap="xs">
              <Title order={3} size="h6">{title}</Title>
              <Badge color={color} size="sm">{rows.length}</Badge>
            </Group>
            {rows.length ? (
              <Table aria-label={`${title} SOPs`} verticalSpacing="xs">
                <Table.Tbody>
                  {rows.map(({ area, sop, due }) => (
                    <Table.Tr key={sop.id}>
                      <Table.Td px={0}>
                        <Anchor component="button" type="button" size="sm" ta="left" onClick={() => onOpenSop(area.id, sop.id)} style={{ overflowWrap: "anywhere" }}>
                          {sop.title || "Untitled SOP"}
                        </Anchor>
                        <Text c="dimmed" size="xs" style={{ overflowWrap: "anywhere" }}>{area.name || "Untitled area"}</Text>
                      </Table.Td>
                      <Table.Td ta="right" px={0}>
                        <Text size="xs" style={{ whiteSpace: "nowrap" }}>{dateFormat.format(due)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" size="sm">No SOPs {title.toLowerCase()}.</Text>
            )}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

export function Opportunities({ areas, opportunities, onOpenNotes }: { areas: Area[]; opportunities: InsightsData["opportunities"]; onOpenNotes: (areaId: string) => void }) {
  const [areaId, setAreaId] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const rows = opportunities.filter(({ area, note }) => (!areaId || area.id === areaId) && (!kind || note.kind === kind));

  return (
    <Paper component="section" aria-label="Opportunities" withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={2} size="h4">Opportunities</Title>
            <Text c="dimmed" size="sm">Open issues first, then improvements. Oldest notes come first within each kind.</Text>
          </div>
          <Group gap="sm">
            <Select
              label="Area"
              placeholder="All areas"
              clearable
              clearButtonProps={{ "aria-label": "Clear area filter" }}
              searchable
              nothingFoundMessage="No matching areas"
              w={176}
              value={areaId}
              onChange={setAreaId}
              data={areas.map((area) => ({ value: area.id, label: area.name || "Untitled area" }))}
            />
            <Select
              label="Kind"
              placeholder="All kinds"
              clearable
              clearButtonProps={{ "aria-label": "Clear kind filter" }}
              w={136}
              value={kind}
              onChange={setKind}
              data={OPPORTUNITY_KINDS}
            />
          </Group>
        </Group>
        {rows.length ? (
          <Table.ScrollContainer minWidth={420}>
            <Table aria-label="Ranked opportunities" verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th scope="col">Rank</Table.Th>
                  <Table.Th scope="col">Note</Table.Th>
                  <Table.Th scope="col">Kind</Table.Th>
                  <Table.Th scope="col" ta="right">Age</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map(({ area, note, age }, index) => {
                  const process = area.processes.find((item) => item.id === note.processId);
                  return (
                    <Table.Tr key={note.id}>
                      <Table.Td>{index + 1}</Table.Td>
                      <Table.Td>
                        <Anchor component="button" type="button" size="sm" ta="left" onClick={() => onOpenNotes(area.id)} style={{ overflowWrap: "anywhere" }}>
                          {note.text || "Untitled note"}
                        </Anchor>
                        <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>
                          {area.name || "Untitled area"}{process && ` · ${process.name || "Untitled process"}`}
                        </Text>
                      </Table.Td>
                      <Table.Td><Badge color={toneOf(NOTE_KINDS, note.kind)}>{labelOf(NOTE_KINDS, note.kind)}</Badge></Table.Td>
                      <Table.Td ta="right" style={{ whiteSpace: "nowrap" }}>{age === null ? "Unknown" : age === 0 ? "Under 1 day" : plural(age, "day")}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <EmptyState title="No matching notes" body={areaId || kind ? "Clear a filter to see more notes." : "Open issues and improvements added to the map appear here."} />
        )}
      </Stack>
    </Paper>
  );
}
