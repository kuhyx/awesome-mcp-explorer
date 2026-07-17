# awesome-mcp-explorer

Filter and sort every server in
[punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)
— 2,981 of them — by Glama grade, licence, scope, language, OS, popularity and
activity. Static site, works offline, every filter lives in the URL.

```bash
./run.sh
```

That picks a Node 24+ already on your machine (installing the latest LTS via
nvm only if there is none), installs dependencies, builds the dataset if it is
missing, serves the site and opens your browser.

## Why

The upstream list is a 1.1 MB README. Everything useful about a server —
whether it is official, what language it is in, whether it runs locally or
against a cloud API — is encoded as emoji in flat markdown, and its quality
grades live on a different site entirely. There is no way to ask
*"show me every triple-A, FOSS, local-only Rust server that is still
maintained"*. This answers that in one URL:

```
?aaa=1&foss=yes&scope=local,!cloud&lang=rust&sort=pushed
```

## What you can filter on

| Filter | Source | Notes |
|---|---|---|
| **Triple-A** and per-axis grades | Glama badge | licence / quality / maintenance |
| Official | README `🎖️` | 183 servers |
| Scope — local / cloud / embedded | README `☁️🏠📟` | one axis, not two |
| Operating system | README `🍎🪟🐧` | |
| Language | README emoji | 8 languages |
| Licence (FOSS) | GitHub API | authoritative `license.spdx_id` |
| Stars, last push | GitHub API | distribution-aware sliders |
| Archived | GitHub API | hide dead projects |
| Category | README `###` sections | 54 of them |
| **Cost, rate limit** | *inferred* | see the caveat below |

Licence, cost, rate limit, language, scope, OS and category are all
**tri-state**: click once to include, twice to exclude, three times to clear.
So `?cost=likely-free,unknown` is "free or unknown", and `?scope=local,!cloud`
is "local but not cloud".

Also: fuzzy search, sorting on six keys, saved presets, export to
JSON/CSV/Markdown, and keyboard shortcuts (`/` search, `a` triple-A, `?` help).

## Two caveats worth reading

**Cost and rate limit are guesses, not data.** Neither the awesome list nor
Glama publishes them. They are inferred from each server's scope markers and
description text, which is weak: 1,466 of 2,981 come out `unknown`. They render
with a `~` prefix and a dashed border so they can never be mistaken for facts,
and you can correct any of them in [`data/overrides.json`](data/overrides.json).

**About 12% of servers have no Glama grade at all.** An ungraded axis is
*unknown*, not bad — it never satisfies a grade filter, and the UI says how many
servers a grade filter cannot speak for, so an empty result is never mistaken
for "none exist".

## How the data is built

`pnpm run build:data` joins three sources into `public/servers.json`:

1. **The README** — structure, emoji markers, categories.
2. **The GitHub API** — licence, stars, last push, archived. Authoritative,
   unlike Glama's own licence field which is null for ~24% of servers.
3. **Glama score badges** — the three letter grades.

The result is a committed-at-build-time artifact rather than a live fetch:
the browser cannot build it (CORS blocks both sources, and GitHub allows 60
anonymous calls an hour against ~3,000 repos). Everything is cached under
`data/cache/`, so a re-run is nearly free.

A few things that are less obvious than they look, all documented at their call
sites:

- **Emoji must be matched on base codepoints.** One entry uses a bare `🎖`
  with no variation selector; 963 of 964 Windows entries use a bare `🪟` and
  exactly one adds `U+FE0F`. Matching literal emoji drops real data.
- **A dash on a Glama badge means "ungraded", not "A−".** Glama has no
  modifiers; the scale is A/B/C/D/F. See `scripts/lib/decode-badge.ts`.
- **Badges are probed for every server**, derived from the GitHub slug when the
  README does not link one. Only ~55% link a badge, but Glama grades ~88%.
- **Glama's `/api/` is `Disallow`ed by robots.txt** and is never touched. The
  badge endpoint the README already hotlinks is.

## Development

```bash
pnpm install
pnpm run lint       # tsc --noEmit && eslint .
pnpm test           # vitest
pnpm run coverage   # 100% or it fails
pnpm run build      # tsc -b && vite build
pnpm run build:data # rebuild servers.json (needs `gh auth login`)
```

Node 24+ · React 19.2 · Vite 8 · TypeScript 6 · Vitest 4 at 100% coverage · ESLint 10 with
typescript-eslint `strictTypeChecked`, `unicorn/all`, sonarjs and perfectionist.
Runtime dependencies: React and `@tanstack/react-virtual`. Nothing else.

TypeScript is pinned to 6.0 rather than 7.x because typescript-eslint requires
`typescript <6.1.0`, and losing every type-aware rule would cost more than the
Go-native compiler gains.

## Licence

MIT. The underlying data belongs to
[awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) (its
contributors), GitHub, and [Glama](https://glama.ai/mcp).
