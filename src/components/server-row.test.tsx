import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GithubFacts, Server } from "../lib/server.ts";

import { formatAge, formatStars, ServerRow } from "./server-row.tsx";

const NOW = Date.parse("2026-07-17T00:00:00Z");

function facts(over: Partial<GithubFacts> = {}): GithubFacts {
  return {
    archived: false,
    createdAt: "2024-01-01T00:00:00Z",
    forks: 3,
    isFoss: "yes",
    pushedAt: "2026-07-16T00:00:00Z",
    spdx: "MIT",
    stars: 59_251,
    ...over,
  };
}

function server(over: Partial<Server> = {}): Server {
  return {
    badgeUrl: null,
    categories: ["Knowledge & Memory"],
    cost: { source: "inferred", value: "likely-free" },
    description: "Up-to-date code documentation for LLMs.",
    gh: facts(),
    glama: { license: "A", maintenance: "B", quality: "A" },
    id: "upstash/context7",
    languages: ["typescript"],
    official: false,
    os: ["linux"],
    owner: "upstash",
    rateLimited: { source: "inferred", value: "no" },
    repo: "context7",
    scope: ["cloud"],
    url: "https://github.com/upstash/context7",
    ...over,
  };
}

const renderRow = (over: Partial<Server> = {}): void => {
  render(<ServerRow now={NOW} server={server(over)} />);
};

describe("formatStars", () => {
  it("shows small counts exactly", () => {
    expect(formatStars(0)).toBe("0");
    expect(formatStars(999)).toBe("999");
  });

  it("abbreviates thousands with one decimal", () => {
    expect(formatStars(5475)).toBe("5.5k");
  });

  it("drops the decimal past ten thousand", () => {
    expect(formatStars(59_251)).toBe("59k");
    expect(formatStars(166_785)).toBe("167k");
  });
});

describe("formatAge", () => {
  it("says today for the last day", () => {
    expect(formatAge("2026-07-17T00:00:00Z", NOW)).toBe("today");
  });

  it("counts days, months and years", () => {
    expect(formatAge("2026-07-10T00:00:00Z", NOW)).toBe("7d ago");
    expect(formatAge("2026-04-17T00:00:00Z", NOW)).toBe("3mo ago");
    expect(formatAge("2024-07-17T00:00:00Z", NOW)).toBe("2y ago");
  });

  it("says unknown for an unparseable date", () => {
    expect(formatAge("", NOW)).toBe("unknown");
  });
});

describe("ServerRow", () => {
  it("links the repo", () => {
    renderRow();
    const link = screen.getByRole("link", { name: "upstash/context7" });
    expect(link).toHaveAttribute("href", "https://github.com/upstash/context7");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("shows the three grades in axis order", () => {
    renderRow();
    const grades = screen.getByTitle("Glama: licence / quality / maintenance");
    expect(grades).toHaveTextContent("AAB");
  });

  it("shows an em-dash for an ungraded axis, not a letter", () => {
    // The real mcp-atlassian shape. A dash means "never graded", and must not
    // be rendered as though it were a grade.
    renderRow({ glama: { license: "A", maintenance: "C" } });
    expect(screen.getByTitle("quality: not graded")).toHaveTextContent("–");
  });

  it("says so when Glama has not indexed the server", () => {
    renderRow({ glama: null });
    expect(screen.getByText("not on Glama")).toBeInTheDocument();
  });

  it("shows the official badge only when official", () => {
    renderRow();
    expect(screen.queryByTitle("Official implementation")).not.toBeInTheDocument();
    render(<ServerRow now={NOW} server={server({ official: true })} />);
    expect(screen.getByTitle("Official implementation")).toBeInTheDocument();
  });

  it("flags an archived repo", () => {
    renderRow({ gh: facts({ archived: true }) });
    expect(screen.getByTitle("Archived on GitHub")).toBeInTheDocument();
  });

  it("shows stars, age and licence", () => {
    renderRow();
    expect(screen.getByTitle("GitHub stars")).toHaveTextContent("59k");
    expect(screen.getByTitle("Last push")).toHaveTextContent("1d ago");
    expect(screen.getByTitle("MIT")).toHaveTextContent("MIT");
  });

  it("copes with a repo GitHub could not read", () => {
    renderRow({ gh: null });
    expect(screen.getByTitle("GitHub stars")).toHaveTextContent("?");
    expect(screen.getByTitle("Last push")).toHaveTextContent("gone");
    expect(
      screen.getByTitle("No licence file: all rights reserved"),
    ).toHaveTextContent("no licence");
  });

  it("lists languages, scope and categories", () => {
    renderRow({ categories: ["Databases", "Search"], languages: ["rust"] });
    expect(screen.getByText("rust")).toBeInTheDocument();
    expect(screen.getByText("cloud")).toBeInTheDocument();
    expect(screen.getByText("Databases")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });
});

// The core honesty rule: an inference must never look like a fact.
describe("ServerRow provenance", () => {
  it("marks an inferred value with ~ and says it is inferred", () => {
    renderRow();
    const chip = screen.getByText("~free");
    expect(chip).toHaveClass("chip-inferred");
    expect(chip).toHaveAttribute("title", expect.stringContaining("Inferred"));
    expect(chip).toHaveAttribute(
      "title",
      expect.stringContaining("overrides.json"),
    );
  });

  it("renders an override as a plain fact, with no ~", () => {
    renderRow({ cost: { source: "override", value: "likely-paid" } });
    const chip = screen.getByText("paid");
    expect(chip).toHaveClass("chip-fact");
    expect(chip).toHaveAttribute("title", expect.stringContaining("Checked by hand"));
  });

  it("marks rate limiting the same way", () => {
    renderRow();
    expect(screen.getByText("~no rate limit")).toHaveClass("chip-inferred");
  });

  it("labels an unknown cost as unknown rather than guessing", () => {
    renderRow({ cost: { source: "inferred", value: "unknown" } });
    expect(screen.getByText("~cost unknown")).toBeInTheDocument();
  });
});
