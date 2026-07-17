import { describe, expect, it } from "vitest";

import { elementAt } from "./array.ts";

describe("elementAt", () => {
  it("reads a value", () => {
    expect(elementAt(["a", "b"], 1)).toBe("b");
  });

  it("throws rather than returning undefined for a bad index", () => {
    expect(() => elementAt(["a"], 5)).toThrow(RangeError);
    expect(() => elementAt([], 0)).toThrow(/index 0 out of range/);
  });
});
