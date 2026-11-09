import type { RangeSliderElement } from "@kuhyx/web-ui/range-slider";

import { fireEvent, screen, waitFor, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SERVERS } from "../test/fixtures.ts";
import { insertHome, mountHome, stubServers } from "../test/mount.ts";

const DEFAULT_ORDER = [
  "acme/ddd-server",
  "acme/ccc-server",
  "acme/aaa-server",
  "acme/bbb-server",
  "acme/eee-server",
];

function visibleIds(): string[] {
  return [...document.querySelectorAll<HTMLElement>(".row:not([hidden])")].map(
    (row) => row.dataset.id ?? "",
  );
}

function status(): string {
  return document.querySelector(".count")?.textContent.trim() ?? "";
}

function search(): string {
  return globalThis.location.search;
}

function tri(name: string): HTMLButtonElement {
  return screen.getByRole("button", { name });
}

function aaa(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-action="toggle-aaa"]')!;
}

function slider(label: string): RangeSliderElement {
  const element = document.querySelector<RangeSliderElement>(`range-slider[label="${CSS.escape(label)}"]`);
  if (element === null) throw new Error(`no ${label} slider`);
  return element;
}

beforeEach(() => {
  globalThis.history.replaceState(null, "", "/");
  globalThis.localStorage.clear();
  stubServers(SERVERS);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hydration", () => {
  it("keeps the prerendered rows in default order and shows the full count", async () => {
    await mountHome();
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
    expect(status()).toBe("5 / 5");
  });

  it("replaces printed dates with ages relative to page load", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-04T00:00:00Z"));
    await mountHome();
    vi.useRealTimers();
    const ages = [...document.querySelectorAll("time.row-age")].map((t) => t.textContent);
    expect(ages).toContain("3d");
    expect(ages.every((age) => /^\d+(d|mo|y)$/.test(age))).toBe(true);
  });

  it("restores every filter and the sort from the URL, and shows them in the controls", async () => {
    globalThis.history.replaceState(
      null,
      "",
      "/?aaa=1&q=aaa&lang=typescript,!rust&sort=name&dir=asc&min=quality:A",
    );
    await mountHome();
    expect(visibleIds()).toEqual(["acme/aaa-server"]);
    expect(status()).toBe("1 / 5");
    expect(document.querySelector<HTMLInputElement>("[data-search]")?.value).toBe("aaa");
    expect(aaa()).toHaveAttribute("aria-pressed", "true");
    expect(tri("TS/JS: include")).toHaveAttribute("aria-pressed", "true");
    expect(tri("Rust: exclude")).toBeInTheDocument();
    expect(document.querySelector('[data-sort-key="name"]')).toHaveAttribute("aria-pressed", "true");
    expect(tri("Sort ascending")).toHaveTextContent("↑");
    expect(document.querySelector<HTMLSelectElement>('[data-axis="quality"]')?.value).toBe("A");
    const summary = document.querySelector('[data-facet="languages"] .facet-summary');
    expect(summary).toHaveAttribute("aria-label", "TS/JS · not Rust");
    expect(summary).toHaveTextContent("✓1 ✕1");
  });

  it("restores a stars bound onto the slider", async () => {
    globalThis.history.replaceState(null, "", "/?minStars=500&maxStars=1500");
    await mountHome();
    expect(visibleIds()).toEqual(["acme/ccc-server", "acme/aaa-server"]);
    expect(slider("Stars").getAttribute("lo")).toBe("500");
    expect(slider("Stars").getAttribute("hi")).toBe("1500");
  });

  it("gives the sliders their distributions and readouts", async () => {
    await mountHome();
    expect(slider("Stars").values).toEqual([50, 500, 1500, 12_000]);
    expect(slider("Stars").querySelector(".slider-value")).toHaveTextContent("50 – 12k");
    expect(slider("Last push").values).toHaveLength(4);
    expect(slider("Last push").querySelector(".slider-value")).toHaveTextContent("2025-01 – 2026-07");
  });
});

