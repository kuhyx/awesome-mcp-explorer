/**
 * Turns raw facts into the derived fields the UI filters on.
 *
 * Two of these — cost and rate-limiting — are **inferences, not data**. Neither
 * the awesome-mcp-servers README nor Glama publishes them anywhere. Rather than
 * fabricate a filter that looks authoritative, everything here is conservative,
 * tagged with its provenance, and correctable via `data/overrides.json`.
 */
import type { Cost, Tri } from "../../src/lib/server.ts";
import type { Scope } from "./parse-readme.ts";

/**
 * SPDX ids that are free/open-source.
 *
 * An id absent from both this list and {@link NON_FOSS_LICENSES} classifies as
 * `unknown` rather than being guessed either way — the build report prints
 * unrecognised ids so the lists can be extended deliberately.
 */
const FOSS_LICENSES = new Set([
  "0BSD",
  "AGPL-3.0",
  "Apache-2.0",
  "Artistic-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BSL-1.0",
  "CC0-1.0",
  "CC-BY-SA-4.0",
  "EPL-2.0",
  "EUPL-1.2",
  "GPL-2.0",
  "GPL-3.0",
  "ISC",
  "LGPL-2.1",
  "LGPL-3.0",
  "MIT",
  "MIT-0",
  "MPL-2.0",
  "MulanPSL-2.0",
  "Unlicense",
  "WTFPL",
  "Zlib",
]);

/**
 * Licences that restrict use enough not to count as free/open-source.
 *
 * These are "source available": readable, sometimes forkable, but with field-of-use
 * or competition restrictions that fail the OSI definition. PolyForm appears in
 * this list for real — it is not hypothetical.
 */
const NON_FOSS_LICENSES = new Set([
  "BUSL-1.1",
  "CC-BY-NC-4.0",
  "CC-BY-NC-SA-4.0",
  "Elastic-2.0",
  "PolyForm-Noncommercial-1.0.0",
  "PolyForm-Shield-1.0.0",
  "PolyForm-Small-Business-1.0.0",
  "SSPL-1.0",
]);

/**
 * GitHub's marker for "there is a licence file but we cannot identify it".
 */
const UNIDENTIFIED_LICENSE = "NOASSERTION";

/**
 * Classifies a repo's licence as free/open-source.
 *
 * @param spdx GitHub's `license.spdx_id`, or null when the repo has no licence
 * file at all.
 */
export function classifyFoss(spdx: null | string): Tri {
  // No licence file means default copyright: all rights reserved, and no right
  // to use, copy or modify. That is a definite "not free", distinct from the
  // "we could not tell" of NOASSERTION.
  if (spdx === null || spdx === "NONE") return "no";
  if (spdx === UNIDENTIFIED_LICENSE) return "unknown";
  if (FOSS_LICENSES.has(spdx)) return "yes";
  if (NON_FOSS_LICENSES.has(spdx)) return "no";
  return "unknown";
}

/**
 * True when the repo is known to GitHub but carries no recognised licence id.
 */
export function isUnrecognisedLicense(spdx: null | string): boolean {
  return (
    spdx !== null &&
    spdx !== "NONE" &&
    spdx !== UNIDENTIFIED_LICENSE &&
    !FOSS_LICENSES.has(spdx) &&
    !NON_FOSS_LICENSES.has(spdx)
  );
}

/**
 * Phrases stating the server needs no credential, hence costs nothing to call.
 *
 * These are checked **before** the paid signals, because they contain them:
 * "no api key" contains "api key". 120 entries say "no api key" against 188
 * that mention "api key" at all, so getting this order wrong would invert the
 * answer for the majority of entries that address the question explicitly.
 */
const FREE_PHRASES = [
  "no api key",
  "no api-key",
  "no key",
  "no auth",
  "without an api key",
  "no credentials",
  "no account",
  "fully local",
  "local-only",
  "offline",
  "self-hosted",
  "free tier",
  "free to use",
  "completely free",
];

/**
 * Phrases implying a paid product.
 *
 * Deliberately excludes payment vocabulary such as "usd", "payment", "billing"
 * and "micropayments": 92 entries mention "usd" and 88 "payment" because they
 * are fintech and crypto servers — that describes what the server *does*, not
 * what it costs. `forgemeshlabs/coinopai-mcp` ("x402 micropayments, USDC/Base")
 * is the canonical trap.
 */
const PAID_PHRASES = [
  "pricing",
  "subscription",
  "paid plan",
  "paid tier",
  "premium",
  "requires a licence",
  "requires a license",
  "commercial licence",
  "commercial license",
];

/**
 * Phrases that state an API key or account is needed.
 */
const CREDENTIAL_PHRASES = [
  "api key",
  "api-key",
  "api token",
  "access token",
  "requires an account",
  "oauth",
];

function hasAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * A repo that is local-only (🏠 without ☁️) runs against software you already have.
 */
function isLocalOnly(scope: readonly Scope[]): boolean {
  return scope.includes("local") && !scope.includes("cloud");
}

/**
 * Guesses whether a server costs money.
 *
 * The signal is weak by construction and the result is mostly `unknown` on
 * purpose: a confident-looking wrong answer is worse than an honest gap, and
 * the UI renders this field as `~likely paid` with an "inferred" tooltip.
 *
 * Order matters: free phrases win over paid ones because they are negations of
 * them ("no api key" contains "api key").
 */
export function inferCost(description: string, scope: readonly Scope[]): Cost {
  const text = description.toLowerCase();
  if (hasAny(text, FREE_PHRASES)) return "likely-free";
  if (hasAny(text, PAID_PHRASES)) return "likely-paid";
  // Needing a credential for a remote API is the best available proxy for a
  // metered product, but only for cloud servers: a local server may want an API
  // key for software running on your own machine and still be free.
  if (!isLocalOnly(scope) && hasAny(text, CREDENTIAL_PHRASES)) {
    return "likely-paid";
  }
  if (isLocalOnly(scope)) return "likely-free";
  return "unknown";
}

/**
 * Guesses whether a server is rate limited.
 *
 * Local-only servers talk to software on your own machine, which does not meter
 * you. Cloud servers behind a credential usually do. Everything else is
 * `unknown`.
 */
export function inferRateLimited(
  description: string,
  scope: readonly Scope[],
): Tri {
  const text = description.toLowerCase();
  if (text.includes("rate limit") || text.includes("rate-limit")) return "yes";
  if (hasAny(text, FREE_PHRASES) && isLocalOnly(scope)) return "no";
  if (isLocalOnly(scope)) return "no";
  if (hasAny(text, CREDENTIAL_PHRASES)) return "yes";
  return "unknown";
}
