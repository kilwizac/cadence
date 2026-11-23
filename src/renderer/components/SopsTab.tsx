import { Badge, Button, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import { IconFileText, IconPaperclip, IconPencil, IconUpload } from "@tabler/icons-react";
import type { Area } from "../../shared/types";
import { SOP_STATUSES, findArea, labelOf, newFileSop, newWrittenSop, shortDate, toneOf } from "../model";
import type { Update } from "../store";
import { hasDesktopFiles, storage } from "../storage";

export function SopsTab({ area, update, onOpenSop }: { area: Area; update: Update; onOpenSop: (sopId: string) => void }) {
  const write = () => {
    const sop = newWrittenSop();
    update((draft) => void findArea(draft, area.id).sops.push(sop));
    onOpenSop(sop.id);
  };

  const attach = async () => {
    const attachment = await storage.pickAttachment();
    if (!attachment) return;
    const sop = newFileSop(attachment);
    update((draft) => void findArea(draft, area.id).sops.push(sop));
  };

  const importDropped = async (files: File[]) => {
    for (const file of files) {
      try {
        const attachment = await storage.importAttachment(storage.pathForFile(file));
        const sop = newFileSop(attachment);
        update((draft) => void findArea(draft, area.id).sops.push(sop));
      } catch (error) {
        notifications.show({ color: "red", title: `Couldn't attach ${file.name}`, message: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  return (
    <Stack gap="md" p="md">
      <Group gap="xs" grow>
        <Button variant="default" leftSection={<IconPencil size={16} />} onClick={write}>
          Write an SOP
        </Button>
        <Button variant="default" leftSection={<IconPaperclip size={16} />} onClick={attach} disabled={!hasDesktopFiles}>
          Attach a file
        </Button>
      </Group>

      <Dropzone onDrop={importDropped} disabled={!hasDesktopFiles} radius="md" p="md" className="sop-dropzone">
        <Group gap="sm" justify="center" wrap="nowrap" mih={area.sops.length ? 40 : 110} style={{ pointerEvents: "none" }}>
          <IconUpload size={22} stroke={1.6} color="var(--mantine-color-dimmed)" />
          <Stack gap={0}>
            <Text size="sm" fw={500}>
              {area.sops.length ? "Drop files to attach more SOPs" : "Drop your existing SOPs here"}
            </Text>
            {!area.sops.length && (
              <Text size="xs" c="dimmed">
                Word, Excel, PDF or images. Files are copied into the app's library.
              </Text>
            )}
          </Stack>
        </Group>
      </Dropzone>

      {area.sops.map((sop) => {
        const usedBy = area.processes.filter((process) => process.sopIds.includes(sop.id)).length;
        return (
          <UnstyledButton key={sop.id} onClick={() => onOpenSop(sop.id)} className="sop-row">
            <Paper withBorder p="sm" radius="md">
              <Group wrap="nowrap" gap="sm">
                <span className="sop-icon">{sop.kind === "file" ? <IconPaperclip size={17} /> : <IconFileText size={17} />}</span>
                <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {sop.title || "Untitled SOP"}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {sop.kind === "file" ? sop.attachment?.originalName : "Written in app"} · Updated {shortDate(sop.updatedAt)}
                    {usedBy > 0 && ` · Used in ${usedBy}`}
                  </Text>
                </Stack>
                <Badge color={toneOf(SOP_STATUSES, sop.status)} style={{ flex: "none" }}>
                  {labelOf(SOP_STATUSES, sop.status)}
                </Badge>
              </Group>
            </Paper>
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}
