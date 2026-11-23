import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Center, Group, Kbd, Loader, Modal, Paper, SegmentedControl, Stack, Text, TextInput, Title, UnstyledButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Spotlight, spotlight, type SpotlightActionGroupData } from "@mantine/spotlight";
import { IconFileText, IconFlag, IconListCheck, IconMapPin, IconNote, IconPlus, IconSearch } from "@tabler/icons-react";
import type { Workspace } from "../shared/types";
import { AreaForm } from "./components/AreaForm";
import { AreaPanel, type PanelTab } from "./components/AreaPanel";
import { FollowUps } from "./components/FollowUps";
import { SopEditor } from "./components/SopEditor";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { MapScene, type Placement } from "./map/MapScene";
import { FOOTPRINT, GRID_SIZE, findArea, newArea, plural } from "./model";
import { PeopleView } from "./people/PeopleView";
import { useWorkspace, type SaveState, type Update } from "./store";
import { hasDesktopFiles, storage } from "./storage";

export function App() {
  const { workspace, loadError, saveState, update } = useWorkspace();
  if (loadError) {
    return (
      <Stack className="fatal" gap="sm" align="flex-start">
        <Title order={3}>Couldn't open your workspace</Title>
        <Text>{loadError}</Text>
        <Text c="dimmed" size="sm">
          Nothing was overwritten. Fix or move workspace.json in the app's data folder, then reopen.
        </Text>
        {hasDesktopFiles && (
          <Button variant="default" onClick={() => storage.revealDataFolder()}>
            Show data folder
          </Button>
        )}
      </Stack>
    );
  }
  if (!workspace) return null;
  return <Shell workspace={workspace} saveState={saveState} update={update} />;
}

const SAVE_LABEL: Record<SaveState, string> = { saved: "Saved", saving: "Saving…", error: "Couldn't save" };
const Insights = lazy(() => import("./insights/Insights"));
type View = "map" | "people" | "insights";

