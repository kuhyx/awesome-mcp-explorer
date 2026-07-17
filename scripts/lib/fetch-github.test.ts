import { describe, expect, it, vi } from "vitest";

import type { FetchLike } from "./net.ts";

import { fetchGithub } from "./fetch-github.ts";
import { nullCache } from "./net.ts";

/** A real-shaped `GET /repos/{owner}/{repo}` body. */
function repoBody(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    archived: false,
    created_at: "2024-01-01T00:00:00Z",
    forks_count: 12,
    license: { spdx_id: "MIT" },
    pushed_at: "2026-07-17T09:30:53Z",
    stargazers_count: 59_251,
    ...over,
  });
}

function okFetch(body: string): FetchLike {
  return () => Promise.resolve(new Response(body, { status: 200 }));
}

const base = { cache: nullCache(), token: "t" };

describe("fetchGithub", () => {
  it("maps a repo response onto facts", async () => {
    const [result] = await fetchGithub(["upstash/context7"], {
      ...base,
      fetchImpl: okFetch(repoBody()),
    });
    expect(result).toEqual({
      facts: {
        archived: false,
        createdAt: "2024-01-01T00:00:00Z",
        forks: 12,
        isFoss: "yes",
        pushedAt: "2026-07-17T09:30:53Z",
        spdx: "MIT",
        stars: 59_251,
      },
      id: "upstash/context7",
    });
  });

  it("sends the token and asks for the v3 media type", async () => {
    const fetchImpl = vi.fn(okFetch(repoBody()));
    await fetchGithub(["a/b"], { ...base, fetchImpl });
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.github.com/repos/a/b");
    expect(init?.headers).toMatchObject({ authorization: "Bearer t" });
  });

  it("keeps the entry with null facts when the repo 404s", async () => {
    // Repos in the list get deleted and renamed; the README still lists them,
    // so they must survive rather than vanish from the dataset.
    const [result] = await fetchGithub(["gone/repo"], {
      ...base,
      fetchImpl: () => Promise.resolve(new Response("", { status: 404 })),
    });
    expect(result?.facts).toBeNull();
    expect(result?.reason).toBe("HTTP 404");
  });

  it("survives a network error on one repo", async () => {
    const [result] = await fetchGithub(["a/b"], {
      ...base,
      fetchImpl: () => Promise.reject(new Error("ECONNRESET")),
    });
    expect(result?.facts).toBeNull();
    expect(result?.reason).toBe("ECONNRESET");
  });

  it("survives a non-Error rejection", async () => {
    const [result] = await fetchGithub(["a/b"], {
      ...base,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      fetchImpl: () => Promise.reject("boom"),
    });
    expect(result?.reason).toBe("boom");
  });

  it("treats a repo with no licence as not free", async () => {
    const [result] = await fetchGithub(["a/b"], {
      ...base,
      fetchImpl: okFetch(repoBody({ license: null })),
    });
    expect(result?.facts?.spdx).toBeNull();
    expect(result?.facts?.isFoss).toBe("no");
  });

  it("normalises a NONE spdx id to no licence", async () => {
    const [result] = await fetchGithub(["a/b"], {
      ...base,
      fetchImpl: okFetch(repoBody({ license: { spdx_id: "NONE" } })),
    });
    expect(result?.facts?.spdx).toBeNull();
    expect(result?.facts?.isFoss).toBe("no");
  });

  it("keeps an unidentifiable licence as unknown", async () => {
    const [result] = await fetchGithub(["a/b"], {
      ...base,
      fetchImpl: okFetch(repoBody({ license: { spdx_id: "NOASSERTION" } })),
    });
    expect(result?.facts?.spdx).toBe("NOASSERTION");
    expect(result?.facts?.isFoss).toBe("unknown");
  });

  it("defaults every missing numeric and date field", async () => {
    const [result] = await fetchGithub(["a/b"], { ...base, fetchImpl: okFetch("{}") });
    expect(result?.facts).toEqual({
      archived: false,
      createdAt: "",
      forks: 0,
      isFoss: "no",
      pushedAt: "",
      spdx: null,
      stars: 0,
    });
  });

  it("serves a cached body without fetching", async () => {
    const store = new Map([["https://api.github.com/repos/a/b", repoBody()]]);
    const fetchImpl = vi.fn<FetchLike>();
    const [result] = await fetchGithub(["a/b"], {
      ...base,
      cache: {
        get: (key) => Promise.resolve(store.get(key) ?? null),
        set: () => Promise.resolve(),
      },
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result?.facts?.stars).toBe(59_251);
  });

  it("writes a fetched body to the cache", async () => {
    const set = vi.fn(() => Promise.resolve());
    await fetchGithub(["a/b"], {
      ...base,
      cache: { get: () => Promise.resolve(null), set },
      fetchImpl: okFetch(repoBody()),
    });
    expect(set).toHaveBeenCalledWith(
      "https://api.github.com/repos/a/b",
      repoBody(),
    );
  });

  it("does not cache a failed response", async () => {
    const set = vi.fn(() => Promise.resolve());
    await fetchGithub(["a/b"], {
      ...base,
      cache: { get: () => Promise.resolve(null), set },
      fetchImpl: () => Promise.resolve(new Response("", { status: 500 })),
    });
    expect(set).not.toHaveBeenCalled();
  });

  it("reports progress across the batch", async () => {
    const onProgress = vi.fn();
    await fetchGithub(["a/b", "c/d"], {
      ...base,
      concurrency: 1,
      fetchImpl: okFetch(repoBody()),
      onProgress,
    });
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });
});
