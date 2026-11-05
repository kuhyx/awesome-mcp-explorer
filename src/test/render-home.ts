/**
 * Renders the real homepage component with the Astro Container API (node
 * only: the jsdom project cannot load `.astro` modules as server components).
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";

import type { Server } from "../lib/server.ts";

import Home from "../components/home.astro";

export async function renderHome(servers: readonly Server[]): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Home, { props: { servers } });
}

/**
 * The `<body>` contents with script tags removed (their `src` is a
 * machine-specific path), one element per line for readable diffs.
 */
export function bodyOf(html: string): string {
  const start = html.indexOf("<body>") + "<body>".length;
  return html
    .slice(start, html.lastIndexOf("</body>"))
    .replaceAll(/<script[^>]*><\/script>/g, "")
    .replaceAll("><", ">\n<");
}
