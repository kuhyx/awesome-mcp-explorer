import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_FILTER, DEFAULT_SORT } from "../lib/filter-sort.ts";
import { readUrl, writeUrl } from "./url-sync.ts";

beforeEach(() => {
  globalThis.history.replaceState(null, "", "/");
});

describe("url sync", () => {
  it("starts from the default when the URL is bare", () => {
    expect(readUrl()).toEqual({ filter: DEFAULT_FILTER, sort: DEFAULT_SORT });
  });

  it("reads state out of the query string", () => {
    globalThis.history.replaceState(null, "", "/?aaa=1&sort=name&dir=asc");
    const { filter, sort } = readUrl();
    expect(filter.tripleA).toBe(true);
    expect(sort).toEqual({ dir: "asc", key: "name" });
  });

  it("writes state into the query string", () => {
    writeUrl({ ...DEFAULT_FILTER, query: "pg" }, { dir: "asc", key: "name" });
    expect(globalThis.location.search).toContain("q=pg");
    expect(readUrl().sort).toEqual({ dir: "asc", key: "name" });
  });

  it("clears the query string when everything returns to default", () => {
    writeUrl({ ...DEFAULT_FILTER, query: "pg" }, DEFAULT_SORT);
    writeUrl(DEFAULT_FILTER, DEFAULT_SORT);
    expect(globalThis.location.search).toBe("");
  });

  it("replaces rather than pushes history, so typing does not flood it", () => {
    const before = globalThis.history.length;
    writeUrl({ ...DEFAULT_FILTER, query: "a" }, DEFAULT_SORT);
    writeUrl({ ...DEFAULT_FILTER, query: "ab" }, DEFAULT_SORT);
    expect(globalThis.history).toHaveLength(before);
  });
});
