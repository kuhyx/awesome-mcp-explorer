import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Preset } from "../lib/presets.ts";

import { BUILTIN_PRESETS } from "../lib/presets.ts";
import { PresetMenu } from "./preset-menu.tsx";

function renderMenu(presets: readonly Preset[] = []) {
  const handlers = { onApply: vi.fn(), onDelete: vi.fn(), onSave: vi.fn() };
  render(<PresetMenu presets={presets} {...handlers} />);
  return handlers;
}

describe("PresetMenu", () => {
  it("offers the built-in presets", () => {
    renderMenu();
    for (const preset of BUILTIN_PRESETS) {
      expect(screen.getByRole("button", { name: preset.name })).toBeInTheDocument();
    }
  });

  it("applies a built-in preset", async () => {
    const { onApply } = renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Triple-A only" }));
    expect(onApply).toHaveBeenCalledWith({ name: "Triple-A only", search: "aaa=1" });
  });

  it("lists and applies a saved preset", async () => {
    const saved: Preset = { name: "Mine", search: "lang=rust" };
    const { onApply } = renderMenu([saved]);
    await userEvent.click(screen.getByRole("button", { name: "Mine" }));
    expect(onApply).toHaveBeenCalledWith(saved);
  });

  it("deletes a saved preset", async () => {
    const { onDelete } = renderMenu([{ name: "Mine", search: "" }]);
    await userEvent.click(
      screen.getByRole("button", { name: "Delete preset Mine" }),
    );
    expect(onDelete).toHaveBeenCalledWith("Mine");
  });

  it("saves the current filters under a name", async () => {
    const { onSave } = renderMenu();
    await userEvent.type(screen.getByLabelText("Preset name"), "My shortlist");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("My shortlist");
  });

  it("clears the name field after saving", async () => {
    renderMenu();
    const input = screen.getByLabelText("Preset name");
    await userEvent.type(input, "X{Enter}");
    expect(input).toHaveValue("");
  });

  it("will not save an empty or whitespace-only name", async () => {
    const { onSave } = renderMenu();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Preset name"), "   ");
    expect(save).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("trims the name", async () => {
    const { onSave } = renderMenu();
    await userEvent.type(screen.getByLabelText("Preset name"), "  Spaced  {Enter}");
    expect(onSave).toHaveBeenCalledWith("Spaced");
  });

  it("does not submit a whitespace-only name via Enter", async () => {
    const { onSave } = renderMenu();
    await userEvent.type(screen.getByLabelText("Preset name"), " {Enter}");
    expect(onSave).not.toHaveBeenCalled();
  });
});
