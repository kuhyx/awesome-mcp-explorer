import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FIXTURE_PATH } from "../test/fixture-path.ts";
import { SERVERS } from "../test/fixtures.ts";
import { bodyOf, renderHome } from "../test/render-home.ts";

const html = await renderHome(SERVERS);
const body = bodyOf(html);

function rowIds(markup: string): string[] {
  return markup
    .matchAll(/<article class="row[^"]*" data-id="([^"]+)"/g)
    .map((match) => match[1] ?? "")
    .toArray();
}

function proseOf(markup: string): string {
  const start = markup.indexOf('<section class="prerender sr-only">');
  const section = markup.slice(start, markup.indexOf("</section>", start));
  return section.replaceAll(/<[^<>]*>/g, " ");
}

describe("homepage prerender", () => {
  it("matches the markup the jsdom element tests run against", () => {
    if (process.env.UPDATE_HOME_FIXTURE === "1") writeFileSync(FIXTURE_PATH, body);
    expect(readFileSync(FIXTURE_PATH, "utf8"), "regenerate with UPDATE_HOME_FIXTURE=1").toBe(body);
  });

  it("prints every server as a keyed row in the default order, with no JavaScript", () => {
    expect(rowIds(html)).toEqual([
      "acme/ddd-server",
      "acme/ccc-server",
      "acme/aaa-server",
      "acme/bbb-server",
      "acme/eee-server",
    ]);
  });

  it("puts each server's description and link in the raw HTML", () => {
    expect(html).toContain("Archived but official.");
    expect(html).toContain('href="https://github.com/acme/bbb-server"');
  });

  it("prints an absolute date, never a relative age that would go stale", () => {
    expect(html).toContain('<time class="row-age" datetime="2026-07-01T00:00:00Z">2026-07-01</time>');
    expect(html).not.toMatch(/\d(d|mo|y) ago/);
  });

  it("sets the title, description, canonical link and JSON-LD", () => {
    expect(html).toContain("<title>MCP Explorer</title>");
    expect(html).toMatch(/<meta content="Filter and sort every server[^"]*" name="description">/);
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"WebApplication"');
  });

  it("prerenders the header, stat bar and filter shells", () => {
    expect(html).toContain('<span class="sr-only">MCP Explorer</span></h1>');
    expect(html).toContain("<strong data-shown>5</strong> / <span data-total>5</span>");
    for (const facet of ["languages", "scope", "os", "foss", "cost", "rateLimited", "categories"]) {
      expect(html).toMatch(new RegExp(`<fieldset[^>]*class="facet"[^>]*data-facet="${facet}"`));
    }
    expect(html).toContain('data-slider="stars"');
    expect(html).toContain('data-slider="pushed"');
    expect(html).toContain('data-preset="aaa=1"');
  });

  it("starts the facet counts from the whole list", () => {
    const start = html.indexOf('data-option="rust"');
    const button = html.slice(start, html.indexOf("</button>", start));
    expect(button).toContain('<span class="tri-count">1</span>');
  });

  it("keeps the prose and the links to about/ and filters/ for no-JS readers and crawlers", () => {
    expect(proseOf(html).length).toBeGreaterThan(400);
    expect(html).toContain('href="about/"');
    expect(html).toContain('href="filters/"');
    expect(html).toContain('<section class="prerender sr-only">');
  });

  it("has exactly one h1", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
  });
});

describe("homepage prerender without a dataset", () => {
  it("still renders the page, with no rows, as CI builds it", async () => {
    const empty = await renderHome([]);
    expect(rowIds(empty)).toEqual([]);
    expect(empty).toContain("<strong data-shown>0</strong> / <span data-total>0</span>");
    expect(empty).toContain('href="about/"');
    expect(empty).toContain("<title>MCP Explorer</title>");
  });
});
