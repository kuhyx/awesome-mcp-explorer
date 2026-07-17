import { describe, expect, it } from "vitest";

import type { GithubFacts, Server } from "./server.ts";

import { computeFacets, pushedValues, starValues, ungradedCount } from "./facets.ts";

function facts(over: Partial<GithubFacts> = {}): GithubFacts {
  return {
    archived: false,
    createdAt: "2024-01-01T00:00:00Z",
    forks: 0,
    isFoss: "yes",
    pushedAt: "2026-07-01T00:00:00Z",
    spdx: "MIT",
    stars: 10,
    ...over,
  };
}

function server(over: Partial<Server> = {}): Server {
  return {
    badgeUrl: null,
    categories: ["Databases"],
    cost: { source: "inferred", value: "unknown" },
    description: "A server.",
    gh: facts(),
    glama: { license: "A", maintenance: "A", quality: "A" },
    id: "a/b",
    languages: ["typescript"],
    official: false,
    os: ["linux"],
    owner: "a",
    rateLimited: { source: "inferred", value: "unknown" },
    repo: "b",
    scope: ["cloud"],
    url: "https://github.com/a/b",
    ...over,
  };
}

describe("computeFacets", () => {
  it("counts an empty set as nothing", () => {
    const facets = computeFacets([]);
    expect(facets.official).toBe(0);
    expect(facets.tripleA).toBe(0);
    expect(facets.languages.size).toBe(0);
  });

  it("tallies multi-valued fields once per value", () => {
    const facets = computeFacets([
      server({ id: "a/1", languages: ["typescript", "python"] }),
      server({ id: "a/2", languages: ["python"] }),
    ]);
    expect(facets.languages.get("python")).toBe(2);
    expect(facets.languages.get("typescript")).toBe(1);
  });

  it("counts a monorepo in each of its categories", () => {
    const facets = computeFacets([server({ categories: ["Databases", "Search"] })]);
    expect(facets.categories.get("Databases")).toBe(1);
    expect(facets.categories.get("Search")).toBe(1);
  });

  it("counts official and triple-A", () => {
    const facets = computeFacets([
      server({ id: "a/1", official: true }),
      server({ glama: { license: "A", maintenance: "A", quality: "B" }, id: "a/2" }),
      server({ glama: null, id: "a/3" }),
    ]);
    expect(facets.official).toBe(1);
    expect(facets.tripleA).toBe(1);
  });

  it("counts grade coverage in three buckets", () => {
    const facets = computeFacets([
      server({ id: "a/1" }),
      server({ glama: { license: "A", maintenance: "C" }, id: "a/2" }),
      server({ glama: null, id: "a/3" }),
    ]);
    expect(facets.gradeCoverage.get("graded-all")).toBe(1);
    expect(facets.gradeCoverage.get("graded-partial")).toBe(1);
    expect(facets.gradeCoverage.get("not-indexed")).toBe(1);
  });

  it("counts cost and rate-limit values", () => {
    const facets = computeFacets([
      server({ cost: { source: "inferred", value: "likely-free" }, id: "a/1" }),
      server({ id: "a/2", rateLimited: { source: "override", value: "yes" } }),
    ]);
    expect(facets.cost.get("likely-free")).toBe(1);
    expect(facets.cost.get("unknown")).toBe(1);
    expect(facets.rateLimited.get("yes")).toBe(1);
  });

  it("excludes a repo with no github data from the foss tally", () => {
    // "GitHub could not read this repo" is not a licence answer, and must not
    // be folded into the "unknown licence" bucket.
    const facets = computeFacets([
      server({ id: "a/1" }),
      server({ gh: null, id: "a/2" }),
    ]);
    expect(facets.foss.get("yes")).toBe(1);
    expect(facets.foss.get("unknown")).toBeUndefined();
  });

  it("tallies scope and os", () => {
    const facets = computeFacets([
      server({ id: "a/1", os: ["linux", "macos"], scope: ["local", "cloud"] }),
    ]);
    expect(facets.scope.get("local")).toBe(1);
    expect(facets.scope.get("cloud")).toBe(1);
    expect(facets.os.get("macos")).toBe(1);
  });
});

describe("starValues", () => {
  it("returns ascending stars", () => {
    const values = starValues([
      server({ gh: facts({ stars: 50 }), id: "a/1" }),
      server({ gh: facts({ stars: 5 }), id: "a/2" }),
    ]);
    expect(values).toEqual([5, 50]);
  });

  it("omits repos with no github data rather than counting them as zero", () => {
    // Counting a deleted repo as 0 stars would drag the median down and make
    // the quantile slider misrepresent the distribution.
    expect(starValues([server({ gh: null })])).toEqual([]);
  });

  it("returns nothing for an empty set", () => {
    expect(starValues([])).toEqual([]);
  });
});

describe("pushedValues", () => {
  it("returns ascending timestamps", () => {
    const values = pushedValues([
      server({ gh: facts({ pushedAt: "2026-07-01T00:00:00Z" }), id: "a/1" }),
      server({ gh: facts({ pushedAt: "2020-01-01T00:00:00Z" }), id: "a/2" }),
    ]);
    expect(values).toEqual([
      Date.parse("2020-01-01T00:00:00Z"),
      Date.parse("2026-07-01T00:00:00Z"),
    ]);
  });

  it("omits repos with no github data", () => {
    expect(pushedValues([server({ gh: null })])).toEqual([]);
  });

  it("omits an unparseable date rather than emitting NaN", () => {
    expect(pushedValues([server({ gh: facts({ pushedAt: "" }) })])).toEqual([]);
  });
});

describe("ungradedCount", () => {
  it("counts servers Glama has not indexed", () => {
    expect(
      ungradedCount([
        server({ id: "a/1" }),
        server({ glama: null, id: "a/2" }),
        server({ glama: {}, id: "a/3" }),
      ]),
    ).toBe(2);
  });

  it("does not count a partially graded server as ungraded", () => {
    expect(ungradedCount([server({ glama: { license: "A" } })])).toBe(0);
  });
});
