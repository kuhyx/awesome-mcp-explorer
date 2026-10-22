/**
 * The route table: every public page of the site, as content blocks.
 *
 * This is the single source for the prerendered HTML, the markdown mirrors,
 * sitemap.xml, llms.txt and the AI Catalog. Add a page here and every one of
 * those picks it up with no other edit.
 *
 * The app itself has exactly one client-side route (`""`, filters live in the
 * query string), so the other pages are static documentation that the build
 * emits as real `<path>/index.html` files.
 *
 * Inline markup in block text: `[label](href)`, `` `code` `` and `**bold**`.
 * An href without a scheme is a site path (no leading slash, see
 * site-config.ts); the renderers turn it into the right relative or absolute
 * URL for where the text ends up.
 */
import { FILTERS_PAGE } from "./filters-page.ts";
import { SITE_NAME, SITE_SUMMARY } from "./site-config.ts";

export type Block =
  | { readonly items: readonly string[]; readonly kind: "list" }
  | { readonly kind: "code"; readonly lang: string; readonly text: string }
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string };

export interface Page {
  readonly blocks: readonly Block[];
  readonly description: string;
  /**
   * Site path without a leading slash; `""` is the homepage.
   */
  readonly path: string;
  readonly title: string;
}

const UPSTREAM = "https://github.com/punkpeye/awesome-mcp-servers";

export const HOME_PAGE: Page = {
  blocks: [
    { kind: "paragraph", text: SITE_SUMMARY },
    {
      kind: "paragraph",
      text: `This page is the explorer itself: with JavaScript on, it loads every server from [awesome-mcp-servers](${UPSTREAM}) — about 3,000 of them — into one filterable, sortable list. Every filter lives in the URL, so a view can be bookmarked or shared.`,
    },
    { kind: "heading", text: "Example" },
    {
      kind: "paragraph",
      text: "Every triple-A, FOSS, local-only Rust server, most recently pushed first:",
    },
    { kind: "code", lang: "text", text: "?aaa=1&foss=yes&scope=local,!cloud&lang=rust&sort=pushed" },
    { kind: "heading", text: "Read more" },
    {
      items: [
        "[URL filter reference](filters/): every query parameter and the values it accepts",
        "[About the data](about/): where each field comes from and how far to trust it",
        "[llms.txt](llms.txt): a short index of this site for language models",
      ],
      kind: "list",
    },
  ],
  description: "Power-user filter and sort explorer for the awesome-mcp-servers list.",
  path: "",
  title: SITE_NAME,
};

export const ABOUT_PAGE: Page = {
  blocks: [
    {
      kind: "paragraph",
      text: `The upstream list is one large README. Whether a server is official, its language, and whether it runs locally or against a cloud API are encoded as emoji, and its quality grades live on [Glama](https://glama.ai/mcp). The explorer joins three sources into one dataset.`,
    },
    { kind: "heading", text: "Sources" },
    {
      items: [
        "**The README**: structure, emoji markers (official, language, scope, OS) and the `###` category sections.",
        "**The GitHub API**: licence (`license.spdx_id`), stars, last push and archived status.",
        "**Glama score badges**: the licence, quality and maintenance letter grades (A to F).",
      ],
      kind: "list",
    },
    { kind: "heading", text: "Caveats" },
    {
      items: [
        "**Cost and rate limit are guesses, not data.** They are inferred from scope markers and description text, shown with a `~` prefix, and about half come out `unknown`.",
        "**About 12% of servers have no Glama grade.** An ungraded axis is unknown, not bad: it never satisfies a grade filter.",
        "**A dash on a Glama badge means ungraded**, not A−. Glama's scale is A, B, C, D, F with no modifiers.",
      ],
      kind: "list",
    },
    { kind: "heading", text: "Licence" },
    {
      kind: "paragraph",
      text: `The explorer is MIT-licensed. The data belongs to the [awesome-mcp-servers](${UPSTREAM}) contributors, GitHub and Glama. See the [URL filter reference](filters/) to build a view.`,
    },
  ],
  description: "Where each field in the explorer comes from, and how far to trust it.",
  path: "about/",
  title: "About the data",
};

/**
 * Every page in the sitemap, homepage first.
 */
export const PAGES: readonly Page[] = [HOME_PAGE, FILTERS_PAGE, ABOUT_PAGE];

/**
 * Served for any path that is not a file. Not in the sitemap.
 */
export const NOT_FOUND_PAGE: Page = {
  blocks: [
    {
      kind: "paragraph",
      text: "There is no page at this address. The explorer has one interactive page; its filters live in the query string, not the path.",
    },
    {
      items: PAGES.map((page) => `[${page.title}](${page.path}): ${page.description}`),
      kind: "list",
    },
  ],
  description: "No page exists at this address.",
  path: "404.html",
  title: "Page not found",
};
