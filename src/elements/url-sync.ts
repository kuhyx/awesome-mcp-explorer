/**
 * Filter + sort state, stored in the URL query string.
 *
 * The query string is the source of truth, so Back works, a reload restores
 * the view, and any state is shareable by copying the address bar.
 */
import type { FilterState, SortState } from "../lib/filter-sort.ts";

import { decodeFilter, encodeFilter } from "../lib/url-state.ts";

export function readUrl(): { filter: FilterState; sort: SortState } {
  return decodeFilter(globalThis.location.search);
}

export function writeUrl(filter: FilterState, sort: SortState): void {
  const query = encodeFilter(filter, sort);
  const url = query === "" ? globalThis.location.pathname : `?${query}`;
  // replaceState, not pushState: typing in the search box would otherwise
  // bury the previous page under one history entry per keystroke.
  globalThis.history.replaceState(null, "", url);
}
