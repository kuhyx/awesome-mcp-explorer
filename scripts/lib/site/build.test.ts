/**
 * The file set the build emits next to the app bundle.
 *
 * The host serves dist/ as plain files with no SPA fallback, so every URL the
 * pages, llms.txt and the catalog advertise must be a file emitted here.
 */
import { describe, expect, it, vi } from "vitest";

import { prerenderIndexHtml, siteFiles } from "./build.ts";
import { aiCatalog, llmsTxt } from "./discovery.ts";
import { HOME_PAGE, PAGES } from "./pages.ts";
import { absoluteUrl, BASE_URL } from "./site-config.ts";
import { agentReadySite } from "./vite-plugin.ts";

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <title>MCP Explorer</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

describe("siteFiles", () => {
  const files = new Map(siteFiles().map((file) => [file.fileName, file.source]));

  it("emits every discovery file and the 404 page", () => {
    for (const name of ["robots.txt", "sitemap.xml", "llms.txt", ".well-known/ai-catalog.json", "404.html"]) {
      expect(files.has(name)).toBe(true);
    }
  });

  it("emits a real HTML file for every route except home, which is index.html", () => {
    for (const page of PAGES) {
      if (page === HOME_PAGE) continue;
      expect(files.get(`${page.path}index.html`)).toContain(`<h1>${page.title}</h1>`);
    }
    expect(files.has("index.html")).toBe(false);
  });

  it("emits a markdown mirror for every page", () => {
    for (const page of PAGES) expect(files.get(`${page.path}index.md`)).toMatch(/^# /u);
  });

  it("resolves every URL in llms.txt and the catalog to an emitted file", () => {
    const urls = [
      ...llmsTxt()
        .matchAll(/\]\((https:[^)]+)\)/gu)
        .map((m) => m[1] ?? ""),
      ...aiCatalog().entries.map((entry) => entry.url),
    ];
    for (const url of urls) {
      const relativePath = url.slice(BASE_URL.length);
      const name =
        relativePath === "" || relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath;
      expect(name === "index.html" || files.has(name), url).toBe(true);
    }
  });

  it("gives the 404 page real text and absolute links", () => {
    const html = files.get("404.html") ?? "";
    expect(html).toContain("<h1>Page not found</h1>");
    expect(html).toContain(`href="${absoluteUrl("about/")}"`);
  });
});

describe("prerenderIndexHtml", () => {
  const html = prerenderIndexHtml(TEMPLATE);

  it("puts the home content inside #root for no-JS readers", () => {
    expect(html).toMatch(/<div id="root"><main class="prerender">[\s\S]*<h1>MCP Explorer<\/h1>/u);
    expect(html).toContain('<a href="about/">');
    expect(html).toContain('<a href="llms.txt">');
  });

  it("adds the discovery head tags before </head>", () => {
    expect(html).toMatch(/<link rel="ai-catalog" href=".well-known\/ai-catalog.json"[^>]*>[\s\S]*<\/head>/u);
    expect(html).toContain("application/ld+json");
  });

  it("refuses a template without the markers it fills", () => {
    expect(() => prerenderIndexHtml("<html></html>")).toThrow(/#root/u);
    expect(() => prerenderIndexHtml('<div id="root"></div>')).toThrow(/<\/head>/u);
  });
});

describe("agentReadySite", () => {
  const plugin = agentReadySite();

  it("prerenders index.html", () => {
    expect(plugin.transformIndexHtml(TEMPLATE)).toBe(prerenderIndexHtml(TEMPLATE));
  });

  it("emits every site file as an asset", () => {
    const emitFile = vi.fn();
    plugin.generateBundle.call({ emitFile });
    expect(emitFile).toHaveBeenCalledTimes(siteFiles().length);
    expect(emitFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: "robots.txt", type: "asset" }));
  });
});
