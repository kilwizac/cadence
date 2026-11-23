import { useState } from "react";
import { ActionIcon, Menu } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDots, IconFileTypePdf, IconFolder } from "@tabler/icons-react";
import type { Workspace } from "../../shared/types";
import { storage } from "../storage";
import { runFileAction } from "./ui";

export function WorkspaceMenu({ workspace }: { workspace: Workspace }) {
  const [busy, setBusy] = useState(false);

  const exportManual = async () => {
    setBusy(true);
    await runFileAction(() => storage.exportManual(workspace), "Operations manual exported.", "Couldn't export the operations manual");
    setBusy(false);
  };

  const showDataFolder = async () => {
    try {
      const error = await storage.revealDataFolder();
      if (error) throw new Error(error);
    } catch (error) {
      notifications.show({ color: "red", title: "Couldn't show the data folder", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <ActionIcon size="lg" variant="default" aria-label="Workspace actions" disabled={busy}>
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconFileTypePdf size={16} />} onClick={exportManual}>Export manual</Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<IconFolder size={16} />} onClick={showDataFolder}>Show data folder</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
