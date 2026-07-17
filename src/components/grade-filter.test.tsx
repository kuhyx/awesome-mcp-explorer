import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FilterState } from "../lib/filter-sort.ts";
import type { GradeCoverage } from "../lib/grade.ts";

import { DEFAULT_FILTER } from "../lib/filter-sort.ts";
import { axisLabel, GradeFilter } from "./grade-filter.tsx";

const coverage = new Map<GradeCoverage, number>([
  ["graded-all", 2052],
  ["graded-partial", 581],
  ["not-indexed", 348],
]);

function renderFilter(over: Partial<FilterState> = {}, ungraded = 348) {
  const onChange = vi.fn();
  render(
    <GradeFilter
      coverageCounts={coverage}
      filter={{ ...DEFAULT_FILTER, ...over }}
      onChange={onChange}
      tripleACount={537}
      ungraded={ungraded}
    />,
  );
  return { onChange };
}

describe("GradeFilter triple-A toggle", () => {
  it("shows the count of triple-A servers", () => {
    renderFilter();
    expect(screen.getByText("537")).toBeInTheDocument();
  });

  it("turns the filter on", async () => {
    const { onChange } = renderFilter();
    await userEvent.click(screen.getByRole("button", { name: /Triple-A only/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ tripleA: true }),
    );
  });

  it("turns the filter back off", async () => {
    const { onChange } = renderFilter({ tripleA: true });
    await userEvent.click(screen.getByRole("button", { name: /Triple-A only/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ tripleA: false }),
    );
  });

  it("reflects its state to assistive tech", () => {
    renderFilter({ tripleA: true });
    expect(screen.getByRole("button", { name: /Triple-A only/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("explains that there is no looser variant, because Glama has no A-", () => {
    renderFilter();
    expect(screen.getByText(/no looser/i)).toBeInTheDocument();
  });
});

describe("GradeFilter per-axis minimums", () => {
  it("offers a select per axis", () => {
    renderFilter();
    for (const axis of ["license", "quality", "maintenance"]) {
      expect(screen.getByText(`${axis} ≥`)).toBeInTheDocument();
    }
  });

  it("sets a minimum grade", async () => {
    const { onChange } = renderFilter();
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0]!, "B");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ minGrades: { license: "B" } }),
    );
  });

  it("clears a minimum when set back to any", async () => {
    const { onChange } = renderFilter({ minGrades: { license: "B" } });
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0]!, "");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ minGrades: {} }),
    );
  });

  it("keeps other axes when changing one", async () => {
    const { onChange } = renderFilter({ minGrades: { license: "A" } });
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[1]!, "C");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ minGrades: { license: "A", quality: "C" } }),
    );
  });
});

describe("GradeFilter coverage chips", () => {
  it("shows a count per bucket", () => {
    renderFilter();
    expect(screen.getByText("2052")).toBeInTheDocument();
    expect(screen.getByText("581")).toBeInTheDocument();
  });

  it("selects a bucket", async () => {
    const { onChange } = renderFilter();
    await userEvent.click(screen.getByRole("button", { name: /All three graded/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ gradeCoverage: "graded-all" }),
    );
  });

  it("deselects the active bucket on a second click", async () => {
    const { onChange } = renderFilter({ gradeCoverage: "graded-all" });
    await userEvent.click(screen.getByRole("button", { name: /All three graded/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ gradeCoverage: null }),
    );
  });
});

// The single most important honesty guarantee in the UI.
describe("GradeFilter ungraded warning", () => {
  it("is hidden while no grade filter is active", () => {
    renderFilter();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("appears once triple-A is on, so an empty result is not misread", () => {
    renderFilter({ tripleA: true });
    expect(screen.getByRole("status")).toHaveTextContent(/348 matching servers have/);
    expect(screen.getByRole("status")).toHaveTextContent(/not .none exist/i);
  });

  it("appears for a coverage filter too", () => {
    renderFilter({ gradeCoverage: "graded-all" });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("appears for a per-axis minimum too", () => {
    renderFilter({ minGrades: { quality: "A" } });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("stays hidden when nothing in the result set is ungraded", () => {
    renderFilter({ tripleA: true }, 0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("uses the singular for one server", () => {
    renderFilter({ tripleA: true }, 1);
    expect(screen.getByRole("status")).toHaveTextContent(/1 matching server has/);
  });
});

describe("axisLabel", () => {
  it("returns the axis name", () => {
    expect(axisLabel("quality")).toBe("quality");
  });
});
