/**
 * Joins the three sources into the dataset the app reads.
 *
 * README (structure) + GitHub (licence, stars, liveness) + Glama (grades),
 * then hand-written overrides on top for the two fields nobody publishes.
 */
import type { Cost, Server, Tri } from "../../src/lib/server.ts";
import type { BadgeResult } from "./fetch-badges.ts";
import type { GithubResult } from "./fetch-github.ts";
import type { MergedEntry } from "./parse-readme.ts";

import { inferCost, inferRateLimited } from "./classify.ts";

/**
 * A hand-written correction for a single server, keyed by `owner/repo`.
 *
 * Only cost and rateLimited are overridable: they are the two fields this
 * project infers rather than reads. Everything else has an authoritative
 * source, so an override would just be a fork of upstream data waiting to
 * go stale.
 */
export interface Override {
  readonly cost?: Cost;
  /** Free-text note for the file's own readers; not shown in the UI. */
  readonly note?: string;
  readonly rateLimited?: Tri;
}

export type Overrides = Readonly<Record<string, Override>>;

export function mergeAll(
  entries: readonly MergedEntry[],
  github: readonly GithubResult[],
  badges: readonly BadgeResult[],
  overrides: Overrides,
): Server[] {
  const githubById = new Map(github.map((r) => [r.id, r]));
  const badgeById = new Map(badges.map((r) => [r.id, r]));

  return entries.map((entry) => {
    const override = overrides[entry.id];
    const badge = badgeById.get(entry.id);

    return {
      badgeUrl: entry.badgeUrl,
      categories: entry.categories,
      cost: {
        source: override?.cost === undefined ? "inferred" : "override",
        value: override?.cost ?? inferCost(entry.description, entry.scope),
      },
      description: entry.description,
      gh: githubById.get(entry.id)?.facts ?? null,
      // Absent from the badge map means the README linked no badge at all;
      // present-but-null means Glama serves a badge with no grade slots. Both
      // are "not indexed" to the UI, so both collapse to null here.
      glama: badge?.grades ?? null,
      id: entry.id,
      languages: entry.languages,
      official: entry.official,
      os: entry.os,
      owner: entry.owner,
      rateLimited: {
        source: override?.rateLimited === undefined ? "inferred" : "override",
        value:
          override?.rateLimited ?? inferRateLimited(entry.description, entry.scope),
      },
      repo: entry.repo,
      scope: entry.scope,
      url: entry.url,
    };
  });
}
