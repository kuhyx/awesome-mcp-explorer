import { fuzzyMatch } from "@kuhyx/web-ui";

/**
 * The filter/sort engine: pure, React-free, and the whole reason the app can
 * hold a 100% coverage bar cheaply.
 *
 * The shape follows `~/dufs-cloud/web/src/lib/filter-sort.ts`: one flat readonly
 * state object where `null`/`[]` mean "no constraint", a `DEFAULT_FILTER` to
 * compare against, and a single pure `applyFilterSort(data, filter, sort)` built
 * from an early-return predicate chain.
 */
import type { Grade, GradeAxis, GradeCoverage } from "./grade.ts";
import type { Cost, Language, Os, Scope, Server, Tri } from "./server.ts";

import { compositeRank, gradeCoverage, isAtLeast, isTripleA } from "./grade.ts";

/**
 * A tri-state selection over some vocabulary.
 *
 * Modelled as two parallel lists exactly as dufs-cloud's extension picker does:
 * a value in neither list is neutral, which keeps "off" as the absence of state
 * rather than a third array to keep in sync.
 */
export interface TriSelect<T extends string> {
  readonly excludes: readonly T[];
  readonly includes: readonly T[];
}

export const EMPTY_TRI: TriSelect<never> = { excludes: [], includes: [] };

export type SortKey =
  | "category"
  | "created"
  | "grade"
  | "name"
  | "pushed"
  | "stars";

export type SortDirection = "asc" | "desc";

export interface SortState {
  readonly dir: SortDirection;
  readonly key: SortKey;
}

export interface FilterState {
  readonly categories: TriSelect<string>;
  /**
   * Multi-select: "likely-free OR unknown" is a normal thing to want.
   */
  readonly cost: TriSelect<Cost>;
  readonly foss: TriSelect<Tri>;
  readonly gradeCoverage: GradeCoverage | null;
  /**
   * Hide repos GitHub reports as archived.
   */
  readonly hideArchived: boolean;
  readonly languages: TriSelect<Language>;
  readonly maxStars: null | number;
  /**
   * Per-axis "at least this good"; an ungraded axis never satisfies one.
   */
  readonly minGrades: Readonly<Partial<Record<GradeAxis, Grade>>>;
  readonly minStars: null | number;
  readonly official: boolean;
  readonly os: TriSelect<Os>;
  /**
   * Epoch ms; a repo must have been pushed at or after this.
   */
  readonly pushedAfter: null | number;
  /**
   * Fuzzy subsequence query over name, owner and description.
   */
  readonly query: string;
  readonly rateLimited: TriSelect<Tri>;
  readonly scope: TriSelect<Scope>;
  /**
   * Require all three axes to be exactly A — the headline filter.
   */
  readonly tripleA: boolean;
}

export const DEFAULT_FILTER: FilterState = {
  categories: EMPTY_TRI,
  cost: EMPTY_TRI,
  foss: EMPTY_TRI,
  gradeCoverage: null,
  hideArchived: false,
  languages: EMPTY_TRI,
  maxStars: null,
  minGrades: {},
  minStars: null,
  official: false,
  os: EMPTY_TRI,
  pushedAfter: null,
  query: "",
  rateLimited: EMPTY_TRI,
  scope: EMPTY_TRI,
  tripleA: false,
};

export const DEFAULT_SORT: SortState = { dir: "desc", key: "stars" };

/**
 * True when any constraint is set — used to badge the UI and offer a reset.
 */
export function isFilterActive(filter: FilterState): boolean {
  return JSON.stringify(filter) !== JSON.stringify(DEFAULT_FILTER);
}

/**
 * Applies one tri-state selection to a server's values.
 *
 * An allowlist requires at least one overlap; a denylist rejects any overlap.
 * A server with no values (e.g. no OS markers at all) fails a non-empty
 * allowlist but passes a denylist — the same "counts as not-X" reading
 * dufs-cloud gives extensionless files.
 */
export function passesTri<T extends string>(
  values: readonly T[],
  select: TriSelect<T>,
): boolean {
  if (
    select.includes.length > 0 &&
    select.includes.every((v) => !values.includes(v))
  ) {
    return false;
  }
  return select.excludes.every((v) => !values.includes(v));
}

function passesGrades(server: Server, filter: FilterState): boolean {
  if (filter.tripleA && (server.glama === null || !isTripleA(server.glama))) {
    return false;
  }
  if (
    filter.gradeCoverage !== null &&
    gradeCoverage(server.glama) !== filter.gradeCoverage
  ) {
    return false;
  }
  for (const [axis, min] of Object.entries(filter.minGrades)) {
    const grade = server.glama?.[axis as GradeAxis];
    // An ungraded axis is unknown, not good: it cannot clear a minimum bar.
    if (grade === undefined || !isAtLeast(grade, min)) return false;
  }
  return true;
}

