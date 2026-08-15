import { describe, expect, it } from "vitest";

import type { FilterState, SortState } from "./filter-sort.ts";
import type { GithubFacts, Server } from "./server.ts";

import {
  applyFilterSort,
  DEFAULT_FILTER,
  DEFAULT_SORT,
  isFilterActive,
  passesFilters,
  passesTri,
} from "./filter-sort.ts";

function facts(over: Partial<GithubFacts> = {}): GithubFacts {
  return {
    archived: false,
    createdAt: "2024-01-01T00:00:00Z",
    forks: 0,
    isFoss: "yes",
    pushedAt: "2026-07-01T00:00:00Z",
    spdx: "MIT",
    stars: 100,
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
    id: "acme/widget",
    languages: ["typescript"],
    official: false,
    os: ["linux"],
    owner: "acme",
    rateLimited: { source: "inferred", value: "unknown" },
    repo: "widget",
    scope: ["cloud"],
    url: "https://github.com/acme/widget",
    ...over,
  };
}

const filter = (over: Partial<FilterState> = {}): FilterState => ({
  ...DEFAULT_FILTER,
  ...over,
});
const sort = (over: Partial<SortState> = {}): SortState => ({
  ...DEFAULT_SORT,
  ...over,
});

describe("passesTri", () => {
  it("passes everything when neutral", () => {
    expect(passesTri(["a"], { excludes: [], includes: [] })).toBe(true);
  });

  it("requires an overlap with a non-empty allowlist", () => {
    expect(passesTri(["a"], { excludes: [], includes: ["a"] })).toBe(true);
    expect(passesTri(["b"], { excludes: [], includes: ["a"] })).toBe(false);
  });

  it("rejects any overlap with the denylist", () => {
    expect(passesTri(["a"], { excludes: ["a"], includes: [] })).toBe(false);
  });

  it("applies the denylist after the allowlist", () => {
    expect(passesTri(["a", "b"], { excludes: ["b"], includes: ["a"] })).toBe(false);
  });

  it("fails an allowlist but passes a denylist when the server has no values", () => {
    // Matches dufs-cloud's reading of extensionless files: nothing counts as
    // "not X", but cannot satisfy "must be X".
    expect(passesTri([], { excludes: [], includes: ["a"] })).toBe(false);
    expect(passesTri([], { excludes: ["a"], includes: [] })).toBe(true);
  });
});

describe("isFilterActive", () => {
  it("is false for the default", () => {
    expect(isFilterActive(DEFAULT_FILTER)).toBe(false);
  });

  it("is true once anything is set", () => {
    expect(isFilterActive(filter({ tripleA: true }))).toBe(true);
    expect(isFilterActive(filter({ query: "x" }))).toBe(true);
  });
});

describe("passesFilters", () => {
  it("passes an unfiltered server", () => {
    expect(passesFilters(server(), DEFAULT_FILTER)).toBe(true);
  });

  it("searches the id and the description", () => {
    expect(passesFilters(server(), filter({ query: "acme" }))).toBe(true);
    expect(passesFilters(server(), filter({ query: "server" }))).toBe(true);
    expect(passesFilters(server(), filter({ query: "zzz" }))).toBe(false);
  });

  it("filters on official", () => {
    expect(passesFilters(server(), filter({ official: true }))).toBe(false);
    expect(passesFilters(server({ official: true }), filter({ official: true }))).toBe(
      true,
    );
  });

  it("filters on language, scope, os and category", () => {
    const f = filter({
      categories: { excludes: [], includes: ["Databases"] },
      languages: { excludes: [], includes: ["typescript"] },
      os: { excludes: [], includes: ["linux"] },
      scope: { excludes: [], includes: ["cloud"] },
    });
    expect(passesFilters(server(), f)).toBe(true);
    expect(passesFilters(server({ languages: ["rust"] }), f)).toBe(false);
    expect(passesFilters(server({ scope: ["local"] }), f)).toBe(false);
    expect(passesFilters(server({ os: ["macos"] }), f)).toBe(false);
    expect(passesFilters(server({ categories: ["Search"] }), f)).toBe(false);
  });

  it("filters on inferred cost and rate limiting", () => {
    const paid = server({ cost: { source: "inferred", value: "likely-paid" } });
    expect(passesFilters(paid, filter({ cost: { excludes: [], includes: ["likely-paid"] } }))).toBe(true);
    expect(passesFilters(paid, filter({ cost: { excludes: [], includes: ["likely-free"] } }))).toBe(false);

    const limited = server({ rateLimited: { source: "override", value: "yes" } });
    expect(passesFilters(limited, filter({ rateLimited: { excludes: [], includes: ["yes"] } }))).toBe(true);
    expect(passesFilters(limited, filter({ rateLimited: { excludes: [], includes: ["no"] } }))).toBe(false);
  });

  it("accepts several cost values at once", () => {
    // The common case: roughly half the list is cost-unknown, so "free OR
    // unknown" is what you actually want to ask for.
    const both = { excludes: [], includes: ["likely-free", "unknown"] } as const;
    const free = server({ cost: { source: "inferred", value: "likely-free" } });
    const unknown = server({ cost: { source: "inferred", value: "unknown" } });
    const paid = server({ cost: { source: "inferred", value: "likely-paid" } });
    expect(passesFilters(free, filter({ cost: both }))).toBe(true);
    expect(passesFilters(unknown, filter({ cost: both }))).toBe(true);
    expect(passesFilters(paid, filter({ cost: both }))).toBe(false);
  });

  it("excludes a cost value", () => {
    const notPaid = { excludes: ["likely-paid"], includes: [] } as const;
    const paid = server({ cost: { source: "inferred", value: "likely-paid" } });
    const free = server({ cost: { source: "inferred", value: "likely-free" } });
    expect(passesFilters(paid, filter({ cost: notPaid }))).toBe(false);
    expect(passesFilters(free, filter({ cost: notPaid }))).toBe(true);
  });
});

