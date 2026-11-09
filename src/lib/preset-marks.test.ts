import { describe, expect, it } from "vitest";

import { presetMarks } from "./preset-marks.ts";
import { BUILTIN_PRESETS } from "./presets.ts";

const glyphs = (search: string): string[] =>
  presetMarks(search).map(({ mark }) => ("glyph" in mark ? mark.glyph : mark.icon));

describe("presetMarks", () => {
  it("shows AAA for Triple-A", () => {
    expect(glyphs("aaa=1")).toEqual(["AAA"]);
  });

  it("composes a facet icon with its option for a language preset", () => {
    expect(glyphs("lang=rust")).toEqual(["code", "Rust"]);
  });

  it("strikes excluded options and shows the generated cost value as its glyph", () => {
    expect(presetMarks("scope=local,!cloud")).toEqual([
      { isExcluded: false, mark: { icon: "pin" } },
      { isExcluded: false, mark: { glyph: "local" } },
      { isExcluded: true, mark: { glyph: "cloud" } },
    ]);
    expect(glyphs("cost=likely-free,unknown")).toEqual(["coin", "0", "?"]);
  });

  it("shows official, the struck archive icon and a non-default sort", () => {
    expect(presetMarks("official=1")).toEqual([{ isExcluded: false, mark: { glyph: "🎖️" } }]);
    expect(presetMarks("live=1&sort=pushed")).toEqual([
      { isExcluded: true, mark: { icon: "archive" } },
      { isExcluded: false, mark: { icon: "clock" } },
      { isExcluded: false, mark: { glyph: "↓" } },
    ]);
    expect(glyphs("sort=name&dir=asc")).toEqual(["A–Z", "↑"]);
  });

  it("skips a value the page has no option for", () => {
    expect(glyphs("lang=cobol")).toEqual([]);
    expect(glyphs("cat=x")).toEqual([]);
  });

  it("gives every built-in preset at least one mark", () => {
    for (const preset of BUILTIN_PRESETS) {
      expect(presetMarks(preset.search).length, preset.name).toBeGreaterThan(0);
    }
  });
});
