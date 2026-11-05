import { describe, expect, it } from "vitest";

import type { TriSelect } from "./filter-sort.ts";

import { cycle, stateOf, summarize } from "./tri-state.ts";

type Lang = "go" | "python" | "rust";
const empty: TriSelect<Lang> = { excludes: [], includes: [] };

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
    expect(cycle(b, "rust")).toEqual(empty);
  });

  it("leaves other options alone", () => {
    const value: TriSelect<Lang> = { excludes: ["go"], includes: ["python"] };
    expect(cycle(value, "rust")).toEqual({ excludes: ["go"], includes: ["python", "rust"] });
  });
});

describe("summarize", () => {
  const upper = (option: string): string => option.toUpperCase();

  it("says Any when neutral", () => {
    expect(summarize(empty, upper)).toBe("Any");
  });

  it("lists includes, then excludes", () => {
    expect(summarize({ excludes: ["go"], includes: ["rust", "python"] }, upper)).toBe(
      "RUST, PYTHON · not GO",
    );
    expect(summarize({ excludes: ["go"], includes: [] }, upper)).toBe("not GO");
  });
});
