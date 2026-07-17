/**
 * Parses punkpeye/awesome-mcp-servers' README into structured entries.
 *
 * The list is hand-maintained markdown, so the format is only *mostly*
 * consistent. Every rule below exists because a real entry violates the
 * obvious approach — see the marker scanner for the full catalogue.
 */

/** Languages the legend defines. */
export const LANGUAGES = [
  "typescript",
  "python",
  "go",
  "rust",
  "csharp",
  "java",
  "cpp",
  "ruby",
] as const;

export type Language = (typeof LANGUAGES)[number];

/**
 * Where the server runs. The legend calls this "scope"; it is the same axis as
 * "local vs cloud", not a separate one.
 */
export const SCOPES = ["cloud", "local", "embedded"] as const;

export type Scope = (typeof SCOPES)[number];

export const OPERATING_SYSTEMS = ["macos", "windows", "linux"] as const;

export type Os = (typeof OPERATING_SYSTEMS)[number];

/** One markdown bullet. A repo listed in several categories yields several. */
export interface RawEntry {
  /** Glama badge URL if the entry carries one, else null. */
  readonly badgeUrl: null | string;
  /** The `###` section the entry appeared under, e.g. "Browser Automation". */
  readonly category: string;
  readonly description: string;
  /** `owner/repo`, lowercased for stable joining against other sources. */
  readonly id: string;
  readonly languages: readonly Language[];
  readonly official: boolean;
  readonly os: readonly Os[];
  readonly owner: string;
  readonly repo: string;
  readonly scope: readonly Scope[];
  readonly url: string;
}

/** One repository, after merging every row that points at it. */
export interface MergedEntry extends Omit<RawEntry, "category"> {
  readonly categories: readonly string[];
}

/**
 * Marker emoji, keyed by their **base codepoint** with variation selectors and
 * the keycap suffix already removed.
 *
 * Normalising rather than matching literal emoji is essential:
 *   - `🎖️` is usually U+1F396 U+FE0F, but `line/line-bot-mcp-server` writes a
 *     bare U+1F396. Matching the literal string silently drops it.
 *   - `🪟` is the reverse: 963 entries use a bare U+1FA9F and exactly one adds
 *     U+FE0F. Matching the VS16 form would find one Windows server in 964.
 *   - `#️⃣` (C#) is U+0023 U+FE0F U+20E3. Two entries omit the U+20E3 keycap.
 *     After stripping both suffixes every variant collapses to `#`.
 */
const MARKERS = new Map<string, Marker>([
  ["\u{1F396}", { kind: "official" }],
  ["\u{1F4C7}", { kind: "language", value: "typescript" }],
  ["\u{1F40D}", { kind: "language", value: "python" }],
  ["\u{1F3CE}", { kind: "language", value: "go" }],
  ["\u{1F980}", { kind: "language", value: "rust" }],
  ["#", { kind: "language", value: "csharp" }],
  ["\u{2615}", { kind: "language", value: "java" }],
  ["\u{1F30A}", { kind: "language", value: "cpp" }],
  ["\u{1F48E}", { kind: "language", value: "ruby" }],
  ["\u{2601}", { kind: "scope", value: "cloud" }],
  ["\u{1F3E0}", { kind: "scope", value: "local" }],
  ["\u{1F4DF}", { kind: "scope", value: "embedded" }],
  ["\u{1F34E}", { kind: "os", value: "macos" }],
  ["\u{1FA9F}", { kind: "os", value: "windows" }],
  ["\u{1F427}", { kind: "os", value: "linux" }],
]);

type Marker =
  | { kind: "language"; value: Language }
  | { kind: "official" }
  | { kind: "os"; value: Os }
  | { kind: "scope"; value: Scope };

// The quantifiers below are bounded rather than open-ended. `[^\]]*]` looks
// harmless but is quadratic: when the closing bracket is missing the engine
// retries every shorter prefix, and the `g` flag repeats that at every start
// position. Bounding the repeat makes the work linear in the input and removes
// the ReDoS class entirely.
//
// The caps are ~3x the real maxima measured across all 2,997 entries: the
// longest link title is 61 chars, the longest parenthesised URL 211.
const MAX_LINK_TEXT = 200;
const MAX_URL = 400;

