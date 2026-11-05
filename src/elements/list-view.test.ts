import { describe, expect, it } from "vitest";

import { fragmentOf } from "../test/html.ts";
import { ListView } from "./list-view.ts";

function ids(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>(".row:not([hidden])")].map(
    (row) => row.dataset.id ?? "",
  );
}

function build(): { root: HTMLElement; view: ListView } {
  const root = document.createElement("div");
  root.append(fragmentOf(`<div data-list>
    <p data-empty hidden></p>
    <article class="row" data-id="a"><time class="row-age" datetime="2026-07-01T00:00:00Z">2026-07-01</time></article>
    <article class="row" data-id="b"></article>
    <article class="row" data-id="c"></article>
  </div>`));
  return { root, view: new ListView(root) };
}

describe("ListView.show", () => {
  it("hides rows that are not wanted and keeps the order of the rest", () => {
    const { root, view } = build();
    view.show(["a", "c"]);
    expect(ids(root)).toEqual(["a", "c"]);
  });

  it("reorders to the result order", () => {
    const { root, view } = build();
    view.show(["c", "a", "b"]);
    expect(ids(root)).toEqual(["c", "a", "b"]);
  });

  it("brings hidden rows back", () => {
    const { root, view } = build();
    view.show(["b"]);
    view.show(["a", "b", "c"]);
    expect(ids(root)).toEqual(["a", "b", "c"]);
  });

  it("does not move nodes when only the set changed", () => {
    const { root, view } = build();
    const first = root.querySelector('[data-id="a"]');
    view.show(["a", "b"]);
    expect(root.querySelector("[data-list]")?.children[1]).toBe(first);
  });

  it("shows the empty message for no results, and ignores unknown ids", () => {
    const { root, view } = build();
    const empty = root.querySelector<HTMLElement>("[data-empty]");
    view.show([]);
    expect(empty?.hidden).toBe(false);
    view.show(["nope", "a"]);
    expect(empty?.hidden).toBe(true);
    expect(ids(root)).toEqual(["a"]);
  });

  it("scrolls back to the top when the view changes", () => {
    const { root, view } = build();
    const list = root.querySelector<HTMLElement>("[data-list]");
    if (list === null) throw new Error("no list");
    list.scrollTop = 40;
    view.show(["a"]);
    expect(list.scrollTop).toBe(0);
  });
});

describe("ListView.refreshAges", () => {
  it("swaps the printed date for an age relative to now", () => {
    const { root, view } = build();
    view.refreshAges(Date.parse("2026-07-04T00:00:00Z"));
    expect(root.querySelector("time")?.textContent).toBe("3d ago");
  });

  it("falls back to unknown for a row without a datetime", () => {
    const { root, view } = build();
    root.querySelector("time")?.removeAttribute("datetime");
    view.refreshAges(Date.now());
    expect(root.querySelector("time")?.textContent).toBe("unknown");
  });
});
