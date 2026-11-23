import { useState, type FormEvent } from "react";
import { Button, Group, Stack, Textarea, TextInput } from "@mantine/core";
import type { Workspace } from "../../shared/types";
import type { Update } from "../store";

export function CompanyProfileForm({ workspace, update, onSave }: {
  workspace: Workspace;
  update: Update;
  onSave?: () => void;
}) {
  const profile = workspace.companyProfile;
  const [name, setName] = useState(profile ? workspace.name : "");
  const [industry, setIndustry] = useState(profile?.industry ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const companyName = name.trim();
    if (!companyName) return;
    update((draft) => {
      draft.name = companyName;
      draft.companyProfile = { industry: industry.trim(), description: description.trim(), confirmed: true };
    });
    onSave?.();
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        <TextInput
          label="Company name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          required
          data-autofocus
          autoFocus
        />
        <TextInput
          label="Industry (optional)"
          placeholder="e.g. Precision manufacturing"
          value={industry}
          onChange={(event) => setIndustry(event.currentTarget.value)}
        />
        <Textarea
          label="Company description (optional)"
          placeholder="What does your company do?"
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          minRows={3}
        />
        <Group>
          <Button type="submit" disabled={!name.trim()}>
            {profile ? "Save profile" : "Create profile"}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
