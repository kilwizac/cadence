import { Badge } from "@mantine/core";
import type { trainingStatus } from "./model";

const TRAINING_STATES = {
  current: { color: "green", label: "Current" },
  outdated: { color: "orange", label: "Outdated" },
  missing: { color: "gray", label: "Missing" },
};

export function TrainingBadge({ status }: { status: ReturnType<typeof trainingStatus> }) {
  const { color, label } = TRAINING_STATES[status];
  return <Badge variant="light" color={color}>{label}</Badge>;
}
