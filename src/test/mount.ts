/**
 * Mounts the prerendered homepage (see render-home.ts) into jsdom and boots
 * `<server-explorer>` against a stubbed servers.json.
 */
import { readFileSync } from "node:fs";
import { vi } from "vitest";
import "@kuhyx/web-ui/range-slider";

import "../elements/register.ts";
import { FIXTURE_PATH } from "./fixture-path.ts";
import { fragmentOf } from "./html.ts";

export function stubServers(servers: unknown): void {
  vi.stubGlobal("fetch", () => Promise.resolve(Response.json(servers)));
}

export function insertHome(): HTMLElement {
  document.body.replaceChildren(fragmentOf(readFileSync(FIXTURE_PATH, "utf8")));
  const explorer = document.querySelector<HTMLElement>("server-explorer");
  if (explorer === null) throw new Error("no <server-explorer> in the fixture");
  return explorer;
}

/**
 * Inserts the markup (which upgrades and connects the element) and waits for
 * the first render driven by the fetched data.
 */
export async function mountHome(): Promise<HTMLElement> {
  const explorer = insertHome();
  await vi.waitFor(() => {
    if (!Object.hasOwn(explorer.dataset, "ready")) throw new Error("not ready");
  });
  return explorer;
}
