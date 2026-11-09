/**
 * Textgate guard over the real homepage render: no word on screen that is not content.
 */
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { SERVERS } from "../test/fixtures.ts";
import { renderHome } from "../test/render-home.ts";
import { visibleWords } from "../test/visible-words.ts";

async function bodyDom(servers: Parameters<typeof renderHome>[0]): Promise<HTMLElement> {
  const { window } = new JSDOM(await renderHome(servers));
  return window.document.body;
}

describe("homepage shows no chrome words", () => {
  it("prints only icons, numbers and content with the fixture dataset", async () => {
    const body = await bodyDom(SERVERS);
    const report = visibleWords(body);
    expect(body.querySelectorAll("article.row")).toHaveLength(SERVERS.length);
    expect(report.inspected).toBeGreaterThan(100);
    expect(report.words).toEqual([]);
  });

  it("prints no chrome words without a dataset either", async () => {
    expect(visibleWords(await bodyDom([])).words).toEqual([]);
  });
});
