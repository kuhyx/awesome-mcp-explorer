/**
 * Renders the static pages through Astro's Container API, so the head and
 * body the build ships are checked without a full build.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";

import { ABOUT_PAGE, NOT_FOUND_PAGE } from "../../scripts/lib/site/pages.ts";
import { BASE_URL } from "../../scripts/lib/site/site-config.ts";
import NotFound from "./404.astro";
import About from "./about.astro";
import Filters from "./filters.astro";

const container = await AstroContainer.create();

function between(html: string, pattern: RegExp): string {
  return pattern.exec(html)?.[1] ?? "";
}

/**
 * The `<link>` tag with this rel and href, whatever order Astro prints attributes in.
 */
function linkTag(html: string, relation: string, href: string): string {
  const tags = html.match(/<link\b[^>]*>/gu) ?? [];
  return tags.find((tag) => tag.includes(`rel="${relation}"`) && tag.includes(`href="${href}"`)) ?? "";
}

describe("about page", () => {
  it("has the page head: title, description, canonical, discovery links, JSON-LD", async () => {
    const html = await container.renderToString(About);
    expect(html).toContain("<title>About the data · MCP Explorer</title>");
    expect(html).toMatch(/<meta\b(?=[^>]*name="description")(?=[^>]*content="Where each field[^"]*")[^>]*>/u);
    expect(html).toContain(ABOUT_PAGE.description);
    expect(linkTag(html, "canonical", `${BASE_URL}about/`)).not.toBe("");
    expect(linkTag(html, "ai-catalog", "../.well-known/ai-catalog.json")).toContain('type="application/ai-catalog+json"');
    expect(linkTag(html, "alternate", "../llms.txt")).toContain('title="llms.txt"');
    expect(linkTag(html, "alternate", "index.md")).toContain('type="text/markdown"');
    const data = JSON.parse(between(html, /<script type="application\/ld\+json">(.+?)<\/script>/u)) as Record<string, unknown>;
    expect(data["@type"]).toBe("WebPage");
    expect(data.url).toBe(`${BASE_URL}about/`);
  });

  it("links home and renders the blocks with relative links", async () => {
    const html = await container.renderToString(About);
    expect(html).toContain('<nav><a href="../">MCP Explorer</a></nav>');
    expect(html).toContain("<h1>About the data</h1>");
    expect(html).toContain('<a href="../filters/">URL filter reference</a>');
  });
});

describe("filters page", () => {
  it("renders the reference with its own head", async () => {
    const html = await container.renderToString(Filters);
    expect(html).toContain("<title>URL filter reference · MCP Explorer</title>");
    expect(linkTag(html, "canonical", `${BASE_URL}filters/`)).not.toBe("");
    expect(html).toContain('<a href="../">explorer</a>');
  });
});

describe("404 page", () => {
  it("uses absolute links and no discovery tags", async () => {
    const html = await container.renderToString(NotFound);
    expect(html).toContain(`<title>${NOT_FOUND_PAGE.title} · MCP Explorer</title>`);
    expect(html).toContain(`<nav><a href="${BASE_URL}">MCP Explorer</a></nav>`);
    expect(html).toContain(`<a href="${BASE_URL}about/">About the data</a>`);
    expect(html).not.toContain("canonical");
    expect(html).not.toContain("ld+json");
    expect(html).not.toContain("text/markdown");
  });
});
