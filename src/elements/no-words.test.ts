/**
 * Textgate guard over every runtime state the explorer can be driven into:
 * whatever the element patches in must stay free of chrome words too.
 */
import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SERVERS } from "../test/fixtures.ts";
import { insertHome, mountHome, stubServers } from "../test/mount.ts";
import { visibleWords } from "../test/visible-words.ts";

function strayWords(): readonly string[] {
  const report = visibleWords(document.body);
  expect(report.inspected).toBeGreaterThan(50);
  return report.words;
}

function click(selector: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`no ${selector}`);
  element.click();
}

beforeEach(() => {
  globalThis.history.replaceState(null, "", "/");
  globalThis.localStorage.clear();
  stubServers(SERVERS);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("no chrome words in any runtime state", () => {
  it("default view, with ages made relative", async () => {
    await mountHome();
    expect(document.querySelector("time.row-age")?.textContent).not.toMatch(/^\d{4}-/);
    expect(strayWords()).toEqual([]);
  });

  it("filters, grade minimum, ungraded warning, reset badge and ascending sort", async () => {
    await mountHome();
    click('button.tri[data-option="cloud"]');
    click('[data-action="sort-dir"]');
    click('[data-sort-key="name"]');
    const axis = document.querySelector<HTMLSelectElement>('[data-axis="quality"]')!;
    axis.value = "B";
    fireEvent.change(axis);
    axis.value = "";
    fireEvent.change(axis);
    click('[data-coverage="not-indexed"]');
    expect(document.querySelector("[data-ungraded]")).not.toHaveAttribute("hidden");
    expect(document.querySelector('[data-action="reset"]')).not.toHaveAttribute("hidden");
    expect(strayWords()).toEqual([]);
  });

  it("empty result", async () => {
    await mountHome();
    const input = document.querySelector<HTMLInputElement>("[data-search]")!;
    input.value = "zzz-no-match";
    fireEvent.input(input);
    expect(document.querySelector("[data-empty]")).not.toHaveAttribute("hidden");
    expect(strayWords()).toEqual([]);
  });

  it("help open", async () => {
    await mountHome();
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
    expect(document.querySelector("[data-help]")).not.toHaveAttribute("hidden");
    expect(strayWords()).toEqual([]);
  });

  it("copy-link feedback and a saved preset under its typed name", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
    await mountHome();
    click('[data-action="copy"]');
    const name = document.querySelector<HTMLInputElement>("[data-preset-name]")!;
    name.value = "Mine";
    fireEvent.input(name);
    fireEvent.submit(document.querySelector("[data-preset-form]")!);
    expect(document.querySelector("[data-saved]")?.textContent).toContain("Mine");
    expect(strayWords()).toEqual([]);
  });

  it("servers.json failed to load", async () => {
    vi.spyOn(console, "error").mockReturnValue();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    insertHome();
    await waitFor(() => {
      expect(document.querySelector("[data-error]")).not.toHaveAttribute("hidden");
    });
    expect(strayWords()).toEqual([]);
  });
});
