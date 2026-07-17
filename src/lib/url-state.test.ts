import { describe, expect, it } from "vitest";

import type { FilterState, SortState } from "./filter-sort.ts";

import { DEFAULT_FILTER, DEFAULT_SORT } from "./filter-sort.ts";
import { decodeFilter, encodeFilter } from "./url-state.ts";

const filter = (over: Partial<FilterState> = {}): FilterState => ({
  ...DEFAULT_FILTER,
  ...over,
});
const sort = (over: Partial<SortState> = {}): SortState => ({
  ...DEFAULT_SORT,
  ...over,
});

/** Encodes then decodes, which is the only property that actually matters. */
function roundTrip(f: FilterState, s: SortState = DEFAULT_SORT): {
  filter: FilterState;
  sort: SortState;
} {
  return decodeFilter(encodeFilter(f, s));
}

describe("encodeFilter", () => {
  it("writes nothing for a pristine view", () => {
    expect(encodeFilter(DEFAULT_FILTER, DEFAULT_SORT)).toBe("");
  });

  it("omits the default sort", () => {
    expect(encodeFilter(DEFAULT_FILTER, sort())).toBe("");
  });

  it("writes only what is set", () => {
    expect(encodeFilter(filter({ tripleA: true }), DEFAULT_SORT)).toBe("aaa=1");
  });

  it("encodes a tri-state with signs in one param", () => {
    const encoded = encodeFilter(
      filter({ languages: { excludes: ["python"], includes: ["rust", "go"] } }),
      DEFAULT_SORT,
    );
    expect(encoded).toBe("lang=rust,go,!python");
  });

  it("encodes per-axis minimum grades", () => {
    const encoded = encodeFilter(
      filter({ minGrades: { maintenance: "B", quality: "A" } }),
      DEFAULT_SORT,
    );
    expect(encoded).toBe("min=quality:A,maintenance:B");
  });
});

describe("round trip", () => {
  it("survives the default", () => {
    expect(roundTrip(DEFAULT_FILTER).filter).toEqual(DEFAULT_FILTER);
  });

  it("survives every scalar filter", () => {
    const f = filter({
      cost: { excludes: [], includes: ["likely-free", "unknown"] },
      foss: { excludes: ["no"], includes: ["yes"] },
      gradeCoverage: "graded-all",
      hideArchived: true,
      maxStars: 5000,
      minStars: 10,
      official: true,
      pushedAfter: 1_700_000_000_000,
      query: "postgres",
      rateLimited: { excludes: [], includes: ["no"] },
      tripleA: true,
    });
    expect(roundTrip(f).filter).toEqual(f);
  });

  it("survives every tri-state", () => {
    const f = filter({
      categories: { excludes: ["Search & Data Extraction"], includes: ["Databases"] },
      languages: { excludes: ["typescript"], includes: ["rust"] },
      os: { excludes: ["windows"], includes: ["linux"] },
      scope: { excludes: ["cloud"], includes: ["local"] },
    });
    expect(roundTrip(f).filter).toEqual(f);
  });

  it("survives minimum grades", () => {
    const f = filter({ minGrades: { license: "A", maintenance: "C", quality: "B" } });
    expect(roundTrip(f).filter).toEqual(f);
  });

  it("survives sort state", () => {
    const s = sort({ dir: "asc", key: "grade" });
    expect(roundTrip(DEFAULT_FILTER, s).sort).toEqual(s);
  });

  it("survives a category containing a COMMA, the separator itself", () => {
    // Regression: "Biology, Medicine and Bioinformatics" is the only one of 54
    // categories with a comma. Its own comma used to be written literally, so
    // it split into "Biology" and " Medicine and Bioinformatics", matched
    // nothing, and the sidebar promised 8 servers while the list showed none.
    const bio = "Biology, Medicine and Bioinformatics";
    const f = filter({ categories: { excludes: [], includes: [bio] } });
    expect(roundTrip(f).filter.categories.includes).toEqual([bio]);
  });

  it("keeps a comma-bearing value distinct from two values", () => {
    const one = filter({
      categories: { excludes: [], includes: ["Biology, Medicine"] },
    });
    const two = filter({
      categories: { excludes: [], includes: ["Biology", "Medicine"] },
    });
    expect(encodeFilter(one, DEFAULT_SORT)).not.toBe(
      encodeFilter(two, DEFAULT_SORT),
    );
    expect(roundTrip(one).filter.categories.includes).toEqual(["Biology, Medicine"]);
    expect(roundTrip(two).filter.categories.includes).toEqual(["Biology", "Medicine"]);
  });

  it("survives an excluded category containing a comma", () => {
    const bio = "Biology, Medicine and Bioinformatics";
    const f = filter({ categories: { excludes: [bio], includes: [] } });
    expect(roundTrip(f).filter.categories.excludes).toEqual([bio]);
  });

  it("decodes the exact URL the sidebar produces for that category", () => {
    const { filter: decoded } = decodeFilter(
      "aaa=1&cat=Biology%2C%20Medicine%20and%20Bioinformatics",
    );
    expect(decoded.tripleA).toBe(true);
    expect(decoded.categories.includes).toEqual([
      "Biology, Medicine and Bioinformatics",
    ]);
  });

  it("survives a category containing a space and an ampersand", () => {
    const f = filter({
      categories: { excludes: [], includes: ["Search & Data Extraction"] },
    });
    expect(roundTrip(f).filter.categories.includes).toEqual([
      "Search & Data Extraction",
    ]);
  });

  it("survives a query with spaces and symbols", () => {
    const f = filter({ query: "a b & c=d" });
    expect(roundTrip(f).filter.query).toBe("a b & c=d");
  });
});

