/**
 * Page-table helpers for the Astro layout: block HTML, link resolution and
 * the head model, shared by every page so each gets the same discovery tags
 * (catalog, llms.txt, markdown mirror, JSON-LD).
 */
import type { Block, Page } from "./pages.ts";

import { absoluteUrl, BASE_URL, isExternal, relativeHref, SITE_NAME } from "./site-config.ts";

/**
 * Maps a content href (site path or external URL) to the href to emit.
 */
export type LinkFor = (href: string) => string;

const INLINE = /\[([^[\]]+)\]\(([^()]*)\)|`([^`]+)`|\*\*([^*]+)\*\*/gu;

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(text: string, linkFor: LinkFor): string {
  let out = "";
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    out += escapeHtml(text.slice(last, match.index));
    const [whole, label, href, code, bold = ""] = match;
    if (label !== undefined && href !== undefined) {
      out += `<a href="${escapeHtml(linkFor(href))}">${escapeHtml(label)}</a>`;
    } else if (code === undefined) {
      out += `<strong>${escapeHtml(bold)}</strong>`;
    } else {
      out += `<code>${escapeHtml(code)}</code>`;
    }
    last = match.index + whole.length;
  }
  return out + escapeHtml(text.slice(last));
}

function block(item: Block, linkFor: LinkFor): string {
  switch (item.kind) {
    case "code": {
      return `<pre><code class="language-${item.lang}">${escapeHtml(item.text)}</code></pre>`;
    }
    case "heading": {
      return `<h2>${inline(item.text, linkFor)}</h2>`;
    }
    case "list": {
      const entries = item.items.map((entry) => `<li>${inline(entry, linkFor)}</li>`);
      return `<ul>${entries.join("")}</ul>`;
    }
    case "paragraph": {
      return `<p>${inline(item.text, linkFor)}</p>`;
    }
  }
}

export function renderBlocks(blocks: readonly Block[], linkFor: LinkFor): string {
  return blocks.map((item) => block(item, linkFor)).join("\n");
}

/**
 * The visible article for a page: H1, then its blocks.
 */
export function pageBody(page: Page, linkFor: LinkFor): string {
  return `<h1>${escapeHtml(page.title)}</h1>\n${renderBlocks(page.blocks, linkFor)}`;
}

function jsonLd(page: Page): string {
  const data =
    page.path === ""
      ? {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          applicationCategory: "DeveloperApplication",
          description: page.description,
          name: page.title,
          operatingSystem: "Any (web browser)",
          url: BASE_URL,
        }
      : {
          "@context": "https://schema.org",
          "@type": "WebPage",
          description: page.description,
          isPartOf: { "@type": "WebSite", name: SITE_NAME, url: BASE_URL },
          name: page.title,
          url: absoluteUrl(page.path),
        };
  return JSON.stringify(data).replaceAll("<", String.raw`\u003c`);
}

export interface HeadLink {
  readonly href: string;
  readonly rel: string;
  readonly title?: string;
  readonly type?: string;
}

export interface HeadModel {
  readonly canonical?: string;
  readonly description: string;
  readonly jsonLd?: string;
  readonly links: readonly HeadLink[];
  readonly title: string;
}

export interface HeadOptions {
  /**
   * For 404.html, served at any depth: absolute links, no page-only tags.
   */
  readonly absolute?: boolean;
}

/**
 * The homepage's tab title is the site name alone (an OS-level proper noun,
 * kuhy's textgate rule: no subtitle); the description is hand-written for
 * crawlers. The page table's own strings stay the short ones used by llms.txt
 * and JSON-LD.
 */
const HOME_TITLE = SITE_NAME;
const HOME_DESCRIPTION =
  "Filter and sort every server in awesome-mcp-servers by Glama grade, licence, scope, language, OS and activity.";

/**
 * Resolves content hrefs for a page: relative to the page by default, so the
 * output works under whatever path the site is served from.
 */
export function linkResolver(page: Page, options: HeadOptions = {}): LinkFor {
  return options.absolute === true
    ? (href) => (isExternal(href) ? href : absoluteUrl(href))
    : (href) => relativeHref(page.path, href);
}

/**
 * Everything a layout needs for one page's `<head>`, as plain data. Astro
 * escapes the values when it renders them.
 */
export function headModel(page: Page, options: HeadOptions = {}): HeadModel {
  const isHome = page.path === "";
  const title = isHome ? HOME_TITLE : `${page.title} · ${SITE_NAME}`;
  const description = isHome ? HOME_DESCRIPTION : page.description;
  if (options.absolute === true) return { description, links: [], title };
  const href = linkResolver(page);
  return {
    canonical: absoluteUrl(page.path),
    description,
    jsonLd: jsonLd(page),
    links: [
      { href: href(".well-known/ai-catalog.json"), rel: "ai-catalog", type: "application/ai-catalog+json" },
      { href: href("llms.txt"), rel: "alternate", title: "llms.txt", type: "text/plain" },
      { href: href(`${page.path}index.md`), rel: "alternate", type: "text/markdown" },
    ],
    title,
  };
}
