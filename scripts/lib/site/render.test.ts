/**
 * HTML and markdown renderings of the page table.
 *
 * Both renderers read the same blocks, so the prerendered HTML and the
 * markdown mirror can never say different things.
 */
import { describe, expect, it } from "vitest";

import type { Page } from "./pages.ts";

import { headTags, pageDocument, renderBlocks } from "./render-html.ts";
import { pageMarkdown } from "./render-markdown.ts";
import { BASE_URL } from "./site-config.ts";

const PAGE: Page = {
  blocks: [
    { kind: "paragraph", text: "See [filters](filters/) and `q=<x>` & **bold**." },
    { kind: "heading", text: "Links" },
    { items: ["[Glama](https://glama.ai/mcp)", "plain"], kind: "list" },
    { kind: "code", lang: "text", text: "?aaa=1&lang=rust" },
  ],
  description: "A test page.",
  path: "about/",
  title: "About <it>",
};

describe("renderBlocks", () => {
  const html = renderBlocks(PAGE.blocks, (href) => `REL:${href}`);

  it("escapes text and renders inline markup", () => {
    expect(html).toContain('<p>See <a href="REL:filters/">filters</a> and <code>q=&lt;x&gt;</code> &amp; <strong>bold</strong>.</p>');
  });

  it("renders headings and lists", () => {
    expect(html).toContain("<h2>Links</h2>");
    expect(html).toContain('<ul><li><a href="REL:https://glama.ai/mcp">Glama</a></li><li>plain</li></ul>');
  });

  it("language-tags every code block", () => {
    expect(html).toContain('<pre><code class="language-text">?aaa=1&amp;lang=rust</code></pre>');
  });
});

describe("headTags", () => {
  const head = headTags(PAGE);

  it("links the catalog, llms.txt and the markdown mirror relative to the page", () => {
    expect(head).toContain('<link rel="ai-catalog" href="../.well-known/ai-catalog.json" type="application/ai-catalog+json">');
    expect(head).toContain('<link rel="alternate" type="text/plain" href="../llms.txt" title="llms.txt">');
    expect(head).toContain('<link rel="alternate" type="text/markdown" href="index.md">');
  });

  it("sets an absolute canonical URL on the canonical host", () => {
    expect(head).toContain(`<link rel="canonical" href="${BASE_URL}about/">`);
  });

  it("carries JSON-LD with @context, with < escaped", () => {
    const json = /<script type="application\/ld\+json">(.+?)<\/script>/u.exec(head)?.[1] ?? "";
    expect(json).not.toContain("<");
    const data = JSON.parse(json) as Record<string, unknown>;
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("WebPage");
    expect(data.name).toBe("About <it>");
  });

  it("describes the homepage as the web application itself", () => {
    const home = headTags({ ...PAGE, path: "" });
    expect(home).toContain('"@type":"WebApplication"');
    expect(home).toContain('href="index.md"');
  });
});

describe("pageDocument", () => {
  it("is a complete document with a home link and an escaped title", () => {
    const html = pageDocument(PAGE);
    expect(html).toMatch(/^<!doctype html>\n<html lang="en">/u);
    expect(html).toContain("<title>About &lt;it&gt; · MCP Explorer</title>");
    expect(html).toContain('<a href="../">MCP Explorer</a>');
    expect(html).toContain('<a href="../filters/">filters</a>');
  });

  it("uses absolute links and no page-only tags for the 404 page", () => {
    const html = pageDocument(PAGE, { absolute: true });
    expect(html).toContain(`<a href="${BASE_URL}filters/">filters</a>`);
    expect(html).toContain(`<a href="${BASE_URL}">MCP Explorer</a>`);
    expect(html).not.toContain("text/markdown");
    expect(html).not.toContain("canonical");
  });
});

describe("pageMarkdown", () => {
  const md = pageMarkdown(PAGE);

  it("starts with the title and description", () => {
    expect(md).toMatch(/^# About <it>\n\n> A test page\.\n\n/u);
  });

  it("makes site links absolute so the mirror works standalone", () => {
    expect(md).toContain(`See [filters](${BASE_URL}filters/) and \`q=<x>\` & **bold**.`);
    expect(md).toContain("- [Glama](https://glama.ai/mcp)\n- plain\n");
    expect(md).toContain("## Links\n");
  });

  it("gives every fence an info string", () => {
    expect(md).toContain("```text\n?aaa=1&lang=rust\n```\n");
  });
});
