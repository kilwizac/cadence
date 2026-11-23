import { useState } from "react";
import { ActionIcon, Button, Group, Menu, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArchive, IconDots, IconFileTypePdf, IconFolder, IconRestore } from "@tabler/icons-react";
import { storage } from "../storage";
import { useWorkspace } from "../store";
import { runFileAction } from "./ui";

export function WorkspaceMenu() {
  const { workspace, restoreBackup } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<string | null>(null);

  const run = async (action: () => Promise<boolean>, success: string, failure: string) => {
    setBusy(true);
    await runFileAction(action, success, failure);
    setBusy(false);
  };

  const chooseBackup = async () => {
    setBusy(true);
    try {
      setBackup(await storage.pickBackup());
    } catch (error) {
      notifications.show({ color: "red", title: "Couldn't choose a backup", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const showDataFolder = async () => {
    try {
      const error = await storage.revealDataFolder();
      if (error) throw new Error(error);
    } catch (error) {
      notifications.show({ color: "red", title: "Couldn't show the data folder", message: error instanceof Error ? error.message : String(error) });
    }
  };

  if (!workspace) return null;
  return (
    <>
      <Menu position="bottom-end">
        <Menu.Target>
          <ActionIcon size="lg" variant="default" aria-label="Workspace actions" disabled={busy}>
            <IconDots size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {workspace.companyProfile && (
            <>
              <Menu.Item leftSection={<IconFileTypePdf size={16} />} onClick={() => run(() => storage.exportManual(workspace), "Operations manual exported.", "Couldn't export the operations manual")}>
                Export manual
              </Menu.Item>
              <Menu.Item leftSection={<IconArchive size={16} />} onClick={() => run(() => storage.backupWorkspace(workspace), "Workspace backup saved.", "Couldn't back up the workspace")}>
                Backup
              </Menu.Item>
            </>
          )}
          <Menu.Item leftSection={<IconRestore size={16} />} onClick={chooseBackup}>Restore</Menu.Item>
          <Menu.Divider />
          <Menu.Item leftSection={<IconFolder size={16} />} onClick={showDataFolder}>Show data folder</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal opened={backup !== null} onClose={() => { if (!busy) setBackup(null); }} title="Replace this workspace?" withCloseButton={!busy} closeOnClickOutside={!busy} closeOnEscape={!busy}>
        <Stack gap="md">
          <Text size="sm" style={{ overflowWrap: "anywhere" }}>
            Restoring <strong>{backup}</strong> will replace the current workspace and its attachments. Cadence will first save a safety copy in the backups folder.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" disabled={busy} data-autofocus onClick={() => setBackup(null)}>Cancel</Button>
            <Button color="red" loading={busy} onClick={async () => {
              await run(restoreBackup, "Workspace restored. The previous workspace is in the backups folder.", "Couldn't restore the workspace");
              setBackup(null);
            }}>Restore workspace</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
