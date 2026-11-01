# Migrate awesome-mcp-explorer to Astro (no React)

## what
The explorer is a filter and sort list over `public/servers.json`, plus a
generated `about/` page and the AgentReady files. It becomes Astro 7 static
output. The list page is one `.astro` page whose script loads the JSON and
renders with custom elements. The Vite site plugin becomes Astro pages and
endpoints.

## steps
1. Do `~/src/utils/web_ui/TODO-astro-port.md` first. Then bump `@kuhyx/web-ui`
   from `web_ui-v0.3.1` to the new tag. `filter-bar` uses `RangeSlider`, which
   becomes `RangeSlider.astro` with `<range-slider>`. This is the first
   consumer to verify the port.
2. Pages, built from `scripts/lib/site/pages.ts` (the route source of truth):
   - `src/pages/index.astro` is the explorer.
   - `src/pages/about.astro` renders the current `about/` content.
   - `src/pages/404.astro` gives a real 404.
   Prerender the server list into the HTML (no-JS content) from
   `servers.json` at build time. The script then enhances it.
3. AgentReady. Port `scripts/lib/site/*` (`build.ts`, `discovery.ts`,
   `render-markdown.ts`, `filters-page.ts`) into endpoints that read
   `pages.ts`:
   - `src/pages/robots.txt.ts`, `sitemap.xml.ts` and `llms.txt.ts`
   - `.well-known/ai-catalog.json.ts`
   - `[...path].md.ts`, the mirrors
   Keep the JSON-LD on the homepage. Delete `vite-plugin.ts` and
   `render-html.ts` once the endpoints match the old `dist/` byte for byte
   where possible.
4. Rewrite the 8 React files:
   - `app.tsx` becomes `index.astro` plus `<server-explorer>`, which owns state,
     URL sync and the keyboard.
   - `server-list` and `server-row` become a `<server-list>` element that
     renders rows from `lib/filter-sort.ts`.
   - `filter-bar`, `tri-state-picker`, `grade-filter` and `preset-menu` become
     `.astro` markup plus element logic. The ranges use `<range-slider>`.
   - `stat-bar` becomes `.astro` with a TS fill-in.
   - The hooks `use-servers.ts`, `use-url-filter.ts` and `use-keyboard.ts` become
     plain modules: loader, `url-state` binding, and key map.
5. Dependencies, exact pins via pnpm:
   - Add `astro@7.4.4`, `@astrojs/check@0.9.12`, `eslint-plugin-astro@3.2.1`
     and `@testing-library/dom`.
   - Remove `react`, `react-dom`, `@vitejs/plugin-react` and
     `@testing-library/react`.
   - Drop direct `vite`. Astro brings `^8.3.5`. `scripts/build-dataset.ts`
     keeps running with node.
6. Tests. Use vitest 5.0.5 with `getViteConfig()`:
   - `src/lib/*` and `scripts/lib/*` tests stay.
   - Element tests run in jsdom.
   - The Container API renders `index`, `about` and `404`.
   - Endpoint tests assert the AgentReady files.
7. `run.sh --build` becomes `astro build && astro preview --port 5178`.

## done
Run from the repo root:
`pnpm install --frozen-lockfile && pnpm exec astro check && pnpm test && pnpm build && ~/src/utils/agent_ready/check.sh dist dist`
Then:
`! grep -q '"react"' package.json && ! grep -qE '"(react-dom|@vitejs/plugin-react)"' package.json && ! find src -name '*.tsx' | grep -q .`
Both exit 0.

## verify
The public host (`https://awesome-mcp-explorer.kuhy.duckdns.org`, from
`site-config.ts`) is not live. A curl returned 000 on 2026-11-01. Verify
locally with `./run.sh --build` on 127.0.0.1:5178, in a headless chromium at
4K and at mobile size:
- The filters narrow the list.
- The star range slider responds to drag and arrow keys.
- `?grade=` survives a reload.
- `/about/` and the 404 render.
If kuhy deploys it later, also run
`~/src/utils/agent_ready/check.sh url <host>`.

## read first
- `~/src/utils/web_ui/TODO-astro-port.md` (do it first)
- `scripts/lib/site/pages.ts`, `build.ts`, `vite-plugin.ts`
- `src/app.tsx`, `src/hooks/use-url-filter.ts`
- `run.sh`, `repo-contract.toml`

REMOVE ME AFTER FINISH