function Shell({ workspace, saveState, update }: { workspace: Workspace; saveState: SaveState; update: Update }) {
  const [view, setView] = useState<View>("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("processes");
  const [focusProcessId, setFocusProcessId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [adding, setAdding] = useState(false);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [openSopId, setOpenSopId] = useState<string | null>(null);

  const selected = workspace.areas.find((area) => area.id === selectedId) ?? null;
  const openSop = selected?.sops.find((sop) => sop.id === openSopId) ?? null;
  const totals = workspace.areas.reduce(
    (sum, area) => ({
      processes: sum.processes + area.processes.length,
      sops: sum.sops + area.sops.length,
      open: sum.open + area.notes.filter((note) => !note.resolved).length,
    }),
    { processes: 0, sops: 0, open: 0 },
  );

  useEffect(() => {
    if (saveState === "error") notifications.show({ id: "save-error", color: "red", title: "Couldn't save", message: "Your latest changes aren't on disk yet. Keep the app open and try again." });
  }, [saveState]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || view !== "map" || adding || openSop) return;
      if (placement) setPlacement(null);
      else setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, adding, openSop, placement]);

  const select = useCallback((id: string | null, nextTab: PanelTab = "processes", processId: string | null = null) => {
    if (id) setView("map");
    if (id !== selectedId) setOpenSopId(null);
    setSelectedId(id);
    setFocusProcessId(processId);
    if (id && (id !== selectedId || nextTab !== "processes" || processId)) setTab(nextTab);
  }, [selectedId]);

  const openAreaSop = useCallback((areaId: string, sopId: string) => {
    select(areaId, "sops");
    setOpenSopId(sopId);
  }, [select]);

  const createArea = (name: string, hue: number, kind: Placement["kind"], x: number, y: number) => {
    const area = newArea(name, hue, kind, x, y);
    update((draft) => void draft.areas.push(area));
    select(area.id);
  };

  const searchActions = useMemo<SpotlightActionGroupData[]>(() => {
    const areas = workspace.areas.map((area) => ({
      id: `area-${area.id}`,
      label: area.name || "Untitled area",
      description: plural(area.processes.length, "process", "processes"),
      leftSection: <IconMapPin size={18} />,
      onClick: () => select(area.id),
    }));
    const processes = workspace.areas.flatMap((area) =>
      area.processes.map((process) => ({
        id: `process-${process.id}`,
        label: process.name || "Untitled process",
        description: [area.name, ...process.steps.map((step) => step.text)].join(" · "),
        leftSection: <IconListCheck size={18} />,
        onClick: () => select(area.id, "processes", process.id),
      })),
    );
    const sops = workspace.areas.flatMap((area) =>
      area.sops.map((sop) => ({
        id: `sop-${sop.id}`,
        label: sop.title || "Untitled SOP",
        description: `${area.name} · ${sop.kind === "file" ? sop.attachment?.originalName : "Written SOP"}`,
        leftSection: <IconFileText size={18} />,
        onClick: () => openAreaSop(area.id, sop.id),
      })),
    );
    const notes = workspace.areas.flatMap((area) =>
      area.notes
        .filter((note) => !note.resolved)
        .map((note) => ({
          id: `note-${note.id}`,
          label: note.text,
          description: area.name,
          leftSection: <IconNote size={18} />,
          onClick: () => select(area.id, "notes"),
        })),
    );
    return [
      { group: "Areas", actions: areas },
      { group: "Processes", actions: processes },
      { group: "SOPs", actions: sops },
      { group: "Open notes", actions: notes },
    ].filter((group) => group.actions.length > 0);
  }, [workspace, select, openAreaSop]);

  return (
    <div className="app">
      <header className="topbar">
        <TextInput
          variant="unstyled"
          className="workspace-name"
          aria-label="Workspace name"
          value={workspace.name}
          onChange={(event) => {
            const name = event.currentTarget.value;
            update((draft) => void (draft.name = name));
          }}
        />
        <Text size="xs" c="dimmed" className="topbar-stats">
          {plural(workspace.areas.length, "area")} · {plural(totals.processes, "process", "processes")} · {plural(totals.sops, "SOP")}
        </Text>
        <SegmentedControl
          aria-label="Workspace view"
          size="xs"
          className="view-switcher"
          data={[{ value: "map", label: "Map" }, { value: "people", label: "People" }, { value: "insights", label: "Insights" }]}
          value={view}
          onChange={(value) => setView(value as View)}
        />
        <UnstyledButton className="search-trigger" onClick={() => spotlight.open()}>
          <IconSearch size={15} />
          <span>Search</span>
          <Kbd size="xs">⌘K</Kbd>
        </UnstyledButton>
        <span className="spacer" />
        <Text size="xs" c={saveState === "error" ? "red" : "dimmed"} fw={saveState === "error" ? 600 : 400} className="save-state">
          {SAVE_LABEL[saveState]}
        </Text>
        <Button
          variant={view === "map" && showFollowUps ? "light" : "default"}
          leftSection={<IconFlag size={16} />}
          rightSection={totals.open > 0 ? <Badge size="sm" color="orange" variant="filled" circle={totals.open < 10}>{totals.open}</Badge> : null}
          onClick={() => {
            setShowFollowUps(view !== "map" || !showFollowUps);
            setView("map");
          }}
          aria-pressed={view === "map" && showFollowUps}
        >
          Follow-ups
        </Button>
        <Button leftSection={<IconPlus size={16} />} onClick={() => {
          setView("map");
          setAdding(true);
        }} disabled={Boolean(placement)}>
          Add area
        </Button>
        {hasDesktopFiles && <WorkspaceMenu workspace={workspace} />}
      </header>

      {view === "people" && <main className="main"><PeopleView workspace={workspace} update={update} /></main>}
      {view === "insights" && (
        <main className="main">
          <Suspense fallback={<Center style={{ flex: 1 }}><Loader aria-label="Loading insights" /></Center>}>
            <Insights workspace={workspace} onOpenSop={openAreaSop} onOpenNotes={(areaId) => select(areaId, "notes")} />
          </Suspense>
        </main>
      )}
      <main className="main" style={view !== "map" ? { display: "none" } : undefined}>
        <div className="stage">
          <MapScene
            areas={workspace.areas}
            flows={workspace.flows}
            selectedId={selectedId}
            placement={placement}
            onSelect={(id) => select(id)}
            onPlace={(cell) => {
              if (!placement) return;
              createArea(placement.name, placement.hue, placement.kind, cell.x, cell.y);
              setPlacement(null);
            }}
            onMove={(id, cell) =>
              update((draft) => {
                const area = findArea(draft, id);
                area.x = cell.x;
                area.y = cell.y;
              })
            }
          />

          {placement && (
            <Paper className="hint" shadow="md" radius="md" px="md" py={6}>
              <Group gap="sm">
                <Text size="sm" c="white">
                  Click an open spot to place <b>{placement.name}</b>
                </Text>
                <Button size="compact-sm" variant="white" color="dark" onClick={() => setPlacement(null)}>
                  Cancel
                </Button>
              </Group>
            </Paper>
          )}

          {workspace.areas.length === 0 && !placement && (
            <Paper className="welcome" shadow="lg" radius="lg" p="xl" withBorder>
              <Stack gap="xs">
                <Title order={2}>Where does your system start?</Title>
                <Text c="dimmed" style={{ textWrap: "pretty" }}>
                  Add the first area of the business. You'll build out its processes, SOPs and improvement notes from there, then add the areas it hands work to.
                </Text>
                <AreaForm
                  existing={workspace.areas}
                  submitLabel="Add to the map"
                  onSubmit={(name, hue, kind) => createArea(name, hue, kind, GRID_SIZE / 2 - FOOTPRINT / 2, GRID_SIZE / 2 - FOOTPRINT / 2)}
                />
              </Stack>
            </Paper>
          )}

          {showFollowUps && <FollowUps workspace={workspace} update={update} onClose={() => setShowFollowUps(false)} onJump={(areaId) => select(areaId, "notes")} />}
        </div>

        {selected && (
          <AreaPanel
            key={selected.id}
            area={selected}
            workspace={workspace}
            tab={tab}
            focusProcessId={focusProcessId}
            onTab={setTab}
            update={update}
            onClose={() => select(null)}
            onOpenSop={setOpenSopId}
          />
        )}
      </main>

      <Modal opened={adding} onClose={() => setAdding(false)} title="Add an area" radius="lg" size={480}>
        <Stack gap="md">
          <Text size="sm" c="dimmed" mt={-8}>
            Name the next part of the business, then click where it sits on the map.
          </Text>
          <AreaForm
            existing={workspace.areas}
            submitLabel="Choose a spot"
            onSubmit={(name, hue, kind) => {
              setAdding(false);
              setPlacement({ name, hue, kind });
            }}
          />
        </Stack>
      </Modal>

      {view === "map" && selected && openSop && <SopEditor key={openSop.id} area={selected} sop={openSop} people={workspace.people} update={update} onClose={() => setOpenSopId(null)} />}

      <Spotlight
        actions={searchActions}
        shortcut="mod + K"
        tagsToIgnore={[]}
        limit={30}
        highlightQuery
        nothingFound="Nothing matches"
        searchProps={{ leftSection: <IconSearch size={18} />, placeholder: "Search areas, processes, SOPs and notes" }}
      />
    </div>
  );
}
