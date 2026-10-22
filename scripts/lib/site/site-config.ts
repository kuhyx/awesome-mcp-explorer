/**
 * The one place the site's public address lives.
 *
 * The site is not deployed yet. Its intended home is its own host at the root:
 * robots.txt, llms.txt and /.well-known/ are only meaningful at a host root, so
 * a GitHub Pages project sub-path could never be agent-ready. Every absolute
 * URL in every agent-facing file is derived from `BASE_URL` here, so moving
 * the site means editing this one constant.
 *
 * Site paths are written WITHOUT a leading slash (`about/`, `llms.txt`): they
 * are relative to BASE_URL, which keeps relativeHref's depth arithmetic right
 * and keeps the build path-agnostic, so `absoluteUrl` refuses a leading slash.
 */

export const BASE_URL = "https://awesome-mcp-explorer.kuhy.duckdns.org/";

export const SITE_NAME = "MCP Explorer";

export const SITE_SUMMARY =
  "Filter and sort every server in punkpeye/awesome-mcp-servers by Glama grade, licence, scope, language, OS, popularity and activity.";

/**
 * Absolute URL for a site path.
 */
export function absoluteUrl(path: string): string {
  if (path.startsWith("/")) {
    throw new Error(`site path ${path} must be relative to BASE_URL; drop the leading slash`);
  }
  const url = new URL(path, BASE_URL);
  return url.href;
}

/**
 * Whether an href points off-site (has a scheme).
 */
export function isExternal(href: string): boolean {
  return /^[a-z][\d+.a-z-]*:/iu.test(href);
}

/**
 * Relative href from the page at site path `from` to site path `to`.
 *
 * Relative links keep working at any deploy path (root, a sub-path, file://),
 * which absolute ones would not.
 */
export function relativeHref(from: string, to: string): string {
  if (isExternal(to)) return to;
  const fromDirectory = from.slice(0, from.lastIndexOf("/") + 1);
  const href =
    fromDirectory !== "" && to.startsWith(fromDirectory)
      ? to.slice(fromDirectory.length)
      : `${"../".repeat(fromDirectory.split("/").length - 1)}${to}`;
  return href || "./";
}
