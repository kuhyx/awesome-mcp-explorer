import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

import { diskCache, mapLimit, nullCache } from "./net.ts";

const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "amx-test-"));
  directories.push(directory);
  return directory;
}

afterAll(async () => {
  await Promise.all(directories.map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("diskCache", () => {
  it("round-trips a value", async () => {
    const cache = diskCache(await temporaryDirectory());
    await cache.set("https://example.com/a", "hello");
    expect(await cache.get("https://example.com/a")).toBe("hello");
  });

  it("misses for an unknown key", async () => {
    const cache = diskCache(await temporaryDirectory());
    expect(await cache.get("https://example.com/nope")).toBeNull();
  });

  it("keeps distinct keys apart", async () => {
    const cache = diskCache(await temporaryDirectory());
    await cache.set("a", "1");
    await cache.set("b", "2");
    expect(await cache.get("a")).toBe("1");
    expect(await cache.get("b")).toBe("2");
  });

  it("accepts a URL as a key despite the slashes", async () => {
    const cache = diskCache(await temporaryDirectory());
    const key = "https://api.github.com/repos/foo/bar?x=1";
    await cache.set(key, "ok");
    expect(await cache.get(key)).toBe("ok");
  });
});

describe("nullCache", () => {
  it("never hits", async () => {
    const cache = nullCache();
    await cache.set("a", "1");
    expect(await cache.get("a")).toBeNull();
  });
});

describe("mapLimit", () => {
  it("maps every item, preserving input order", async () => {
    const out = await mapLimit([1, 2, 3, 4, 5], 2, (n) => Promise.resolve(n * 2));
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it("keeps input order even when later items finish first", async () => {
    const out = await mapLimit([30, 0, 10], 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });
    expect(out).toEqual([30, 0, 10]);
  });

  it("never exceeds the concurrency limit", async () => {
    let live = 0;
    let peak = 0;
    await mapLimit(Array.from({ length: 20 }, (_, index) => index), 4, async () => {
      live += 1;
      peak = Math.max(peak, live);
      await new Promise((resolve) => setTimeout(resolve, 1));
      live -= 1;
    });
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("reports progress once per item", async () => {
    const onProgress = vi.fn();
    await mapLimit([1, 2, 3], 2, (n) => Promise.resolve(n), onProgress);
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
  });

  it("handles an empty list without spawning workers", async () => {
    const worker = vi.fn();
    expect(await mapLimit([], 4, worker)).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it("copes with a limit larger than the list", async () => {
    expect(await mapLimit([1, 2], 99, (n) => Promise.resolve(n))).toEqual([1, 2]);
  });
});
