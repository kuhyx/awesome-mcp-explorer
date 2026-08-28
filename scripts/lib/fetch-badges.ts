/**
 * Fetches and decodes Glama score badges.
 *
 * Only badge URLs the README already publishes are fetched — this never probes
 * Glama for servers it does not link, and never touches `/api/`, which
 * `robots.txt` disallows. Badges are the surface Glama publishes for embedding;
 * the README hotlinks these exact URLs already.
 */
import type { Grades } from "../../src/lib/grade.ts";
import type { Cache, FetchLike } from "./net.ts";

import { decodeBadge, UnknownGlyphError } from "./decode-badge.ts";
import { mapLimit } from "./net.ts";

export interface BadgeTarget {
  /**
   * The full badge SVG URL: the README's image src, or a derived one.
   */
  readonly badgeUrl: string;
  readonly id: string;
}

export interface BadgeResult {
  readonly grades: Grades | null;
  readonly id: string;
  /**
   * Set when the badge could not be read or decoded, for the build report.
   */
  readonly reason?: string;
  /**
   * True when decoding failed on an unknown glyph — a format change, not a miss.
   */
  readonly unknownGlyph?: boolean;
}

export interface FetchBadgesOptions {
  readonly cache: Cache;
  readonly concurrency?: number;
  readonly fetchImpl: FetchLike;
  readonly onProgress?: (done: number, total: number) => void;
}

/**
 * Deliberately gentle: this is someone else's site and the data is not urgent.
 */
const DEFAULT_CONCURRENCY = 4;

async function fetchOne(
  target: BadgeTarget,
  options: FetchBadgesOptions,
): Promise<BadgeResult> {
  const url = target.badgeUrl;

  const cached = await options.cache.get(url);
  const svg = cached ?? (await readBadge(url, options));
  if (svg === null) return { grades: null, id: target.id, reason: "unreachable" };
  if (cached === null) await options.cache.set(url, svg);

  // Decode failures propagate to the batch handler, which tags an unknown glyph
  // distinctly — see fetchBadges.
  return { grades: decodeBadge(svg), id: target.id };
}

async function readBadge(
  url: string,
  options: FetchBadgesOptions,
): Promise<null | string> {
  const response = await options.fetchImpl(url, {
    headers: { "user-agent": "awesome-mcp-explorer" },
  });
  return response.ok ? await response.text() : null;
}

/**
 * Fetches and decodes every badge, in input order. Never rejects for one bad badge.
 */
export function fetchBadges(
  targets: readonly BadgeTarget[],
  options: FetchBadgesOptions,
): Promise<BadgeResult[]> {
  return mapLimit(
    targets,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (target) => {
      try {
        return await fetchOne(target, options);
      } catch (error) {
        return {
          grades: null,
          id: target.id,
          reason: Error.isError(error) ? error.message : String(error),
          // Surfaced, never swallowed: an unknown glyph means Glama changed the
          // badge format. Quietly treating it as "ungraded" would empty the
          // triple-A filter with no indication why, so the build fails on it.
          ...(error instanceof UnknownGlyphError && { unknownGlyph: true }),
        };
      }
    },
    options.onProgress,
  );
}
