import { createHash } from "node:crypto";
/**
 * Shared plumbing for the two network stages: a disk cache, a concurrency
 * limiter, and the injected-fetch seam that keeps those stages testable.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** The subset of `fetch` this pipeline uses, so tests can supply a fake. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface Cache {
  get(key: string): Promise<null | string>;
  set(key: string, value: string): Promise<void>;
}

/**
 * A cache on disk, one file per key.
 *
 * Re-running the pipeline is meant to be nearly free: ~3,000 GitHub calls and
 * ~1,600 badge fetches are slow and, in GitHub's case, rate limited. Keys are
 * hashed because they are URLs and would otherwise be illegal filenames.
 */
export function diskCache(directory: string): Cache {
  const pathFor = (key: string): string =>
    path.join(directory, `${createHash("sha256").update(key).digest("hex")}.cache`);

  return {
    async get(key) {
      try {
        return await readFile(pathFor(key), "utf8");
      } catch {
        // A miss and an unreadable file are the same thing to a caller: refetch.
        return null;
      }
    },
    async set(key, value) {
      const filePath = pathFor(key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, value, "utf8");
    },
  };
}

/** A cache that never hits, for tests and for `--no-cache` runs. */
export function nullCache(): Cache {
  return {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
  };
}

/**
 * Runs `worker` over `items` with at most `limit` in flight.
 *
 * Results keep the input order regardless of completion order, because the
 * merge stage joins on index-independent ids and reordering would only make
 * the build report harder to read.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = Array.from<R>({ length: items.length });
  let done = 0;

  // One shared iterator is the whole queue: `for...of` pulls the next entry
  // atomically (JS is single-threaded), so N concurrent loops each take
  // distinct items and stop together when it drains. This also keeps `item`
  // typed as T — indexing would type it `T | undefined` under
  // noUncheckedIndexedAccess and force an unreachable guard.
  const queue = items.entries();

  async function run(): Promise<void> {
    for (const [index, item] of queue) {
      results[index] = await worker(item, index);
      done += 1;
      onProgress?.(done, items.length);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}
