/**
 * Facet counts and distributions derived from a server set.
 *
 * Counts are computed from the *currently filtered* set, so each option shows
 * what clicking it would actually yield rather than a static total — the
 * difference between "Rust (90)" always and "Rust (3)" once you have also
 * ticked Triple-A.
 */
import type { GradeCoverage } from "./grade.ts";
import type { Cost, Language, Os, Scope, Server, Tri } from "./server.ts";

import { gradeCoverage, isTripleA as isAllA } from "./grade.ts";

/** Triple-A, tolerating an unindexed server. */
function isTripleA(grades: Server["glama"]): boolean {
  return grades !== null && isAllA(grades);
}

export interface Facets {
  readonly categories: ReadonlyMap<string, number>;
  readonly cost: ReadonlyMap<Cost, number>;
  readonly foss: ReadonlyMap<Tri, number>;
  readonly gradeCoverage: ReadonlyMap<GradeCoverage, number>;
  readonly languages: ReadonlyMap<Language, number>;
  readonly official: number;
  readonly os: ReadonlyMap<Os, number>;
  readonly rateLimited: ReadonlyMap<Tri, number>;
  readonly scope: ReadonlyMap<Scope, number>;
  readonly tripleA: number;
}

function tally<T>(counts: Map<T, number>, key: T): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

export function computeFacets(servers: readonly Server[]): Facets {
  const categories = new Map<string, number>();
  const languages = new Map<Language, number>();
  const scope = new Map<Scope, number>();
  const os = new Map<Os, number>();
  const cost = new Map<Cost, number>();
  const foss = new Map<Tri, number>();
  const rateLimited = new Map<Tri, number>();
  const coverage = new Map<GradeCoverage, number>();
  let official = 0;
  let tripleA = 0;

  for (const server of servers) {
    for (const c of server.categories) tally(categories, c);
    for (const l of server.languages) tally(languages, l);
    for (const s of server.scope) tally(scope, s);
    for (const o of server.os) tally(os, o);
    tally(cost, server.cost.value);
    tally(rateLimited, server.rateLimited.value);
    tally(coverage, gradeCoverage(server.glama));
    // A 404'd repo has no licence answer at all, which is distinct from
    // "unknown licence" — it is excluded from the foss tally rather than
    // inflating any bucket.
    if (server.gh !== null) tally(foss, server.gh.isFoss);
    if (server.official) official += 1;
    if (isTripleA(server.glama)) tripleA += 1;
  }

  return {
    categories,
    cost,
    foss,
    gradeCoverage: coverage,
    languages,
    official,
    os,
    rateLimited,
    scope,
    tripleA,
  };
}

/**
 * Ascending star counts across servers GitHub could read.
 *
 * Feeds the quantile slider. Repos with no GitHub data contribute nothing:
 * counting them as 0 stars would drag the whole distribution down and make the
 * median lie.
 */
export function starValues(servers: readonly Server[]): number[] {
  return servers
    .flatMap((s) => (s.gh === null ? [] : [s.gh.stars]))
    .toSorted((a, b) => a - b);
}

/** Ascending last-push timestamps (epoch ms), for the recency slider. */
export function pushedValues(servers: readonly Server[]): number[] {
  return servers
    .flatMap((s) => {
      if (s.gh === null) return [];
      const t = Date.parse(s.gh.pushedAt);
      return Number.isNaN(t) ? [] : [t];
    })
    .toSorted((a, b) => a - b);
}

/**
 * How many servers a grade filter cannot speak for.
 *
 * Surfaced next to any grade control so an empty result is never mistaken for
 * "no such servers exist" — roughly half the list has no Glama grade at all.
 */
export function ungradedCount(servers: readonly Server[]): number {
  return servers.filter((s) => gradeCoverage(s.glama) === "not-indexed").length;
}
