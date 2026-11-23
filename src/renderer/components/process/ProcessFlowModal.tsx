import { lazy, Suspense } from "react";
import { Center, Loader, Modal } from "@mantine/core";
import type { Process } from "../../../shared/types";

const ProcessFlow = lazy(() => import("./ProcessFlow"));

export function ProcessFlowModal({
  opened,
  onClose,
  process,
  edit,
}: {
  opened: boolean;
  onClose: () => void;
  process: Process;
  edit: (recipe: (draft: Process) => void) => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Flow · ${process.name || "Untitled process"}`}
      size={1120}
      radius="lg"
      centered
      closeOnClickOutside={false}
    >
      {opened && (
        <Suspense fallback={<Center h="60vh"><Loader aria-label="Loading process flow" /></Center>}>
          <ProcessFlow process={process} edit={edit} />
        </Suspense>
      )}
    </Modal>
  );
}
