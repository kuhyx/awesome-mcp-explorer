/**
 * robots.txt, sitemap.xml, llms.txt and the AI Catalog.
 *
 * These are what an agent reads before any page, and they are served
 * byte-for-byte. Each test pins the shape the shared AgentReady checker
 * (~/src/utils/agent_ready) requires, plus the one thing it cannot see from a
 * build directory: every absolute URL is on the canonical host.
 */
import { describe, expect, it } from "vitest";

import { aiCatalog, llmsTxt, robotsTxt, sitemapXml } from "./discovery.ts";
import { PAGES } from "./pages.ts";
import { absoluteUrl, BASE_URL } from "./site-config.ts";

const AGENTS = ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended"];

describe("robotsTxt", () => {
  const robots = robotsTxt();

  it("has a wildcard group that allows everything", () => {
    expect(robots).toMatch(/^User-agent: \*\nAllow: \/$/mu);
  });

  it.each(AGENTS)("explicitly allows %s", (agent) => {
    expect(robots).toContain(`User-agent: ${agent}\nAllow: /`);
  });

  it("disallows nothing", () => {
    expect(robots).not.toMatch(/^Disallow:\s*\S/mu);
  });

  it("points at the sitemap under the base URL", () => {
    expect(robots).toContain(`Sitemap: ${BASE_URL}sitemap.xml\n`);
  });
});

describe("sitemapXml", () => {
  const xml = sitemapXml();

  it("lists every page by absolute URL on the canonical host", () => {
    const locs = xml
      .matchAll(/<loc>([^<]+)<\/loc>/gu)
      .map((m) => m[1] ?? "")
      .toArray();
    expect(locs).toStrictEqual(PAGES.map((page) => absoluteUrl(page.path)));
    for (const loc of locs) expect(loc.startsWith(BASE_URL)).toBe(true);
  });

  it("is a sitemaps.org urlset", () => {
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/u);
  });
});

describe("llmsTxt", () => {
  const llms = llmsTxt();

  it("opens with an H1 and a blockquote summary", () => {
    expect(llms).toMatch(/^# MCP Explorer\n\n> \S/u);
  });

  it("links every page and its markdown mirror with a note", () => {
    for (const page of PAGES) {
      expect(llms).toContain(`- [${page.title}](${absoluteUrl(page.path)}): ${page.description}`);
      const mirror = absoluteUrl(`${page.path}index.md`);
      expect(llms).toContain(`(${mirror})`);
    }
  });

  it("groups links under H2 sections", () => {
    expect(llms).toMatch(/^## Pages$/mu);
    expect(llms).toMatch(/^## Markdown mirrors$/mu);
  });
});

describe("aiCatalog", () => {
  const catalog = aiCatalog();

  it("is a valid AI Catalog 1.0 document", () => {
    expect(catalog.specVersion).toBe("1.0");
    expect(catalog.host.displayName).toBe("MCP Explorer");
    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(/^urn:air:awesome-mcp-explorer\.kuhy\.duckdns\.org:site:[a-z:]+$/u);
      expect(entry.type).toMatch(/^[a-z]+\/[a-z+.-]+$/u);
      expect(entry.url.startsWith(BASE_URL)).toBe(true);
    }
  });

  it("lists llms.txt, the sitemap and every markdown mirror", () => {
    const urls = catalog.entries.map((entry) => entry.url);
    expect(urls).toContain(absoluteUrl("llms.txt"));
    expect(urls).toContain(absoluteUrl("sitemap.xml"));
    for (const page of PAGES) expect(urls).toContain(absoluteUrl(`${page.path}index.md`));
  });

  it("has unique identifiers", () => {
    const ids = catalog.entries.map((entry) => entry.identifier);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
