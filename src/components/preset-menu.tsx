/**
 * Built-in and saved filter presets.
 */
import { useState } from "react";

import type { Preset } from "../lib/presets.ts";

import { BUILTIN_PRESETS } from "../lib/presets.ts";

export interface PresetMenuProps {
  readonly onApply: (preset: Preset) => void;
  readonly onDelete: (name: string) => void;
  readonly onSave: (name: string) => void;
  readonly presets: readonly Preset[];
}

export function PresetMenu({
  onApply,
  onDelete,
  onSave,
  presets,
}: PresetMenuProps): React.JSX.Element {
  const [name, setName] = useState("");

  return (
    <div className="presets">
      {BUILTIN_PRESETS.map((preset) => (
        <button
          className="chip"
          key={preset.name}
          onClick={(): void => {
            onApply(preset);
          }}
          type="button"
        >
          {preset.name}
        </button>
      ))}

      {presets.map((preset) => (
        <span className="preset-saved" key={preset.name}>
          <button
            className="chip on"
            onClick={(): void => {
              onApply(preset);
            }}
            type="button"
          >
            {preset.name}
          </button>
          <button
            aria-label={`Delete preset ${preset.name}`}
            className="chip preset-del"
            onClick={(): void => {
              onDelete(preset.name);
            }}
            type="button"
          >
            ✕
          </button>
        </span>
      ))}

      <form
        className="preset-save"
        onSubmit={(event): void => {
          event.preventDefault();
          if (name.trim() === "") return;
          onSave(name.trim());
          setName("");
        }}
      >
        <input
          aria-label="Preset name"
          onChange={(event): void => {
            setName(event.target.value);
          }}
          placeholder="Save current as…"
          value={name}
        />
        <button className="chip" disabled={name.trim() === ""} type="submit">
          Save
        </button>
      </form>
    </div>
  );
}
