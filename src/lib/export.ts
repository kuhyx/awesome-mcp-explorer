/**
 * Exports the filtered set as JSON, CSV or Markdown.
 *
 * The point of a power-user filter is usually to *do* something with the
 * result: paste a shortlist into a doc, diff two queries, feed a script.
 */
import type { Server } from "./server.ts";

export type ExportFormat = "csv" | "json" | "markdown";

const COLUMNS = [
  "id",
  "url",
  "official",
  "categories",
  "languages",
  "scope",
  "os",
  "license",
  "foss",
  "stars",
  "pushed",
  "archived",
  "license_grade",
  "quality_grade",
  "maintenance_grade",
  "cost",
  "cost_source",
  "rate_limited",
  "rate_limited_source",
] as const;

function row(server: Server): readonly string[] {
  return [
    server.id,
    server.url,
    String(server.official),
    server.categories.join(";"),
    server.languages.join(";"),
    server.scope.join(";"),
    server.os.join(";"),
    server.gh?.spdx ?? "",
    server.gh?.isFoss ?? "",
    server.gh === null ? "" : String(server.gh.stars),
    server.gh?.pushedAt ?? "",
    server.gh === null ? "" : String(server.gh.archived),
    server.glama?.license ?? "",
    server.glama?.quality ?? "",
    server.glama?.maintenance ?? "",
    server.cost.value,
    server.cost.source,
    server.rateLimited.value,
    server.rateLimited.source,
  ];
}

/**
 * RFC 4180 quoting: wrap in quotes and double any embedded quote.
 */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function toCsv(servers: readonly Server[]): string {
  const lines = [
    COLUMNS.join(","),
    ...servers.map((s) => row(s).map((cell) => csvCell(cell)).join(",")),
  ];
  return lines.join("\n");
}

/**
 * Escapes the pipe that would otherwise break out of a Markdown table cell.
 */
function mdCell(value: string): string {
  return value.replaceAll("|", String.raw`\|`);
}

function toMarkdown(servers: readonly Server[]): string {
  const header = ["Server", "Grades", "Stars", "Licence", "Scope", "Description"];
  const lines = [
    `| ${header.join(" | ")} |`,
    `|${header.map(() => "---").join("|")}|`,
    ...servers.map((s) => {
      const grades =
        s.glama === null
          ? "not indexed"
          : [s.glama.license, s.glama.quality, s.glama.maintenance]
              .map((g) => g ?? "–")
              .join("/");
      return `| [${mdCell(s.id)}](${s.url}) | ${grades} | ${s.gh?.stars ?? "?"} | ${
        s.gh?.spdx ?? "none"
      } | ${s.scope.join("/")} | ${mdCell(s.description)} |`;
    }),
  ];
  return lines.join("\n");
}

export function exportServers(
  servers: readonly Server[],
  format: ExportFormat,
): string {
  switch (format) {
    case "csv": {
      return toCsv(servers);
    }
    case "json": {
      return JSON.stringify(servers, null, 2);
    }
    case "markdown": {
      return toMarkdown(servers);
    }
  }
}

export const MIME_TYPES: Readonly<Record<ExportFormat, string>> = {
  csv: "text/csv",
  json: "application/json",
  markdown: "text/markdown",
};

export const FILE_EXTENSIONS: Readonly<Record<ExportFormat, string>> = {
  csv: "csv",
  json: "json",
  markdown: "md",
};