// A shared link must degrade to a sensible view, never to a crash.
describe("decodeFilter on hostile input", () => {
  it("returns the default for an empty search", () => {
    expect(decodeFilter("")).toEqual({ filter: DEFAULT_FILTER, sort: DEFAULT_SORT });
  });

  it("ignores unknown params", () => {
    expect(decodeFilter("nonsense=1&whatever=2").filter).toEqual(DEFAULT_FILTER);
  });

  it("reads a bare key with no '=' as an empty value", () => {
    // `?aaa` is a legal query string, and a flag reads as set only on "1", so a
    // valueless flag stays off rather than throwing on the missing separator.
    expect(decodeFilter("aaa").filter.tripleA).toBe(false);
    expect(decodeFilter("q").filter.query).toBe("");
    // A bare key alongside a real one must not swallow its neighbour.
    expect(decodeFilter("live&aaa=1").filter.tripleA).toBe(true);
  });

  it("ignores a value outside the vocabulary", () => {
    expect(decodeFilter("foss=maybe").filter.foss).toEqual({
      excludes: [],
      includes: [],
    });
    expect(decodeFilter("cost=cheap").filter.cost).toEqual({
      excludes: [],
      includes: [],
    });
    expect(decodeFilter("cov=sort-of").filter.gradeCoverage).toBeNull();
  });

  it("reads several licence values from one param", () => {
    expect(decodeFilter("foss=yes,unknown").filter.foss).toEqual({
      excludes: [],
      includes: ["yes", "unknown"],
    });
  });

  it("drops unknown members of a tri-state but keeps valid ones", () => {
    expect(decodeFilter("lang=rust,cobol").filter.languages).toEqual({
      excludes: [],
      includes: ["rust"],
    });
  });

  it("reads a bare token as an include", () => {
    expect(decodeFilter("lang=rust").filter.languages).toEqual({
      excludes: [],
      includes: ["rust"],
    });
  });

  it("ignores an empty or bare-marker category token", () => {
    expect(decodeFilter("cat=!").filter.categories).toEqual({
      excludes: [],
      includes: [],
    });
    expect(decodeFilter("cat=a,,b").filter.categories.includes).toEqual(["a", "b"]);
  });

  it("ignores a token with a stray percent rather than throwing", () => {
    // decodeURIComponent throws on a lone '%'; a hand-edited link must still open.
    expect(decodeFilter("cat=%zz").filter.categories.includes).toEqual([]);
    expect(decodeFilter("q=%zz").filter.query).toBe("");
  });

  it("ignores a malformed minimum grade", () => {
    expect(decodeFilter("min=quality:Z").filter.minGrades).toEqual({});
    expect(decodeFilter("min=vibes:A").filter.minGrades).toEqual({});
    expect(decodeFilter("min=garbage").filter.minGrades).toEqual({});
  });

  it("ignores a non-numeric or negative star bound", () => {
    expect(decodeFilter("minStars=abc").filter.minStars).toBeNull();
    expect(decodeFilter("minStars=-5").filter.minStars).toBeNull();
    expect(decodeFilter("minStars=NaN").filter.minStars).toBeNull();
  });

  it("falls back to the default sort for an unknown key or direction", () => {
    expect(decodeFilter("sort=vibes&dir=sideways").sort).toEqual(DEFAULT_SORT);
  });

  it("accepts zero as a star bound", () => {
    expect(decodeFilter("minStars=0").filter.minStars).toBe(0);
  });
});
