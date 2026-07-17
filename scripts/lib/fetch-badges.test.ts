import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import type { FetchLike } from "./net.ts";

import { fetchBadges } from "./fetch-badges.ts";
import { nullCache } from "./net.ts";

const AAA_BADGE = readFileSync(
  new URL("__fixtures__/aaa-coinopai.svg", import.meta.url),
  "utf8",
);

function okFetch(body: string): FetchLike {
  return () => Promise.resolve(new Response(body, { status: 200 }));
}

const SVG_URL =
  "https://glama.ai/mcp/servers/forgemeshlabs/coinopai-mcp/badges/score.svg";
const target = { badgeUrl: SVG_URL, id: "forgemeshlabs/coinopai-mcp" };

describe("fetchBadges", () => {
  it("decodes a fetched badge", async () => {
    const [result] = await fetchBadges([target], {
      cache: nullCache(),
      fetchImpl: okFetch(AAA_BADGE),
    });
    expect(result?.grades).toEqual({
      license: "A",
      maintenance: "A",
      quality: "A",
    });
  });

  it("requests the badge URL as given", async () => {
    const fetchImpl = vi.fn(okFetch(AAA_BADGE));
    await fetchBadges([target], { cache: nullCache(), fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(SVG_URL, expect.anything());
  });

  it("reports an unreachable badge without failing the batch", async () => {
    const [result] = await fetchBadges([target], {
      cache: nullCache(),
      fetchImpl: () => Promise.resolve(new Response("", { status: 404 })),
    });
    expect(result?.grades).toBeNull();
    expect(result?.reason).toBe("unreachable");
  });

  it("surfaces an unknown glyph as a flagged failure, not as 'ungraded'", async () => {
    // A format change must be visible in the build report. Silently returning
    // null here would empty the triple-A filter with no indication why.
    const [result] = await fetchBadges([target], {
      cache: nullCache(),
      fetchImpl: okFetch(
        '<svg><use href="#g0" x="11" y="13" fill="#37a169"/><defs><path id="g0" d="M0 0h9v9z"/></defs></svg>',
      ),
    });
    expect(result?.unknownGlyph).toBe(true);
    expect(result?.reason).toMatch(/Unrecognised glyph/);
  });

  it("survives a network error on one badge", async () => {
    const [result] = await fetchBadges([target], {
      cache: nullCache(),
      fetchImpl: () => Promise.reject(new Error("ETIMEDOUT")),
    });
    expect(result?.grades).toBeNull();
    expect(result?.reason).toBe("ETIMEDOUT");
  });

  it("survives a non-Error rejection", async () => {
    const [result] = await fetchBadges([target], {
      cache: nullCache(),
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      fetchImpl: () => Promise.reject("boom"),
    });
    expect(result?.reason).toBe("boom");
  });

  it("decodes from cache without fetching", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    const [result] = await fetchBadges([target], {
      cache: { get: () => Promise.resolve(AAA_BADGE), set: () => Promise.resolve() },
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result?.grades?.license).toBe("A");
  });

  it("caches a freshly fetched badge", async () => {
    const set = vi.fn(() => Promise.resolve());
    await fetchBadges([target], {
      cache: { get: () => Promise.resolve(null), set },
      fetchImpl: okFetch(AAA_BADGE),
    });
    expect(set).toHaveBeenCalledWith(SVG_URL, AAA_BADGE);
  });

  it("reports progress across the batch", async () => {
    const onProgress = vi.fn();
    await fetchBadges([target, { ...target, id: "x/y" }], {
      cache: nullCache(),
      concurrency: 1,
      fetchImpl: okFetch(AAA_BADGE),
      onProgress,
    });
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });
});