describe("passesFilters on grades", () => {
  it("keeps a triple-A server", () => {
    expect(passesFilters(server(), filter({ tripleA: true }))).toBe(true);
  });

  it("drops a server with a B on any axis", () => {
    const b = server({ glama: { license: "A", maintenance: "A", quality: "B" } });
    expect(passesFilters(b, filter({ tripleA: true }))).toBe(false);
  });

  it("drops a partially graded server from triple-A", () => {
    // The real mcp-atlassian shape: quality never graded.
    const partial = server({ glama: { license: "A", maintenance: "C" } });
    expect(passesFilters(partial, filter({ tripleA: true }))).toBe(false);
  });

  it("drops an unindexed server from triple-A", () => {
    expect(passesFilters(server({ glama: null }), filter({ tripleA: true }))).toBe(
      false,
    );
  });

  it("filters on grade coverage", () => {
    expect(passesFilters(server(), filter({ gradeCoverage: "graded-all" }))).toBe(true);
    expect(
      passesFilters(server({ glama: null }), filter({ gradeCoverage: "not-indexed" })),
    ).toBe(true);
    expect(
      passesFilters(server({ glama: null }), filter({ gradeCoverage: "graded-all" })),
    ).toBe(false);
  });

  it("applies a per-axis minimum grade", () => {
    const b = server({ glama: { license: "A", maintenance: "A", quality: "B" } });
    expect(passesFilters(b, filter({ minGrades: { quality: "B" } }))).toBe(true);
    expect(passesFilters(b, filter({ minGrades: { quality: "A" } }))).toBe(false);
  });

  it("never lets an ungraded axis clear a minimum bar", () => {
    const partial = server({ glama: { license: "A", maintenance: "C" } });
    expect(passesFilters(partial, filter({ minGrades: { quality: "F" } }))).toBe(false);
  });
});

