import { BarChart, DonutChart } from "@mantine/charts";
import { ColorSwatch, Container, Group, Paper, ScrollArea, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconChartBar } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { Workspace } from "../../shared/types";
import { EmptyState } from "../components/ui";
import { PROCESS_STATUSES, plural } from "../model";
import { Opportunities, SopReviews } from "./Actions";
import { getInsights } from "./metrics";
import "@mantine/charts/styles.css";

const processSeries = PROCESS_STATUSES.map(({ value, label, tone }) => ({ name: value, label, color: `${tone}.6` }));
const areaBarProps = {
  dataKey: "area",
  orientation: "vertical",
  gridAxis: "x",
  tickLine: "none",
  maxBarWidth: 20,
  xAxisProps: { allowDecimals: false },
  yAxisProps: { width: 148, interval: 0, tickFormatter: (name: string) => name.length > 21 ? `${name.slice(0, 20)}…` : name },
} as const;

const percent = new Intl.NumberFormat(undefined, { style: "percent" });

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Paper component="section" aria-label={title} withBorder radius="lg" p="lg" miw={0}>
      <Stack gap="lg">
        <div>
          <Title order={2} size="h4">{title}</Title>
          <Text c="dimmed" size="sm">{description}</Text>
        </div>
        {children}
      </Stack>
    </Paper>
  );
}

export default function Insights({ workspace, onOpenSop, onOpenNotes }: {
  workspace: Workspace;
  onOpenSop: (areaId: string, sopId: string) => void;
  onOpenNotes: (areaId: string) => void;
}) {
  const data = getInsights(workspace);
  const withProcesses = data.areaRows.filter((area) => area.total > 0);
  const coverage = data.processes ? percent.format(data.covered / data.processes) : "—";
  const totals = [
    { label: "Processes", value: data.processes, detail: `Across ${plural(workspace.areas.length, "area")}` },
    { label: "Approved SOP coverage", value: coverage, detail: `${data.covered} of ${plural(data.processes, "process", "processes")}` },
    { label: "Open notes", value: data.openNotes, detail: "Unresolved notes of any kind" },
    { label: "Mapped handoffs", value: data.handoffs, detail: `${data.connected} of ${plural(workspace.areas.length, "area")} connected` },
  ];

  return (
    <ScrollArea style={{ flex: 1, minWidth: 0 }} type="auto" viewportProps={{ tabIndex: 0, "aria-label": "Insights dashboard" }}>
      <Container size={1260} px={{ base: "sm", sm: "xl" }} py="xl">
        <Stack gap="lg">
          <div>
            <Group gap="xs">
              <IconChartBar size={23} aria-hidden />
              <Title order={1} size="h2">Insights</Title>
            </Group>
            <Text c="dimmed" mt={4}>See what’s documented, where work hands off, and what needs attention.</Text>
          </div>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            {totals.map(({ label, value, detail }) => (
              <Paper key={label} withBorder radius="lg" p="md">
                <Text size="sm" fw={600}>{label}</Text>
                <Text size="1.75rem" fw={700} lh={1.35} style={{ fontVariantNumeric: "tabular-nums" }}>{value}</Text>
                <Text size="xs" c="dimmed">{detail}</Text>
              </Paper>
            ))}
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <ChartCard title="Process status by area" description="Process counts at each stage of mapping and documentation.">
              {withProcesses.length ? (
                <BarChart
                  {...areaBarProps}
                  h={Math.max(180, 56 + data.areaRows.length * 28)}
                  data={data.areaRows}
                  series={processSeries}
                  type="stacked"
                  withLegend
                  barChartProps={{ title: "Process counts by area and status" }}
                />
              ) : (
                <EmptyState title="No processes yet" body="Add a process in a map area to see its status here." />
              )}
            </ChartCard>

            <ChartCard title="Documentation coverage" description="Share of processes linked to at least one approved SOP.">
              {withProcesses.length ? (
                <BarChart
                  {...areaBarProps}
                  h={Math.max(180, 56 + withProcesses.length * 28)}
                  data={withProcesses}
                  series={[{ name: "coverage", label: "Coverage", color: "blue.6" }]}
                  xAxisProps={{ domain: [0, 100], ticks: [0, 25, 50, 75, 100] }}
                  valueFormatter={(value) => percent.format(value / 100)}
                  barChartProps={{ title: "Approved SOP coverage by area" }}
                />
              ) : (
                <EmptyState title="No coverage to measure" body="Link approved SOPs to your processes to track coverage here." />
              )}
            </ChartCard>

            <ChartCard title="Open notes by kind" description="What’s waiting for follow-up across all areas.">
              {data.openNotes ? (
                <Group justify="center" gap="xl">
                  <DonutChart data={data.noteKinds} size={155} chartLabel={data.openNotes} withTooltip={false} accessibilityLayer={false} aria-hidden />
                  <Stack gap={8}>
                    {data.noteKinds.map(({ name, value, color }) => (
                      <Group key={name} wrap="nowrap" justify="space-between" gap="md">
                        <Group gap={6} wrap="nowrap">
                          <ColorSwatch size={10} color={`var(--mantine-color-${color.replace(".", "-")})`} aria-hidden />
                          <Text size="sm">{name}</Text>
                        </Group>
                        <Text size="sm" fw={600}>{value}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Group>
              ) : (
                <EmptyState title="No open notes" body="New and unresolved notes appear here." />
              )}
            </ChartCard>

            <ChartCard title="Open notes by age" description="How long unresolved notes have been open.">
              {data.openNotes ? (
                <BarChart
                  {...areaBarProps}
                  h={166}
                  dataKey="label"
                  data={data.noteAges}
                  series={[{ name: "count", label: "Open notes", color: "violet.6" }]}
                  yAxisProps={{ width: 110, interval: 0 }}
                  barChartProps={{ title: "Open note counts by age" }}
                />
              ) : (
                <EmptyState title="No age data yet" body="New notes are grouped here by the time since they were added." />
              )}
            </ChartCard>

            <ChartCard title="Map handoffs" description="Incoming and outgoing flows for each area.">
              {data.handoffs ? (
                <BarChart
                  {...areaBarProps}
                  h={Math.max(180, 56 + data.areaRows.length * 34)}
                  data={data.areaRows}
                  series={[
                    { name: "incoming", label: "Incoming", color: "teal.6" },
                    { name: "outgoing", label: "Outgoing", color: "blue.6" },
                  ]}
                  withLegend
                  barChartProps={{ title: "Incoming and outgoing handoffs by area" }}
                />
              ) : (
                <EmptyState title="No mapped handoffs" body="Add a flow between two map areas to see how work moves." />
              )}
            </ChartCard>

            <SopReviews reviews={data.reviews} onOpenSop={onOpenSop} />
          </SimpleGrid>

          <Opportunities areas={workspace.areas} opportunities={data.opportunities} onOpenNotes={onOpenNotes} />
        </Stack>
      </Container>
    </ScrollArea>
  );
}
