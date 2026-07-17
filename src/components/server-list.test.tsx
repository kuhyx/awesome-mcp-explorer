import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Server } from "../lib/server.ts";

import { ServerList } from "./server-list.tsx";

const NOW = Date.parse("2026-07-17T00:00:00Z");

function server(index: number): Server {
  return {
    badgeUrl: null,
    categories: ["Databases"],
    cost: { source: "inferred", value: "unknown" },
    description: `Server number ${index}.`,
    gh: {
      archived: false,
      createdAt: "2024-01-01T00:00:00Z",
      forks: 0,
      isFoss: "yes",
      pushedAt: "2026-07-01T00:00:00Z",
      spdx: "MIT",
      stars: index,
    },
    glama: { license: "A", maintenance: "A", quality: "A" },
    id: `owner/repo-${index}`,
    languages: ["typescript"],
    official: false,
    os: ["linux"],
    owner: "owner",
    rateLimited: { source: "inferred", value: "unknown" },
    repo: `repo-${index}`,
    scope: ["cloud"],
    url: `https://github.com/owner/repo-${index}`,
    
  };
}

const many = (count: number): Server[] =>
  Array.from({ length: count }, (_, index) => server(index));

describe("ServerList", () => {
  it("says so when nothing matches", () => {
    render(<ServerList now={NOW} servers={[]} />);
    expect(screen.getByText("No servers match these filters.")).toBeInTheDocument();
  });

  it("renders a small list in full", () => {
    render(<ServerList now={NOW} servers={many(3)} />);
    expect(screen.getByText("owner/repo-0")).toBeInTheDocument();
    expect(screen.getByText("owner/repo-2")).toBeInTheDocument();
  });

  it("mounts only a window of a large list, not all of it", () => {
    // The whole reason this component exists: 2,981 rows of a dozen chips each
    // would be tens of thousands of nodes.
    render(<ServerList now={NOW} servers={many(2981)} />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    expect(links.length).toBeLessThan(60);
  });

  it("renders the first rows of a large list", () => {
    render(<ServerList now={NOW} servers={many(2981)} />);
    expect(screen.getByText("owner/repo-0")).toBeInTheDocument();
  });
});
