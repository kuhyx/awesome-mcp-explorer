/**
 * Decodes a Glama `score.svg` badge into its three letter grades.
 *
 * ## Why this file exists
 *
 * Glama publishes per-server quality grades, but not anywhere convenient:
 *   - the public REST API (`/api/mcp/v1/servers/...`) does not return them at
 *     all, and `robots.txt` disallows `/api/` for crawlers anyway;
 *   - the server page renders them only as styled `<div>`s with hashed class
 *     names, and its markup omits the license grade entirely.
 *
 * The badge is the one surface designed to be consumed by third parties — the
 * awesome-mcp-servers README already hotlinks it — and it is both the smallest
 * (~4 KB vs ~85 KB) and the most complete source, carrying all three axes.
 *
 * ## The encoding
 *
 * The badge draws each grade as a `<use>` referencing a glyph outline defined
 * in the same file:
 *
 * ```xml
 * <use href="#g0" x="12" y="13" fill="#37a169"/>   <- license:     A
 * <use href="#g1" x="25" y="13" fill="#555"/>      <- quality:     ungraded
 * <use href="#g2" x="35" y="13" fill="#f5a623"/>   <- maintenance: C
 * <use href="#g3" x="74" y="13"/>                  <- "glama" wordmark
 * ...
 * <path id="g0" d="M.27 0l2.73-8h2.14l2.81 8h..."/>
 * ```
 *
 * Two traps, both of which cost real debugging time:
 *
 * 1. **Glyph ids are positional, not a letter code.** `gN` is simply the Nth
 *    *distinct* glyph in that file, so `g0` means `A` in one badge and `C` in
 *    another. The only stable key is the `d` outline itself.
 *
 * 2. **A dash is not a modifier — it means "ungraded".** A grey (`#555`) dash
 *    in a slot means Glama never graded that axis. Verified against the
 *    rendered pages: Muvon/octocode and sooperset/mcp-atlassian both draw a
 *    dash in the quality slot, and neither page shows a quality grade at all.
 *    Reading it as `A-` (as the naive interpretation does) invents a grade that
 *    does not exist anywhere in Glama's scale.
 *
 * Grade slots are exactly the `<use>` elements carrying a `fill`; the trailing
 * five spell "glama" and inherit their colour. Slots are always all-or-nothing:
 * three of them, or none when the server is not indexed.
 */
import type { Grade, Grades } from "../../src/lib/grade.ts";

import { GRADE_AXES } from "../../src/lib/grade.ts";

/**
 * Glyph outline (`d` attribute) to the character it draws.
 *
 * Keyed by the full `d` string: `C` and the wordmark's lowercase `g` differ
 * only from the third character onward (`M4.22.11q-1.06 0-1.91-.49` versus
 * `M4.23.11q-1.06 0-1.87-.5`), so prefix matching would confuse them.
 *
 * Sampled from 627 glyph definitions across 110 live badges. Any outline not
 * listed here is a hard error rather than a guess — see {@link decodeBadge}.
 */
const GLYPHS = new Map<string, "DASH" | Grade>([
  [
    "M.27 0l2.73-8h2.14l2.81 8h-1.82l-.61-1.86h-2.85l-.59 1.86Zm2.81-3.14h2.01l-.25-.72q-.18-.61-.39-1.33-.18-.72-.39-1.53-.2.83-.39 1.55-.19.7-.36 1.31Z",
    "A",
  ],
  [
    "M.72 0v-8h3.19q1.31 0 1.96.58.68.58.68 1.47 0 .72-.43 1.15-.4.44-1.01.57v.09q.44.01.84.25t.66.67q.25.42.25 1.02 0 .62-.31 1.12t-.94.8q-.61.28-1.5.28Zm1.64-1.34h1.42q.72 0 1.05-.28.34-.29.34-.74 0-.5-.37-.83t-.97-.33h-1.47Zm0-3.3h1.3q.53 0 .87-.28t.34-.77q.01-.43-.31-.7-.29-.28-.87-.28h-1.33Z",
    "B",
  ],
  [
    "M4.22.11q-1.06 0-1.91-.49-.83-.48-1.33-1.4-.48-.92-.48-2.22t.48-2.22q.5-.92 1.35-1.41.84-.48 1.89-.48.91 0 1.64.34t1.2.97q.49.63.61 1.53h-1.67q-.11-.65-.59-1.01-.47-.38-1.16-.38-.94 0-1.52.71-.56.68-.56 1.95 0 1.3.58 1.98t1.5.68q.69 0 1.16-.36.48-.38.61-1.03h1.65q-.09.73-.53 1.39-.44.64-1.17 1.04t-1.75.41Z",
    "C",
  ],
  [
    "M3.55 0h-2.83v-8h2.84q1.21 0 2.07.48t1.34 1.38q.47.89.47 2.14t-.47 2.14-1.34 1.38q-.88.48-2.08.48Zm-1.19-1.41h1.09q1.16 0 1.75-.62.61-.63.61-1.97t-.59-1.97-1.75-.62h-1.11Z",
    "D",
  ],
  [
    "M.72 0v-8h5.26v1.36h-3.62v2.23h3.28v1.33h-3.28v3.08Z",
    "F",
  ],
  [
    "M4.39-3.94v1.3h-3.64v-1.3Z",
    "DASH",
  ],
]);