/** `[![alt](img)](href)` — a badge image wrapped in a link. */
const BADGE_IMAGE = new RegExp(
  String.raw`\[!\[[^\]]{0,${MAX_LINK_TEXT}}\]\([^)]{0,${MAX_URL}}\)\]\(([^)]{0,${MAX_URL}})\)`,
  "g",
);
/** `[text](href)` — an ordinary inline link. */
const INLINE_LINK = new RegExp(
  String.raw`\[([^\]]{0,${MAX_LINK_TEXT}})\]\(([^)]{0,${MAX_URL}})\)`,
  "g",
);
/** `### 🔗 <a name="anchor"></a>Category Name` */
const CATEGORY_PREFIX = "### ";
/** Leading `- [title](url)` of a list entry. */
const ENTRY_START = new RegExp(
  String.raw`^-\s+\[[^\]]{0,${MAX_LINK_TEXT}}\]\((https://github\.com/[^)]{1,${MAX_URL}})\)`,
);
/** Variation selectors and the keycap combining mark. */
const EMOJI_SUFFIXES = /[\u{FE0F}\u{20E3}]/gu;

/** Strips VS16/keycap so every spelling of a marker collapses to one form. */
function normalizeEmoji(text: string): string {
  return text.replaceAll(EMOJI_SUFFIXES, "");
}

/** Category headings carry a decorative emoji and an anchor tag; drop both. */
function cleanCategory(heading: string): string {
  return heading
    .replaceAll(/<a\s+name="[^"]*"><\/a>/g, "")
    .replaceAll(/[\p{Extended_Pictographic}\u{FE0F}]/gu, "")
    .trim();
}

/**
 * Extracts the marker emoji that precede an entry's description.
 *
 * Deliberately does **not** look for a separator, because there is no reliable
 * one: entries variously use ` - `, `- `, ` – ` (en dash), or no separator at
 * all. Instead it consumes the leading run and stops at the first word
 * character, which is where prose always begins.
 *
 * It must also tolerate, all of which occur in the real list:
 *   - `🏠/☁️`     slash-joined markers meaning *both* apply
 *   - `- 🎖️🏎️☁️` a stray leading dash, and markers with no spaces between them
 *   - `🔒 ☁️`     emoji that are not in the legend at all (skipped, not fatal)
 */
function scanMarkers(text: string): Marker[] {
  const found: Marker[] = [];
  for (const char of normalizeEmoji(text)) {
    const marker = MARKERS.get(char);
    if (marker !== undefined) {
      found.push(marker);
      continue;
    }
    // A letter or digit means the description has started; everything before it
    // (spaces, slashes, dashes, unknown emoji) is marker-zone noise to skip.
    if (/\p{Letter}|\p{Number}/u.test(char)) break;
  }
  return found;
}

/** Strips markers and links, leaving the human description. */
function extractDescription(text: string): string {
  let rest = text.replaceAll(BADGE_IMAGE, "");
  // Keep link *text* — descriptions like "mcp server for [cert-manager](url)"
  // read as nonsense if the anchor text is dropped along with the href.
  rest = rest.replaceAll(INLINE_LINK, "$1");
  rest = normalizeEmoji(rest);
  let index = 0;
  for (const char of rest) {
    if (/\p{Letter}|\p{Number}/u.test(char) && !MARKERS.has(char)) break;
    index += char.length;
  }
  return rest
    .slice(index)
    .replace(/^[\s\-–—:·]+/, "")
    .trim();
}

/** Pulls the Glama badge href out of an entry, if present. */
function extractBadgeUrl(line: string): null | string {
  for (const match of line.matchAll(BADGE_IMAGE)) {
    const href = match[1];
    if (href?.includes("glama.ai/mcp/servers") === true) {
      // Normalise the two spellings Glama uses: /servers/@owner/repo and
      // /servers/owner/repo both address the same server.
      return href.replace("/servers/@", "/servers/");
    }
  }
  return null;
}

