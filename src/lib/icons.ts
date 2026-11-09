/**
 * The icon vocabulary: one shape per concept, reused by every control that
 * shows that concept (a facet heading, its preset chip and its row chip share
 * one icon). The shapes live in `components/sprite.astro`.
 *
 * Marks are what a control shows instead of a word: a sprite icon, or a short
 * glyph with no letters in it (★, ↓, "A–Z").
 */
import type { SortKey } from "./filter-sort.ts";
import type { GradeAxis, GradeCoverage } from "./grade.ts";

export const ICON_NAMES = [
  "archive",
  "calendar",
  "check",
  "clock",
  "code",
  "coin",
  "cov-all",
  "cov-none",
  "cov-part",
  "download",
  "empty",
  "error",
  "folder",
  "gauge",
  "grade",
  "help",
  "link",
  "link-off",
  "logo",
  "monitor",
  "pin",
  "reset",
  "save",
  "scale",
  "search",
  "shield",
  "sort",
  "star",
  "warning",
  "wrench",
  "close",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export type Mark = { readonly glyph: string } | { readonly icon: IconName };

export const AXIS_ICONS: Readonly<Record<GradeAxis, IconName>> = {
  license: "scale",
  maintenance: "wrench",
  quality: "star",
};

export const COVERAGE_ICONS: Readonly<Record<GradeCoverage, IconName>> = {
  "graded-all": "cov-all",
  "graded-partial": "cov-part",
  "not-indexed": "cov-none",
};

export const SORT_MARKS: Readonly<Record<SortKey, Mark>> = {
  category: { icon: "folder" },
  created: { icon: "calendar" },
  grade: { icon: "grade" },
  name: { glyph: "A–Z" },
  pushed: { icon: "clock" },
  stars: { glyph: "★" },
};
