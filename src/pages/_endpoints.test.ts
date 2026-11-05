/**
 * The agent-facing endpoints must serve exactly what the generators produce,
 * since crawlers and the AgentReady checker read these bytes verbatim.
 */
import type { APIContext } from "astro";

import { describe, expect, it } from "vitest";

import { aiCatalog, llmsTxt, robotsTxt, sitemapXml } from "../../scripts/lib/site/discovery.ts";
import { HOME_PAGE, PAGES } from "../../scripts/lib/site/pages.ts";
import { pageMarkdown } from "../../scripts/lib/site/render-markdown.ts";
import { GET as aiCatalogGet } from "./.well-known/ai-catalog.json.ts";
import { getStaticPaths, GET as markdownGet } from "./[...path].md.ts";
import { GET as llmsGet } from "./llms.txt.ts";
import { GET as robotsGet } from "./robots.txt.ts";
import { GET as sitemapGet } from "./sitemap.xml.ts";

describe("discovery endpoints", () => {
  it("serves robots.txt as plain text", async () => {
    const response = robotsGet();
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe(robotsTxt());
  });

  it("serves sitemap.xml as XML", async () => {
    const response = sitemapGet();
    expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    expect(await response.text()).toBe(sitemapXml());
  });

  it("serves llms.txt as plain text", async () => {
    const response = llmsGet();
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe(llmsTxt());
  });

  it("serves the AI catalog as pretty JSON with a trailing newline", async () => {
    const response = aiCatalogGet();
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(await response.text()).toBe(`${JSON.stringify(aiCatalog(), null, 2)}\n`);
  });
});

describe("markdown mirrors", () => {
  it("emits one index.md per page, the homepage at the root", () => {
    const paths = getStaticPaths().map((entry) => entry.params.path);
    expect(paths).toEqual(["index", "filters/index", "about/index"]);
  });

  it("renders each page's markdown", async () => {
    for (const entry of getStaticPaths()) {
      const response = markdownGet({ props: entry.props } as unknown as APIContext);
      expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
      expect(await response.text()).toBe(pageMarkdown(entry.props.page));
    }
    expect(getStaticPaths()).toHaveLength(PAGES.length);
    expect(getStaticPaths()[0]?.props.page).toBe(HOME_PAGE);
  });
});