describe("a URL naming a value the page has no button for", () => {
  it("still filters and summarises it", async () => {
    globalThis.history.replaceState(null, "", "/?cat=Nonexistent");
    await mountHome();
    expect(visibleIds()).toEqual([]);
    expect(document.querySelector('[data-facet="categories"] .facet-summary')).toHaveAttribute(
      "aria-label",
      "Nonexistent",
    );
  });
});

describe("search", () => {
  it("filters as you type, writes the URL, and restores on clear", async () => {
    const user = userEvent.setup();
    await mountHome();
    const box = screen.getByRole("searchbox", { name: "Search servers" });
    await user.type(box, "bbb");
    expect(visibleIds()).toEqual(["acme/bbb-server"]);
    expect(search()).toBe("?q=bbb");
    await user.clear(box);
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
    expect(search()).toBe("");
  });

  it("shows the empty message when nothing matches", async () => {
    const user = userEvent.setup();
    await mountHome();
    await user.type(screen.getByRole("searchbox"), "zzzzqqq");
    expect(visibleIds()).toEqual([]);
    const empty = screen.getByLabelText("No servers match these filters");
    expect(empty).toBeVisible();
    expect(empty).toHaveTextContent("");
    await user.clear(screen.getByRole("searchbox"));
    expect(empty).not.toBeVisible();
  });
});

describe("tri-state facets", () => {
  it("cycles off -> include -> exclude -> off and keeps counts in step", async () => {
    const user = userEvent.setup();
    await mountHome();
    await user.click(tri("Rust: off"));
    expect(visibleIds()).toEqual(["acme/bbb-server"]);
    expect(search()).toBe("?lang=rust");
    expect(document.querySelector('[data-facet="languages"] .facet-summary')).toHaveAttribute("aria-label", "Rust");

    await user.click(tri("Rust: include"));
    expect(visibleIds()).toEqual(DEFAULT_ORDER.filter((id) => id !== "acme/bbb-server"));
    expect(search()).toBe("?lang=!rust");

    await user.click(tri("Rust: exclude"));
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
    expect(search()).toBe("");
  });

  it("counts reflect the current results, and an empty option is disabled", async () => {
    const user = userEvent.setup();
    await mountHome();
    expect(tri("Rust: off").querySelector(".tri-count")).toHaveTextContent("1");
    await user.click(aaa());
    expect(tri("Rust: off").querySelector(".tri-count")).toHaveTextContent("0");
    expect(tri("Rust: off")).toBeDisabled();
    expect(tri("TS/JS: off").querySelector(".tri-count")).toHaveTextContent("1");
    expect(aaa()).toHaveAttribute("aria-pressed", "true");
  });

  it("filters by category through the data-driven picker", async () => {
    const user = userEvent.setup();
    await mountHome();
    await user.click(tri("Search & Data Extraction: off"));
    expect(visibleIds()).toEqual(["acme/ddd-server", "acme/ccc-server"]);
  });
});

describe("provenance and grade controls", () => {
  it("toggles official and hide-archived", async () => {
    const user = userEvent.setup();
    await mountHome();
    await user.click(screen.getByRole("button", { name: /Official only/ }));
    expect(visibleIds()).toEqual(["acme/ddd-server"]);
    expect(search()).toBe("?official=1");
    await user.click(screen.getByRole("button", { name: /Official only/ }));
    await user.click(screen.getByRole("button", { name: "Hide archived" }));
    expect(visibleIds()).not.toContain("acme/ddd-server");
    expect(search()).toBe("?live=1");
  });

  it("sets and clears a minimum grade per axis", async () => {
    const user = userEvent.setup();
    await mountHome();
    const maintenance = document.querySelector<HTMLSelectElement>('[data-axis="maintenance"]');
    const quality = document.querySelector<HTMLSelectElement>('[data-axis="quality"]');
    if (maintenance === null || quality === null) throw new Error("no selects");
    await user.selectOptions(maintenance, "A");
    expect(visibleIds()).toEqual(["acme/aaa-server"]);
    await user.selectOptions(quality, "A");
    expect(search()).toBe("?min=quality:A,maintenance:A");
    await user.selectOptions(maintenance, "");
    expect(search()).toBe("?min=quality:A");
    expect(maintenance.value).toBe("");
  });

  it("toggles a coverage chip and warns about ungraded servers it cannot speak for", async () => {
    const user = userEvent.setup();
    await mountHome();
    const warning = document.querySelector<HTMLElement>("[data-ungraded]");
    expect(warning).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: /Not on Glama/ }));
    expect(visibleIds()).toEqual(["acme/ccc-server", "acme/eee-server"]);
    expect(warning).toBeVisible();
    expect(warning).toHaveTextContent("2");
    expect(warning).toHaveAttribute("aria-label", "2 matching without a Glama grade");
    await user.type(screen.getByRole("searchbox"), "eee-");
    expect(warning).toHaveTextContent("1");
    await user.click(screen.getByRole("button", { name: /Not on Glama/ }));
    expect(warning).not.toBeVisible();
  });
});

