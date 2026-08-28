import { describe, expect, it } from "vitest";

import type { Grades } from "./grade.ts";

import {
  compositeRank,
  gradeCoverage,
  gradeRank,
  isAtLeast,
  isTripleA,
} from "./grade.ts";

const grades = (over: Grades = {}): Grades => {
	return {
	  license: "A",
	  maintenance: "A",
	  quality: "A",
	  ...over,
	};
};

describe("gradeRank", () => {
  it("ranks A best and F worst", () => {
    expect(gradeRank("A")).toBe(0);
    expect(gradeRank("F")).toBe(4);
  });

  it("orders the whole scale", () => {
    const ranks = (["A", "B", "C", "D", "F"] as const).map((g) => gradeRank(g));
    expect(ranks).toEqual(ranks.toSorted((a, b) => a - b));
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
  it("accepts all three axes A", () => {
    expect(isTripleA(grades())).toBe(true);
  });

  it("rejects B on any axis", () => {
    expect(isTripleA(grades({ quality: "B" }))).toBe(false);
  });

  it("rejects a partially graded server", () => {
    // An ungraded axis is unknown, not an A: sooperset/mcp-atlassian has
    // license=A and maintenance=C with quality never graded, and must not
    // sneak into a triple-A filter.
    expect(isTripleA({ license: "A", quality: "A" })).toBe(false);
  });

  it("rejects an ungraded server", () => {
    expect(isTripleA({})).toBe(false);
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
    // The real sooperset/mcp-atlassian shape: a dash in the quality slot.
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
    // A=0, A=0, B=1 -> 1/3
    expect(compositeRank(grades({ quality: "B" }))).toBeCloseTo(1 / 3);
  });

  it("averages only the axes that are graded", () => {
    // A=0, C=2, quality ungraded -> mean(0, 2) = 1
    expect(compositeRank({ license: "A", maintenance: "C" })).toBe(1);
  });

  it("ranks a triple-A server better than a mixed one", () => {
    const best = compositeRank(grades());
    const mixed = compositeRank(grades({ quality: "B" }));
    expect(best).not.toBeNull();
    expect(mixed).not.toBeNull();
    expect(best!).toBeLessThan(mixed!);
  });
});