/**
 * Parses the README markdown into one entry per listed GitHub repository.
 *
 * Only content under `## Server Implementations` is considered: the Clients,
 * Tutorials and Legend sections also contain bullet lists and emoji, and the
 * Legend in particular contains every marker exactly once, which would poison
 * any whole-document counting.
 */
export function parseReadme(markdown: string): RawEntry[] {
  const entries: RawEntry[] = [];
  let category = "";
  let isInServerSection = false;

  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) {
      isInServerSection = line.includes("Server Implementations");
      continue;
    }
    if (!isInServerSection) continue;

    if (line.startsWith(CATEGORY_PREFIX)) {
      category = cleanCategory(line.slice(CATEGORY_PREFIX.length));
      continue;
    }

    // `matched` is undefined for every non-entry line; `url` cannot be
    // undefined once matched, but noUncheckedIndexedAccess types it that way.
    const [matched, url] = ENTRY_START.exec(line) ?? [];
    if (matched === undefined || url === undefined) continue;

    // ENTRY_START only guarantees a github.com URL, not that it names a repo:
    // a bare `https://github.com/owner` link reaches here and has no repo.
    const slug = parseRepoUrl(url);
    if (slug === null) continue;

    const rest = line.slice(matched.length);
    const markers = scanMarkers(rest.replaceAll(BADGE_IMAGE, ""));

    entries.push({
      badgeUrl: extractBadgeUrl(line),
      category,
      description: extractDescription(rest),
      id: `${slug.owner}/${slug.repo}`.toLowerCase(),
      languages: dedupe(
        markers.flatMap((m) => (m.kind === "language" ? [m.value] : [])),
      ),
      official: markers.some((m) => m.kind === "official"),
      os: dedupe(markers.flatMap((m) => (m.kind === "os" ? [m.value] : []))),
      owner: slug.owner,
      repo: slug.repo,
      scope: dedupe(
        markers.flatMap((m) => (m.kind === "scope" ? [m.value] : [])),
      ),
      url,
    });
  }

  return entries;
}

/**
 * Merges every row that points at the same repository into one entry.
 *
 * Duplicates are not mistakes in the source: they are monorepos. The extreme
 * case is `modelcontextprotocol/servers-archived`, listed 9 times across 8
 * categories, whose rows disagree about language because each row describes a
 * *different sub-server inside the same repo* (one TypeScript, one Python).
 *
 * So the merge is a union rather than a first-wins pick — keeping only the
 * first row would drop 8 of that repo's 9 categories, and a "Databases" filter
 * would fail to find it. Repo-level identity is the right grain here because
 * both enrichment sources (GitHub, Glama) are themselves repo-scoped.
 *
 * The description and badge come from the first row that has one; they describe
 * the repo as a whole closely enough, and concatenating them reads as noise.
 */
export function mergeEntries(rows: readonly RawEntry[]): MergedEntry[] {
  const byId = new Map<string, MergedEntry>();

  for (const row of rows) {
    const existing = byId.get(row.id);
    if (existing === undefined) {
      const { category, ...rest } = row;
      byId.set(row.id, { ...rest, categories: [category] });
      continue;
    }
    byId.set(row.id, {
      ...existing,
      badgeUrl: existing.badgeUrl ?? row.badgeUrl,
      categories: dedupe([...existing.categories, row.category]),
      description:
        existing.description === "" ? row.description : existing.description,
      languages: dedupe([...existing.languages, ...row.languages]),
      official: existing.official || row.official,
      os: dedupe([...existing.os, ...row.os]),
      scope: dedupe([...existing.scope, ...row.scope]),
    });
  }

  return byId.values().toArray();
}

/** Splits a GitHub URL into owner/repo, ignoring deep links and `.git`. */
export function parseRepoUrl(url: string): null | { owner: string; repo: string } {
  const match = /^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)/.exec(url);
  const owner = match?.[1];
  const repo = match?.[2];
  if (owner === undefined || repo === undefined) return null;
  return { owner, repo: repo.replace(/\.git$/, "") };
}

function dedupe<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