describe("passesFilters on github facts", () => {
  it("filters on foss", () => {
    expect(passesFilters(server(), filter({ foss: { excludes: [], includes: ["yes"] } }))).toBe(true);
    expect(passesFilters(server(), filter({ foss: { excludes: [], includes: ["no"] } }))).toBe(false);
  });

  it("accepts FOSS or unclear together", () => {
    const both = { excludes: [], includes: ["yes", "unknown"] } as const;
    const unclear = server({ gh: facts({ isFoss: "unknown" }) });
    const proprietary = server({ gh: facts({ isFoss: "no" }) });
    expect(passesFilters(server(), filter({ foss: both }))).toBe(true);
    expect(passesFilters(unclear, filter({ foss: both }))).toBe(true);
    expect(passesFilters(proprietary, filter({ foss: both }))).toBe(false);
  });

  it("drops a repo with no github data from a licence allowlist", () => {
    const gone = server({ gh: null });
    expect(passesFilters(gone, filter({ foss: { excludes: [], includes: ["yes"] } }))).toBe(false);
    // ...but a denylist keeps it: "not proprietary" is true of an unknown.
    expect(
      passesFilters(gone, filter({ foss: { excludes: ["no"], includes: [] } })),
    ).toBe(true);
  });

  it("hides archived repos only when asked", () => {
    const dead = server({ gh: facts({ archived: true }) });
    expect(passesFilters(dead, DEFAULT_FILTER)).toBe(true);
    expect(passesFilters(dead, filter({ hideArchived: true }))).toBe(false);
  });

  it("filters on a star range", () => {
    expect(passesFilters(server(), filter({ minStars: 50 }))).toBe(true);
    expect(passesFilters(server(), filter({ minStars: 500 }))).toBe(false);
    expect(passesFilters(server(), filter({ maxStars: 500 }))).toBe(true);
    expect(passesFilters(server(), filter({ maxStars: 50 }))).toBe(false);
  });

  it("filters on last push", () => {
    const cutoff = Date.parse("2026-01-01T00:00:00Z");
    expect(passesFilters(server(), filter({ pushedAfter: cutoff }))).toBe(true);
    const stale = server({ gh: facts({ pushedAt: "2020-01-01T00:00:00Z" }) });
    expect(passesFilters(stale, filter({ pushedAfter: cutoff }))).toBe(false);
  });

  it("drops a repo with no github data from a push-date filter", () => {
    const gone = server({ gh: null });
    expect(passesFilters(gone, filter({ pushedAfter: 0 }))).toBe(false);
  });

  it("treats a 404'd repo as zero stars rather than crashing", () => {
    const gone = server({ gh: null });
    expect(passesFilters(gone, filter({ minStars: 1 }))).toBe(false);
    expect(passesFilters(gone, filter({ maxStars: 10 }))).toBe(true);
  });

  it("keeps a 404'd repo when no github filter is set", () => {
    expect(passesFilters(server({ gh: null }), DEFAULT_FILTER)).toBe(true);
  });
});

