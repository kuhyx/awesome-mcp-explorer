import { describe, expect, it } from "vitest";

import { absoluteUrl, BASE_URL, relativeHref } from "./site-config.ts";

describe("absoluteUrl", () => {
  it("resolves against the root of the site's own host", () => {
    expect(absoluteUrl("about/")).toBe("https://awesome-mcp-explorer.kuhy.duckdns.org/about/");
    expect(absoluteUrl("")).toBe(BASE_URL);
  });

  it("rejects a leading slash, so site paths stay relative to BASE_URL", () => {
    expect(() => absoluteUrl("/llms.txt")).toThrow(/leading slash/u);
  });
});

describe("relativeHref", () => {
  it.each([
    ["", "about/", "about/"],
    ["", "llms.txt", "llms.txt"],
    ["about/", "", "../"],
    ["about/", "filters/", "../filters/"],
    ["about/", "about/index.md", "index.md"],
    ["about/", "about/", "./"],
    ["", "", "./"],
  ])("from %j to %j is %j", (from, to, expected) => {
    expect(relativeHref(from, to)).toBe(expected);
  });

  it("passes external URLs through", () => {
    expect(relativeHref("about/", "https://glama.ai/mcp")).toBe("https://glama.ai/mcp");
  });
});
