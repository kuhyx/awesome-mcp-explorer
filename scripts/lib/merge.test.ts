import { describe, expect, it } from "vitest";

import type { MergedEntry } from "./parse-readme.ts";

import { mergeAll } from "./merge.ts";

function entry(over: Partial<MergedEntry> = {}): MergedEntry {
  return {
    badgeUrl: null,
    categories: ["Databases"],
    description: "A server.",
    id: "a/b",
    languages: ["typescript"],
    official: false,
    os: ["linux"],
    owner: "a",
    repo: "b",
    scope: ["cloud"],
    url: "https://github.com/a/b",
    ...over,
  };
}

const facts = {
  archived: false,
  createdAt: "2024-01-01T00:00:00Z",
  forks: 1,
  isFoss: "yes",
  pushedAt: "2026-07-01T00:00:00Z",
  spdx: "MIT",
  stars: 10,
} as const;

describe("mergeAll", () => {
  it("joins github facts onto the entry", () => {
    const [server] = mergeAll([entry()], [{ facts, id: "a/b" }], [], {});
    expect(server?.gh).toEqual(facts);
  });

  it("joins glama grades onto the entry", () => {
    const [server] = mergeAll(
      [entry()],
      [],
      [{ grades: { license: "A", maintenance: "A", quality: "A" }, id: "a/b" }],
      {},
    );
    expect(server?.glama).toEqual({
      license: "A",
      maintenance: "A",
      quality: "A",
    });
  });

  it("leaves gh null when the repo could not be read", () => {
    const [server] = mergeAll(
      [entry()],
      [{ facts: null, id: "a/b", reason: "HTTP 404" }],
      [],
      {},
    );
    expect(server?.gh).toBeNull();
  });

  it("leaves glama null when the README linked no badge", () => {
    const [server] = mergeAll([entry()], [], [], {});
    expect(server?.glama).toBeNull();
  });

  it("leaves glama null when the badge carried no grade slots", () => {
    // "Serves a badge with no grades" and "has no badge" are both not-indexed.
    const [server] = mergeAll([entry()], [], [{ grades: null, id: "a/b" }], {});
    expect(server?.glama).toBeNull();
  });

  it("does not join facts from a different repo", () => {
    const [server] = mergeAll([entry()], [{ facts, id: "other/repo" }], [], {});
    expect(server?.gh).toBeNull();
  });

  it("carries the README fields through unchanged", () => {
    const [server] = mergeAll(
      [entry({ categories: ["Databases", "Search"], official: true })],
      [],
      [],
      {},
    );
    expect(server?.categories).toEqual(["Databases", "Search"]);
    expect(server?.official).toBe(true);
    expect(server?.url).toBe("https://github.com/a/b");
  });
});

describe("mergeAll inference and overrides", () => {
  it("marks an inferred cost as inferred", () => {
    const [server] = mergeAll(
      [entry({ description: "Weather, no API key required.", scope: ["cloud"] })],
      [],
      [],
      {},
    );
    expect(server?.cost).toEqual({ source: "inferred", value: "likely-free" });
  });

  it("lets an override replace the inferred cost and marks the provenance", () => {
    const [server] = mergeAll(
      [entry({ description: "Weather, no API key required." })],
      [],
      [],
      { "a/b": { cost: "likely-paid", note: "checked the pricing page" } },
    );
    expect(server?.cost).toEqual({ source: "override", value: "likely-paid" });
  });

  it("lets an override replace rateLimited independently of cost", () => {
    const [server] = mergeAll([entry()], [], [], { "a/b": { rateLimited: "no" } });
    expect(server?.rateLimited).toEqual({ source: "override", value: "no" });
    expect(server?.cost.source).toBe("inferred");
  });

  it("ignores an override aimed at another repo", () => {
    const [server] = mergeAll([entry()], [], [], {
      "someone/else": { cost: "likely-paid" },
    });
    expect(server?.cost.source).toBe("inferred");
  });

  it("infers rateLimited from the description and scope", () => {
    const [server] = mergeAll(
      [entry({ description: "Controls local Chrome.", scope: ["local"] })],
      [],
      [],
      {},
    );
    expect(server?.rateLimited).toEqual({ source: "inferred", value: "no" });
  });
});
