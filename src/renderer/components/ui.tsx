import { CheckIcon, ColorSwatch, Group, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { hueColor } from "../model";

export function HuePicker({ value, hues, onChange }: { value: number; hues: number[]; onChange: (hue: number) => void }) {
  return (
    <Group gap={6} role="radiogroup" aria-label="Color">
      {hues.map((hue) => (
        <ColorSwatch
          key={hue}
          component="button"
          type="button"
          role="radio"
          aria-checked={value === hue}
          aria-label={`Color ${hue}`}
          color={hueColor(hue)}
          size={22}
          onClick={() => onChange(hue)}
          style={{ cursor: "pointer", color: "white" }}
        >
          {value === hue && <CheckIcon size={11} />}
        </ColorSwatch>
      ))}
    </Group>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Stack gap={4} align="center" py="xl" px="md" ta="center">
      <Text fw={600}>{title}</Text>
      <Text size="sm" c="dimmed" maw={320} style={{ textWrap: "pretty" }}>
        {body}
      </Text>
    </Stack>
  );
}

export function confirmDelete(title: string, body: string, onConfirm: () => void) {
  modals.openConfirmModal({
    title,
    children: <Text size="sm">{body}</Text>,
    labels: { confirm: "Delete", cancel: "Cancel" },
    confirmProps: { color: "red" },
    onConfirm,
  });
}
