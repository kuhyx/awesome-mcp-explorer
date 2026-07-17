import type { FilterState, SortDirection, SortKey, TriSelect } from "./filter-sort.ts";
/**
 * Encodes filter + sort into the URL query string.
 *
 * dufs-cloud deliberately keeps its filters ephemeral, resetting them on every
 * navigation — right for a file browser, wrong for a directory. Here the whole
 * point is to be able to send someone "every triple-A, FOSS, local Rust
 * server", so the state must survive a reload and a paste.
 *
 * The encoding is hand-rolled and lossy-by-design: only non-default values are
 * written, so a pristine view has a clean URL, and unknown or malformed params
 * are ignored rather than throwing. A shared link should degrade to a sensible
 * view, never to a crash.
 */
import type { Grade, GradeAxis, GradeCoverage } from "./grade.ts";
import type { Cost, Language, Os, Scope, Tri } from "./server.ts";

import { LANGUAGES, OPERATING_SYSTEMS, SCOPES } from "../../scripts/lib/parse-readme.ts";
import { DEFAULT_FILTER, DEFAULT_SORT } from "./filter-sort.ts";
import { GRADE_AXES, GRADES } from "./grade.ts";

const SORT_KEYS: readonly SortKey[] = [
  "category",
  "created",
  "grade",
  "name",
  "pushed",
  "stars",
];
const COSTS: readonly Cost[] = ["likely-free", "likely-paid", "unknown"];
const TRIS: readonly Tri[] = ["no", "unknown", "yes"];
const COVERAGES: readonly GradeCoverage[] = [
  "graded-all",
  "graded-partial",
  "not-indexed",
];

/**
 * Marks an excluded value: `lang=rust,go,!python` is "Rust or Go, but not Python".
 *
 * `!` and not `-`, because a leading `-` is easy to mistake for a hyphen inside
 * a value, and emphatically not `+`: a literal `+` in a query string means a
 * space, so `lang=+rust` decodes to `lang= rust`. Bare-for-include also keeps
 * the common case (`lang=rust`) free of punctuation entirely.
 */
const EXCLUDE_MARK = "!";

/**
 * A tri-state as one param.
 *
 * One param rather than two (`langIn`/`langEx`) so a filter reads as a single
 * unit and cannot be half-applied by a truncated link.
 */
function encodeTri<T extends string>(select: TriSelect<T>): string {
  return [
    ...select.includes,
    ...select.excludes.map((v) => `${EXCLUDE_MARK}${v}`),
  ].join(",");
}

function splitTri(raw: string): { excludes: string[]; includes: string[] } {
  const includes: string[] = [];
  const excludes: string[] = [];
  for (const token of raw.split(",")) {
    if (token === "" || token === EXCLUDE_MARK) continue;
    if (token.startsWith(EXCLUDE_MARK)) excludes.push(token.slice(1));
    else includes.push(token);
  }
  return { excludes, includes };
}

function decodeTri<T extends string>(
  raw: null | string,
  vocabulary: readonly T[],
): TriSelect<T> {
  if (raw === null || raw === "") return { excludes: [], includes: [] };
  const { excludes, includes } = splitTri(raw);
  // Unknown members are dropped rather than throwing: a link from an older
  // version of the app should still open, just without the vanished facet.
  const known = (values: string[]): T[] =>
    values.filter((v): v is T => vocabulary.includes(v as T));
  return { excludes: known(excludes), includes: known(includes) };
}

/** Categories are open-vocabulary, so they cannot be validated against a list. */
function decodeCategoryTri(raw: null | string): TriSelect<string> {
  if (raw === null || raw === "") return { excludes: [], includes: [] };
  return splitTri(raw);
}

function isEmptyTri(select: TriSelect<string>): boolean {
  return select.includes.length === 0 && select.excludes.length === 0;
}

function encodeMinGrades(grades: FilterState["minGrades"]): string {
  return GRADE_AXES.flatMap((axis) => {
    const grade = grades[axis];
    return grade === undefined ? [] : [`${axis}:${grade}`];
  }).join(",");
}

function decodeMinGrades(raw: null | string): FilterState["minGrades"] {
  if (raw === null || raw === "") return {};
  const out: Partial<Record<GradeAxis, Grade>> = {};
  for (const token of raw.split(",")) {
    const [axis, grade] = token.split(":", 2);
    if (!GRADE_AXES.includes(axis as GradeAxis)) continue;
    if (!GRADES.includes(grade as Grade)) continue;
    out[axis as GradeAxis] = grade as Grade;
  }
  return out;
}