describe("sorting", () => {
  it("changes the sort key and reorders the rows", async () => {
    const user = userEvent.setup();
    await mountHome();
    await user.click(document.querySelector('[data-sort-key="name"]')!);
    expect(visibleIds()).toEqual([
      "acme/eee-server",
      "acme/ddd-server",
      "acme/ccc-server",
      "acme/bbb-server",
      "acme/aaa-server",
    ]);
    expect(search()).toBe("?sort=name");
    expect(document.querySelector('[data-sort-key="name"]')).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector('[data-sort-key="stars"]')).toHaveAttribute("aria-pressed", "false");
  });

  it("flips the direction", async () => {
    const user = userEvent.setup();
    await mountHome();
    await user.click(tri("Sort descending"));
    expect(visibleIds()).toEqual([
      "acme/bbb-server",
      "acme/aaa-server",
      "acme/ccc-server",
      "acme/ddd-server",
      "acme/eee-server",
    ]);
    expect(tri("Sort ascending")).toHaveTextContent("↑");
    await user.click(tri("Sort ascending"));
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
  });
});

describe("reset, copy link and export", () => {
  it("offers Reset only while a filter is active and clears everything", async () => {
    const user = userEvent.setup();
    await mountHome();
    const reset = document.querySelector<HTMLElement>('[data-action="reset"]');
    expect(reset).not.toBeVisible();
    await user.click(tri("Rust: off"));
    expect(reset).toBeVisible();
    expect(reset).toHaveTextContent("1");
    await user.click(tri("Rust: include"));
    await user.click(screen.getByRole("button", { name: "Official only" }));
    expect(reset).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
    expect(search()).toBe("");
    expect(reset).not.toBeVisible();
  });

  it("copies the current address", async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText");
    await mountHome();
    await user.click(tri("Rust: off"));
    const copy = screen.getByRole("button", { name: "Copy link" });
    await user.click(copy);
    expect(write).toHaveBeenCalledWith(expect.stringContaining("?lang=rust"));
    expect(copy).toHaveAttribute("data-copied");
  });

  it("exports the current results as a download", async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob): string => {
        blobs.push(blob);
        return "blob:fake";
      },
      revokeObjectURL: vi.fn(),
    });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    await mountHome();
    await user.click(tri("Rust: off"));
    const menu = screen.getByLabelText("Export");
    await user.selectOptions(menu, "csv");
    expect(downloads).toEqual(["mcp-servers.csv"]);
    expect(blobs[0]?.type).toBe("text/csv");
    expect(await blobs[0]?.text()).toContain("acme/bbb-server");
    expect(await blobs[0]?.text()).not.toContain("acme/aaa-server");
    expect(menu).toHaveValue("");
    await user.selectOptions(menu, "");
    expect(downloads).toHaveLength(1);
  });
});