function passesGithub(server: Server, filter: FilterState): boolean {
  // A repo GitHub could not read has no licence answer at all: an empty list
  // fails an allowlist but passes a denylist, the same reading the other
  // pickers give a server with no markers.
  if (!passesTri(server.gh === null ? [] : [server.gh.isFoss], filter.foss)) {
    return false;
  }
  if (filter.hideArchived && server.gh?.archived === true) return false;
  if (filter.minStars !== null && (server.gh?.stars ?? 0) < filter.minStars) {
    return false;
  }
  if (filter.maxStars !== null && (server.gh?.stars ?? 0) > filter.maxStars) {
    return false;
  }
  if (filter.pushedAfter !== null) {
    const pushed = Date.parse(server.gh?.pushedAt ?? "");
    if (Number.isNaN(pushed) || pushed < filter.pushedAfter) return false;
  }
  return true;
}

export function passesFilters(server: Server, filter: FilterState): boolean {
  const haystack = `${server.id} ${server.description}`;
  if (!fuzzyMatch(filter.query, haystack)) return false;
  if (filter.official && !server.official) return false;
  if (!passesTri(server.languages, filter.languages)) return false;
  if (!passesTri(server.scope, filter.scope)) return false;
  if (!passesTri(server.os, filter.os)) return false;
  if (!passesTri(server.categories, filter.categories)) return false;
  if (!passesTri([server.cost.value], filter.cost)) return false;
  if (!passesTri([server.rateLimited.value], filter.rateLimited)) return false;
  if (!passesGrades(server, filter)) return false;
  return passesGithub(server, filter);
}

/**
 * Sort keys split by projected type.
 *
 * Splitting the union at the type level, rather than one projection returning
 * `string | number`, keeps each switch exhaustive with no `default` — so
 * `noFallthroughCasesInSwitch` turns a forgotten key into a compile error
 * instead of an untestable fallback branch.
 */
const TEXT_KEYS = ["category", "name"] as const;

type TextKey = (typeof TEXT_KEYS)[number];
type OrdinalKey = Exclude<SortKey, TextKey>;

function isTextKey(key: SortKey): key is TextKey {
  return (TEXT_KEYS as readonly SortKey[]).includes(key);
}

/**
 * Text projection. Always defined: every server has an id and a category.
 */
function textValue(server: Server, key: TextKey): string {
  return key === "category" ? (server.categories[0] ?? "") : server.id;
}

/**
 * Ordinal projection.
 *
 * Returns null rather than a sentinel for a server whose data is missing, so
 * {@link compare} can pin it last in *both* directions instead of letting
 * "unknown" masquerade as "worst".
 */
function ordinalValue(server: Server, key: OrdinalKey): null | number {
  switch (key) {
    case "created": {
      return server.gh === null ? null : Date.parse(server.gh.createdAt);
    }
    case "grade": {
      return compositeRank(server.glama);
    }
    case "pushed": {
      return server.gh === null ? null : Date.parse(server.gh.pushedAt);
    }
    case "stars": {
      return server.gh === null ? null : server.gh.stars;
    }
  }
}

function compareText(a: Server, b: Server, key: TextKey): number {
  return textValue(a, key).localeCompare(textValue(b, key), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compare(a: Server, b: Server, sort: SortState): number {
  if (isTextKey(sort.key)) {
    const c = compareText(a, b, sort.key) || a.id.localeCompare(b.id);
    return sort.dir === "asc" ? c : -c;
  }

  const va = ordinalValue(a, sort.key);
  const vb = ordinalValue(b, sort.key);

  // Unknown always sinks, regardless of direction: a server with no data is not
  // "the worst one", and flipping to ascending should not promote it to the top.
  if (va === null || vb === null) {
    if (va === vb) return a.id.localeCompare(b.id);
    return va === null ? 1 : -1;
  }

  const c = va - vb || a.id.localeCompare(b.id);
  return sort.dir === "asc" ? c : -c;
}

/**
 * Filters then sorts. Pure: returns a new array, mutates nothing.
 */
export function applyFilterSort(
  servers: readonly Server[],
  filter: FilterState,
  sort: SortState,
): Server[] {
  return servers
    .filter((server) => passesFilters(server, filter))
    .toSorted((a, b) => compare(a, b, sort));
}
