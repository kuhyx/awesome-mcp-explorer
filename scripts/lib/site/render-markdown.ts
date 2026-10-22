/**
 * Renders a page as its markdown mirror (`<path>/index.md`).
 *
 * Block text is already markdown; only site-path links change, to absolute
 * URLs, because a mirror is often fetched on its own, away from the page it
 * sits next to.
 */
import type { Block, Page } from "./pages.ts";

import { absoluteUrl, isExternal } from "./site-config.ts";

const LINK = /\[([^[\]]+)\]\(([^()]*)\)/gu;

function absolutize(text: string): string {
  return text.replaceAll(LINK, (_whole, label: string, href: string) =>
    isExternal(href) ? `[${label}](${href})` : `[${label}](${absoluteUrl(href)})`,
  );
}

function block(item: Block): string {
  switch (item.kind) {
    case "code": {
      return `\`\`\`${item.lang}\n${item.text}\n\`\`\`\n`;
    }
    case "heading": {
      return `## ${absolutize(item.text)}\n`;
    }
    case "list": {
      return item.items.map((entry) => `- ${absolutize(entry)}\n`).join("");
    }
    case "paragraph": {
      return `${absolutize(item.text)}\n`;
    }
  }
}

export function pageMarkdown(page: Page): string {
  return [`# ${page.title}\n`, `> ${page.description}\n`, ...page.blocks.map((item) => block(item))].join("\n");
}
