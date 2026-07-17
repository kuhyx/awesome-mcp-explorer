import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SORT } from "../lib/filter-sort.ts";
import { StatBar } from "./stat-bar.tsx";

function renderBar(over: Partial<Parameters<typeof StatBar>[0]> = {}) {
  const handlers = {
    onExport: vi.fn(),
    onReset: vi.fn(),
    onShare: vi.fn(),
    onSort: vi.fn(),
  };
  render(
    <StatBar
      filterActive={false}
      shown={537}
      sort={DEFAULT_SORT}
      total={2981}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
}

describe("StatBar", () => {
  it("announces the counts", () => {
    renderBar();
    expect(screen.getByRole("status")).toHaveTextContent("Showing 537 of 2,981");
  });

  it("changes the sort key", async () => {
    const { onSort } = renderBar();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /Sort/ }), "grade");
    expect(onSort).toHaveBeenCalledWith({ dir: "desc", key: "grade" });
  });

  it("flips the sort direction", async () => {
    const { onSort } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Sort descending/ }));
    expect(onSort).toHaveBeenCalledWith({ dir: "asc", key: "stars" });
  });

  it("shows the direction that is active", () => {
    renderBar({ sort: { dir: "asc", key: "stars" } });
    expect(screen.getByRole("button", { name: /Sort ascending/ })).toHaveTextContent(
      "↑",
    );
  });

  it("offers Reset only when a filter is active", async () => {
    renderBar();
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();

    const { onReset } = renderBar({ filterActive: true });
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("copies the link", async () => {
    const { onShare } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(onShare).toHaveBeenCalledOnce();
  });

  it("exports in the chosen format and resets the picker", async () => {
    const { onExport } = renderBar();
    const select = screen.getByRole("combobox", { name: /Export/ });
    await userEvent.selectOptions(select, "csv");
    expect(onExport).toHaveBeenCalledWith("csv");
    expect(select).toHaveValue("");
  });

  it("does nothing when the export picker returns to its placeholder", async () => {
    const { onExport } = renderBar();
    const select = screen.getByRole("combobox", { name: /Export/ });
    await userEvent.selectOptions(select, "");
    expect(onExport).not.toHaveBeenCalled();
  });
});
