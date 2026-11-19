## Commands

- run: `./run.sh` (`--build` serves `astro build` via `astro preview`)
- test: `pnpm run test`
- test-changed: `scripts/test_changed.sh`
- lint: `pnpm run lint`
- coverage: `pnpm run coverage --coverage.reporter=lcov --coverage.reporter=text-summary`
- coverage-gaps: `coverage-gaps coverage/lcov.info`
- check: `pnpm exec astro check`
- deploy: none (static site not hosted yet: no Caddy block, no unit, its domain does not resolve; see scripts/lib/site/site-config.ts)