/** Grey fill used for the "ungraded" dash. */
const UNGRADED_FILL = "#555";

/** `<use href="#gN" ... fill="#xxx"/>` — only graded slots carry a fill. */
const GRADE_USE = /<use\s+href="#(g\d+)"[^>]*\sfill="([^"]*)"/g;
/** `<path id="gN" d="..."/>` */
const GLYPH_DEF = /<path\s+id="(g\d+)"\s+d="([^"]*)"/g;

/** Thrown when a badge contains an outline that is not in {@link GLYPHS}. */
export class UnknownGlyphError extends Error {
  // Declared explicitly rather than as a parameter property: those emit runtime
  // assignments, which erasableSyntaxOnly forbids.
  readonly outline: string;

  constructor(outline: string, options?: ErrorOptions) {
    super(
      `Unrecognised glyph outline in Glama badge: ${outline.slice(0, 60)}...` +
        " The badge format has probably changed; extend GLYPHS in decode-badge.ts.",
      options,
    );
    this.name = "UnknownGlyphError";
    this.outline = outline;
  }
}

/**
 * Reads a mandatory capture group from a match.
 *
 * `matchAll` only yields successful matches and every group used here is
 * mandatory, so the value is always a string — but `noUncheckedIndexedAccess`
 * types it `string | undefined`. Throwing rather than defaulting keeps that
 * impossible case honest: a silent `?? ""` would be an untestable branch, and
 * defaulting a glyph id to empty would surface later as a confusing
 * "unknown glyph" instead of "the regex changed".
 */
export function group(match: RegExpExecArray, index: number): string {
  const value = match[index];
  if (value === undefined) {
    throw new Error(
      `Regex group ${index} did not participate in the match: ${match[0].slice(0, 40)}`,
    );
  }
  return value;
}

/**
 * Decodes a badge SVG into grades.
 *
 * Returns `null` when the badge has no grade slots at all, which is how Glama
 * renders a server it has not indexed (roughly 45% of the README's entries).
 * An axis whose slot holds a grey dash is omitted from the result: it is
 * "indexed but ungraded", which is distinct from "not indexed" — and both are
 * distinct from a bad grade.
 *
 * @throws {UnknownGlyphError} if a slot draws an outline this decoder does not
 * know. Failing loudly is deliberate: silently defaulting an unknown glyph to
 * some grade would corrupt the headline triple-A filter invisibly, and the
 * badge format carries no version to check.
 */
export function decodeBadge(svg: string): Grades | null {
  const outlines = new Map(
    svg.matchAll(GLYPH_DEF).map((match) => [group(match, 1), group(match, 2)]),
  );

  const slots = svg
    .matchAll(GRADE_USE)
    .map((match) => ({
      fill: group(match, 2),
      // A use may reference a glyph with no definition; "" then fails the
      // GLYPHS lookup below and raises UnknownGlyphError, which is right.
      outline: outlines.get(group(match, 1)) ?? "",
    }))
    .toArray();

  if (slots.length === 0) return null;

  const grades: Record<string, Grade> = {};
  for (const [index, slot] of slots.entries()) {
    const axis = GRADE_AXES[index];
    if (axis === undefined) break; // more slots than axes: ignore the extras

    const glyph = GLYPHS.get(slot.outline);
    if (glyph === undefined) throw new UnknownGlyphError(slot.outline);
    // A dash means the axis exists but was never graded; leave it absent.
    if (glyph === "DASH" || slot.fill === UNGRADED_FILL) continue;

    grades[axis] = glyph;
  }

  return grades;
}