describe("range sliders", () => {
  it("stars: stepping a thumb sets a bound, returning to the edge clears it", async () => {
    const user = userEvent.setup();
    await mountHome();
    const low = screen.getByRole("slider", { name: "Stars minimum" });
    await user.click(low);
    low.focus();
    await user.keyboard("{ArrowRight}");
    expect(search()).toBe("?minStars=500");
    expect(visibleIds()).toEqual(["acme/ddd-server", "acme/ccc-server", "acme/aaa-server"]);
    await user.keyboard("{ArrowLeft}");
    expect(search()).toBe("");
    expect(slider("Stars").hasAttribute("lo")).toBe(false);

    const high = screen.getByRole("slider", { name: "Stars maximum" });
    high.focus();
    await user.keyboard("{ArrowLeft}");
    expect(search()).toBe("?maxStars=1500");
    expect(slider("Stars").getAttribute("hi")).toBe("1500");
    await user.keyboard("{ArrowRight}");
    expect(search()).toBe("");
  });

  it("last push: the low thumb filters, the high thumb snaps back", async () => {
    const user = userEvent.setup();
    await mountHome();
    const low = screen.getByRole("slider", { name: "Last push minimum" });
    low.focus();
    await user.keyboard("{End}");
    expect(search()).toMatch(/^\?since=\d+$/);
    expect(visibleIds().length).toBeLessThan(5);
    await user.keyboard("{Home}");
    expect(search()).toBe("");

    const high = screen.getByRole("slider", { name: "Last push maximum" });
    high.focus();
    await user.keyboard("{ArrowLeft}");
    expect(search()).toBe("");
    expect(slider("Last push").hasAttribute("hi")).toBe(false);
  });

  it("ignores a bubbling change that is not from a slider", async () => {
    await mountHome();
    const box = screen.getByRole("searchbox");
    box.dispatchEvent(
      new CustomEvent("change", { bubbles: true, detail: { hi: 1, lo: 1 } }),
    );
    expect(search()).toBe("");
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
  });

  it("does not read a checkbox-style native change as a range", async () => {
    await mountHome();
    fireEvent.change(document.querySelector<HTMLSelectElement>('[data-axis="license"]') as HTMLElement);
    expect(search()).toBe("");
  });
});

describe("presets", () => {
  it("applies a built-in preset, filter and sort together", async () => {
    const user = userEvent.setup();
    await mountHome();
    await user.click(screen.getByRole("button", { name: "Actively maintained" }));
    expect(search()).toBe("?live=1&sort=pushed");
    expect(visibleIds()).not.toContain("acme/ddd-server");
    expect(document.querySelector('[data-sort-key="pushed"]')).toHaveAttribute("aria-pressed", "true");
  });

  it("saves the current view, persists it, applies it and deletes it", async () => {
    const user = userEvent.setup();
    await mountHome();
    const save = screen.getByRole("button", { name: "Save current as preset" });
    expect(save).toBeDisabled();

    await user.click(tri("Rust: off"));
    await user.type(screen.getByLabelText("Preset name"), "  My rust  ");
    expect(save).toBeEnabled();
    await user.click(save);
    expect(screen.getByLabelText("Preset name")).toHaveValue("");
    expect(save).toBeDisabled();
    const saved = screen.getByRole("button", { name: "My rust" });
    expect(saved).toHaveClass("on");
    expect(globalThis.localStorage.getItem("awesome-mcp-explorer:presets")).toContain("My rust");

    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
    await user.click(saved);
    expect(visibleIds()).toEqual(["acme/bbb-server"]);

    await user.click(screen.getByRole("button", { name: "Delete preset My rust" }));
    expect(screen.queryByRole("button", { name: "My rust" })).not.toBeInTheDocument();
    expect(globalThis.localStorage.getItem("awesome-mcp-explorer:presets")).toBe("[]");
  });

  it("restores saved presets on the next visit", async () => {
    globalThis.localStorage.setItem(
      "awesome-mcp-explorer:presets",
      JSON.stringify([{ name: "Kept", search: "aaa=1" }]),
    );
    await mountHome();
    expect(screen.getByRole("button", { name: "Kept" })).toBeInTheDocument();
  });

  it("ignores submitting a blank name", async () => {
    await mountHome();
    const form = document.querySelector<HTMLFormElement>("[data-preset-form]");
    if (form === null) throw new Error("no form");
    fireEvent.submit(form);
    expect(globalThis.localStorage.getItem("awesome-mcp-explorer:presets")).toBeNull();
  });
});

