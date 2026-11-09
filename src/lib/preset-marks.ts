/**
 * What a built-in preset chip shows instead of its name: the marks of the
 * filters it sets, in the same vocabulary as the controls they set
 * (AAA, 🎖️, a facet icon and its option, the sort key and direction).
 */
import type { FilterState, SortState, TriSelect } from "./filter-sort.ts";
import type { Mark } from "./icons.ts";

import { FACETS } from "./facet-defs.ts";
import { DEFAULT_SORT } from "./filter-sort.ts";
import { SORT_MARKS } from "./icons.ts";
import { decodeFilter } from "./url-state.ts";

export interface PresetMark {
  /**
   * Struck through: the preset excludes this.
   */
  readonly exclude: boolean;
  readonly mark: Mark;
}

const on = (mark: Mark): PresetMark => ({ exclude: false, mark });

function triMarks(filter: FilterState): PresetMark[] {
  return FACETS.flatMap((spec) => {
    const select = filter[spec.key] as TriSelect<string>;
    if (select.includes.length + select.excludes.length === 0) return [];
    // Walks the page's own options, so a value the page has no button for
    // (nothing to draw) is skipped rather than shown as raw text.
    const picked = (values: readonly string[], exclude: boolean): PresetMark[] =>
      spec.options
        .filter((option) => values.includes(option.value))
        .map((option) => ({ exclude, mark: { glyph: option.mark ?? option.name } }));
    return [on({ icon: spec.icon }), ...picked(select.includes, false), ...picked(select.excludes, true)];
  });
}

function sortMarks(sort: SortState): PresetMark[] {
  if (sort.key === DEFAULT_SORT.key && sort.dir === DEFAULT_SORT.dir) return [];
  return [on(SORT_MARKS[sort.key]), on({ glyph: sort.dir === "asc" ? "↑" : "↓" })];
}

export function presetMarks(search: string): PresetMark[] {
  const { filter, sort } = decodeFilter(search);
  return [
    ...(filter.tripleA ? [on({ glyph: "AAA" })] : []),
    ...(filter.official ? [on({ glyph: "🎖️" })] : []),
    ...(filter.hideArchived ? [{ exclude: true, mark: { icon: "archive" } } as const] : []),
    ...triMarks(filter),
    ...sortMarks(sort),
  ];
}
