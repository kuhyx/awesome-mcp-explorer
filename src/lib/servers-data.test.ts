import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterAll, describe, expect, it } from "vitest";

import { SERVERS } from "../test/fixtures.ts";
import { parseServers } from "./parse-servers.ts";
import { buildHomeModel, readServersFile } from "./servers-data.ts";

const directory = mkdtempSync(`${tmpdir()}/amx-servers-`);
afterAll(() => {
  rmSync(directory, { force: true, recursive: true });
});

describe("parseServers", () => {
  it("accepts a list of servers", () => {
    expect(parseServers(SERVERS)).toHaveLength(SERVERS.length);
  });

  it("rejects anything else with a readable error", () => {
    expect(() => parseServers({ servers: [] })).toThrow("not a list of servers");
    expect(() => parseServers([{ id: "a/b" }])).toThrow("not a list of servers");
    expect(() => parseServers([null])).toThrow("not a list of servers");
  });
});

describe("readServersFile", () => {
  it("reads and validates the dataset", () => {
    const path = `${directory}/servers.json`;
    writeFileSync(path, JSON.stringify(SERVERS));
    expect(readServersFile(path)).toHaveLength(SERVERS.length);
  });

  it("treats a missing file as an empty list, as CI has no dataset", () => {
    expect(readServersFile(`${directory}/absent.json`)).toEqual([]);
  });

  it("does not hide other read errors", () => {
    expect(() => readServersFile(directory)).toThrow();
  });

  it("fails on a malformed file rather than shipping a half-empty page", () => {
    const path = `${directory}/bad.json`;
    writeFileSync(path, '{"not":"a list"}');
    expect(() => readServersFile(path)).toThrow("not a list of servers");
  });

  it("defaults to the committed path", () => {
    expect(Array.isArray(readServersFile())).toBe(true);
  });
});

describe("buildHomeModel", () => {
  const model = buildHomeModel(SERVERS);

  it("orders rows like the default view: most stars first", () => {
    expect(model.rows.map((s) => s.id)).toEqual([
      "acme/ddd-server",
      "acme/ccc-server",
      "acme/aaa-server",
      "acme/bbb-server",
      "acme/eee-server",
    ]);
    expect(model.total).toBe(5);
  });

  it("derives categories, distributions and counts", () => {
    expect(model.categories).toEqual(["Databases", "Search & Data Extraction"]);
    expect(model.stars).toEqual([50, 500, 1500, 12_000]);
    expect(model.pushed).toHaveLength(4);
    expect(model.facets.official).toBe(1);
    expect(model.facets.tripleA).toBe(1);
    expect(model.ungraded).toBe(2);
  });

  it("copes with an empty dataset", () => {
    const empty = buildHomeModel([]);
    expect(empty.rows).toEqual([]);
    expect(empty.total).toBe(0);
  });
});
