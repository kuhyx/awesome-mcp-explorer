/**
 * Fetches repository facts from the GitHub REST API.
 *
 * GitHub rather than Glama is the licence source on purpose: Glama's own
 * `spdxLicense` is null for roughly a quarter of servers, and its API is
 * disallowed to crawlers by `robots.txt` anyway. GitHub is authoritative, and
 * it throws in stars / pushedAt / archived for free — which become the
 * distribution sliders and the "dead project" filter.
 */
import type { GithubFacts } from "../../src/lib/server.ts";
import type { Cache, FetchLike } from "./net.ts";

import { classifyFoss } from "./classify.ts";
import { mapLimit } from "./net.ts";

/**
 * The fields this pipeline reads from `GET /repos/{owner}/{repo}`.
 */
interface RepoResponse {
  archived?: boolean;
  created_at?: string;
  forks_count?: number;
  license?: null | { spdx_id?: null | string };
  pushed_at?: string;
  stargazers_count?: number;
}

export interface GithubResult {
  readonly facts: GithubFacts | null;
  readonly id: string;
  /**
   * Set when the repo could not be read, for the build report.
   */
  readonly reason?: string;
}

export interface FetchGithubOptions {
  readonly cache: Cache;
  readonly concurrency?: number;
  readonly fetchImpl: FetchLike;
  readonly onProgress?: (done: number, total: number) => void;
  /**
   * A GitHub token. Without one the limit is 60/hour, which cannot do 3,000 repos.
   */
  readonly token: string;
}

/**
 * Anonymous GitHub allows 60 requests/hour; a token allows 5,000.
 */
const DEFAULT_CONCURRENCY = 8;

function toFacts(body: RepoResponse): GithubFacts {
  // GitHub omits `license` entirely for a repo with no licence file, and sets
  // spdx_id to "NONE" in some responses. classifyFoss treats both as "no".
  const spdx = body.license?.spdx_id ?? null;
  return {
    archived: body.archived ?? false,
    createdAt: body.created_at ?? "",
    forks: body.forks_count ?? 0,
    isFoss: classifyFoss(spdx),
    pushedAt: body.pushed_at ?? "",
    spdx: spdx === "NONE" ? null : spdx,
    stars: body.stargazers_count ?? 0,
  };
}

async function fetchOne(
  id: string,
  options: FetchGithubOptions,
): Promise<GithubResult> {
  const url = `https://api.github.com/repos/${id}`;

  const cached = await options.cache.get(url);
  if (cached !== null) {
    return { facts: toFacts(JSON.parse(cached) as RepoResponse), id };
  }

  const response = await options.fetchImpl(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${options.token}`,
      "user-agent": "awesome-mcp-explorer",
    },
  });

  if (!response.ok) {
    // 404 is expected and common: repos in the list get deleted or renamed.
    // The entry survives with gh: null rather than being dropped, because the
    // README still lists it and the UI should say so.
    return { facts: null, id, reason: `HTTP ${response.status}` };
  }

  const text = await response.text();
  await options.cache.set(url, text);
  return { facts: toFacts(JSON.parse(text) as RepoResponse), id };
}

/**
 * Fetches facts for every id, in input order. Never rejects for one bad repo.
 */
export function fetchGithub(
  ids: readonly string[],
  options: FetchGithubOptions,
): Promise<GithubResult[]> {
  return mapLimit(
    ids,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (id) => {
      try {
        return await fetchOne(id, options);
      } catch (error) {
        return {
          facts: null,
          id,
          reason: Error.isError(error) ? error.message : String(error),
        };
      }
    },
    options.onProgress,
  );
}
