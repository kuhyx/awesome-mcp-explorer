import { describe, expect, it } from "vitest";

import type { Grades } from "./grade.ts";

import {
  compositeRank,
  gradeCoverage,
  gradeRank,
  isABand,
  isAtLeast,
  isTripleA,
} from "./grade.ts";

const grades = (over: Grades = {}): Grades => ({
  license: "A",
  maintenance: "A",
  quality: "A",
  ...over,
});

describe("gradeRank", () => {
  it("ranks A best and F worst", () => {
    expect(gradeRank("A")).toBe(0);
    expect(gradeRank("F")).toBe(7);
  });

  it("ranks a modifier below its bare letter", () => {
    expect(gradeRank("A")).toBeLessThan(gradeRank("A-"));
    expect(gradeRank("A-")).toBeLessThan(gradeRank("B"));
  });
});

describe("isAtLeast", () => {
  it("accepts a better or equal grade", () => {
    expect(isAtLeast("A", "B")).toBe(true);
    expect(isAtLeast("B", "B")).toBe(true);
  });

  it("rejects a worse grade", () => {
    expect(isAtLeast("C", "B")).toBe(false);
  });
});

describe("isTripleA", () => {
  it("accepts all three axes exactly A", () => {
    expect(isTripleA(grades())).toBe(true);
  });

  it("rejects A- on any axis", () => {
    expect(isTripleA(grades({ quality: "A-" }))).toBe(false);
  });

  it("rejects a partially graded server", () => {
    expect(isTripleA({ license: "A", quality: "A" })).toBe(false);
  });

  it("rejects an ungraded server", () => {
    expect(isTripleA({})).toBe(false);
  });
});

describe("isABand", () => {
  it("accepts a mix of A and A-", () => {
    expect(isABand(grades({ maintenance: "A-", quality: "A-" }))).toBe(true);
  });

  it("rejects B", () => {
    expect(isABand(grades({ quality: "B" }))).toBe(false);
  });

  it("rejects a partially graded server", () => {
    expect(isABand({ license: "A" })).toBe(false);
  });
});

describe("gradeCoverage", () => {
  it("reports not-indexed for null", () => {
    expect(gradeCoverage(null)).toBe("not-indexed");
  });

  it("reports not-indexed for an empty grade set", () => {
    expect(gradeCoverage({})).toBe("not-indexed");
  });

  it("reports graded-partial when an axis is missing", () => {
    // mcp-atlassian is the real-world case: license + maintenance, no quality.
    expect(gradeCoverage({ license: "A", maintenance: "C" })).toBe(
      "graded-partial",
    );
  });

  it("reports graded-all when every axis is present", () => {
    expect(gradeCoverage(grades())).toBe("graded-all");
  });
});

describe("compositeRank", () => {
  it("returns null for an ungraded server rather than sorting it as worst", () => {
    expect(compositeRank(null)).toBeNull();
    expect(compositeRank({})).toBeNull();
  });

  it("averages the ranks of graded axes", () => {
    // A=0, B=2 -> mean of (0, 0, 2) = 0.666...
    expect(compositeRank(grades({ quality: "B" }))).toBeCloseTo(2 / 3);
  });

  it("averages only the axes that are graded", () => {
    expect(compositeRank({ license: "A", maintenance: "C" })).toBe(2);
  });

  it("ranks a triple-A server better than a mixed one", () => {
    const best = compositeRank(grades());
    const mixed = compositeRank(grades({ quality: "B" }));
    expect(best).not.toBeNull();
    expect(mixed).not.toBeNull();
    expect(best!).toBeLessThan(mixed!);
  });
});