describe("applyFilterSort", () => {
  const a = server({ gh: facts({ stars: 10 }), id: "a/one" });
  const b = server({ gh: facts({ stars: 300 }), id: "b/two" });
  const c = server({ gh: facts({ stars: 50 }), id: "c/three" });

  it("sorts by stars descending by default", () => {
    expect(applyFilterSort([a, b, c], DEFAULT_FILTER, DEFAULT_SORT).map((s) => s.id)).toEqual(
      ["b/two", "c/three", "a/one"],
    );
  });

  it("sorts by stars ascending", () => {
    expect(
      applyFilterSort([a, b, c], DEFAULT_FILTER, sort({ dir: "asc" })).map((s) => s.id),
    ).toEqual(["a/one", "c/three", "b/two"]);
  });

  it("sorts by name", () => {
    expect(
      applyFilterSort([b, a, c], DEFAULT_FILTER, sort({ dir: "asc", key: "name" })).map(
        (s) => s.id,
      ),
    ).toEqual(["a/one", "b/two", "c/three"]);
  });

  it("sorts by category", () => {
    const x = server({ categories: ["Zebra"], id: "x/x" });
    const y = server({ categories: ["Alpha"], id: "y/y" });
    expect(
      applyFilterSort([x, y], DEFAULT_FILTER, sort({ dir: "asc", key: "category" })).map(
        (s) => s.id,
      ),
    ).toEqual(["y/y", "x/x"]);
  });

  it("sorts by created and pushed dates", () => {
    const older = server({ gh: facts({ createdAt: "2020-01-01T00:00:00Z" }), id: "o/o" });
    const newer = server({ gh: facts({ createdAt: "2026-01-01T00:00:00Z" }), id: "n/n" });
    expect(
      applyFilterSort([older, newer], DEFAULT_FILTER, sort({ key: "created" })).map(
        (s) => s.id,
      ),
    ).toEqual(["n/n", "o/o"]);

    const stale = server({ gh: facts({ pushedAt: "2020-01-01T00:00:00Z" }), id: "s/s" });
    const fresh = server({ gh: facts({ pushedAt: "2026-07-01T00:00:00Z" }), id: "f/f" });
    expect(
      applyFilterSort([stale, fresh], DEFAULT_FILTER, sort({ key: "pushed" })).map(
        (s) => s.id,
      ),
    ).toEqual(["f/f", "s/s"]);
  });

  it("sorts by composite grade, best first", () => {
    const good = server({ glama: { license: "A", maintenance: "A", quality: "A" }, id: "g/g" });
    const bad = server({ glama: { license: "C", maintenance: "C", quality: "C" }, id: "b/b" });
    expect(
      applyFilterSort([bad, good], DEFAULT_FILTER, sort({ dir: "asc", key: "grade" })).map(
        (s) => s.id,
      ),
    ).toEqual(["g/g", "b/b"]);
  });

  it("sinks unknown values last in BOTH directions", () => {
    // An ungraded server is unknown, not worst: flipping the direction must not
    // promote it to the top of the list.
    const graded = server({ glama: { license: "C", maintenance: "C", quality: "C" }, id: "g/g" });
    const ungraded = server({ glama: null, id: "u/u" });
    for (const direction of ["asc", "desc"] as const) {
      expect(
        applyFilterSort([ungraded, graded], DEFAULT_FILTER, sort({ dir: direction, key: "grade" })).map(
          (s) => s.id,
        ),
      ).toEqual(["g/g", "u/u"]);
    }
  });

  it("breaks ties on id, and orders two unknowns by id", () => {
    const one = server({ glama: null, id: "b/b" });
    const two = server({ glama: null, id: "a/a" });
    expect(
      applyFilterSort([one, two], DEFAULT_FILTER, sort({ key: "grade" })).map((s) => s.id),
    ).toEqual(["a/a", "b/b"]);
  });

  it("sinks a repo with no github data on every ordinal sort", () => {
    // A deleted repo (gh: null) is unknown on stars, pushed and created alike;
    // none of those may treat it as zero and rank it above a real repo.
    const gone = server({ gh: null, id: "z/gone" });
    const alive = server({ gh: facts({ stars: 1 }), id: "a/alive" });
    for (const key of ["stars", "pushed", "created"] as const) {
      // Both input orders: the comparator sees (null, value) one way and
      // (value, null) the other, and must sink the null either way.
      for (const input of [
        [gone, alive],
        [alive, gone],
      ]) {
        expect(
          applyFilterSort(input, DEFAULT_FILTER, sort({ dir: "asc", key })).map(
            (s) => s.id,
          ),
        ).toEqual(["a/alive", "z/gone"]);
      }
    }
  });

  it("orders two data-less repos by id rather than arbitrarily", () => {
    const one = server({ gh: null, id: "b/b" });
    const two = server({ gh: null, id: "a/a" });
    expect(
      applyFilterSort([one, two], DEFAULT_FILTER, sort({ key: "stars" })).map(
        (s) => s.id,
      ),
    ).toEqual(["a/a", "b/b"]);
  });

  it("sorts text keys descending too", () => {
    const x = server({ id: "a/aaa" });
    const y = server({ id: "b/bbb" });
    expect(
      applyFilterSort([x, y], DEFAULT_FILTER, sort({ dir: "desc", key: "name" })).map(
        (s) => s.id,
      ),
    ).toEqual(["b/bbb", "a/aaa"]);
  });

  it("breaks a category tie on id", () => {
    const x = server({ categories: ["Same"], id: "b/b" });
    const y = server({ categories: ["Same"], id: "a/a" });
    expect(
      applyFilterSort([x, y], DEFAULT_FILTER, sort({ dir: "asc", key: "category" })).map(
        (s) => s.id,
      ),
    ).toEqual(["a/a", "b/b"]);
  });

  it("sorts a repo with no categories at all", () => {
    // Three entries have an empty description upstream; an empty category list
    // is the same class of hole and must not throw.
    const none = server({ categories: [], id: "n/none" });
    const some = server({ categories: ["Alpha"], id: "s/some" });
    expect(
      applyFilterSort([some, none], DEFAULT_FILTER, sort({ dir: "asc", key: "category" })).map(
        (s) => s.id,
      ),
    ).toEqual(["n/none", "s/some"]);
  });

  it("ties on equal stars fall back to id order", () => {
    const one = server({ gh: facts({ stars: 5 }), id: "b/b" });
    const two = server({ gh: facts({ stars: 5 }), id: "a/a" });
    expect(
      applyFilterSort([one, two], DEFAULT_FILTER, sort({ dir: "asc" })).map((s) => s.id),
    ).toEqual(["a/a", "b/b"]);
  });

  it("filters and sorts together", () => {
    const rust = server({ gh: facts({ stars: 5 }), id: "r/r", languages: ["rust"] });
    const result = applyFilterSort(
      [a, b, rust],
      filter({ languages: { excludes: [], includes: ["typescript"] } }),
      DEFAULT_SORT,
    );
    expect(result.map((s) => s.id)).toEqual(["b/two", "a/one"]);
  });

  it("does not mutate the input array", () => {
    const input = [a, b, c];
    applyFilterSort(input, DEFAULT_FILTER, DEFAULT_SORT);
    expect(input.map((s) => s.id)).toEqual(["a/one", "b/two", "c/three"]);
  });

  it("returns nothing for an empty list", () => {
    expect(applyFilterSort([], DEFAULT_FILTER, DEFAULT_SORT)).toEqual([]);
  });
});
