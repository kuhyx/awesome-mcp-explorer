/**
 * Everything the build adds for agents, as plain (fileName, source) pairs.
 *
 * Free of Vite types so it is unit-testable; vite-plugin.ts only hands these
 * to Rollup. The host is assumed to have no SPA fallback, so every URL the
 * pages advertise must be one of these files (or the app's own index.html).
 */
import { aiCatalog, llmsTxt, robotsTxt, sitemapXml } from "./discovery.ts";
import { HOME_PAGE, NOT_FOUND_PAGE, PAGES } from "./pages.ts";
import { headTags, pageBody, pageDocument } from "./render-html.ts";
import { pageMarkdown } from "./render-markdown.ts";
import { relativeHref } from "./site-config.ts";

export interface SiteFile {
  /**
   * Path relative to the build directory, no leading slash.
   */
  readonly fileName: string;
  readonly source: string;
}

const ROOT = '<div id="root"></div>';
const HEAD_END = "</head>";

/**
 * Prerenders the homepage into the app's index.html.
 *
 * The content goes inside #root, which React's first render replaces, so a
 * reader without JavaScript gets the page and everyone else gets the app.
 */
export function prerenderIndexHtml(html: string): string {
  if (!html.includes(ROOT)) throw new Error(`index.html has no empty ${ROOT} (#root) to prerender into`);
  if (!html.includes(HEAD_END)) throw new Error("index.html has no </head> for the discovery tags");
  const body = pageBody(HOME_PAGE, (href) => relativeHref(HOME_PAGE.path, href));
  return html
    .replace(HEAD_END, () => `${headTags(HOME_PAGE)}\n${HEAD_END}`)
    .replace(ROOT, () => `<div id="root"><main class="prerender">\n${body}\n</main></div>`);
}

export function siteFiles(): SiteFile[] {
  const pages = PAGES.filter((page) => page !== HOME_PAGE).map((page) => ({ fileName: `${page.path}index.html`, source: pageDocument(page) }));
  const mirrors = PAGES.map((page) => ({ fileName: `${page.path}index.md`, source: pageMarkdown(page) }));
  return [
    { fileName: "robots.txt", source: robotsTxt() },
    { fileName: "sitemap.xml", source: sitemapXml() },
    { fileName: "llms.txt", source: llmsTxt() },
    { fileName: ".well-known/ai-catalog.json", source: `${JSON.stringify(aiCatalog(), null, 2)}\n` },
    { fileName: "404.html", source: pageDocument(NOT_FOUND_PAGE, { absolute: true }) },
    ...pages,
    ...mirrors,
  ];
}
