/**
 * Renders the page table as HTML: the prerendered homepage body, the other
 * pages and the 404 page all share these functions, so every page gets the
 * same head tags (catalog, llms.txt, markdown mirror, JSON-LD).
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

/**
 * Discovery tags for one page's head. Hrefs are relative to the page, so they
 * resolve under whatever path the site is served from.
 */
export function headTags(page: Page): string {
  const href = (to: string): string => escapeHtml(relativeHref(page.path, to));
  const mirror = `${page.path}index.md`;
  return [
    `<link rel="canonical" href="${escapeHtml(absoluteUrl(page.path))}">`,
    `<link rel="ai-catalog" href="${href(".well-known/ai-catalog.json")}" type="application/ai-catalog+json">`,
    `<link rel="alternate" type="text/plain" href="${href("llms.txt")}" title="llms.txt">`,
    `<link rel="alternate" type="text/markdown" href="${href(mirror)}">`,
    `<script type="application/ld+json">${jsonLd(page)}</script>`,
  ].join("\n");
}

/**
 * The visible article for a page: H1, then its blocks.
 */
export function pageBody(page: Page, linkFor: LinkFor): string {
  return `<h1>${escapeHtml(page.title)}</h1>\n${renderBlocks(page.blocks, linkFor)}`;
}

const STYLE =
  "body{font-family:system-ui,sans-serif;line-height:1.5;max-width:44rem;margin:0 auto;padding:1.5rem;color:#211d1b;background:#faf8f5}a{color:#8a6422}pre{overflow-x:auto;padding:.75rem;background:#efebe5}";

/**
 * A standalone page. `absolute` (for 404.html, served at any depth) makes
 * every link absolute and drops the tags that only describe a real page.
 */
export function pageDocument(page: Page, options: { absolute?: boolean } = {}): string {
  const linkFor: LinkFor =
    options.absolute === true
      ? (href) => (isExternal(href) ? href : absoluteUrl(href))
      : (href) => relativeHref(page.path, href);
  const head = options.absolute === true ? "" : `\n${headTags(page)}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(page.title)} · ${SITE_NAME}</title>
<meta name="description" content="${escapeHtml(page.description)}">${head}
<style>${STYLE}</style>
</head>
<body>
<nav><a href="${escapeHtml(linkFor(""))}">${SITE_NAME}</a></nav>
<main>
${pageBody(page, linkFor)}
</main>
</body>
</html>
`;
}