/** Reads a param only if it is in the allowed vocabulary. */
function oneOf<T extends string>(raw: null | string, allowed: readonly T[]): null | T {
  return raw !== null && allowed.includes(raw as T) ? (raw as T) : null;
}

function positiveInt(raw: null | string): null | number {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Percent-encodes a value, then restores the delimiters this encoding uses.
 *
 * `URLSearchParams.toString()` would escape `,` `!` and `:` into `%2C` `%21`
 * `%3A`, turning a shareable link into `lang=%2Crust%2C%21python`. Those three
 * characters are legal in a query string, and readability is the entire point
 * of putting the state in the URL — a link you can eyeball and hand-edit.
 */
function encodeValue(value: string): string {
  return encodeURIComponent(value)
    .replaceAll("%2C", ",")
    .replaceAll("%21", "!")
    .replaceAll("%3A", ":");
}

/** A flag contributes its key only when set. */
function flag(isSet: boolean): null | string {
  return isSet ? "1" : null;
}

/** A tri-state contributes nothing when neutral. */
function tri<T extends string>(select: TriSelect<T>): null | string {
  return isEmptyTri(select) ? null : encodeTri(select);
}

export function encodeFilter(
  filter: FilterState,
  sort: { dir: SortDirection; key: SortKey },
): string {
  // A table rather than a wall of `if`s: each row is "param name, value or null
  // if it should be omitted". Only non-defaults are written, so a pristine view
  // has an empty query string.
  const fields: readonly (readonly [string, null | number | string])[] = [
    ["q", filter.query === "" ? null : filter.query],
    ["official", flag(filter.official)],
    ["aaa", flag(filter.tripleA)],
    ["live", flag(filter.hideArchived)],
    ["lang", tri(filter.languages)],
    ["scope", tri(filter.scope)],
    ["os", tri(filter.os)],
    ["cat", tri(filter.categories)],
    ["foss", tri(filter.foss)],
    ["cost", tri(filter.cost)],
    ["rl", tri(filter.rateLimited)],
    ["cov", filter.gradeCoverage],
    [
      "min",
      Object.keys(filter.minGrades).length > 0
        ? encodeMinGrades(filter.minGrades)
        : null,
    ],
    ["minStars", filter.minStars],
    ["maxStars", filter.maxStars],
    ["since", filter.pushedAfter],
    ["sort", sort.key === DEFAULT_SORT.key ? null : sort.key],
    ["dir", sort.dir === DEFAULT_SORT.dir ? null : sort.dir],
  ];

  return fields
    .filter((field) => field[1] !== null)
    .map(([key, value]) => `${key}=${encodeValue(String(value))}`)
    .join("&");
}

export function decodeFilter(search: string): {
  filter: FilterState;
  sort: { dir: SortDirection; key: SortKey };
} {
  const parameters = new URLSearchParams(search);
  const get = (key: string): null | string => parameters.get(key);

  return {
    filter: {
      categories: decodeCategoryTri(get("cat")),
      cost: decodeTri<Cost>(get("cost"), COSTS),
      foss: decodeTri<Tri>(get("foss"), TRIS),
      gradeCoverage: oneOf(get("cov"), COVERAGES),
      hideArchived: get("live") === "1",
      languages: decodeTri<Language>(get("lang"), LANGUAGES),
      maxStars: positiveInt(get("maxStars")),
      minGrades: decodeMinGrades(get("min")),
      minStars: positiveInt(get("minStars")),
      official: get("official") === "1",
      os: decodeTri<Os>(get("os"), OPERATING_SYSTEMS),
      pushedAfter: positiveInt(get("since")),
      query: get("q") ?? DEFAULT_FILTER.query,
      rateLimited: decodeTri<Tri>(get("rl"), TRIS),
      scope: decodeTri<Scope>(get("scope"), SCOPES),
      tripleA: get("aaa") === "1",
    },
    sort: {
      dir: oneOf(get("dir"), ["asc", "desc"] as const) ?? DEFAULT_SORT.dir,
      key: oneOf(get("sort"), SORT_KEYS) ?? DEFAULT_SORT.key,
    },
  };
}
