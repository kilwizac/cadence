import { useState } from "react";
import { ActionIcon, Button, Group, Modal, Paper, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { RichTextEditor } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { IconExternalLink, IconFolder, IconPaperclip, IconTrash } from "@tabler/icons-react";
import type { Area, Sop, SopStatus } from "../../shared/types";
import { SOP_STATUSES, findArea, shortDate, touch } from "../model";
import type { Update } from "../store";
import { storage } from "../storage";
import { confirmDelete } from "./ui";

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function SopEditor({ area, sop, update, onClose }: { area: Area; sop: Sop; update: Update; onClose: () => void }) {
  const [openError, setOpenError] = useState("");

  const edit = (recipe: (draft: Sop) => void) =>
    update((draft) => {
      const target = findArea(draft, area.id).sops.find((s) => s.id === sop.id);
      if (!target) return;
      recipe(target);
      touch(target);
    });

  const editor = useEditor({
    extensions: [StarterKit],
    content: sop.content,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      edit((s) => void (s.content = html));
    },
  });

  const remove = () =>
    confirmDelete(`Delete ${sop.title || "this SOP"}?`, "It will be unlinked from every process that uses it.", () => {
      if (sop.attachment) storage.deleteAttachment(sop.attachment.storedName);
      update((draft) => {
        const owner = findArea(draft, area.id);
        owner.sops = owner.sops.filter((s) => s.id !== sop.id);
        for (const process of owner.processes) process.sopIds = process.sopIds.filter((id) => id !== sop.id);
      });
      onClose();
    });

  const openFile = async () => {
    if (!sop.attachment) return;
    setOpenError(await storage.openAttachment(sop.attachment.storedName));
  };

  const usedBy = area.processes.filter((process) => process.sopIds.includes(sop.id));

  return (
    <Modal opened onClose={onClose} size={sop.kind === "written" ? 860 : 520} withCloseButton={false} padding="lg" radius="lg">
      <Stack gap="md">
        <Group gap="xs" wrap="nowrap">
          <TextInput
            variant="unstyled"
            className="sop-title"
            aria-label="SOP title"
            placeholder="Untitled SOP"
            value={sop.title}
            onChange={(event) => {
              const title = event.currentTarget.value;
              edit((s) => void (s.title = title));
            }}
            style={{ flex: 1 }}
          />
          <Select
            aria-label="SOP status"
            w={130}
            data={SOP_STATUSES}
            value={sop.status}
            onChange={(value) => value && edit((s) => void (s.status = value as SopStatus))}
          />
          <Tooltip label="Delete SOP">
            <ActionIcon variant="subtle" color="red" size="lg" aria-label="Delete SOP" onClick={remove}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
          <Button variant="default" onClick={onClose}>
            Done
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mt={-8}>
          {area.name} · Updated {shortDate(sop.updatedAt)}
          {usedBy.length > 0 && ` · Used in ${usedBy.map((p) => p.name).join(", ")}`}
        </Text>

        {sop.kind === "written" ? (
          <RichTextEditor editor={editor} className="sop-editor">
            <RichTextEditor.Toolbar sticky>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.H2 />
                <RichTextEditor.H3 />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Bold />
                <RichTextEditor.Italic />
                <RichTextEditor.Underline />
                <RichTextEditor.Strikethrough />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.BulletList />
                <RichTextEditor.OrderedList />
                <RichTextEditor.Blockquote />
                <RichTextEditor.Hr />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Link />
                <RichTextEditor.Unlink />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Undo />
                <RichTextEditor.Redo />
              </RichTextEditor.ControlsGroup>
            </RichTextEditor.Toolbar>
            <RichTextEditor.Content />
          </RichTextEditor>
        ) : (
          sop.attachment && (
            <Paper withBorder p="md" radius="md" bg="var(--mantine-color-gray-0)">
              <Group wrap="nowrap">
                <span className="sop-icon large">
                  <IconPaperclip size={20} />
                </span>
                <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {sop.attachment.originalName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatSize(sop.attachment.size)} · stored in the app's library
                  </Text>
                </Stack>
                <Button leftSection={<IconExternalLink size={16} />} onClick={openFile}>
                  Open
                </Button>
                <Tooltip label="Show in Finder">
                  <ActionIcon variant="default" size="lg" aria-label="Show in Finder" onClick={() => storage.revealAttachment(sop.attachment!.storedName)}>
                    <IconFolder size={17} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Paper>
          )
        )}
        {openError && (
          <Text size="sm" c="red">
            {openError}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
