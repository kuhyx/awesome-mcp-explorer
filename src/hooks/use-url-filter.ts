/**
 * Filter + sort state, stored in the URL query string.
 *
 * Hand-rolled over `useSyncExternalStore` and the History API rather than a
 * router, matching dufs-cloud's `use-hash-path`: a router would be the single
 * largest dependency in a project that otherwise has two.
 *
 * The query string is the source of truth, so Back works, a reload restores the
 * view, and any state is shareable by copying the address bar.
 */
import { useCallback, useSyncExternalStore } from "react";

import type { FilterState, SortState } from "../lib/filter-sort.ts";

import { decodeFilter, encodeFilter } from "../lib/url-state.ts";

function subscribe(onChange: () => void): () => void {
  globalThis.addEventListener("popstate", onChange);
  return (): void => {
    globalThis.removeEventListener("popstate", onChange);
  };
}

function getSearch(): string {
  return globalThis.location.search;
}

export interface UrlFilter {
  readonly filter: FilterState;
  /**
   * Writes filter and sort together.
   *
   * Necessary, not a convenience: `setFilter` and `setSort` each close over the
   * *other* half as it was at render time, so calling both from one handler
   * makes the second silently overwrite the first. Applying a preset that
   * changes both — "Actively maintained" sets a filter and sorts by last push —
   * would drop the filter on the floor.
   */
  readonly setBoth: (nextFilter: FilterState, nextSort: SortState) => void;
  readonly setFilter: (next: FilterState) => void;
  readonly setSort: (next: SortState) => void;
  readonly sort: SortState;
}

export function useUrlFilter(): UrlFilter {
  const search = useSyncExternalStore(subscribe, getSearch, () => "");
  const { filter, sort } = decodeFilter(search);

  const write = useCallback((next: FilterState, nextSort: SortState): void => {
    const query = encodeFilter(next, nextSort);
    const url = query === "" ? globalThis.location.pathname : `?${query}`;
    // replaceState, not pushState: typing in the search box would otherwise
    // bury the previous page under one history entry per keystroke.
    globalThis.history.replaceState(null, "", url);
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  return {
    filter,
    setBoth: write,
    setFilter: useCallback(
      (next: FilterState) => {
        write(next, sort);
      },
      [sort, write],
    ),
    setSort: useCallback(
      (next: SortState) => {
        write(filter, next);
      },
      [filter, write],
    ),
    sort,
  };
}
