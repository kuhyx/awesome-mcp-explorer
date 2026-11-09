/**
 * Static definitions behind the filter bar's markup: which facets exist, what
 * each option is called, and the label tables for the sort and grade controls.
 *
 * Used by the `.astro` components at build time; the browser reads option
 * names back out of the rendered `data-name` attributes instead.
 */
import type { ExportFormat } from "./export.ts";
import type { SortKey } from "./filter-sort.ts";
import type { GradeCoverage } from "./grade.ts";
import type { IconName } from "./icons.ts";
import type { Cost, Language, Tri } from "./server.ts";

import { LANGUAGES, OPERATING_SYSTEMS, SCOPES } from "../../scripts/lib/parse-readme.ts";
import { COST_LABELS, COST_MARKS, RATE_LABELS, RATE_MARKS } from "./format.ts";

/**
 * The tri-state facets: keys shared by `FilterState` and `Facets`.
 */
export type TriKey =
  | "categories"
  | "cost"
  | "foss"
  | "languages"
  | "os"
  | "rateLimited"
  | "scope";

export interface FacetOption {
  /**
   * Shown instead of the name when set; the name is then spoken only.
   */
  readonly mark?: string;
  /**
   * The spoken name, and the visible one for proper nouns (Rust, macOS, FOSS).
   */
  readonly name: string;
  readonly value: string;
}

export interface FacetSpec {
  readonly icon: IconName;
  /**
   * Values guessed from the README text rather than published: drawn dashed.
   */
  readonly inferred: boolean;
  readonly key: Exclude<TriKey, "categories">;
  /**
   * Spoken name of the whole facet.
   */
  readonly label: string;
  readonly options: readonly FacetOption[];
}

/**
 * Keyed by Language, so a new language is a compile error, not a fallback.
 */
const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  cpp: "C/C++",
  csharp: "C#",
  go: "Go",
  java: "Java",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust",
  typescript: "TS/JS",
};

// Licence, cost and rate limit are tri-state pickers rather than pick-one
// chips: "FOSS or unclear" and "free or unknown" are ordinary things to want,
// and roughly half of each of the inferred fields is `unknown`.
const FOSS_NAMES: Readonly<Record<Tri, string>> = {
  no: "Not FOSS",
  unknown: "Unclear",
  yes: "FOSS",
};

// FOSS stays a word (a proper noun); the other two are glyphs: © for "all
// rights reserved", ? for unclear.
const FOSS_MARKS: Readonly<Partial<Record<Tri, string>>> = {
  no: "©",
  unknown: "?",
};

function named<T extends string>(
  values: readonly T[],
  nameOf: (value: T) => string,
  marks?: Readonly<Partial<Record<T, string>>>,
): FacetOption[] {
  return values.map((value) => {
    const mark = marks?.[value];
    return mark === undefined ? { name: nameOf(value), value } : { mark, name: nameOf(value), value };
  });
}

const TRI_ORDER: readonly Tri[] = ["yes", "no", "unknown"];
const COST_ORDER: readonly Cost[] = ["likely-free", "likely-paid", "unknown"];

/**
 * Rendered in this order, between the provenance chips and the sliders.
 */
export const FACETS: readonly FacetSpec[] = [
  {
    icon: "code",
    inferred: false,
    key: "languages",
    label: "Language",
    options: named(LANGUAGES, (v) => LANGUAGE_NAMES[v]),
  },
  { icon: "pin", inferred: false, key: "scope", label: "Scope (local vs cloud)", options: named(SCOPES, String) },
  { icon: "monitor", inferred: false, key: "os", label: "Operating system", options: named(OPERATING_SYSTEMS, String) },
  {
    icon: "scale",
    inferred: false,
    key: "foss",
    label: "Licence",
    options: named(TRI_ORDER, (v) => FOSS_NAMES[v], FOSS_MARKS),
  },
  {
    icon: "coin",
    inferred: true,
    key: "cost",
    label: "Cost (inferred)",
    options: named(COST_ORDER, (v) => COST_LABELS[v], COST_MARKS),
  },
  {
    icon: "gauge",
    inferred: true,
    key: "rateLimited",
    label: "Rate limit (inferred)",
    options: named(TRI_ORDER, (v) => RATE_LABELS[v], RATE_MARKS),
  },
];

export const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  category: "category",
  created: "age",
  grade: "grade",
  name: "name",
  pushed: "last push",
  stars: "stars",
};

export const COVERAGE_LABELS: Readonly<Record<GradeCoverage, string>> = {
  "graded-all": "All three graded",
  "graded-partial": "Partly graded",
  "not-indexed": "Not on Glama",
};

export const EXPORT_FORMATS: readonly { format: ExportFormat; name: string }[] = [
  { format: "json", name: "JSON" },
  { format: "csv", name: "CSV" },
  { format: "markdown", name: "Markdown" },
];
