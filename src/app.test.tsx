import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Server } from "./lib/server.ts";

import { App } from "./app.tsx";

function server(over: Partial<Server> = {}): Server {
  return {
    badgeUrl: null,
    categories: ["Databases"],
    cost: { source: "inferred", value: "likely-free" },
    description: "A server for things.",
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
    id: "acme/aaa-server",
    languages: ["typescript"],
    official: false,
    os: ["linux"],
    owner: "acme",
    rateLimited: { source: "inferred", value: "no" },
    repo: "aaa-server",
    scope: ["cloud"],
    url: "https://github.com/acme/aaa-server",
    ...over,
  };
}

const DATA: Server[] = [
  server(),
  server({
    glama: { license: "A", maintenance: "B", quality: "A" },
    id: "acme/bbb-server",
    languages: ["rust"],
    repo: "bbb-server",
  }),
  // A second category so the category sort comparator actually runs.
  server({
    categories: ["Search & Data Extraction"],
    glama: null,
    id: "acme/ccc-server",
    repo: "ccc-server",
  }),
];

function stubFetch(data: Server[] = DATA): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(Response.json(data, { status: 200 }))),
  );
}

beforeEach(() => {
  globalThis.history.replaceState(null, "", "/");
  globalThis.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderApp(): Promise<void> {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
}

describe("App loading", () => {
  it("shows a loading state", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<App />);
    expect(screen.getByText("Loading servers…")).toBeInTheDocument();
  });

  it("explains how to fix a missing dataset rather than showing a blank page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 404 }))),
    );
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Could not load servers.json/)).toBeInTheDocument();
    });
    expect(screen.getByText(/pnpm run build:data/)).toBeInTheDocument();
  });
});

describe("App filtering", () => {
  it("lists every server initially", async () => {
    stubFetch();
    await renderApp();
    expect(screen.getByRole("status")).toHaveTextContent("Showing 3 of 3");
  });

  it("filters to triple-A and writes it to the URL", async () => {
    stubFetch();
    await renderApp();
    // Scoped to the sidebar fieldset (a fieldset+legend is an accessible
    // group), because the preset menu has a button of the same name.
    const grades = screen.getByRole("group", { name: /Glama grade/ });
    await userEvent.click(
      within(grades).getByRole("button", { name: /Triple-A only/ }),
    );
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 3");
    });
    expect(globalThis.location.search).toBe("?aaa=1");
  });

  it("restores state from the URL on load", async () => {
    globalThis.history.replaceState(null, "", "/?aaa=1");
    stubFetch();
    await renderApp();
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 3");
    });
  });

  it("searches by fuzzy query", async () => {
    stubFetch();
    await renderApp();
    await userEvent.type(screen.getByLabelText("Search servers"), "bbb");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 3");
    });
  });

  it("resets every filter", async () => {
    globalThis.history.replaceState(null, "", "/?aaa=1");
    stubFetch();
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Showing 3 of 3");
    });
    expect(globalThis.location.search).toBe("");
  });
});

describe("App keyboard", () => {
  it("toggles triple-A with 'a'", async () => {
    stubFetch();
    await renderApp();
    await userEvent.keyboard("a");
    await waitFor(() => {
      expect(globalThis.location.search).toBe("?aaa=1");
    });
  });

  it("focuses search with '/'", async () => {
    stubFetch();
    await renderApp();
    await userEvent.keyboard("/");
    expect(screen.getByLabelText("Search servers")).toHaveFocus();
  });

  it("opens and closes help with '?' and Escape", async () => {
    stubFetch();
    await renderApp();
    await userEvent.keyboard("?");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not toggle a filter while typing 'a' in the search box", async () => {
    stubFetch();
    await renderApp();
    await userEvent.type(screen.getByLabelText("Search servers"), "a");
    expect(globalThis.location.search).not.toContain("aaa=1");
  });
});

describe("App presets", () => {
  it("applies a built-in preset", async () => {
    stubFetch();
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: "Triple-A only" }));
    await waitFor(() => {
      expect(globalThis.location.search).toBe("?aaa=1");
    });
  });

  it("saves, applies and deletes a preset", async () => {
    stubFetch();
    await renderApp();
    await userEvent.keyboard("a"); // triple-A on
    await userEvent.type(screen.getByLabelText("Preset name"), "Mine{Enter}");

    expect(screen.getByRole("button", { name: "Mine" })).toBeInTheDocument();
    expect(globalThis.localStorage.getItem("awesome-mcp-explorer:presets")).toContain(
      "aaa=1",
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete preset Mine" }));
    expect(screen.queryByRole("button", { name: "Mine" })).not.toBeInTheDocument();
  });
});

describe("App actions", () => {
  it("copies the current URL", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    stubFetch();
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith(globalThis.location.href);
  });

  it("exports the filtered set", async () => {
    // Spy on the anchor's click, not on document.createElement: React needs the
    // real createElement to render at all.
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const createObjectURL = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    stubFetch();
    await renderApp();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /Export/ }),
      "json",
    );
    expect(click).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
});
