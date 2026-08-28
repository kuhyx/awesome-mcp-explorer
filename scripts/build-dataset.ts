/**
 * Builds `public/servers.json` from the three upstream sources.
 *
 * Run with `pnpm run build:data`. Network results are cached under
 * `data/cache/`, so a re-run after the first is nearly free.
 *
 * This file is deliberately thin: every decision lives in `scripts/lib/*`,
 * which is unit-tested. What is here is wiring, progress output, and the
 * verification report.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { argv, env, exit, stderr, stdout } from "node:process";

import type { Overrides } from "./lib/merge.ts";

import { isUnrecognisedLicense } from "./lib/classify.ts";
import { fetchBadges } from "./lib/fetch-badges.ts";
import { fetchGithub } from "./lib/fetch-github.ts";
import { mergeAll } from "./lib/merge.ts";
import { diskCache, nullCache } from "./lib/net.ts";
import { derivedBadgeUrl, mergeEntries, parseReadme } from "./lib/parse-readme.ts";

const README_URL =
  "https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/refs/heads/main/README.md";

const root = new URL("..", import.meta.url);
const OUT = new URL("public/servers.json", root);
const OVERRIDES = new URL("data/overrides.json", root);
const CACHE_DIR = new URL("data/cache/", root);

/**
 * The GitHub token, supplied by the `build:data` script as
 * `GITHUB_TOKEN=$(gh auth token)`.
 *
 * Resolved in the shell rather than by shelling out to `gh` from here: spawning
 * a PATH-resolved binary from this code is a real (if small) hijack risk,
 * and the shell already knows where `gh` is.
 *
 * Anonymous GitHub allows 60 requests/hour, which cannot cover ~3,000 repos; a
 * token allows 5,000.
 */
function githubToken(): string {
  const token = env.GITHUB_TOKEN;
  if (token === undefined || token === "") {
    stderr.write(
      "GITHUB_TOKEN is empty. Run via `pnpm run build:data`, or export a token:\n" +
        "  export GITHUB_TOKEN=$(gh auth token)\n",
    );
    exit(1);
  }
  return token;
}

/**
 * Distinct `###` sections across a set of entries.
 */
function categoryCount(items: readonly { categories: readonly string[] }[]): number {
  const seen = new Set(items.flatMap((item) => item.categories));
  return seen.size;
}

function progress(label: string): (done: number, total: number) => void {
  return (done, total) => {
    if (done !== total && done % 50 !== 0) return;
    stdout.write(`\r  ${label}: ${done}/${total}   `);
    if (done === total) stdout.write("\n");
  };
}

async function main(): Promise<void> {
  const isUseCache = !argv.includes("--no-cache");
  const cache = isUseCache ? diskCache(CACHE_DIR.pathname) : nullCache();
  await mkdir(CACHE_DIR, { recursive: true });

  stdout.write("Fetching README...\n");
  const readme = await fetch(README_URL);
  const markdown = await readme.text();
  const rows = parseReadme(markdown);
  const entries = mergeEntries(rows);
  stdout.write(
    `  ${rows.length} rows -> ${entries.length} unique repos, ` +
      `${categoryCount(entries)} categories\n`,
  );

  stdout.write("Fetching GitHub metadata...\n");
  const github = await fetchGithub(
    entries.map((entry) => entry.id),
    { cache, fetchImpl: fetch, onProgress: progress("repos"), token: githubToken() },
  );

  // Every server is probed, not only the ~55% whose README entry links a badge:
  // Glama grades many it is not linked from (upstash/context7 is A/A/B with no
  // badge in the list), and reporting those as "not indexed" would hide them
  // from the triple-A filter. A linked badge wins over a derived URL because
  // the Glama namespace does not always match the GitHub owner.
  stdout.write("Fetching Glama badges (all servers, derived where unlinked)...\n");
  const badgeTargets = entries.map((entry) => {
  	return {
	    badgeUrl: entry.badgeUrl ?? derivedBadgeUrl(entry.owner, entry.repo),
	    id: entry.id,
	  };
  });
  const badges = await fetchBadges(badgeTargets, {
    cache,
    fetchImpl: fetch,
    onProgress: progress("badges"),
  });

  const overridesFile = JSON.parse(await readFile(OVERRIDES, "utf8")) as {
    servers: Overrides;
  };
  const overrides = overridesFile.servers;
  const servers = mergeAll(entries, github, badges, overrides);

  await writeFile(OUT, `${JSON.stringify(servers)}\n`, "utf8");
  report(servers, github, badges, overrides);
}

