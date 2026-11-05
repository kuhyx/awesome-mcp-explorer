/**
 * HTML and markdown renderings of the page table.
 *
 * Both renderers read the same blocks, so the prerendered HTML and the
 * markdown mirror can never say different things.
 */
import { describe, expect, it } from "vitest";

import type { Page } from "./pages.ts";

import { headModel, linkResolver, pageBody, renderBlocks } from "./render-html.ts";
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

describe("pageBody", () => {
  it("starts with an escaped H1, then the blocks", () => {
    const html = pageBody(PAGE, (href) => href);
    expect(html).toMatch(/^<h1>About &lt;it&gt;<\/h1>\n<p>/u);
    expect(html).toContain("<h2>Links</h2>");
  });
});

describe("headModel", () => {
  const model = headModel(PAGE);

  it("links the catalog, llms.txt and the markdown mirror relative to the page", () => {
    expect(model.links).toContainEqual({ href: "../.well-known/ai-catalog.json", rel: "ai-catalog", type: "application/ai-catalog+json" });
    expect(model.links).toContainEqual({ href: "../llms.txt", rel: "alternate", title: "llms.txt", type: "text/plain" });
    expect(model.links).toContainEqual({ href: "index.md", rel: "alternate", type: "text/markdown" });
  });

  it("sets an absolute canonical URL on the canonical host", () => {
    expect(model.canonical).toBe(`${BASE_URL}about/`);
  });

  it("titles non-home pages with the site name", () => {
    expect(model.title).toBe("About <it> · MCP Explorer");
    expect(model.description).toBe("A test page.");
  });

  it("carries JSON-LD with @context, with < escaped", () => {
    const json = model.jsonLd ?? "";
    expect(json).not.toContain("<");
    const data = JSON.parse(json) as Record<string, unknown>;
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("WebPage");
    expect(data.name).toBe("About <it>");
  });

  it("describes the homepage as the web application, with the hand-written title", () => {
    const home = headModel({ ...PAGE, path: "" });
    expect(home.jsonLd).toContain('"@type":"WebApplication"');
    expect(home.links).toContainEqual({ href: "index.md", rel: "alternate", type: "text/markdown" });
    expect(home.title).toBe("MCP Explorer — filter awesome-mcp-servers");
    expect(home.description).toMatch(/^Filter and sort every server in awesome-mcp-servers/u);
  });

  it("drops the discovery tags for the absolute (404) mode", () => {
    const missing = headModel(PAGE, { absolute: true });
    expect(missing.canonical).toBeUndefined();
    expect(missing.jsonLd).toBeUndefined();
    expect(missing.links).toEqual([]);
    expect(missing.title).toBe("About <it> · MCP Explorer");
  });
});

describe("linkResolver", () => {
  it("emits relative links by default", () => {
    expect(linkResolver(PAGE)("filters/")).toBe("../filters/");
    expect(linkResolver(PAGE)("")).toBe("../");
  });

  it("emits absolute links for site paths and keeps external ones in absolute mode", () => {
    const absolute = linkResolver(PAGE, { absolute: true });
    expect(absolute("filters/")).toBe(`${BASE_URL}filters/`);
    expect(absolute("https://glama.ai/mcp")).toBe("https://glama.ai/mcp");
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
