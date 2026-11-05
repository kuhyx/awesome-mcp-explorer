import type { APIContext } from "astro";

import type { Page } from "../../scripts/lib/site/pages.ts";

import { PAGES } from "../../scripts/lib/site/pages.ts";
import { pageMarkdown } from "../../scripts/lib/site/render-markdown.ts";

interface Props {
  page: Page;
}

/**
 * One `<path>index.md` per page; the homepage's mirror is `index.md` at the root.
 */
export function getStaticPaths(): { params: { path: string }; props: Props }[] {
  return PAGES.map((page) => ({ params: { path: `${page.path}index` }, props: { page } }));
}

export function GET({ props }: APIContext): Response {
  return new Response(pageMarkdown((props as Props).page), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
