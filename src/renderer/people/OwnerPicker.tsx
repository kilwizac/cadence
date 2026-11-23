import { useState } from "react";
import { Select } from "@mantine/core";

const CREATE_PERSON = ":create";

export function OwnerPicker({
  options,
  value,
  onChange,
  onCreate,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreate: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const name = search.trim();
  const canCreate = name && !options.some((option) => option.label.toLowerCase() === name.toLowerCase());

  return (
    <Select
      label="Owner"
      placeholder="Pick or add a person"
      nothingFoundMessage="Type a name to add someone"
      data={canCreate ? [...options, { value: CREATE_PERSON, label: `Add “${name}”` }] : options}
      value={value}
      onChange={(id) => id === CREATE_PERSON ? onCreate(name) : onChange(id)}
      onSearchChange={setSearch}
      searchable
      clearable
      allowDeselect={false}
      clearButtonProps={{ "aria-label": "Clear owner" }}
    />
  );
}
