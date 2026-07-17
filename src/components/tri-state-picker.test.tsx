import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TriSelect } from "../lib/filter-sort.ts";

import { cycle, stateOf, summarize, TriStatePicker } from "./tri-state-picker.tsx";

const OPTIONS = ["rust", "python", "go"] as const;
type Lang = (typeof OPTIONS)[number];

const counts = new Map<Lang, number>([
  ["rust", 88],
  ["python", 1023],
  ["go", 161],
]);

const empty: TriSelect<Lang> = { excludes: [], includes: [] };

function renderPicker(value: TriSelect<Lang> = empty) {
  const onChange = vi.fn();
  render(
    <TriStatePicker
      counts={counts}
      label="Language"
      onChange={onChange}
      options={OPTIONS}
      value={value}
    />,
  );
  return { onChange };
}

describe("stateOf", () => {
  it("reports off, include and exclude", () => {
    expect(stateOf(empty, "rust")).toBe("off");
    expect(stateOf({ excludes: [], includes: ["rust"] }, "rust")).toBe("include");
    expect(stateOf({ excludes: ["rust"], includes: [] }, "rust")).toBe("exclude");
  });
});

describe("cycle", () => {
  it("goes off -> include -> exclude -> off", () => {
    const a = cycle(empty, "rust");
    expect(a).toEqual({ excludes: [], includes: ["rust"] });
    const b = cycle(a, "rust");
    expect(b).toEqual({ excludes: ["rust"], includes: [] });
    const c = cycle(b, "rust");
    expect(c).toEqual({ excludes: [], includes: [] });
  });

  it("leaves other options alone", () => {
    const value: TriSelect<Lang> = { excludes: ["go"], includes: ["python"] };
    expect(cycle(value, "rust")).toEqual({
      excludes: ["go"],
      includes: ["python", "rust"],
    });
  });

  it("moves an option between lists rather than duplicating it", () => {
    const value: TriSelect<Lang> = { excludes: [], includes: ["rust"] };
    const next = cycle(value, "rust");
    expect(next.includes).not.toContain("rust");
    expect(next.excludes).toEqual(["rust"]);
  });
});

describe("summarize", () => {
  const id = (option: string): string => option;

  it("says Any when neutral", () => {
    expect(summarize(empty, id)).toBe("Any");
  });

  it("lists includes", () => {
    expect(summarize({ excludes: [], includes: ["rust", "go"] }, id)).toBe("rust, go");
  });

  it("lists excludes as 'not X'", () => {
    expect(summarize({ excludes: ["python"], includes: [] }, id)).toBe("not python");
  });

  it("joins both with a middot", () => {
    expect(summarize({ excludes: ["python"], includes: ["rust"] }, id)).toBe(
      "rust · not python",
    );
  });

  it("uses the formatter", () => {
    expect(summarize({ excludes: [], includes: ["rust"] }, () => "Rust")).toBe("Rust");
  });
});

describe("TriStatePicker", () => {
  it("labels each option with its state, which is also the a11y hook", async () => {
    renderPicker();
    expect(screen.getByLabelText("rust: off")).toBeInTheDocument();
    expect(screen.getByLabelText("python: off")).toBeInTheDocument();
  });

  it("shows the count for each option", () => {
    renderPicker();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("1023")).toBeInTheDocument();
  });

  it("cycles to include on click", async () => {
    const { onChange } = renderPicker();
    await userEvent.click(screen.getByLabelText("rust: off"));
    expect(onChange).toHaveBeenCalledWith({ excludes: [], includes: ["rust"] });
  });

  it("cycles include -> exclude on a second click", async () => {
    const { onChange } = renderPicker({ excludes: [], includes: ["rust"] });
    await userEvent.click(screen.getByLabelText("rust: include"));
    expect(onChange).toHaveBeenCalledWith({ excludes: ["rust"], includes: [] });
  });

  it("marks a selected option as pressed", () => {
    renderPicker({ excludes: [], includes: ["rust"] });
    expect(screen.getByLabelText("rust: include")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("go: off")).toHaveAttribute("aria-pressed", "false");
  });

  it("disables an option that would match nothing", () => {
    render(
      <TriStatePicker
        counts={new Map<Lang, number>([["rust", 0]])}
        label="Language"
        onChange={vi.fn()}
        options={["rust"]}
        value={empty}
      />,
    );
    expect(screen.getByLabelText("rust: off")).toBeDisabled();
  });

  it("keeps an active option clickable even at zero, so it can be undone", () => {
    // Otherwise a filter that narrows itself to nothing would be a trap.
    render(
      <TriStatePicker
        counts={new Map<Lang, number>([["rust", 0]])}
        label="Language"
        onChange={vi.fn()}
        options={["rust"]}
        value={{ excludes: [], includes: ["rust"] }}
      />,
    );
    expect(screen.getByLabelText("rust: include")).not.toBeDisabled();
  });

  it("shows the summary in the legend", () => {
    renderPicker({ excludes: ["python"], includes: ["rust"] });
    expect(screen.getByText("rust · not python")).toBeInTheDocument();
  });

  it("applies a custom formatter to names", () => {
    render(
      <TriStatePicker
        counts={counts}
        format={(o): string => o.toUpperCase()}
        label="Language"
        onChange={vi.fn()}
        options={OPTIONS}
        value={empty}
      />,
    );
    expect(screen.getByLabelText("RUST: off")).toBeInTheDocument();
  });

  it("treats a missing count as zero", () => {
    render(
      <TriStatePicker
        counts={new Map<Lang, number>()}
        label="Language"
        onChange={vi.fn()}
        options={["rust"]}
        value={{ excludes: [], includes: ["rust"] }}
      />,
    );
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
