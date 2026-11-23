import { useState, type FormEvent } from "react";
import { Button, Chip, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import type { Area, AreaKind } from "../../shared/types";
import { AREA_KINDS, HUES, PRESETS, guessKind } from "../model";
import { HuePicker } from "./ui";

export function AreaForm({
  existing,
  submitLabel,
  onSubmit,
}: {
  existing: Area[];
  submitLabel: string;
  onSubmit: (name: string, hue: number, kind: AreaKind) => void;
}) {
  const [name, setName] = useState("");
  const [hue, setHue] = useState(HUES[existing.length % HUES.length]);
  const [kind, setKind] = useState<AreaKind | null>(null);
  const taken = new Set(existing.map((area) => area.name.trim().toLowerCase()));
  const presets = PRESETS.filter((preset) => !taken.has(preset.name.toLowerCase()));
  const resolvedKind = kind ?? guessKind(name);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSubmit(name.trim(), hue, resolvedKind);
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        <TextInput label="Name" placeholder="e.g. Shipping & Receiving" value={name} onChange={(event) => setName(event.currentTarget.value)} data-autofocus autoFocus />
        {presets.length > 0 && (
          <Stack gap={6}>
            <Text size="xs" c="dimmed" fw={600}>
              Common areas
            </Text>
            <Group gap={6}>
              {presets.map((preset) => (
                <Chip
                  key={preset.name}
                  size="xs"
                  checked={name === preset.name}
                  onChange={() => {
                    setName(preset.name);
                    setHue(preset.hue);
                    setKind(preset.kind);
                  }}
                >
                  {preset.name}
                </Chip>
              ))}
            </Group>
          </Stack>
        )}
        <Select
          label="Type"
          description="Sets the building and equipment shown on the map"
          data={AREA_KINDS}
          value={resolvedKind}
          onChange={(value) => value && setKind(value as AreaKind)}
        />
        <Stack gap={6}>
          <Text size="sm" fw={500}>
            Color
          </Text>
          <HuePicker value={hue} hues={HUES} onChange={setHue} />
        </Stack>
        <Group>
          <Button type="submit" disabled={!name.trim()}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
