import { describe, expect, it } from "vitest";

import { EXPORT_FORMATS, FACETS, SORT_LABELS } from "./facet-defs.ts";

describe("facet definitions", () => {
  it("names every option of every tri-state facet", () => {
    for (const facet of FACETS) {
      expect(facet.options.length).toBeGreaterThan(0);
      for (const option of facet.options) expect(option.name).not.toBe("");
    }
    const language = FACETS.find((f) => f.key === "languages");
    expect(language?.options).toContainEqual({ name: "C/C++", value: "cpp" });
    const foss = FACETS.find((f) => f.key === "foss");
    expect(foss?.options.map((o) => o.name)).toEqual(["FOSS", "Not FOSS", "Unclear"]);
  });

  it("offers every sort key and export format", () => {
    expect(Object.keys(SORT_LABELS)).toHaveLength(6);
    expect(EXPORT_FORMATS.map((f) => f.format)).toEqual(["json", "csv", "markdown"]);
  });
});
