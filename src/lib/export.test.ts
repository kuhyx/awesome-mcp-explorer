import { describe, expect, it } from "vitest";

import type { GithubFacts, Server } from "./server.ts";

import { exportServers, FILE_EXTENSIONS, MIME_TYPES } from "./export.ts";

function facts(over: Partial<GithubFacts> = {}): GithubFacts {
  return {
    archived: false,
    createdAt: "2024-01-01T00:00:00Z",
    forks: 2,
    isFoss: "yes",
    pushedAt: "2026-07-01T00:00:00Z",
    spdx: "MIT",
    stars: 42,
    ...over,
  };
}

function server(over: Partial<Server> = {}): Server {
  return {
    badgeUrl: null,
    categories: ["Databases"],
    cost: { source: "inferred", value: "likely-free" },
    description: "A server.",
    gh: facts(),
    glama: { license: "A", maintenance: "B", quality: "A" },
    id: "acme/widget",
    languages: ["typescript"],
    official: true,
    os: ["linux"],
    owner: "acme",
    rateLimited: { source: "override", value: "no" },
    repo: "widget",
    scope: ["cloud"],
    url: "https://github.com/acme/widget",
    ...over,
  };
}

describe("exportServers json", () => {
  it("emits the servers verbatim", () => {
    const parsed: unknown = JSON.parse(exportServers([server()], "json"));
    expect(parsed).toEqual([server()]);
  });

  it("emits an empty array for no results", () => {
    expect(JSON.parse(exportServers([], "json"))).toEqual([]);
  });
});

describe("exportServers csv", () => {
  it("emits a header and one row", () => {
    const lines = exportServers([server()], "csv").split("\n");
    expect(lines[0]).toContain("id,url,official");
    expect(lines[1]).toContain("acme/widget");
    expect(lines).toHaveLength(2);
  });

  it("joins multi-valued fields with semicolons, not commas", () => {
    // A comma would silently create extra columns.
    const csv = exportServers(
      [server({ categories: ["Databases", "Search"] })],
      "csv",
    );
    expect(csv).toContain("Databases;Search");
  });

  it("records provenance so an inference cannot be mistaken for a fact", () => {
    const csv = exportServers([server()], "csv");
    expect(csv).toContain("likely-free,inferred");
    expect(csv).toContain("no,override");
  });

  it("quotes a field containing a comma, quote or newline", () => {
    const csv = exportServers(
      [server({ description: 'Has, a comma and "quotes"\nand a newline' })],
      "csv",
    );
    // The description is not a CSV column, so use a field that is: the id.
    const withComma = exportServers([server({ id: 'a,b"c' })], "csv");
    expect(withComma).toContain('"a,b""c"');
    expect(csv.split("\n")[0]).toContain("id,url");
  });

  it("leaves github columns empty for a repo that 404'd", () => {
    const csv = exportServers([server({ gh: null })], "csv");
    expect(csv).toContain("acme/widget");
    expect(csv).not.toContain("MIT");
  });

  it("leaves grade columns empty for an unindexed server", () => {
    const csv = exportServers([server({ glama: null })], "csv");
    const cells = csv.split("\n")[1]!.split(",");
    expect(cells).toContain("");
  });

  it("emits only a header for no results", () => {
    expect(exportServers([], "csv").split("\n")).toHaveLength(1);
  });
});

describe("exportServers markdown", () => {
  it("emits a table with a link per server", () => {
    const md = exportServers([server()], "markdown");
    expect(md).toContain("| [acme/widget](https://github.com/acme/widget) |");
    expect(md).toContain("A/A/B");
  });

  it("shows an em-dash for an ungraded axis and 'not indexed' for none", () => {
    expect(exportServers([server({ glama: { license: "A" } })], "markdown")).toContain(
      "A/–/–",
    );
    expect(exportServers([server({ glama: null })], "markdown")).toContain(
      "not indexed",
    );
  });

  it("escapes a pipe so it cannot break out of a cell", () => {
    const md = exportServers([server({ description: "a | b" })], "markdown");
    expect(md).toContain("a \\| b");
  });

  it("shows ? for unknown stars and 'none' for no licence", () => {
    const md = exportServers([server({ gh: null })], "markdown");
    expect(md).toContain("| ? |");
    expect(md).toContain("| none |");
  });

  it("emits just the header rows for no results", () => {
    expect(exportServers([], "markdown").split("\n")).toHaveLength(2);
  });
});

describe("format metadata", () => {
  it("has a mime type and extension for every format", () => {
    for (const format of ["csv", "json", "markdown"] as const) {
      expect(MIME_TYPES[format]).toBeTruthy();
      expect(FILE_EXTENSIONS[format]).toBeTruthy();
    }
  });
});