function report(
  servers: ReturnType<typeof mergeAll>,
  github: Awaited<ReturnType<typeof fetchGithub>>,
  badges: Awaited<ReturnType<typeof fetchBadges>>,
  overrides: Overrides,
): void {
  const count = (isMatch: (s: (typeof servers)[number]) => boolean): number =>
    servers.filter((server) => isMatch(server)).length;
  const pct = (x: number): string => `${((x / servers.length) * 100).toFixed(1)}%`;

  const tripleA = servers.filter(
    (s) => {
    	return s.glama?.license === "A" &&
      s.glama.quality === "A" &&
      s.glama.maintenance === "A";
    },
  );
  const unknownGlyphs = badges.filter((b) => b.unknownGlyph === true);
  const ghFailures = github.filter((g) => g.facts === null);
  const oddLicenses = new Set(
    servers.flatMap((s) => {
    	return s.gh !== null && isUnrecognisedLicense(s.gh.spdx) && s.gh.spdx !== null
        ? [s.gh.spdx]
        : [];
    },
    ),
  );

  const lines = [
    "",
    "=".repeat(64),
    `servers            ${servers.length}`,
    `official           ${count((s) => s.official)}`,
    `categories         ${categoryCount(servers)}`,
    "",
    `github ok          ${github.length - ghFailures.length} (${ghFailures.length} unreadable)`,
    `foss / not / ?     ${count((s) => s.gh?.isFoss === "yes")} / ${count((s) => s.gh?.isFoss === "no")} / ${count((s) => s.gh?.isFoss === "unknown")}`,
    `archived           ${count((s) => s.gh?.archived === true)}`,
    "",
    `glama indexed      ${count((s) => s.glama !== null)} (${pct(count((s) => s.glama !== null))})`,
    `  fully graded     ${count((s) => s.glama !== null && Object.keys(s.glama).length === 3)}`,
    `  partially graded ${count((s) => s.glama !== null && Object.keys(s.glama).length > 0 && Object.keys(s.glama).length < 3)}`,
    `  TRIPLE A         ${tripleA.length}`,
    "",
    `cost inferred      free ${count((s) => s.cost.value === "likely-free")} / paid ${count((s) => s.cost.value === "likely-paid")} / unknown ${count((s) => s.cost.value === "unknown")}`,
    `rate-limit inferred yes ${count((s) => s.rateLimited.value === "yes")} / no ${count((s) => s.rateLimited.value === "no")} / unknown ${count((s) => s.rateLimited.value === "unknown")}`,
    `overrides applied  ${Object.keys(overrides).length}`,
    "=".repeat(64),
  ];
  stdout.write(`${lines.join("\n")}\n`);

  if (oddLicenses.size > 0) {
    stdout.write(
      `\nUnclassified SPDX ids (extend classify.ts to resolve): ${[...oddLicenses].join(", ")}\n`,
    );
  }

  stdout.write("\nSample of triple-A servers:\n");
  for (const s of tripleA.slice(0, 5)) {
    stdout.write(`  ${s.id}  ${s.gh?.stars ?? "?"}* ${s.gh?.spdx ?? "no licence"}\n`);
  }

  // A changed badge format must fail the build, not quietly empty the filter.
  if (unknownGlyphs.length > 0) {
    stderr.write(
      `\nFAIL: ${unknownGlyphs.length} badges used an unknown glyph. ` +
        "Glama's badge format has probably changed; see decode-badge.ts.\n",
    );
    for (const b of unknownGlyphs.slice(0, 3)) stderr.write(`  ${b.id}: ${b.reason}\n`);
    exit(1);
  }
}

await main();
