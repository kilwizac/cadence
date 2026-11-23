import { ActionIcon, Badge, Group, ScrollArea, Select, Stack, Tabs, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { IconTrash, IconX } from "@tabler/icons-react";
import type { Area, AreaKind, Workspace } from "../../shared/types";
import { AREA_KINDS, HUES, findArea, hueColor, openNotes, plural } from "../model";
import type { Update } from "../store";
import { storage } from "../storage";
import { ConnectionsTab } from "./ConnectionsTab";
import { NotesTab } from "./NotesTab";
import { ProcessesTab } from "./ProcessesTab";
import { SopsTab } from "./SopsTab";
import { HuePicker, confirmDelete } from "./ui";

export type PanelTab = "processes" | "sops" | "notes" | "connections";

export function AreaPanel({
  area,
  workspace,
  tab,
  focusProcessId,
  onTab,
  update,
  onClose,
  onOpenSop,
}: {
  area: Area;
  workspace: Workspace;
  tab: PanelTab;
  focusProcessId: string | null;
  onTab: (tab: PanelTab) => void;
  update: Update;
  onClose: () => void;
  onOpenSop: (sopId: string) => void;
}) {
  const edit = (recipe: (draft: Area) => void) => update((draft) => recipe(findArea(draft, area.id)));
  const open = openNotes(area).length;
  const connections = workspace.flows.filter((flow) => flow.from === area.id || flow.to === area.id).length;

  const remove = () =>
    confirmDelete(`Delete ${area.name || "this area"}?`, "Its processes, SOPs, notes and flows will be removed. This can't be undone.", () => {
      for (const sop of area.sops) if (sop.attachment) storage.deleteAttachment(sop.attachment.storedName);
      update((draft) => {
        draft.areas = draft.areas.filter((a) => a.id !== area.id);
        draft.flows = draft.flows.filter((flow) => flow.from !== area.id && flow.to !== area.id);
      });
      onClose();
    });

  const tabs: { id: PanelTab; label: string; count: number }[] = [
    { id: "processes", label: "Processes", count: area.processes.length },
    { id: "sops", label: "SOPs", count: area.sops.length },
    { id: "notes", label: "Notes", count: open },
    { id: "connections", label: "Flows", count: connections },
  ];

  return (
    <aside className="panel" aria-label={`${area.name} details`}>
      <Stack gap="sm" p="md" pb={0}>
        <Group gap={8} wrap="nowrap">
          <span className="area-swatch" style={{ background: hueColor(area.hue) }} />
          <TextInput
            variant="unstyled"
            className="panel-title"
            aria-label="Area name"
            value={area.name}
            placeholder="Untitled area"
            onChange={(event) => edit((a) => void (a.name = event.currentTarget.value))}
            style={{ flex: 1 }}
          />
          <Tooltip label="Delete area">
            <ActionIcon variant="subtle" color="red" aria-label="Delete area" onClick={remove}>
              <IconTrash size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Close">
            <ActionIcon variant="subtle" color="gray" aria-label="Close panel" onClick={onClose}>
              <IconX size={17} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Textarea
          variant="filled"
          aria-label="Area description"
          placeholder="What this area is responsible for"
          autosize
          minRows={1}
          maxRows={4}
          value={area.description}
          onChange={(event) => edit((a) => void (a.description = event.currentTarget.value))}
        />
        <Group justify="space-between" gap="xs">
          <HuePicker value={area.hue} hues={HUES} onChange={(hue) => edit((a) => void (a.hue = hue))} />
          <Select
            aria-label="Area type"
            size="xs"
            w={190}
            data={AREA_KINDS}
            value={area.kind}
            onChange={(value) => value && edit((a) => void (a.kind = value as AreaKind))}
          />
        </Group>
        <Text size="xs" c="dimmed">
          {plural(area.processes.length, "process", "processes")} · {plural(area.sops.length, "SOP")} · {open} open {open === 1 ? "note" : "notes"}
        </Text>
      </Stack>
      <Tabs value={tab} onChange={(value) => value && onTab(value as PanelTab)} className="panel-tabs" keepMounted={false}>
        <Tabs.List px="md">
          {tabs.map((item) => (
            <Tabs.Tab
              key={item.id}
              value={item.id}
              rightSection={
                item.count > 0 ? (
                  <Badge size="xs" variant="light" color={item.id === "notes" ? "orange" : "gray"} circle={item.count < 10}>
                    {item.count}
                  </Badge>
                ) : null
              }
            >
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <ScrollArea className="panel-body" type="auto">
          <Tabs.Panel value="processes">
            <ProcessesTab key={focusProcessId ?? "none"} area={area} update={update} initialOpenId={focusProcessId} />
          </Tabs.Panel>
          <Tabs.Panel value="sops">
            <SopsTab area={area} update={update} onOpenSop={onOpenSop} />
          </Tabs.Panel>
          <Tabs.Panel value="notes">
            <NotesTab area={area} update={update} />
          </Tabs.Panel>
          <Tabs.Panel value="connections">
            <ConnectionsTab area={area} workspace={workspace} update={update} />
          </Tabs.Panel>
        </ScrollArea>
      </Tabs>
    </aside>
  );
}
