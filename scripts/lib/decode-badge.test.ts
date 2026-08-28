import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { decodeBadge, group, UnknownGlyphError } from "./decode-badge.ts";

const A_OUTLINE =
  "M.27 0l2.73-8h2.14l2.81 8h-1.82l-.61-1.86h-2.85l-.59 1.86Zm2.81-3.14h2.01l-.25-.72q-.18-.61-.39-1.33-.18-.72-.39-1.53-.2.83-.39 1.55-.19.7-.36 1.31Z";

/**
 * Builds a minimal badge with the given grade slots, in axis order.
 */
function badgeSvg(...slots: { d: string; fill: string }[]): string {
  const defs = slots.map((s, index) => `<path id="g${index}" d="${s.d}"/>`).join("");
  const uses = slots
    .map(
      (s, index) =>
        `<use href="#g${index}" x="${11 + index * 13}" y="13" fill="${s.fill}"/>`,
    )
    .join("");
  return `<svg>${uses}<defs>${defs}</defs></svg>`;
}

/**
 * Every fixture is a verbatim badge fetched from the live Glama endpoint, and
 * each decoded result below was cross-checked against that server's rendered
 * page. Synthetic SVGs would test the decoder against my own understanding of
 * the format rather than against the format.
 */
function fixture(name: string): string {
  return readFileSync(
    new URL(`__fixtures__/${name}.svg`, import.meta.url),
    "utf8",
  );
}

describe("decodeBadge on real badges", () => {
  it("decodes a triple-A badge (forgemeshlabs/coinopai-mcp)", () => {
    expect(decodeBadge(fixture("aaa-coinopai"))).toEqual({
      license: "A",
      maintenance: "A",
      quality: "A",
    });
  });

  it("decodes A/A/B (upstash/context7)", () => {
    // Page shows quality=A, maintenance=B.
    expect(decodeBadge(fixture("aab-context7"))).toEqual({
      license: "A",
      maintenance: "B",
      quality: "A",
    });
  });

  it("decodes A/B/A and keeps the axes in order (microsoft/playwright-mcp)", () => {
    // Page shows quality=B, maintenance=A — proving slot 2 is quality and
    // slot 3 is maintenance, not the reverse.
    expect(decodeBadge(fixture("aba-playwright"))).toEqual({
      license: "A",
      maintenance: "A",
      quality: "B",
    });
  });

  it("decodes a D grade (aparajithn/agent-scraper-mcp)", () => {
    expect(decodeBadge(fixture("grade-d-agent-scraper"))?.maintenance).toBe(
      "D",
    );
  });

  it("decodes an F grade (ayo-nci/bulkrender-mcp)", () => {
    const grades = decodeBadge(fixture("grade-f-bulkrender"));
    expect(Object.values(grades ?? {})).toContain("F");
  });
});

// The dash is the single most dangerous part of this format: read naively it
// looks like an "A-" modifier, but Glama has no modifiers at all.
describe("decodeBadge and the ungraded dash", () => {
  it("omits an axis whose slot holds a dash (sooperset/mcp-atlassian)", () => {
    // The page shows maintenance=C and no quality grade whatsoever.
    expect(decodeBadge(fixture("partial-atlassian"))).toEqual({
      license: "A",
      maintenance: "C",
    });
  });

  it("omits the dashed axis rather than reading it as a modifier (Muvon/octocode)", () => {
    // The page shows maintenance=B only. A naive reader sees "A - B" and
    // invents "A-"; the truth is license=A, quality ungraded, maintenance=B.
    const grades = decodeBadge(fixture("modifier-octocode"));
    expect(grades).toEqual({ license: "A", maintenance: "B" });
    expect(grades).not.toHaveProperty("quality");
  });

  it("omits the dashed axis for aitytech/agentkits-memory", () => {
    expect(decodeBadge(fixture("modifier-agentkits"))).toEqual({
      license: "A",
      maintenance: "C",
    });
  });
});

describe("decodeBadge on an unindexed server", () => {
  it("returns null when the badge has no grade slots (Higangssh/homebutler)", () => {
    expect(decodeBadge(fixture("none-homebutler"))).toBeNull();
  });

  it("returns null for an SVG with no uses at all", () => {
    expect(decodeBadge("<svg></svg>")).toBeNull();
  });
});

describe("group", () => {
  it("returns a mandatory capture group", () => {
    const match = /(\d{1,3})-(\d{1,3})/.exec("12-34");
    expect(group(match!, 1)).toBe("12");
    expect(group(match!, 2)).toBe("34");
  });

  it("throws for a group that did not participate", () => {
    // Unreachable through decodeBadge's own regexes, whose groups are all
    // mandatory — exercised directly so the guarantee stays honest rather than
    // becoming an untested `?? ""`.
    const match = /(a)|(b)/.exec("a");
    expect(() => group(match!, 2)).toThrow(/group 2 did not participate/);
  });
});

describe("decodeBadge failure modes", () => {
  it("throws on an unrecognised glyph rather than guessing a grade", () => {
    expect(() =>
      decodeBadge(badgeSvg({ d: "M0 0h9v9z", fill: "#37a169" })),
    ).toThrow(UnknownGlyphError);
  });

  it("names the offending outline in the error", () => {
    expect(() =>
      decodeBadge(badgeSvg({ d: "M0 0h9v9z", fill: "#37a169" })),
    ).toThrow(/M0 0h9v9z/);
  });

  it("throws when a use references a glyph that has no definition", () => {
    expect(() =>
      decodeBadge('<svg><use href="#g0" x="11" y="13" fill="#37a169"/></svg>'),
    ).toThrow(UnknownGlyphError);
  });

  it("ignores slots beyond the three known axes", () => {
    const four = badgeSvg(
      { d: A_OUTLINE, fill: "#37a169" },
      { d: A_OUTLINE, fill: "#37a169" },
      { d: A_OUTLINE, fill: "#37a169" },
      { d: "M0 0h9v9z", fill: "#37a169" }, // would throw if it were read
    );
    expect(decodeBadge(four)).toEqual({
      license: "A",
      maintenance: "A",
      quality: "A",
    });
  });

  it("treats a grey fill as ungraded even if the glyph is a letter", () => {
    // Defence in depth: the dash and the grey fill each independently mark an
    // axis ungraded, so a format tweak to either one still fails safe.
    expect(decodeBadge(badgeSvg({ d: A_OUTLINE, fill: "#555" }))).toEqual({});
  });
});
