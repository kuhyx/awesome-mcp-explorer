/**
 * How many filters are set: the number on the reset button's badge.
 * Each field of FilterState that differs from its default counts once.
 */
import type { FilterState } from "./filter-sort.ts";

import { DEFAULT_FILTER } from "./filter-sort.ts";

export function activeFilterCount(filter: FilterState): number {
  return Object.keys(DEFAULT_FILTER).filter((key) => {
    const field = key as keyof FilterState;
    return JSON.stringify(filter[field]) !== JSON.stringify(DEFAULT_FILTER[field]);
  }).length;
}
