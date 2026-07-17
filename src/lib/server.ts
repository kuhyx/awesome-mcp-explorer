/**
 * The shape of one server in `public/servers.json`.
 *
 * Written by the build pipeline in `scripts/`, read by the app. It is the only
 * contract between the two halves of this repo.
 */
import type { Language, Os, Scope } from "../../scripts/lib/parse-readme.ts";
import type { Grades } from "./grade.ts";

export type { Language, Os, Scope } from "../../scripts/lib/parse-readme.ts";

/** Three-valued answer. `unknown` is a real answer, not a missing one. */
export type Tri = "no" | "unknown" | "yes";

/** Where a fact came from, so the UI can be honest about how much to trust it. */
export type Provenance = "inferred" | "override";

export interface InferredFact<T> {
  readonly source: Provenance;
  readonly value: T;
}

export type Cost = "likely-free" | "likely-paid" | "unknown";

/** GitHub facts. Null on the whole object when the repo 404s (deleted/renamed). */
export interface GithubFacts {
  readonly archived: boolean;
  /** ISO-8601. */
  readonly createdAt: string;
  readonly forks: number;
  /**
   * Whether the license is free/open-source.
   *
   * `unknown` means GitHub found a licence file it could not identify
   * (`NOASSERTION`), or one this project does not classify. It does **not**
   * mean "no licence" — that case is `no`, because unlicensed code is
   * all-rights-reserved by default and you have no right to use it. The two are
   * told apart by `spdx`: null for no licence at all.
   */
  readonly isFoss: Tri;
  /** ISO-8601 of the last push, the liveness signal. */
  readonly pushedAt: string;
  /** SPDX id, or null when the repo has no licence file at all. */
  readonly spdx: null | string;
  readonly stars: number;
}

export interface Server {
  /** Glama badge URL, or null when the README lists no badge. */
  readonly badgeUrl: null | string;
  /** Every `###` section this repo is listed under; monorepos have several. */
  readonly categories: readonly string[];
  readonly cost: InferredFact<Cost>;
  readonly description: string;
  readonly gh: GithubFacts | null;
  /** Glama grades, or null when Glama has not indexed the repo. */
  readonly glama: Grades | null;
  /** `owner/repo`, lowercased. The join key across all three sources. */
  readonly id: string;
  readonly languages: readonly Language[];
  readonly official: boolean;
  readonly os: readonly Os[];
  readonly owner: string;
  readonly rateLimited: InferredFact<Tri>;
  readonly repo: string;
  readonly scope: readonly Scope[];
  readonly url: string;
}