describe("keyboard", () => {
  it("/ focuses search, a toggles Triple-A, ? and Esc drive the help", async () => {
    const user = userEvent.setup();
    await mountHome();
    const help = document.querySelector<HTMLElement>("[data-help]");
    expect(help).not.toBeVisible();

    await user.keyboard("/");
    expect(screen.getByRole("searchbox")).toHaveFocus();
    await user.keyboard("a");
    expect(screen.getByRole("searchbox")).toHaveValue("a");
    expect(search()).toBe("?q=a");

    await user.keyboard("{Escape}");
    expect(screen.getByRole("searchbox")).not.toHaveFocus();
    await user.clear(screen.getByRole("searchbox"));
    (document.activeElement as HTMLElement).blur();

    await user.keyboard("a");
    expect(search()).toBe("?aaa=1");
    await user.keyboard("a");
    expect(search()).toBe("");

    await user.keyboard("?");
    expect(help).toBeVisible();
    expect(within(help!).getByLabelText("focus search")).toBeVisible();
    await user.keyboard("?");
    expect(help).not.toBeVisible();
    await user.keyboard("?");
    await user.keyboard("{Escape}");
    expect(help).not.toBeVisible();
  });

  it("stops listening when the element leaves the page", async () => {
    const user = userEvent.setup();
    const explorer = await mountHome();
    explorer.remove();
    await user.keyboard("a");
    expect(search()).toBe("");
  });
});

describe("history", () => {
  it("follows Back/Forward by re-reading the URL", async () => {
    await mountHome();
    globalThis.history.replaceState(null, "", "/?lang=rust");
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
    expect(visibleIds()).toEqual(["acme/bbb-server"]);
    expect(tri("Rust: include")).toBeInTheDocument();
    globalThis.history.replaceState(null, "", "/");
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
  });

  it("stops following history once removed", async () => {
    const explorer = await mountHome();
    explorer.remove();
    globalThis.history.replaceState(null, "", "/?lang=rust");
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
    expect(explorer.querySelectorAll(".row:not([hidden])")).toHaveLength(5);
  });
});

describe("clicks that are not controls", () => {
  it("ignores text, slider thumbs and unlabelled buttons", async () => {
    const user = userEvent.setup();
    await mountHome();
    await user.click(document.querySelector(".count")!);
    await user.click(screen.getByRole("slider", { name: "Stars minimum" }));
    expect(search()).toBe("");
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
  });
});

describe("before the data arrives", () => {
  function deferFetch(): (value: unknown) => void {
    let resolve: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      () => {
        return new Promise<Response>((done) => {
          resolve = (value: unknown): void => {
            done(Response.json(value));
          };
        });
      },
    );
    return (value: unknown): void => {
      resolve(value);
    };
  }

  it("keeps the printed list, records interaction in the URL, then applies it", async () => {
    const user = userEvent.setup();
    const finish = deferFetch();
    insertHome();
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
    await user.click(aaa());
    expect(search()).toBe("?aaa=1");
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
    finish(SERVERS);
    await waitFor(() => {
      expect(visibleIds()).toEqual(["acme/aaa-server"]);
    });
  });

  it("does nothing if the element left the page before the data arrived", async () => {
    const finish = deferFetch();
    const explorer = insertHome();
    const sliderElement = slider("Stars");
    explorer.remove();
    finish(SERVERS);
    await new Promise((done) => setTimeout(done, 10));
    expect(sliderElement.values).toEqual([]);
  });
});

describe("when servers.json cannot be loaded", () => {
  it("shows the error icon, logs the detail, and leaves the printed rows alone", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("", { status: 500 })));
    insertHome();
    const logged = vi.spyOn(console, "error").mockReturnValue();
    const message = document.querySelector<HTMLElement>("[data-error]");
    await waitFor(() => {
      expect(message).toBeVisible();
    });
    expect(message).toHaveTextContent("servers.json: HTTP 500");
    expect(message?.querySelector("[data-error-detail]")).toHaveClass("sr-only");
    expect(message?.querySelector("svg[data-icon='error']")).toBeInTheDocument();
    expect(logged).toHaveBeenCalledWith("servers.json: HTTP 500");
    expect(visibleIds()).toEqual(DEFAULT_ORDER);
  });

  it("reports a file that is not a server list", async () => {
    stubServers({ nope: true });
    insertHome();
    await waitFor(() => {
      expect(document.querySelector("[data-error-detail]")).toHaveTextContent(
        "servers.json is not a list of servers",
      );
    });
  });
});
