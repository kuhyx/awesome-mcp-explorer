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
import type { Cost, Language, Tri } from "./server.ts";

import { LANGUAGES, OPERATING_SYSTEMS, SCOPES } from "../../scripts/lib/parse-readme.ts";

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
  readonly name: string;
  readonly value: string;
}

export interface FacetSpec {
  readonly key: Exclude<TriKey, "categories">;
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

const COST_NAMES: Readonly<Record<Cost, string>> = {
  "likely-free": "~free",
  "likely-paid": "~paid",
  unknown: "~unknown",
};

const RATE_NAMES: Readonly<Record<Tri, string>> = {
  no: "~unlimited",
  unknown: "~unknown",
  yes: "~limited",
};

function named<T extends string>(
  values: readonly T[],
  nameOf: (value: T) => string,
): FacetOption[] {
  return values.map((value) => ({ name: nameOf(value), value }));
}

const TRI_ORDER: readonly Tri[] = ["yes", "no", "unknown"];
const COST_ORDER: readonly Cost[] = ["likely-free", "likely-paid", "unknown"];

/**
 * Rendered in this order, between the provenance chips and the sliders.
 */
export const FACETS: readonly FacetSpec[] = [
  { key: "languages", label: "Language", options: named(LANGUAGES, (v) => LANGUAGE_NAMES[v]) },
  { key: "scope", label: "Scope (local vs cloud)", options: named(SCOPES, String) },
  { key: "os", label: "Operating system", options: named(OPERATING_SYSTEMS, String) },
  { key: "foss", label: "Licence", options: named(TRI_ORDER, (v) => FOSS_NAMES[v]) },
  { key: "cost", label: "Cost (inferred)", options: named(COST_ORDER, (v) => COST_NAMES[v]) },
  {
    key: "rateLimited",
    label: "Rate limit (inferred)",
    options: named(TRI_ORDER, (v) => RATE_NAMES[v]),
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
