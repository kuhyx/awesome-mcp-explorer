/**
 * A small, real-shaped dataset shared by the element tests and the page render.
 */
import type { GithubFacts, Server } from "../lib/server.ts";

export function facts(over: Partial<GithubFacts> = {}): GithubFacts {
  return {
    archived: false,
    createdAt: "2024-01-01T00:00:00Z",
    forks: 0,
    isFoss: "yes",
    pushedAt: "2026-07-01T00:00:00Z",
    spdx: "MIT",
    stars: 10,
    ...over,
  };
}

export function makeServer(over: Partial<Server> = {}): Server {
  return {
    badgeUrl: null,
    categories: ["Databases"],
    cost: { source: "inferred", value: "likely-free" },
    description: "A server for things.",
    gh: facts(),
    glama: { license: "A", maintenance: "A", quality: "A" },
    id: "acme/aaa-server",
    languages: ["typescript"],
    official: false,
    os: ["linux"],
    owner: "acme",
    rateLimited: { source: "inferred", value: "no" },
    repo: "aaa-server",
    scope: ["cloud"],
    url: "https://github.com/acme/aaa-server",
    ...over,
  };
}

/**
 * Five servers: triple-A, B-graded rust, ungraded (not on Glama), an
 * archived official one with a checked cost, and a repo GitHub 404s on.
 */
export const SERVERS: readonly Server[] = [
  makeServer({ gh: facts({ stars: 500 }) }),
  makeServer({
    gh: facts({ pushedAt: "2025-01-01T00:00:00Z", stars: 50 }),
    glama: { license: "A", maintenance: "B", quality: "A" },
    id: "acme/bbb-server",
    languages: ["rust"],
    repo: "bbb-server",
    url: "https://github.com/acme/bbb-server",
  }),
  makeServer({
    categories: ["Search & Data Extraction"],
    gh: facts({ isFoss: "no", spdx: null, stars: 1500 }),
    glama: null,
    id: "acme/ccc-server",
    repo: "ccc-server",
    scope: ["local"],
    url: "https://github.com/acme/ccc-server",
  }),
  makeServer({
    categories: ["Databases", "Search & Data Extraction"],
    cost: { source: "override", value: "likely-paid" },
    description: "Archived but official.",
    gh: facts({ archived: true, stars: 12_000 }),
    glama: { license: "A", quality: "C" },
    id: "acme/ddd-server",
    official: true,
    rateLimited: { source: "override", value: "yes" },
    repo: "ddd-server",
    url: "https://github.com/acme/ddd-server",
  }),
  makeServer({
    gh: null,
    glama: null,
    id: "acme/eee-server",
    repo: "eee-server",
    url: "https://github.com/acme/eee-server",
  }),
];
