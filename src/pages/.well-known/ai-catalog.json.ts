import { aiCatalog } from "../../../scripts/lib/site/discovery.ts";

export function GET(): Response {
  return new Response(`${JSON.stringify(aiCatalog(), null, 2)}\n`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
