import { describe, expect, it } from "vitest";

import { activeFilterCount } from "./active-count.ts";
import { DEFAULT_FILTER } from "./filter-sort.ts";

describe("activeFilterCount", () => {
  it("is zero for the default filter", () => {
    expect(activeFilterCount(DEFAULT_FILTER)).toBe(0);
  });

  it("counts every changed field once, however many values it holds", () => {
    const filter = {
      ...DEFAULT_FILTER,
      languages: { excludes: ["go" as const], includes: ["rust" as const, "python" as const] },
      official: true,
    };
    expect(activeFilterCount(filter)).toBe(2);
  });
});
