import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Facets } from "../lib/facets.ts";
import type { Server } from "../lib/server.ts";

import { computeFacets } from "../lib/facets.ts";
import { DEFAULT_FILTER } from "../lib/filter-sort.ts";
import { FilterBar } from "./filter-bar.tsx";

/**
 * Facets built from real-shaped servers, not from an empty list.
 *
 * With zero counts every option is disabled by design — the picker will not let
 * you select a filter that matches nothing — so an empty-facet fixture would
 * test the disabled state and nothing else.
 */
function sample(over: Partial<Server>): Server {
  return {
    badgeUrl: null,
    categories: ["Databases"],
    cost: { source: "inferred", value: "likely-free" },
    description: "A server.",
    gh: {
      archived: false,
      createdAt: "2024-01-01T00:00:00Z",
      forks: 0,
      isFoss: "yes",
      pushedAt: "2026-07-01T00:00:00Z",
      spdx: "MIT",
      stars: 10,
    },
    glama: { license: "A", maintenance: "A", quality: "A" },
    id: "a/b",
    languages: ["typescript"],
    official: true,
    os: ["linux"],
    owner: "a",
    rateLimited: { source: "inferred", value: "yes" },
    repo: "b",
    scope: ["local"],
    url: "https://github.com/a/b",
    ...over,
  };
}

const facets: Facets = computeFacets([
  sample({}),
  sample({ id: "c/d", languages: ["rust"], scope: ["cloud"], os: ["macos"] }),
  sample({ id: "e/f", languages: ["csharp"], categories: ["Search & Data Extraction"] }),
]);

function renderBar(over: Partial<Parameters<typeof FilterBar>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <FilterBar
      categories={["Databases", "Search & Data Extraction"]}
      facets={facets}
      filter={DEFAULT_FILTER}
      onChange={onChange}
      pushedValues={[1, 2, 3, 4]}
      starValues={[0, 5, 50, 5000]}
      ungraded={0}
      {...over}
    />,
  );
  return { onChange };
}

describe("FilterBar", () => {
  it("renders every facet group", () => {
    renderBar();
    for (const label of [
      "Glama grade",
      "Provenance",
      "Language",
      "Scope (local vs cloud)",
      "Operating system",
      "Licence",
      "Cost (inferred)",
      "Rate limit (inferred)",
      "Category",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("states plainly that cost and rate limits are inferred", () => {
    renderBar();
    // The text is split across <strong>/<code>, so match the container.
    expect(
      screen.getByText(/neither the awesome list nor Glama publishes them/i),
    ).toBeInTheDocument();
    expect(screen.getByText("data/overrides.json")).toBeInTheDocument();
  });

  it("toggles official", async () => {
    const { onChange } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Official only/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ official: true }),
    );
  });

  it("toggles hide-archived", async () => {
    const { onChange } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Hide archived" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ hideArchived: true }),
    );
  });

  it("turns official back off", async () => {
    const { onChange } = renderBar({ filter: { ...DEFAULT_FILTER, official: true } });
    await userEvent.click(screen.getByRole("button", { name: /Official only/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ official: false }),
    );
  });

  it("uses friendly language names", () => {
    renderBar();
    expect(screen.getByLabelText("TS/JS: off")).toBeInTheDocument();
    expect(screen.getByLabelText("C#: off")).toBeInTheDocument();
  });

  it("cycles a language", async () => {
    const { onChange } = renderBar();
    await userEvent.click(screen.getByLabelText("Rust: off"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        languages: { excludes: [], includes: ["rust"] },
      }),
    );
  });

  it("cycles scope and os", async () => {
    const { onChange } = renderBar();
    await userEvent.click(screen.getByLabelText("local: off"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { excludes: [], includes: ["local"] } }),
    );
    await userEvent.click(screen.getByLabelText("linux: off"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ os: { excludes: [], includes: ["linux"] } }),
    );
  });

  it("selects and deselects a licence bucket", async () => {
    const { onChange } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: /^FOSS/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ foss: "yes" }));

    const second = renderBar({ filter: { ...DEFAULT_FILTER, foss: "yes" } });
    await userEvent.click(screen.getAllByRole("button", { name: /^FOSS/ })[1]!);
    expect(second.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ foss: null }),
    );
  });

  it("selects a cost and a rate-limit bucket", async () => {
    const { onChange } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: /~free/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ cost: "likely-free" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /~limited/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ rateLimited: "yes" }),
    );
  });

  it("cycles a category", async () => {
    const { onChange } = renderBar();
    await userEvent.click(screen.getByLabelText("Databases: off"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: { excludes: [], includes: ["Databases"] },
      }),
    );
  });
});

describe("FilterBar sliders", () => {
  it("shows the star range from the distribution", () => {
    renderBar();
    expect(screen.getByText("Stars")).toBeInTheDocument();
    expect(screen.getByLabelText(/Stars minimum/)).toBeInTheDocument();
  });

  it("hides a slider when there is no distribution to show", () => {
    renderBar({ pushedValues: [], starValues: [] });
    expect(screen.queryByLabelText(/Stars minimum/)).not.toBeInTheDocument();
  });

  it("shows the last-push slider", () => {
    renderBar();
    expect(screen.getByText("Last push")).toBeInTheDocument();
  });
});
