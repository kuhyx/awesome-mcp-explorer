import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_FILTER, DEFAULT_SORT } from "../lib/filter-sort.ts";
import { useUrlFilter } from "./use-url-filter.ts";

beforeEach(() => {
  globalThis.history.replaceState(null, "", "/");
});

describe("useUrlFilter", () => {
  it("starts from the default when the URL is bare", () => {
    const { result } = renderHook(() => useUrlFilter());
    expect(result.current.filter).toEqual(DEFAULT_FILTER);
    expect(result.current.sort).toEqual(DEFAULT_SORT);
  });

  it("reads state out of the query string", () => {
    globalThis.history.replaceState(null, "", "/?aaa=1&foss=yes&sort=name");
    const { result } = renderHook(() => useUrlFilter());
    expect(result.current.filter.tripleA).toBe(true);
    expect(result.current.filter.foss).toBe("yes");
    expect(result.current.sort.key).toBe("name");
  });

  it("writes a filter change into the URL", () => {
    const { result } = renderHook(() => useUrlFilter());
    act(() => {
      result.current.setFilter({ ...DEFAULT_FILTER, tripleA: true });
    });
    expect(globalThis.location.search).toBe("?aaa=1");
    expect(result.current.filter.tripleA).toBe(true);
  });

  it("writes a sort change into the URL", () => {
    const { result } = renderHook(() => useUrlFilter());
    act(() => {
      result.current.setSort({ dir: "asc", key: "name" });
    });
    expect(globalThis.location.search).toContain("sort=name");
    expect(result.current.sort).toEqual({ dir: "asc", key: "name" });
  });

  it("clears the query string when everything returns to default", () => {
    globalThis.history.replaceState(null, "", "/?aaa=1");
    const { result } = renderHook(() => useUrlFilter());
    act(() => {
      result.current.setFilter(DEFAULT_FILTER);
    });
    expect(globalThis.location.search).toBe("");
  });

  it("keeps sort when the filter changes, and vice versa", () => {
    const { result } = renderHook(() => useUrlFilter());
    act(() => {
      result.current.setSort({ dir: "asc", key: "grade" });
    });
    act(() => {
      result.current.setFilter({ ...DEFAULT_FILTER, official: true });
    });
    expect(result.current.sort.key).toBe("grade");
    expect(result.current.filter.official).toBe(true);
  });

  it("follows a back-button navigation", () => {
    const { result } = renderHook(() => useUrlFilter());
    act(() => {
      globalThis.history.replaceState(null, "", "/?aaa=1");
      globalThis.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.filter.tripleA).toBe(true);
  });

  it("replaces rather than pushes history, so typing does not flood it", () => {
    const before = globalThis.history.length;
    const { result } = renderHook(() => useUrlFilter());
    act(() => {
      result.current.setFilter({ ...DEFAULT_FILTER, query: "a" });
    });
    act(() => {
      result.current.setFilter({ ...DEFAULT_FILTER, query: "ab" });
    });
    expect(globalThis.history.length).toBe(before);
  });
});
