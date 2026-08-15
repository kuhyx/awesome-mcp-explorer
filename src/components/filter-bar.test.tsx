import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Facets } from "../lib/facets.ts";
import type { FilterState } from "../lib/filter-sort.ts";
import type { GithubFacts, Server } from "../lib/server.ts";

import { computeFacets } from "../lib/facets.ts";
import { DEFAULT_FILTER } from "../lib/filter-sort.ts";
import { FilterBar } from "./filter-bar.tsx";

const BASE_FACTS: GithubFacts = {
  archived: false,
  createdAt: "2024-01-01T00:00:00Z",
  forks: 0,
  isFoss: "yes",
  pushedAt: "2026-07-01T00:00:00Z",
  spdx: "MIT",
  stars: 10,
};

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
    gh: BASE_FACTS,
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

// Spread across every value each picker offers: an option whose count is zero
// is disabled by design, so a fixture covering only one value per facet would
// leave most of the sidebar unclickable and the tests testing nothing.
const facets: Facets = computeFacets([
  sample({}),
  sample({ id: "c/d", languages: ["rust"], os: ["macos"], scope: ["cloud"] }),
  sample({ categories: ["Search & Data Extraction"], id: "e/f", languages: ["csharp"] }),
  sample({
    cost: { source: "inferred", value: "unknown" },
    gh: { ...BASE_FACTS, isFoss: "unknown" },
    id: "g/h",
    rateLimited: { source: "inferred", value: "unknown" },
  }),
  sample({
    cost: { source: "inferred", value: "likely-paid" },
    gh: { ...BASE_FACTS, isFoss: "no" },
    id: "i/j",
    rateLimited: { source: "inferred", value: "no" },
  }),
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

  it("shows hide-archived as pressed when on", () => {
    renderBar({ filter: { ...DEFAULT_FILTER, hideArchived: true } });
    expect(screen.getByRole("button", { name: "Hide archived" })).toHaveAttribute(
      "aria-pressed",
      "true",
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

  it("cycles a licence value", async () => {
    const { onChange } = renderBar();
    await userEvent.click(screen.getByLabelText("FOSS: off"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ foss: { excludes: [], includes: ["yes"] } }),
    );
  });

  it("adds a second licence value rather than replacing the first", async () => {
    // The point of the change: "FOSS or Unclear" must be expressible.
    const { onChange } = renderBar({
      filter: { ...DEFAULT_FILTER, foss: { excludes: [], includes: ["yes"] } },
    });
    await userEvent.click(screen.getByLabelText("Unclear: off"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        foss: { excludes: [], includes: ["yes", "unknown"] },
      }),
    );
    // FOSS stays selected: the click added to the selection, it did not replace it.
    expect(screen.getByLabelText("FOSS: include")).toBeInTheDocument();
  });

  it("excludes a licence value on a second click", async () => {
    const { onChange } = renderBar({
      filter: { ...DEFAULT_FILTER, foss: { excludes: [], includes: ["yes"] } },
    });
    await userEvent.click(screen.getByLabelText("FOSS: include"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ foss: { excludes: ["yes"], includes: [] } }),
    );
  });

  it("cycles cost and rate-limit values", async () => {
    const { onChange } = renderBar();
    await userEvent.click(screen.getByLabelText("~free: off"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        cost: { excludes: [], includes: ["likely-free"] },
      }),
    );
    await userEvent.click(screen.getByLabelText("~limited: off"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rateLimited: { excludes: [], includes: ["yes"] },
      }),
    );
  });

  it("selects free OR unknown cost together", () => {
    renderBar({
      filter: {
        ...DEFAULT_FILTER,
        cost: { excludes: [], includes: ["likely-free", "unknown"] },
      },
    });
    expect(screen.getByLabelText("~free: include")).toBeInTheDocument();
    expect(screen.getByLabelText("~unknown: include")).toBeInTheDocument();
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

/**
 * Drives the shared slider directly; jsdom has no pointer capture.
 *
 * The press goes to the *track*, not the thumb: @kuhyx/web-ui's RangeSlider
 * grabs whichever thumb is nearer to the press, so a press anywhere on the
 * track works. `index` therefore selects which slider to drive (each has two
 * thumbs), and the press position decides which of its thumbs moves.
 */
function dragThumb(index: number, clientX: number): void {
  const track = screen.getAllByRole("slider")[index]!.closest(".slider-track");
  track?.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, clientX, pointerId: 1 }),
  );
  track?.dispatchEvent(
    new PointerEvent("pointermove", { bubbles: true, clientX, pointerId: 1 }),
  );
}

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

  it("sets a star bound when dragged inward", () => {
    const { onChange } = renderBar();
    dragThumb(0, 600); // low thumb to mid-track
    const [next] = onChange.mock.calls[0] as [FilterState];
    expect(next.minStars).toEqual(expect.any(Number));
  });

  it("clears the star bound at the extreme, so the extreme means 'no filter'", () => {
    const { onChange } = renderBar({
      filter: { ...DEFAULT_FILTER, maxStars: 50, minStars: 5 },
    });
    dragThumb(0, 0); // low thumb back to the far left
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ minStars: null }),
    );
  });

  it("clears the upper star bound at the far right", () => {
    const { onChange } = renderBar({
      filter: { ...DEFAULT_FILTER, maxStars: 50 },
    });
    dragThumb(1, 9999);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxStars: null }),
    );
  });

  it("sets the last-push bound", () => {
    const { onChange } = renderBar();
    // Press near the left end so the shared slider grabs the *low* thumb: the
    // last-push filter only reads `lo` (there is no upper bound to set).
    dragThumb(2, 300);
    const [next] = onChange.mock.calls[0] as [FilterState];
    expect(next.pushedAfter).toEqual(expect.any(Number));
  });

  it("clears the last-push bound at the far left", () => {
    // A separate test, not a second render: two FilterBars in one document
    // would leave getAllByRole indexing the first one's thumbs.
    const { onChange } = renderBar({
      filter: { ...DEFAULT_FILTER, pushedAfter: 3 },
    });
    dragThumb(2, 0);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pushedAfter: null }),
    );
  });
});
