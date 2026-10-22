/**
 * The discovery files agents read before any page: robots.txt, sitemap.xml,
 * llms.txt and the AI Catalog. All are generated from the page table and
 * BASE_URL, so every URL in them is on the canonical host.
 */
import { PAGES } from "./pages.ts";
import { absoluteUrl, BASE_URL, SITE_NAME, SITE_SUMMARY } from "./site-config.ts";

/**
 * Agents named explicitly so no future `User-agent: *` tightening can catch
 * them by accident. Training crawlers are allowed on purpose.
 */
const AGENTS = ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended"] as const;

export function robotsTxt(): string {
  const groups = ["*", ...AGENTS].map((agent) => `User-agent: ${agent}\nAllow: /\n`);
  return `${groups.join("\n")}\nSitemap: ${absoluteUrl("sitemap.xml")}\n`;
}

export function sitemapXml(): string {
  const urls = PAGES.map((page) => `  <url><loc>${absoluteUrl(page.path)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

export function llmsTxt(): string {
  const pages = PAGES.map((page) => `- [${page.title}](${absoluteUrl(page.path)}): ${page.description}`);
  const mirrors = PAGES.map((page) => {
    const url = absoluteUrl(`${page.path}index.md`);
    return `- [${page.title} (markdown)](${url}): the same page as plain markdown`;
  });
  return `# ${SITE_NAME}

> ${SITE_SUMMARY}

The explorer is a static site: one interactive page whose filters live in the query string, plus the reference pages below.

## Pages

${pages.join("\n")}

## Markdown mirrors

${mirrors.join("\n")}
`;
}

export interface CatalogEntry {
  readonly displayName: string;
  readonly identifier: string;
  readonly type: string;
  readonly url: string;
}

export interface AiCatalog {
  readonly entries: readonly CatalogEntry[];
  readonly host: { readonly displayName: string; readonly documentationUrl: string; readonly identifier: string };
  readonly specVersion: string;
}

/**
 * `urn:air:{publisher}:{namespace}:{name}`; the publisher is BASE_URL's host.
 */
function urn(name: string): string {
  const url = new URL(BASE_URL);
  return `urn:air:${url.host}:site:${name}`;
}

export function aiCatalog(): AiCatalog {
  const mirrors = PAGES.map((page) => {
    const name = page.path.replaceAll("/", "") || "home";
    return {
      displayName: `${page.title} (markdown)`,
      identifier: urn(`page:${name}`),
      type: "text/markdown",
      url: absoluteUrl(`${page.path}index.md`),
    };
  });
  return {
    entries: [
      { displayName: "llms.txt", identifier: urn("llms"), type: "text/plain", url: absoluteUrl("llms.txt") },
      { displayName: "Sitemap", identifier: urn("sitemap"), type: "application/xml", url: absoluteUrl("sitemap.xml") },
      ...mirrors,
    ],
    host: { displayName: SITE_NAME, documentationUrl: absoluteUrl("about/"), identifier: BASE_URL },
    specVersion: "1.0",
  };
}
