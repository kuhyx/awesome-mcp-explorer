/**
 * The URL filter reference page.
 *
 * Every value list is read from the constants the app's URL codec
 * (src/lib/url-state.ts) and the README parser validate against, so the page
 * cannot document a language, grade or sort key the app does not accept.
 */
import type { Page } from "./pages.ts";

import { GRADE_AXES, GRADES } from "../../../src/lib/grade.ts";
import { COSTS, SORT_KEYS, TRIS } from "../../../src/lib/url-state.ts";
import { LANGUAGES, OPERATING_SYSTEMS, SCOPES } from "../parse-readme.ts";

function values(list: readonly string[]): string {
  return list.map((value) => `\`${value}\``).join(", ");
}

export const FILTERS_PAGE: Page = {
  blocks: [
    {
      kind: "paragraph",
      text: "The explorer keeps its whole state in the query string. Only non-default values are written, unknown parameters are ignored, and a malformed value falls back to the default rather than failing.",
    },
    { kind: "heading", text: "Tri-state lists" },
    {
      kind: "paragraph",
      text: "List parameters take comma-separated values. A bare value includes, a value prefixed with `!` excludes: `lang=rust,go,!python` is Rust or Go, but not Python.",
    },
    {
      items: [
        `\`lang\`: ${values(LANGUAGES)}`,
        `\`scope\`: ${values(SCOPES)}`,
        `\`os\`: ${values(OPERATING_SYSTEMS)}`,
        `\`foss\`, \`rl\` (rate limited): ${values(TRIS)}`,
        `\`cost\`: ${values(COSTS)}`,
        "`cat`: category names from the upstream README, percent-encoded",
      ],
      kind: "list",
    },
    { kind: "heading", text: "Grades" },
    {
      items: [
        "`aaa=1`: only servers graded A on every axis",
        `\`min\`: minimum grade per axis as \`axis:grade\`, axes ${values(GRADE_AXES)}, grades ${values(GRADES)}`,
        "`cov`: grade coverage, `graded-all`, `graded-partial` or `not-indexed`",
      ],
      kind: "list",
    },
    { kind: "heading", text: "Other filters" },
    {
      items: [
        "`q`: fuzzy search over name, owner and description",
        "`official=1`: only servers marked official upstream",
        "`live=1`: hide archived repositories",
        "`minStars`, `maxStars`: GitHub star bounds",
        "`since`: last push at or after this time, in epoch milliseconds",
      ],
      kind: "list",
    },
    { kind: "heading", text: "Sorting" },
    {
      kind: "paragraph",
      text: `\`sort\`: ${values(SORT_KEYS)}. \`dir\`: \`asc\` or \`desc\`.`,
    },
    { kind: "heading", text: "Example" },
    { kind: "code", lang: "text", text: "?aaa=1&min=maintenance:B&lang=rust,go&os=!windows&sort=stars&dir=desc" },
    {
      kind: "paragraph",
      text: "Open it on the [explorer]() by appending the query string to its address.",
    },
  ],
  description: "Every query parameter the explorer reads, and the values it accepts.",
  path: "filters/",
  title: "URL filter reference",
};
